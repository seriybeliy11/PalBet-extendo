import React, { useState, useEffect } from 'react';
import { Button, Card, Space, Typography, Input, Slider, Divider, Modal, Tag, Alert } from 'antd';
import { ShoppingCartOutlined, DollarOutlined, ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons';
import styled from 'styled-components';
import { createClient } from '@supabase/supabase-js';

const { Title, Text } = Typography;

// Supabase client initialization
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_KEY;  // Здесь должен быть anon public ключ
const supabase = createClient(supabaseUrl, supabaseKey);

// Styled components
const Container = styled.div`
  position: relative;
  min-height: 400px;
  overflow: hidden;
`;

const SlideContainer = styled.div`
  display: flex;
  width: 200%;
  transform: translateX(${props => props.$activeMenu === 'buy' ? '0%' : '-50%'});
  transition: transform 0.3s ease-in-out;
`;

const MenuPanel = styled.div`
  width: 50%;
  padding: 16px;
`;

const TabButton = styled(Button)`
  position: relative;
  border: none;
  background: ${props => props.$active ? 'rgba(24, 144, 255, 0.1)' : 'transparent'} !important;
  color: ${props => props.$active ? '#1890ff' : '#8c8c8c'} !important;
  font-weight: ${props => props.$active ? '600' : '400'};
  
  &::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 0;
    width: 100%;
    height: 2px;
    background-color: ${props => props.$active ? '#1890ff' : 'transparent'};
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
  const [orderBook, setOrderBook] = useState({ bids: [], asks: [] });

  const userId = 1; // Replace with actual user ID from auth system
  const marketId = 1; // Hardcoded for the single market

  // Calculate total portfolio value
  useEffect(() => {
    const totalValue = purchasedContracts.reduce((sum, pos) => sum + (pos.current_value || 0), 0);
    setTotalPortfolioValue(totalValue);
  }, [purchasedContracts]);

  // Fetch user data
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .eq('id', userId)
          .single();
        
        if (error) throw error;
        setUser(data);
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
        const { data, error } = await supabase
          .from('markets')
          .select('*')
          .eq('id', marketId)
          .single();
        
        if (error) throw error;
        setMarket(data);
        if (data) {
          setOfferPrice(data.yes_price || 0.5);
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
        const { data, error } = await supabase
          .from('positions')
          .select('*')
          .eq('user_id', userId);
        
        if (error) throw error;
        setPurchasedContracts(data || []);
      } catch (err) {
        setError('Failed to fetch positions');
        console.error(err);
      }
    };
    fetchPositions();
  }, [userId]);

  // Fetch order book
  useEffect(() => {
    const fetchOrderBook = async () => {
      if (!prediction) return;
      
      try {
        // Check if the RPC function exists, use fallback if not
        const { data, error } = await supabase
          .from('orders')
          .select('*')
          .eq('market_id', marketId)
          .eq('outcome', prediction);

        if (error) throw error;

        const bids = data?.filter(order => order.order_type === 'buy') || [];
        const asks = data?.filter(order => order.order_type === 'sell') || [];
        
        setOrderBook({ bids, asks });
      } catch (err) {
        console.error('Failed to fetch order book:', err);
        // Fallback to empty order book
        setOrderBook({ bids: [], asks: [] });
      }
    };
    fetchOrderBook();
  }, [prediction, marketId]);

  // Real-time subscriptions
  useEffect(() => {
    // Subscribe to orders changes
    const ordersSubscription = supabase
      .channel('orders-changes')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'orders',
          filter: `market_id=eq.${marketId}`
        }, 
        () => {
          // Re-fetch order book when orders change
          if (prediction) {
            supabase
              .from('orders')
              .select('*')
              .eq('market_id', marketId)
              .eq('outcome', prediction)
              .then(({ data }) => {
                if (data) {
                  const bids = data.filter(order => order.order_type === 'buy');
                  const asks = data.filter(order => order.order_type === 'sell');
                  setOrderBook({ bids, asks });
                }
              });
          }
        }
      )
      .subscribe();

    // Subscribe to positions changes
    const positionsSubscription = supabase
      .channel('positions-changes')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'positions',
          filter: `user_id=eq.${userId}`
        }, 
        async () => {
          // Re-fetch user positions
          const { data } = await supabase
            .from('positions')
            .select('*')
            .eq('user_id', userId);
          setPurchasedContracts(data || []);
        }
      )
      .subscribe();

    return () => {
      ordersSubscription.unsubscribe();
      positionsSubscription.unsubscribe();
    };
  }, [marketId, userId, prediction]);

  // Calculate potential profit for buying
  useEffect(() => {
    if (prediction && betAmount > 0) {
      const currentPrice = getCurrentPrice();
      const profit = (1 - currentPrice) * betAmount;
      setPotentialProfit(profit);
    } else {
      setPotentialProfit(0);
    }
  }, [prediction, betAmount, orderBook]);

  // Calculate sell profit
  useEffect(() => {
    if (selectedPosition && minPrice > 0) {
      const purchaseValue = (selectedPosition.purchase_price || 0) * (selectedPosition.shares || 0);
      const sellValue = minPrice * (sellAmount || selectedPosition.shares || 0);
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

  // Get current price based on order book
  const getCurrentPrice = () => {
    if (!prediction) return 0.5;
    
    if (orderBook.bids.length > 0 && orderBook.asks.length > 0) {
      const bestBid = Math.max(...orderBook.bids.map(bid => bid.price || 0));
      const bestAsk = Math.min(...orderBook.asks.map(ask => ask.price || 1));
      return (bestBid + bestAsk) / 2;
    }
    
    // Fallback to market prices
    if (!market) return 0.5;
    return prediction === 'yes' ? (market.yes_price || 0.5) : (market.no_price || 0.5);
  };

  const handleBuy = async () => {
    if (!user?.wallet) {
      setError('Please set your wallet address first');
      return;
    }
    if (!tonTxHash) {
      setError('Transaction hash is required');
      return;
    }

    try {
      // First create an order
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert({
          user_id: userId,
          market_id: marketId,
          outcome: prediction,
          order_type: 'buy',
          price: getCurrentPrice(),
          shares: betAmount,
          status: 'pending'
        })
        .select();

      if (orderError) throw orderError;

      setSuccess('Buy order placed successfully!');
      setError(null);
      
      // Refresh data
      const { data: positionsData } = await supabase
        .from('positions')
        .select('*')
        .eq('user_id', userId);
      setPurchasedContracts(positionsData || []);
      
      // Refresh user balance
      const { data: userData } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();
      setUser(userData);

      setModalVisible(false);
      setPrediction(null);
      setBetAmount(1);
      setTonTxHash('');
    } catch (err) {
      setError(err.message || 'Failed to buy contracts');
      console.error(err);
    }
  };

  const handleSellRequest = async () => {
    if (!selectedPosition) return;
    
    try {
      // Create sell order
      const { data, error } = await supabase
        .from('orders')
        .insert({
          user_id: userId,
          market_id: marketId,
          outcome: selectedPosition.outcome,
          order_type: 'sell',
          price: minPrice,
          shares: sellAmount || selectedPosition.shares,
          status: 'pending'
        })
        .select();

      if (error) throw error;

      setSuccess('Sell order created successfully!');
      setError(null);
      
      // Refresh positions
      const { data: positionsData } = await supabase
        .from('positions')
        .select('*')
        .eq('user_id', userId);
      setPurchasedContracts(positionsData || []);
      
      setSelectedPosition(null);
      setSellAmount(0);
      setMinPrice(0);
    } catch (err) {
      setError(err.message || 'Failed to create sell order');
      console.error(err);
    }
  };

  const handlePositionSelect = (position) => {
    setSelectedPosition(position);
    setSellAmount(position.shares || 0);
    setMinPrice(getCurrentPrice());
  };

  if (market && market.resolved) {
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
        <Text type="secondary" style={{ display: 'block', fontSize: '12px' }}>
          Баланс: {user?.balance?.toFixed(2) || '0.00'} USDT
        </Text>
      </div>

      {/* Display success message */}
      {success && (
        <Alert message={success} type="success" style={{ marginBottom: 16 }} />
      )}

      {/* Display error message */}
      {error && (
        <Alert message={error} type="error" style={{ marginBottom: 16 }} />
      )}

      {/* Tab buttons */}
      <Space.Compact size="large" style={{ width: '100%', marginBottom: 24, background: '#f5f5f5', borderRadius: 6 }}>
        <TabButton
          $active={activeMenu === 'buy'}
          size="large"
          style={{ flex: 1 }}
          icon={<ShoppingCartOutlined />}
          onClick={() => setActiveMenu('buy')}
        >
          Купить
        </TabButton>
        <TabButton
          $active={activeMenu === 'sell'}
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
          <Text>{market.name}</Text>
          <Text type="secondary" style={{ display: 'block', fontSize: '12px' }}>
            {market.description}
          </Text>
        </div>
      )}

      <Container>
        <SlideContainer $activeMenu={activeMenu}>
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
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text type="secondary">Общая стоимость:</Text>
                  <Text strong>{(getCurrentPrice() * betAmount).toFixed(2)} USDT</Text>
                </div>
              </InfoBlock>

              <Button 
                type="primary" 
                style={{ background: '#1890ff', borderColor: '#1890ff' }} 
                block
                onClick={() => setModalVisible(true)}
                disabled={!prediction || !user?.wallet}
              >
                Купить контракты
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
                          <Tag color={contract.outcome === 'yes' ? 'green' : 'red'}>
                            {contract.outcome === 'yes' ? 'ДА' : 'НЕТ'}
                          </Tag>
                          <Text strong>{contract.shares} шт.</Text>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <Text type="secondary" style={{ fontSize: '12px' }}>
                            Стоимость: {((contract.shares || 0) * getCurrentPrice()).toFixed(2)} USDT
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
                      Количество для продажи (макс: {selectedPosition.shares})
                    </Text>
                    <Input 
                      type="number" 
                      placeholder="0" 
                      value={sellAmount}
                      onChange={(e) => {
                        const value = Math.min(selectedPosition.shares, parseInt(e.target.value) || 0);
                        setSellAmount(value);
                      }}
                      min={1}
                      max={selectedPosition.shares}
                    />
                  </div>

                  <div>
                    <Text type="secondary" style={{ fontSize: '12px', display: 'block', marginBottom: 4 }}>
                      Цена продажи за контракт (USDT)
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
                    Разместить ордер на продажу
                  </Button>
                </>
              )}
            </Space>
          </MenuPanel>
        </SlideContainer>
      </Container>

      {/* Modal for buying */}
      <Modal
        title="Покупка контрактов"
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
            <Text strong>{market?.name || 'Loading...'}</Text>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Text>Ваше предположение:</Text>
            <Text strong>{prediction === 'yes' ? 'ДА' : 'НЕТ'}</Text>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Text>Количество контрактов:</Text>
            <Text strong>{betAmount}</Text>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Text>Цена за контракт:</Text>
            <Text strong>{getCurrentPrice().toFixed(2)} USDT</Text>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Text>Общая стоимость:</Text>
            <Text strong type="success">{(getCurrentPrice() * betAmount).toFixed(2)} USDT</Text>
          </div>
          
          <Divider />
          
          <div>
            <Text type="secondary" style={{ fontSize: '12px', display: 'block', marginBottom: 4 }}>
              Хэш транзакции (обязательно)
            </Text>
            <Input 
              placeholder="Введите хэш транзакции"
              value={tonTxHash}
              onChange={(e) => setTonTxHash(e.target.value)}
            />
          </div>

          <Divider />
          
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