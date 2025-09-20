import React, { useState, useEffect } from 'react';
import { Button, Card, Space, Typography, Input, Slider, Divider, Modal, Tag } from 'antd';
import { ShoppingCartOutlined, DollarOutlined, ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons';
import styled from 'styled-components';
import axios from 'axios';

const { Title, Text } = Typography;

// Styled components (unchanged)
const Container = styled.div`
  position: relative;
  min-height: 400px;
  overflow: hidden;
`;

const SlideContainer = styled.div`
  display: flex;
  width: 200%;
  transform: translateX(${props => props.activeMenu === 'buy' ? '0%' : '-50%'});
  transition: transform 0.3s ease-in-out;
`;

const MenuPanel = styled.div`
  width: 50%;
  padding: 16px;
`;

const TabButton = styled(Button)`
  position: relative;
  border: none;
  background: ${props => props.active ? 'rgba(24, 144, 255, 0.1)' : 'transparent'} !important;
  color: ${props => props.active ? '#1890ff' : '#8c8c8c'} !important;
  font-weight: ${props => props.active ? '600' : '400'};
  
  &::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 0;
    width: 100%;
    height: 2px;
    background-color: ${props => props.active ? '#1890ff' : 'transparent'};
    transition: background-color 0.3s;
  }
  
  &:hover {
    color: #1890ff !important;
    background: rgba(24, 144, 255, 0.1) !important;
    
    &::after {
      background-color: #1890ff;
    }
  }
`;

const InfoBlock = styled.div`
  padding: 12px;
  background: #f9f9f9;
  border-radius: 8px;
  margin-bottom: 12px;
`;

const PositionCard = styled.div`
  padding: 12px;
  border: 1px solid #d9d9d9;
  border-radius: 8px;
  margin-bottom: 12px;
  background: white;
  cursor: pointer;
  transition: all 0.2s;
  
  &:hover {
    border-color: #1890ff;
    box-shadow: 0 2px 8px rgba(24, 144, 255, 0.1);
  }
  
  &.selected {
    border-color: #1890ff;
    background: #e6f7ff;
  }
`;

const TradeInterfaceBlue = () => {
  const [activeMenu, setActiveMenu] = useState('buy');
  const [prediction, setPrediction] = useState(null);
  const [betAmount, setBetAmount] = useState(1);
  const [modalVisible, setModalVisible] = useState(false);
  const [offerPrice, setOfferPrice] = useState(0.5);
  const [sellAmount, setSellAmount] = useState(0);
  const [sellPrice, setSellPrice] = useState(0);
  const [potentialProfit, setPotentialProfit] = useState(0);
  const [market, setMarket] = useState(null);
  const [user, setUser] = useState(null);
  const [purchasedContracts, setPurchasedContracts] = useState([]);
  const [selectedPosition, setSelectedPosition] = useState(null);
  const [sellProfit, setSellProfit] = useState({ usdt: 0, percent: 0 });
  const [error, setError] = useState(null);

  const userId = '1'; // Replace with actual user ID from auth system
  const marketId = '1'; // Hardcoded for the single market in the backend

  // Fetch user data
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await axios.get(`http://localhost:5000/api/user/${userId}`);
        setUser(response.data);
      } catch (err) {
        setError('Failed to fetch user data');
        console.error(err);
      }
    };
    fetchUser();
  }, []);

  // Fetch market data
  useEffect(() => {
    const fetchMarket = async () => {
      try {
        const response = await axios.get(`http://localhost:5000/api/market/${marketId}`);
        setMarket(response.data);
        setOfferPrice(response.data.yesPrice); // Set initial offer price to current yesPrice
      } catch (err) {
        setError('Failed to fetch market data');
        console.error(err);
      }
    };
    fetchMarket();
  }, []);

  // Fetch user positions
  useEffect(() => {
    const fetchPositions = async () => {
      try {
        const response = await axios.get(`http://localhost:5000/api/positions/${userId}`);
        setPurchasedContracts(response.data);
      } catch (err) {
        setError('Failed to fetch positions');
        console.error(err);
      }
    };
    fetchPositions();
  }, []);

  // Calculate potential profit for buying
  useEffect(() => {
    if (prediction && betAmount > 0) {
      const profit = (1 - offerPrice) * betAmount;
      setPotentialProfit(profit);
    } else {
      setPotentialProfit(0);
    }
  }, [prediction, betAmount, offerPrice]);

  // Calculate sell profit
  useEffect(() => {
    if (selectedPosition && sellPrice > 0) {
      const purchaseValue = selectedPosition.purchasePrice * selectedPosition.quantity;
      const sellValue = sellPrice * (sellAmount || selectedPosition.quantity);
      const profitUsdt = sellValue - purchaseValue;
      const profitPercent = purchaseValue ? ((sellValue - purchaseValue) / purchaseValue) * 100 : 0;
      
      setSellProfit({
        usdt: profitUsdt,
        percent: profitPercent
      });
    } else {
      setSellProfit({ usdt: 0, percent: 0 });
    }
  }, [selectedPosition, sellPrice, sellAmount]);

  const handleBuy = async () => {
    try {
      const response = await axios.post('http://localhost:5000/api/buy', {
        userId,
        marketId,
        type: prediction,
        quantity: betAmount,
        offerPrice
      });
      // Refresh positions and user data
      const [positionsResponse, userResponse] = await Promise.all([
        axios.get(`http://localhost:5000/api/positions/${userId}`),
        axios.get(`http://localhost:5000/api/user/${userId}`)
      ]);
      setPurchasedContracts(positionsResponse.data);
      setUser(userResponse.data);
      setModalVisible(false);
      setPrediction(null);
      setBetAmount(1);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to buy contracts');
      console.error(err);
    }
  };

  const handleSell = async () => {
    if (!selectedPosition) return;
    
    try {
      const response = await axios.post('http://localhost:5000/api/sell', {
        userId,
        positionId: selectedPosition.id,
        quantity: sellAmount || selectedPosition.quantity,
        sellPrice
      });
      // Refresh positions and user data
      const [positionsResponse, userResponse] = await Promise.all([
        axios.get(`http://localhost:5000/api/positions/${userId}`),
        axios.get(`http://localhost:5000/api/user/${userId}`)
      ]);
      setPurchasedContracts(positionsResponse.data);
      setUser(userResponse.data);
      setSelectedPosition(null);
      setSellAmount(0);
      setSellPrice(0);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to sell contracts');
      console.error(err);
    }
  };

  const handlePositionSelect = (position) => {
    setSelectedPosition(position);
    setSellAmount(position.quantity);
    setSellPrice(position.currentPrice);
  };

  return (
    <Card
      style={{
        maxWidth: 400,
        margin: '0 auto',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
        borderRadius: 12,
        borderTop: '3px solid #1890ff'
      }}
      bodyStyle={{ padding: 24 }}
    >
      {/* Display user balance */}
      {user && (
        <div style={{ marginBottom: 16, padding: 12, background: '#f0f8ff', borderRadius: 8 }}>
          <Text strong>Баланс: </Text>
          <Text>{user.balance.toFixed(2)} USDT</Text>
        </div>
      )}

      {/* Display error message */}
      {error && (
        <div style={{ marginBottom: 16, padding: 12, background: '#fff1f0', borderRadius: 8 }}>
          <Text type="danger">{error}</Text>
        </div>
      )}

      {/* Tab buttons */}
      <Space.Compact size="large" style={{ width: '100%', marginBottom: 24, background: '#f5f5f5', borderRadius: 6 }}>
        <TabButton
          active={activeMenu === 'buy'}
          size="large"
          style={{ flex: 1 }}
          icon={<ShoppingCartOutlined />}
          onClick={() => setActiveMenu('buy')}
        >
          Купить
        </TabButton>
        <TabButton
          active={activeMenu === 'sell'}
          size="large"
          style={{ flex: 1 }}
          icon={<DollarOutlined />}
          onClick={() => setActiveMenu('sell')}
        >
          Продать
        </TabButton>
      </Space.Compact>

      <Divider style={{ margin: '16px 0' }} />

      {/* Market info */}
      {market && (
        <div style={{ marginBottom: 16, padding: 12, background: '#f0f8ff', borderRadius: 8 }}>
          <Text strong>Контракт: </Text>
          <Text>{market.title}</Text>
        </div>
      )}

      <Container>
        <SlideContainer activeMenu={activeMenu}>
          {/* Buy panel */}
          <MenuPanel>
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <Title level={5} style={{ color: '#1890ff', margin: 0 }}>
                📈 Покупка контрактов
              </Title>

              <div>
                <Text type="secondary" style={{ fontSize: '12px', display: 'block', marginBottom: 8 }}>
                  Ваше предположение
                </Text>
                <Space.Compact style={{ width: '100%' }}>
                  <Button 
                    type={prediction === 'yes' ? 'primary' : 'default'}
                    style={{ 
                      flex: 1, 
                      backgroundColor: prediction === 'yes' ? '#52c41a' : undefined,
                      borderColor: prediction === 'yes' ? '#52c41a' : undefined
                    }}
                    onClick={() => setPrediction('yes')}
                  >
                    ДА
                  </Button>
                  <Button 
                    type={prediction === 'no' ? 'primary' : 'default'}
                    style={{ 
                      flex: 1,
                      backgroundColor: prediction === 'no' ? '#f5222d' : undefined,
                      borderColor: prediction === 'no' ? '#f5222d' : undefined
                    }}
                    onClick={() => setPrediction('no')}
                  >
                    НЕТ
                  </Button>
                </Space.Compact>
              </div>

              <div>
                <Text type="secondary" style={{ fontSize: '12px', display: 'block', marginBottom: 4 }}>
                  Количество контрактов: {betAmount}
                </Text>
                <Slider 
                  min={1} 
                  max={20} 
                  value={betAmount}
                  onChange={setBetAmount}
                  trackStyle={{ backgroundColor: '#1890ff' }}
                  handleStyle={{ borderColor: '#1890ff' }}
                />
              </div>

              <InfoBlock>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <Text type="secondary">Потенциальная прибыль:</Text>
                  <Text strong type="success">{potentialProfit.toFixed(2)} USDT</Text>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text type="secondary">Текущая цена:</Text>
                  <Text strong>{market ? (prediction === 'yes' ? market.yesPrice : market.noPrice).toFixed(2) : '0.00'} USDT</Text>
                </div>
              </InfoBlock>

              <Button 
                type="primary" 
                style={{ background: '#1890ff', borderColor: '#1890ff' }} 
                block
                onClick={() => setModalVisible(true)}
                disabled={!prediction || !market}
              >
                Предложить цену
              </Button>
            </Space>
          </MenuPanel>

          {/* Sell panel */}
          <MenuPanel>
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <Title level={5} style={{ color: '#1890ff', margin: 0 }}>
                📉 Продажа контрактов
              </Title>
              
              <Text type="secondary" style={{ fontSize: '12px', display: 'block', marginBottom: 8 }}>
                Выберите позицию для продажи:
              </Text>
              
              <div style={{ maxHeight: '200px', overflowY: 'auto', marginBottom: 16 }}>
                {purchasedContracts.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 16, background: '#f9f9f9', borderRadius: 8 }}>
                    <Text type="secondary">У вас нет купленных контрактов</Text>
                  </div>
                ) : (
                  purchasedContracts.map(contract => (
                    <PositionCard 
                      key={contract.id}
                      className={selectedPosition?.id === contract.id ? 'selected' : ''}
                      onClick={() => handlePositionSelect(contract)}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <Tag color={contract.type === 'yes' ? 'green' : 'red'}>
                            {contract.type === 'yes' ? 'ДА' : 'НЕТ'}
                          </Tag>
                          <Text strong>{contract.quantity} шт.</Text>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <Text type="secondary" style={{ fontSize: '12px' }}>
                            Куплено по: {contract.purchasePrice.toFixed(2)} USDT
                          </Text>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                            <Text strong>Текущая: {contract.currentPrice.toFixed(2)} USDT</Text>
                            {contract.currentPrice > contract.purchasePrice ? (
                              <ArrowUpOutlined style={{ color: '#52c41a', marginLeft: 4 }} />
                            ) : (
                              <ArrowDownOutlined style={{ color: '#f5222d', marginLeft: 4 }} />
                            )}
                          </div>
                        </div>
                      </div>
                    </PositionCard>
                  ))
                )}
              </div>
              
              {selectedPosition && (
                <>
                  <div>
                    <Text type="secondary" style={{ fontSize: '12px', display: 'block', marginBottom: 4 }}>
                      Количество для продажи (макс: {selectedPosition.quantity})
                    </Text>
                    <Input 
                      type="number" 
                      placeholder="0" 
                      value={sellAmount}
                      onChange={(e) => {
                        const value = Math.min(selectedPosition.quantity, parseInt(e.target.value) || 0);
                        setSellAmount(value);
                      }}
                      min={1}
                      max={selectedPosition.quantity}
                    />
                  </div>

                  <div>
                    <Text type="secondary" style={{ fontSize: '12px', display: 'block', marginBottom: 4 }}>
                      Цена продажи за контракт (USDT)
                    </Text>
                    <Input 
                      suffix="USDT" 
                      placeholder="0.00" 
                      value={sellPrice}
                      onChange={(e) => setSellPrice(parseFloat(e.target.value) || 0)}
                    />
                  </div>

                  <InfoBlock>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <Text type="secondary">Потенциальная прибыль:</Text>
                      <Text strong type={sellProfit.usdt >= 0 ? 'success' : 'danger'}>
                        {sellProfit.usdt.toFixed(2)} USDT
                      </Text>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Text type="secondary">Доходность:</Text>
                      <Text strong type={sellProfit.percent >= 0 ? 'success' : 'danger'}>
                        {sellProfit.percent.toFixed(1)}%
                      </Text>
                    </div>
                  </InfoBlock>

                  <Button 
                    type="primary" 
                    style={{ background: '#1890ff', borderColor: '#1890ff' }} 
                    block
                    onClick={handleSell}
                    disabled={sellAmount <= 0 || sellPrice <= 0}
                  >
                    Продать контракты
                  </Button>
                </>
              )}
            </Space>
          </MenuPanel>
        </SlideContainer>
      </Container>

      {/* Modal for offering price */}
      <Modal
        title="Предложить цену контракта"
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={[
          <Button key="cancel" onClick={() => setModalVisible(false)}>
            Отмена
          </Button>,
          <Button 
            key="buy" 
            type="primary" 
            style={{ background: '#1890ff', borderColor: '#1890ff' }}
            onClick={handleBuy}
          >
            Купить {betAmount} контрактов
          </Button>,
        ]}
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Text>Событие:</Text>
            <Text strong>{market?.title || 'Loading...'}</Text>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Text>Ваше предположение:</Text>
            <Text strong>{prediction === 'yes' ? 'ДА' : 'НЕТ'}</Text>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Text>Количество контрактов:</Text>
            <Text strong>{betAmount}</Text>
          </div>
          
          <Divider />
          
          <div>
            <Text type="secondary" style={{ fontSize: '12px', display: 'block', marginBottom: 4 }}>
              Предлагаемая цена за контракт (USDT)
            </Text>
            <Slider 
              min={0.01} 
              max={market ? (prediction === 'yes' ? market.yesPrice : market.noPrice) : 0.99}
              step={0.01}
              value={offerPrice}
              onChange={setOfferPrice}
              trackStyle={{ backgroundColor: '#1890ff' }}
              handleStyle={{ borderColor: '#1890ff' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
              <Text type="secondary">0.01 USDT</Text>
              <Text strong>{offerPrice.toFixed(2)} USDT</Text>
              <Text type="secondary">{market ? (prediction === 'yes' ? market.yesPrice : market.noPrice).toFixed(2) : '0.99'} USDT</Text>
            </div>
          </div>

          <Divider />
          
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Text>Общая стоимость:</Text>
            <Text strong type="success">{(offerPrice * betAmount).toFixed(2)} USDT</Text>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Text>Потенциальная прибыль:</Text>
            <Text strong type="success">{potentialProfit.toFixed(2)} USDT</Text>
          </div>
        </Space>
      </Modal>
    </Card>
  );
};

export default TradeInterfaceBlue;