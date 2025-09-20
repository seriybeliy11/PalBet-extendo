import React, { useState, useEffect } from 'react';
import { Button, Card, Space, Typography, Input, Slider, Divider, Modal, Tag, Alert } from 'antd';
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
  const [tonTxHash, setTonTxHash] = useState('');
  const [sellAmount, setSellAmount] = useState(0);
  const [minPrice, setMinPrice] = useState(0);
  const [potentialProfit, setPotentialProfit] = useState(0);
  const [market, setMarket] = useState(null);
  const [user, setUser] = useState(null);
  const [purchasedContracts, setPurchasedContracts] = useState([]);
  const [selectedPosition, setSelectedPosition] = useState(null);
  const [sellProfit, setSellProfit] = useState({ usdt: 0, percent: 0 });
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [totalPortfolioValue, setTotalPortfolioValue] = useState(0);

  const userId = '1'; // Replace with actual user ID from auth system
  const marketId = '1'; // Hardcoded for the single market in the backend

  // Calculate total portfolio value
  useEffect(() => {
    const totalValue = purchasedContracts.reduce((sum, pos) => sum + (pos.currentValue || 0), 0);
    setTotalPortfolioValue(totalValue);
  }, [purchasedContracts]);

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
  }, [userId]);

  // Fetch market data
  useEffect(() => {
    const fetchMarket = async () => {
      try {
        const response = await axios.get(`http://localhost:5000/api/market/${marketId}`);
        const marketData = response.data;
        setMarket(marketData);
        if (marketData) {
          const currentPrice = marketData.yesPrice; // Default to yes
          setOfferPrice(currentPrice);
        }
      } catch (err) {
        setError('Failed to fetch market data');
        console.error(err);
      }
    };
    fetchMarket();
  }, [marketId]);

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
    const interval = setInterval(fetchPositions, 5000); // Refresh every 5s for updates
    return () => clearInterval(interval);
  }, [userId]);

  // Calculate potential profit for buying (using current price)
  useEffect(() => {
    if (prediction && betAmount > 0 && market) {
      const currentPrice = prediction === 'yes' ? market.yesPrice : market.noPrice;
      const profit = (1 - currentPrice) * betAmount;
      setPotentialProfit(profit);
    } else {
      setPotentialProfit(0);
    }
  }, [prediction, betAmount, market]);

  // Calculate sell profit (using minPrice as sell price for estimation)
  useEffect(() => {
    if (selectedPosition && minPrice > 0) {
      const purchaseValue = selectedPosition.purchasePrice * selectedPosition.quantity;
      const sellValue = minPrice * (sellAmount || selectedPosition.quantity);
      const profitUsdt = sellValue - purchaseValue;
      const profitPercent = purchaseValue ? ((sellValue - purchaseValue) / purchaseValue) * 100 : 0;
      
      setSellProfit({
        usdt: profitUsdt,
        percent: profitPercent
      });
    } else {
      setSellProfit({ usdt: 0, percent: 0 });
    }
  }, [selectedPosition, minPrice, sellAmount]);

  const handleBuy = async () => {
    if (!user.tonWalletAddress) {
      setError('Please set your TON wallet address first');
      return;
    }
    if (!tonTxHash) {
      setError('TON transaction hash is required');
      return;
    }
    try {
      const currentPrice = prediction === 'yes' ? market.yesPrice : market.noPrice;
      const response = await axios.post('http://localhost:5000/api/buy', {
        userId,
        marketId,
        type: prediction,
        quantity: betAmount,
        offerPrice: Math.max(offerPrice, currentPrice), // Ensure >= current
        tonTxHash
      });
      setSuccess('Buy order placed successfully! TX: ' + tonTxHash);
      setError(null);
      // Refresh data
      const [positionsResponse] = await Promise.all([
        axios.get(`http://localhost:5000/api/positions/${userId}`)
      ]);
      setPurchasedContracts(positionsResponse.data);
      setModalVisible(false);
      setPrediction(null);
      setBetAmount(1);
      setTonTxHash('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to buy contracts');
      console.error(err);
    }
  };

  const handleSellRequest = async () => {
    if (!selectedPosition) return;
    try {
      const currentPrice = selectedPosition.type === 'yes' ? market.yesPrice : market.noPrice;
      const response = await axios.post('http://localhost:5000/api/sell/request', {
        userId,
        positionId: selectedPosition.id,
        quantity: sellAmount || selectedPosition.quantity,
        minPrice: Math.min(minPrice, currentPrice) // Ensure <= current
      });
      setSuccess('Sell request submitted successfully. Request ID: ' + response.data.requestId + '. Waiting for admin confirmation.');
      setError(null);
      // Refresh positions (though update after confirm)
      const positionsResponse = await axios.get(`http://localhost:5000/api/positions/${userId}`);
      setPurchasedContracts(positionsResponse.data);
      setSelectedPosition(null);
      setSellAmount(0);
      setMinPrice(0);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit sell request');
      console.error(err);
    }
  };

  const handlePositionSelect = (position) => {
    setSelectedPosition(position);
    setSellAmount(position.quantity);
    const currentPrice = position.type === 'yes' ? market?.yesPrice : market?.noPrice;
    setMinPrice(currentPrice || 0.5);
  };

  const getCurrentPrice = () => {
    if (!market || !prediction) return 0.5;
    return prediction === 'yes' ? market.yesPrice : market.noPrice;
  };

  if (market && market.status !== 'open') {
    return (
      <Card>
        <Alert message="Market is closed" type="warning" />
      </Card>
    );
  }

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
      {/* Display portfolio value */}
      <div style={{ marginBottom: 16, padding: 12, background: '#f0f8ff', borderRadius: 8 }}>
        <Text strong>Портфель: </Text>
        <Text>{totalPortfolioValue.toFixed(2)} USDT</Text>
      </div>

      {/* Display success message */}
      {success && (
        <div style={{ marginBottom: 16, padding: 12, background: '#f6ffed', borderRadius: 8 }}>
          <Text type="success">{success}</Text>
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
                  <Text strong>{getCurrentPrice().toFixed(2)} USDT</Text>
                </div>
              </InfoBlock>

              <Button 
                type="primary" 
                style={{ background: '#1890ff', borderColor: '#1890ff' }} 
                block
                onClick={() => setModalVisible(true)}
                disabled={!prediction || !market || !user?.tonWalletAddress}
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
                            {contract.unrealizedPnL >= 0 ? (
                              <ArrowUpOutlined style={{ color: '#52c41a', marginLeft: 4 }} />
                            ) : (
                              <ArrowDownOutlined style={{ color: '#f5222d', marginLeft: 4 }} />
                            )}
                          </div>
                          <Text type="secondary" style={{ fontSize: '11px' }}>
                            PnL: {contract.unrealizedPnL.toFixed(2)} USDT
                          </Text>
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
                      Минимальная цена продажи за контракт (USDT)
                    </Text>
                    <Input 
                      suffix="USDT" 
                      placeholder="0.00" 
                      value={minPrice}
                      onChange={(e) => setMinPrice(parseFloat(e.target.value) || 0)}
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
                    onClick={handleSellRequest}
                    disabled={sellAmount <= 0 || minPrice <= 0}
                  >
                    Подать запрос на продажу
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
            disabled={!tonTxHash}
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
              Максимальная цена за контракт (USDT, ≥ текущей)
            </Text>
            <Slider 
              min={getCurrentPrice()} 
              max={0.99}
              step={0.01}
              value={offerPrice}
              onChange={setOfferPrice}
              trackStyle={{ backgroundColor: '#1890ff' }}
              handleStyle={{ borderColor: '#1890ff' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
              <Text type="secondary">{getCurrentPrice().toFixed(2)} USDT</Text>
              <Text strong>{offerPrice.toFixed(2)} USDT</Text>
              <Text type="secondary">0.99 USDT</Text>
            </div>
          </div>

          <Divider />
          
          <div>
            <Text type="secondary" style={{ fontSize: '12px', display: 'block', marginBottom: 4 }}>
              TON TX Hash (обязательно)
            </Text>
            <Input 
              placeholder="Введите хэш транзакции TON"
              value={tonTxHash}
              onChange={(e) => setTonTxHash(e.target.value)}
            />
          </div>

          <Divider />
          
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Text>Общая стоимость (при текущей цене):</Text>
            <Text strong type="success">{(getCurrentPrice() * betAmount).toFixed(2)} USDT</Text>
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