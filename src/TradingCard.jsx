import React, { useState, useEffect } from 'react';
import { Button, Card, Space, Typography, Input, Slider, Divider, Modal, Tag, Alert, InputNumber } from 'antd';
import { ShoppingCartOutlined, DollarOutlined, ExportOutlined, WalletOutlined, LinkOutlined } from '@ant-design/icons';
import styled from 'styled-components';
import { createClient } from '@supabase/supabase-js';
import { useTonConnectUI } from '@tonconnect/ui-react';
import { Address, beginCell, toNano } from '@ton/ton';

// Supabase client initialization
const supabaseUrl = 'https://dlwjjtvrtdohtfxsrcbd.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRsd2pqdHZydGRvaHRmeHNyY2JkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg0MDQxNTQsImV4cCI6MjA3Mzk4MDE1NH0.eLbGiCej5jwJ5-NKRgCBhLsE9Q0fz8pFbpiadE-Cwe8';
const supabase = createClient(supabaseUrl, supabaseKey);

// TON constants
const USDT_MASTER = Address.parse('EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs');
const PLATFORM_WALLET = Address.parse('YOUR_PLATFORM_USDT_WALLET_ADDRESS');

const { Title, Text } = Typography;

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
  const [depositModalVisible, setDepositModalVisible] = useState(false);
  const [withdrawModalVisible, setWithdrawModalVisible] = useState(false);
  const [depositAmount, setDepositAmount] = useState(0);
  const [withdrawAmount, setWithdrawAmount] = useState(0);
  const [offerPrice, setOfferPrice] = useState(0.5);
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
  const [isLoading, setIsLoading] = useState(false);
  const [referralCodeInput, setReferralCodeInput] = useState('');
  const [referralLink, setReferralLink] = useState('');

  const [tonConnectUI] = useTonConnectUI();
  const marketId = 1; // Hardcoded for single market

  // Проверяем URL на наличие реферального кода
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const refCode = urlParams.get('ref');
    if (refCode) setReferralCodeInput(refCode);
  }, []);

  // Обработка подключения кошелька и регистрации
  useEffect(() => {
    const handleWalletConnection = async () => {
      if (tonConnectUI.connected && tonConnectUI.account?.address) {
        const walletAddress = tonConnectUI.account.address;
        try {
          // Проверяем, существует ли пользователь
          let { data: userData, error: userError } = await supabase
            .from('users')
            .select('*')
            .eq('wallet', walletAddress)
            .single();

          if (userError && userError.code === 'PGRST116') {
            // Новый пользователь
            const referralCode = crypto.randomUUID();
            const { data: newUser, error: insertError } = await supabase
              .from('users')
              .insert({
                name: `User_${walletAddress.slice(0, 6)}`,
                wallet: walletAddress,
                balance: 0,
                locked_balance: 0,
                referral_code: referralCode
              })
              .select()
              .single();
            if (insertError) throw insertError;

            // Привязка реферального кода, если указан
            if (referralCodeInput) {
              const { data: referrer, error: referrerError } = await supabase
                .from('users')
                .select('id')
                .eq('referral_code', referralCodeInput)
                .single();
              if (!referrerError && referrer) {
                await supabase
                  .from('referrals')
                  .insert({ referrer_id: referrer.id, referred_id: newUser.id });
                await supabase
                  .from('users')
                  .update({ referrer_id: referrer.id })
                  .eq('id', newUser.id);
              }
            }
            setUser(newUser);
            setReferralLink(`${window.location.origin}?ref=${referralCode}`);
          } else if (userError) {
            throw userError;
          } else {
            setUser(userData);
            setReferralLink(`${window.location.origin}?ref=${userData.referral_code}`);
          }
        } catch (err) {
          setError('Ошибка при обработке кошелька');
          console.error(err);
        }
      }
    };
    handleWalletConnection();
  }, [tonConnectUI, referralCodeInput]);

  // Calculate total portfolio value
  useEffect(() => {
    const totalValue = purchasedContracts.reduce((sum, pos) => sum + ((pos.shares || 0) * getCurrentPrice()), 0);
    setTotalPortfolioValue(totalValue);
  }, [purchasedContracts, orderBook]);

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
        setOfferPrice(data?.yes_price || 0.5);
      } catch (err) {
        setError('Не удалось загрузить данные рынка');
        console.error(err);
      }
    };
    fetchMarket();
  }, []);

  // Fetch user positions
  useEffect(() => {
    if (!user?.id) return;
    const fetchPositions = async () => {
      try {
        const { data, error } = await supabase
          .from('positions')
          .select('*')
          .eq('user_id', user.id);
        if (error) throw error;
        setPurchasedContracts(data || []);
      } catch (err) {
        setError('Не удалось загрузить позиции');
        console.error(err);
      }
    };
    fetchPositions();
  }, [user]);

  // Fetch order book
  useEffect(() => {
    const fetchOrderBook = async () => {
      if (!prediction) return;
      try {
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
        setOrderBook({ bids: [], asks: [] });
      }
    };
    fetchOrderBook();
  }, [prediction]);

  // Real-time subscriptions
  useEffect(() => {
    if (!user?.id) return;
    const ordersSubscription = supabase
      .channel('orders-changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'orders', filter: `market_id=eq.${marketId}` }, 
        () => {
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

    const positionsSubscription = supabase
      .channel('positions-changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'positions', filter: `user_id=eq.${user.id}` }, 
        async () => {
          const { data } = await supabase.from('positions').select('*').eq('user_id', user.id);
          setPurchasedContracts(data || []);
        }
      )
      .subscribe();

    const userSubscription = supabase
      .channel('users-changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'users', filter: `id=eq.${user?.id}` }, 
        async () => {
          const { data } = await supabase.from('users').select('*').eq('id', user.id).single();
          setUser(data);
        }
      )
      .subscribe();

    return () => {
      ordersSubscription.unsubscribe();
      positionsSubscription.unsubscribe();
      userSubscription.unsubscribe();
    };
  }, [user, prediction]);

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
      const purchaseValue = (selectedPosition.purchase_price || getCurrentPrice()) * (selectedPosition.shares || 0);
      const sellValue = minPrice * (sellAmount || selectedPosition.shares || 0);
      const profitUsdt = sellValue - purchaseValue;
      const profitPercent = purchaseValue ? ((sellValue - purchaseValue) / purchaseValue) * 100 : 0;
      setSellProfit({ usdt: profitUsdt, percent: profitPercent });
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
    return prediction === 'yes' ? (market?.yes_price || 0.5) : (market?.no_price || 0.5);
  };

  // Handle wallet connection
  const handleConnectWallet = async () => {
    try {
      await tonConnectUI.connectWallet();
    } catch (err) {
      setError('Не удалось подключить кошелёк');
      console.error(err);
    }
  };

  // Handle deposit
  const handleDeposit = async () => {
    if (!user?.wallet) {
      setError('Подключите кошелёк');
      return;
    }
    if (!tonConnectUI.connected) {
      setError('Подключите TON кошелёк');
      try {
        await tonConnectUI.connectWallet();
      } catch (err) {
        setError('Не удалось подключить TON кошелёк');
        return;
      }
    }
    if (depositAmount <= 0) {
      setError('Сумма депозита должна быть больше 0');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const external_uuid = crypto.randomUUID();
      const totalCost = depositAmount.toFixed(6);

      const { data: order } = await supabase
        .from('orders')
        .insert({
          user_id: user.id,
          market_id: null,
          outcome: null,
          order_type: 'deposit',
          price: 0,
          amount: totalCost,
          shares: 0,
          status: 'pending',
          external_uuid
        })
        .select()
        .single();

      await supabase
        .from('users')
        .update({ locked_balance: user.locked_balance + parseFloat(totalCost) })
        .eq('id', user.id);

      await supabase
        .from('audit_logs')
        .insert({ user_id: user.id, action: 'deposit_request', amount: totalCost });

      const transferBody = beginCell()
        .storeUint(0xf8a7ea5, 32)
        .storeUint(0, 64)
        .storeCoins(toNano(totalCost))
        .storeAddress(PLATFORM_WALLET)
        .storeAddress(Address.parse(user.wallet))
        .storeMaybeRef(null)
        .storeCoins(toNano('0'))
        .storeRef(beginCell().storeStringTail(external_uuid).endCell())
        .endCell();

      const transaction = {
        validUntil: Math.floor(Date.now() / 1000) + 300,
        messages: [
          {
            address: user.wallet,
            amount: toNano('0.05'),
            payload: transferBody.toBoc().toString('base64')
          }
        ]
      };

      const result = await tonConnectUI.sendTransaction(transaction);

      if (result.boc) {
        setSuccess('Депозит отправлен! Ожидается подтверждение...');
        setDepositModalVisible(false);
        setDepositAmount(0);
      }
    } catch (err) {
      setError(err.message || 'Не удалось обработать депозит');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle buy order (off-chain)
  const handleBuy = async () => {
    if (!user?.wallet) {
      setError('Подключите кошелёк');
      return;
    }
    if (!prediction) {
      setError('Выберите предположение (ДА/НЕТ)');
      return;
    }
    if (betAmount <= 0) {
      setError('Количество контрактов должно быть больше 0');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const totalCost = (getCurrentPrice() * betAmount).toFixed(6);
      if (user.balance < totalCost) {
        throw new Error('Недостаточно средств на балансе');
      }

      const { data: order } = await supabase
        .from('orders')
        .insert({
          user_id: user.id,
          market_id: marketId,
          outcome: prediction,
          order_type: 'buy',
          price: getCurrentPrice(),
          amount: totalCost,
          shares: betAmount,
          status: 'pending',
          external_uuid: crypto.randomUUID()
        })
        .select()
        .single();

      await supabase
        .from('users')
        .update({
          balance: user.balance - parseFloat(totalCost),
          locked_balance: user.locked_balance + parseFloat(totalCost)
        })
        .eq('id', user.id);

      await supabase
        .from('audit_logs')
        .insert({ user_id: user.id, action: 'buy_order', amount: totalCost });

      await supabase
        .from('orders')
        .update({ filled_shares: betAmount, status: 'filled', updated_at: new Date().toISOString() })
        .eq('id', order.id);

      const { data: existingPosition } = await supabase
        .from('positions')
        .select('*')
        .eq('user_id', user.id)
        .eq('market_id', marketId)
        .eq('outcome', prediction)
        .single();

      if (existingPosition) {
        await supabase
          .from('positions')
          .update({ shares: existingPosition.shares + betAmount })
          .eq('id', existingPosition.id);
      } else {
        await supabase
          .from('positions')
          .insert({
            user_id: user.id,
            market_id: marketId,
            outcome: prediction,
            shares: betAmount,
            purchase_price: getCurrentPrice()
          });
      }

      const { data: trade } = await supabase
        .from('trades')
        .insert({
          buy_order_id: order.id,
          market_id: marketId,
          outcome: prediction,
          price: getCurrentPrice(),
          shares: betAmount,
          fee: parseFloat(totalCost) * 0.02,
          referral_fee: 0,
          referred_user_fee: 0
        })
        .select()
        .single();

      await fetch('https://dlwjjtvrtdohtfxsrcbd.supabase.co/functions/v1/process-referral-rewards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseKey}` },
        body: JSON.stringify({ trade_id: trade.id, user_id: user.id })
      });

      await supabase
        .from('users')
        .update({ locked_balance: user.locked_balance })
        .eq('id', user.id);

      setSuccess('Ордер на покупку успешно размещён!');
      setModalVisible(false);
      setPrediction(null);
      setBetAmount(1);

      const { data: positionsData } = await supabase.from('positions').select('*').eq('user_id', user.id);
      setPurchasedContracts(positionsData || []);
      const { data: userData } = await supabase.from('users').select('*').eq('id', user.id).single();
      setUser(userData);
    } catch (err) {
      setError(err.message || 'Не удалось обработать ордер на покупку');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle sell order (off-chain)
  const handleSellRequest = async () => {
    if (!selectedPosition) {
      setError('Выберите позицию для продажи');
      return;
    }
    if (sellAmount <= 0 || sellAmount > selectedPosition.shares) {
      setError('Недопустимое количество для продажи');
      return;
    }
    if (minPrice <= 0) {
      setError('Цена продажи должна быть больше 0');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const totalSellAmount = (minPrice * sellAmount).toFixed(6);

      const { data: order } = await supabase
        .from('orders')
        .insert({
          user_id: user.id,
          market_id: marketId,
          outcome: selectedPosition.outcome,
          order_type: 'sell',
          price: minPrice,
          amount: totalSellAmount,
          shares: sellAmount,
          status: 'pending',
          external_uuid: crypto.randomUUID()
        })
        .select()
        .single();

      await supabase
        .from('positions')
        .update({ locked_shares: selectedPosition.locked_shares + sellAmount })
        .eq('id', selectedPosition.id);

      await supabase
        .from('audit_logs')
        .insert({ user_id: user.id, action: 'sell_order', amount: totalSellAmount });

      await supabase
        .from('orders')
        .update({ filled_shares: sellAmount, status: 'filled', updated_at: new Date().toISOString() })
        .eq('id', order.id);

      await supabase
        .from('positions')
        .update({ shares: selectedPosition.shares - sellAmount, locked_shares: selectedPosition.locked_shares })
        .eq('id', selectedPosition.id);

      await supabase
        .from('users')
        .update({ balance: user.balance + parseFloat(totalSellAmount) })
        .eq('id', user.id);

      const { data: trade } = await supabase
        .from('trades')
        .insert({
          buy_order_id: null,
          market_id: marketId,
          outcome: selectedPosition.outcome,
          price: minPrice,
          shares: sellAmount,
          fee: parseFloat(totalSellAmount) * 0.02,
          referral_fee: 0,
          referred_user_fee: 0
        })
        .select()
        .single();

      await fetch('https://dlwjjtvrtdohtfxsrcbd.supabase.co/functions/v1/process-referral-rewards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseKey}` },
        body: JSON.stringify({ trade_id: trade.id, user_id: user.id })
      });

      setSuccess('Ордер на продажу успешно размещён!');
      setSelectedPosition(null);
      setSellAmount(0);
      setMinPrice(0);

      const { data: positionsData } = await supabase.from('positions').select('*').eq('user_id', user.id);
      setPurchasedContracts(positionsData || []);
      const { data: userData } = await supabase.from('users').select('*').eq('id', user.id).single();
      setUser(userData);
    } catch (err) {
      setError(err.message || 'Не удалось создать ордер на продажу');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle withdraw
  const handleWithdraw = async () => {
    if (!user?.wallet) {
      setError('Подключите кошелёк');
      return;
    }
    if (!tonConnectUI.connected) {
      setError('Подключите TON кошелёк');
      try {
        await tonConnectUI.connectWallet();
      } catch (err) {
        setError('Не удалось подключить TON кошелёк');
        return;
      }
    }
    if (withdrawAmount <= 0 || withdrawAmount > user.balance) {
      setError('Недопустимая сумма вывода');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const external_uuid = crypto.randomUUID();

      const { data: withdrawal } = await supabase
        .from('withdrawals')
        .insert({
          user_id: user.id,
          amount: withdrawAmount,
          status: 'pending',
          external_uuid
        })
        .select()
        .single();

      await supabase
        .from('users')
        .update({ balance: user.balance - withdrawAmount })
        .eq('id', user.id);

      await supabase
        .from('audit_logs')
        .insert({ user_id: user.id, action: 'withdrawal_request', amount: withdrawAmount });

      const response = await fetch('https://dlwjjtvrtdohtfxsrcbd.supabase.co/functions/v1/withdraw-usdt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseKey}` },
        body: JSON.stringify({ user_id: user.id, amount: withdrawAmount, withdrawal_id: withdrawal.id, external_uuid })
      });

      if (!response.ok) throw new Error('Failed to initiate withdrawal');

      setSuccess('Запрос на вывод отправлен! Ожидается подтверждение...');
      setWithdrawModalVisible(false);
      setWithdrawAmount(0);

      const { data: userData } = await supabase.from('users').select('*').eq('id', user.id).single();
      setUser(userData);
    } catch (err) {
      setError(err.message || 'Не удалось запросить вывод');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePositionSelect = (position) => {
    setSelectedPosition(position);
    setSellAmount(position.shares || 0);
    setMinPrice(getCurrentPrice());
  };

  // Copy referral link to clipboard
  const copyReferralLink = () => {
    navigator.clipboard.writeText(referralLink);
    setSuccess('Реферальная ссылка скопирована!');
  };

  if (market && market.resolved) {
    return (
      <Card>
        <Alert message="Рынок закрыт" type="warning" />
      </Card>
    );
  }

  return (
    <Card
      style={{ maxWidth: 400, margin: '0 auto', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)', borderRadius: 12, borderTop: '3px solid #1890ff' }}
      bodyStyle={{ padding: 24 }}
    >
      {!user && (
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <Button
            type="primary"
            icon={<WalletOutlined />}
            onClick={handleConnectWallet}
            disabled={isLoading}
          >
            Подключить кошелёк
          </Button>
          {referralCodeInput && (
            <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
              Реферальный код: {referralCodeInput}
            </Text>
          )}
        </div>
      )}
      {user && (
        <div style={{ marginBottom: 16, padding: 12, background: '#f0f8ff', borderRadius: 8 }}>
          <Text strong>Портфель: </Text>
          <Text>{totalPortfolioValue.toFixed(2)} USDT</Text>
          <Text type="secondary" style={{ display: 'block', fontSize: '12px' }}>
            Баланс: {user?.balance?.toFixed(2) || '0.00'} USDT
          </Text>
          <Text type="secondary" style={{ display: 'block', fontSize: '12px', marginTop: 8 }}>
            Ваш реферальный код: {user?.referral_code || 'Генерируется...'}
            <Button
              type="link"
              icon={<LinkOutlined />}
              onClick={copyReferralLink}
              style={{ padding: 0, marginLeft: 8 }}
            >
              Скопировать ссылку
            </Button>
          </Text>
          {!user.referrer_id && !referralCodeInput && (
            <div style={{ marginTop: 8 }}>
              <Input
                placeholder="Введите реферальный код (необязательно)"
                value={referralCodeInput}
                onChange={(e) => setReferralCodeInput(e.target.value)}
                style={{ marginBottom: 8 }}
              />
              <Button
                type="primary"
                onClick={async () => {
                  if (referralCodeInput) {
                    const { data: referrer } = await supabase
                      .from('users')
                      .select('id')
                      .eq('referral_code', referralCodeInput)
                      .single();
                    if (referrer) {
                      await supabase
                        .from('referrals')
                        .insert({ referrer_id: referrer.id, referred_id: user.id });
                      await supabase
                        .from('users')
                        .update({ referrer_id: referrer.id })
                        .eq('id', user.id);
                      setSuccess('Реферальный код применён!');
                      setReferralCodeInput('');
                    } else {
                      setError('Недействительный реферальный код');
                    }
                  }
                }}
                disabled={!referralCodeInput || isLoading}
              >
                Применить реферальный код
              </Button>
            </div>
          )}
          <Space style={{ marginTop: 8 }}>
            <Button
              type="primary"
              icon={<WalletOutlined />}
              onClick={() => setDepositModalVisible(true)}
              disabled={isLoading}
            >
              Пополнить баланс
            </Button>
            <Button
              type="primary"
              icon={<ExportOutlined />}
              onClick={() => setWithdrawModalVisible(true)}
              disabled={isLoading || !user?.balance}
            >
              Вывести депозит
            </Button>
          </Space>
        </div>
      )}

      {success && <Alert message={success} type="success" style={{ marginBottom: 16 }} />}
      {error && <Alert message={error} type="error" style={{ marginBottom: 16 }} />}

      {user && (
        <>
          <Space.Compact size="large" style={{ width: '100%', marginBottom: 24, background: '#f5f5f5', borderRadius: 6 }}>
            <TabButton $active={activeMenu === 'buy'} size="large" style={{ flex: 1 }} icon={<ShoppingCartOutlined />} onClick={() => setActiveMenu('buy')}>
              Купить
            </TabButton>
            <TabButton $active={activeMenu === 'sell'} size="large" style={{ flex: 1 }} icon={<DollarOutlined />} onClick={() => setActiveMenu('sell')}>
              Продать
            </TabButton>
          </Space.Compact>

          <Divider style={{ margin: '16px 0' }} />

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
                        style={{ flex: 1, backgroundColor: prediction === 'yes' ? '#52c41a' : undefined, borderColor: prediction === 'yes' ? '#52c41a' : undefined }}
                        onClick={() => setPrediction('yes')}
                      >
                        ДА
                      </Button>
                      <Button
                        type={prediction === 'no' ? 'primary' : 'default'}
                        style={{ flex: 1, backgroundColor: prediction === 'no' ? '#f5222d' : undefined, borderColor: prediction === 'no' ? '#f5222d' : undefined }}
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
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Text type="secondary">Комиссия (2%):</Text>
                      <Text strong>{((getCurrentPrice() * betAmount) * 0.02).toFixed(2)} USDT</Text>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Text type="secondary">Реферальный бонус (0.1%):</Text>
                      <Text strong type="success">{((getCurrentPrice() * betAmount) * 0.001).toFixed(2)} USDT</Text>
                    </div>
                  </InfoBlock>
                  <Button
                    type="primary"
                    style={{ background: '#1890ff', borderColor: '#1890ff' }}
                    block
                    onClick={() => setModalVisible(true)}
                    disabled={!prediction || !user?.wallet || isLoading}
                    loading={isLoading}
                  >
                    Купить контракты
                  </Button>
                </Space>
              </MenuPanel>
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
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Text type="secondary">Комиссия (2%):</Text>
                          <Text strong>{(minPrice * sellAmount * 0.02).toFixed(2)} USDT</Text>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Text type="secondary">Реферальный бонус (0.1%):</Text>
                          <Text strong type="success">{(minPrice * sellAmount * 0.001).toFixed(2)} USDT</Text>
                        </div>
                      </InfoBlock>
                      <Button
                        type="primary"
                        style={{ background: '#1890ff', borderColor: '#1890ff' }}
                        block
                        onClick={handleSellRequest}
                        disabled={sellAmount <= 0 || minPrice <= 0 || isLoading}
                        loading={isLoading}
                      >
                        Разместить ордер на продажу
                      </Button>
                    </>
                  )}
                </Space>
              </MenuPanel>
            </SlideContainer>
          </Container>

          <Modal
            title="Покупка контрактов"
            open={modalVisible}
            onCancel={() => setModalVisible(false)}
            footer={[
              <Button key="cancel" onClick={() => setModalVisible(false)} disabled={isLoading}>
                Отмена
              </Button>,
              <Button
                key="buy"
                type="primary"
                style={{ background: '#1890ff', borderColor: '#1890ff' }}
                onClick={handleBuy}
                disabled={!prediction || !user?.wallet || isLoading}
                loading={isLoading}
              >
                Купить {betAmount} контрактов
              </Button>,
            ]}
          >
            <Space direction="vertical" style={{ width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text>Событие:</Text>
                <Text strong>{market?.name || 'Загрузка...'}</Text>
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
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text>Комиссия (2%):</Text>
                <Text strong>{((getCurrentPrice() * betAmount) * 0.02).toFixed(2)} USDT</Text>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text>Реферальный бонус (0.1%):</Text>
                <Text strong type="success">{((getCurrentPrice() * betAmount) * 0.001).toFixed(2)} USDT</Text>
              </div>
            </Space>
          </Modal>

          <Modal
            title="Пополнить баланс"
            open={depositModalVisible}
            onCancel={() => setDepositModalVisible(false)}
            footer={[
              <Button key="cancel" onClick={() => setDepositModalVisible(false)} disabled={isLoading}>
                Отмена
              </Button>,
              <Button
                key="deposit"
                type="primary"
                style={{ background: '#1890ff', borderColor: '#1890ff' }}
                onClick={handleDeposit}
                disabled={depositAmount <= 0 || isLoading}
                loading={isLoading}
              >
                Пополнить {depositAmount} USDT
              </Button>,
            ]}
          >
            <Space direction="vertical" style={{ width: '100%' }}>
              <Text>Введите сумму депозита:</Text>
              <InputNumber
                min={0}
                value={depositAmount}
                onChange={(value) => setDepositAmount(value || 0)}
                placeholder="Введите сумму USDT"
                style={{ width: '100%' }}
                precision={6}
              />
            </Space>
          </Modal>

          <Modal
            title="Вывод депозита"
            open={withdrawModalVisible}
            onCancel={() => setWithdrawModalVisible(false)}
            footer={[
              <Button key="cancel" onClick={() => setWithdrawModalVisible(false)} disabled={isLoading}>
                Отмена
              </Button>,
              <Button
                key="withdraw"
                type="primary"
                style={{ background: '#1890ff', borderColor: '#1890ff' }}
                onClick={handleWithdraw}
                disabled={withdrawAmount <= 0 || withdrawAmount > user?.balance || isLoading}
                loading={isLoading}
              >
                Вывести {withdrawAmount} USDT
              </Button>,
            ]}
          >
            <Space direction="vertical" style={{ width: '100%' }}>
              <Text>Доступный баланс: {user?.balance?.toFixed(2)} USDT</Text>
              <InputNumber
                min={0}
                max={user?.balance || 0}
                value={withdrawAmount}
                onChange={(value) => setWithdrawAmount(value || 0)}
                placeholder="Введите сумму USDT"
                style={{ width: '100%' }}
                precision={6}
              />
            </Space>
          </Modal>
        </>
      )}
    </Card>
  );
};

export default TradeInterfaceBlue;