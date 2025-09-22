import React, { useState, useEffect } from 'react';
import { Button, Card, Space, Typography, Input, Slider, Divider, Modal, Tag, Alert, Spin } from 'antd';
import { ShoppingCartOutlined, DollarOutlined, LoadingOutlined } from '@ant-design/icons';
import styled from 'styled-components';
import { createClient } from '@supabase/supabase-js';
import 'buffer';
import { TonConnectButton, useTonConnectUI } from '@tonconnect/ui-react';
import { Address, beginCell, toNano, Cell } from '@ton/core';

const { Title, Text } = Typography;

const supabaseUrl = 'https://dlwjjtvrtdohtfxsrcbd.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRsd2pqdHZydGRvaHRmeHNyY2JkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg0MDQxNTQsImV4cCI6MjA3Mzk4MDE1NH0.eLbGiCej5jwJ5-NKRgCBhLsE9Q0fz8pFbpiadE-Cwe8';
const supabase = createClient(supabaseUrl, supabaseKey);

// TON API
const TON_API_URL = 'https://toncenter.com/api/v2/jsonRPC';
const TON_API_KEY = 'c34570e1397da2c94f0b4263d887459eb7cc30e041bfefb179af624e49e7a26b';

// TON Constants
const USDT_MASTER_ADDRESS = Address.parse('EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs');
const PLATFORM_WALLET = Address.parse('UQCxTSI4j9d9FiwwHVnJ6G55kILHYjzN_RSfIhuLN2pe50y7');
const USDT_DECIMALS = 6;

// Jetton opcodes
const JETTON_TRANSFER_OP = 0xf8a7ea5n;
const JETTON_TRANSFER_NOTIFICATION_OP = 0x7362d09cn;

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
  const [tonConnectUI] = useTonConnectUI();
  const [activeMenu, setActiveMenu] = useState('buy');
  const [prediction, setPrediction] = useState(null);
  const [betAmount, setBetAmount] = useState(1);
  const [modalVisible, setModalVisible] = useState(false);
  const [depositAmount, setDepositAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [sellAmount, setSellAmount] = useState(0);
  const [minPrice, setMinPrice] = useState(0);
  const [potentialProfit, setPotentialProfit] = useState(0);
  const [market, setMarket] = useState(null);
  const [user, setUser] = useState(null);
  const [purchasedContracts, setPurchasedContracts] = useState([]);
  const [selectedPosition, setSelectedPosition] = useState(null);
  const [sellProfit, setSellProfit] = useState({ usdt: 0 });
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [totalPortfolioValue, setTotalPortfolioValue] = useState(0);
  const [orderBook, setOrderBook] = useState({ bids: [], asks: [] });
  const [tonWalletConnected, setTonWalletConnected] = useState(false);
  const [transactionStatus, setTransactionStatus] = useState(null); // 'pending', 'confirmed', 'failed'
  const [transactionHash, setTransactionHash] = useState(null);

  const userId = 1;
  const marketId = 1;

  // Подключение кошелька
  useEffect(() => {
    setTonWalletConnected(tonConnectUI.connected);
  }, [tonConnectUI.connected]);

  // Fetch initial data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [userData, marketData, positionsData] = await Promise.all([
          supabase.from('users').select('*').eq('id', userId).single(),
          supabase.from('markets').select('*').eq('id', marketId).single(),
          supabase.from('positions').select('*, markets!inner(name, yes_price, no_price, resolved)').eq('user_id', userId).eq('markets.resolved', false),
        ]);
        if (userData.error) throw userData.error;
        if (marketData.error) throw marketData.error;
        if (positionsData.error) throw positionsData.error;
        setUser(userData.data);
        setMarket(marketData.data);
        setPurchasedContracts(positionsData.data || []);
      } catch (err) {
        setError('Failed to fetch data');
      }
    };
    fetchData();
  }, []);

  // Fetch order book
  useEffect(() => {
    const fetchOrderBook = async () => {
      if (!prediction) return;
      try {
        const { data, error } = await supabase
          .from('orders')
          .select('*')
          .eq('market_id', marketId)
          .eq('outcome', prediction)
          .eq('status', 'active');
        if (error) throw error;
        setOrderBook({
          bids: data?.filter(order => order.order_type === 'buy') || [],
          asks: data?.filter(order => order.order_type === 'sell') || [],
        });
      } catch (err) {
        setError('Failed to fetch order book');
      }
    };
    fetchOrderBook();
  }, [prediction]);

  // Real-time subscriptions
  useEffect(() => {
    const subscriptions = [
      supabase.channel('orders-changes').on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `market_id=eq.${marketId}` }, async () => {
        if (prediction) {
          const { data } = await supabase.from('orders').select('*').eq('market_id', marketId).eq('outcome', prediction).eq('status', 'active');
          if (data) setOrderBook({ bids: data.filter(o => o.order_type === 'buy'), asks: data.filter(o => o.order_type === 'sell') });
          await updateMarketPrices(marketId);
        }
      }).subscribe(),
      supabase.channel('markets-changes').on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'markets', filter: `id=eq.${marketId}` }, (payload) => setMarket(payload.new)).subscribe(),
      supabase.channel('positions-changes').on('postgres_changes', { event: '*', schema: 'public', table: 'positions', filter: `user_id=eq.${userId}` }, async () => {
        const { data, error } = await supabase.from('positions').select('*, markets!inner(name, yes_price, no_price, resolved)').eq('user_id', userId).eq('markets.resolved', false);
        if (!error) setPurchasedContracts(data || []);
      }).subscribe(),
    ];
    return () => subscriptions.forEach(sub => sub.unsubscribe());
  }, [prediction]);

  // Calculate potential profit
  useEffect(() => {
    if (prediction && betAmount > 0) {
      const currentPrice = getCurrentPrice();
      setPotentialProfit((1 - currentPrice) * betAmount);
    } else {
      setPotentialProfit(0);
    }
  }, [prediction, betAmount, market]);

  // Calculate sell profit
  useEffect(() => {
    if (selectedPosition && minPrice > 0) {
      setSellProfit({ usdt: minPrice * (sellAmount || selectedPosition.shares || 0) });
    } else {
      setSellProfit({ usdt: 0 });
    }
  }, [selectedPosition, minPrice, sellAmount]);

  // Calculate portfolio value
  useEffect(() => {
    if (!purchasedContracts.length || !market) return;
    const totalValue = purchasedContracts.reduce((sum, pos) => sum + (pos.shares || 0) * (pos.outcome === 'yes' ? (market.yes_price || 0.5) : (market.no_price || 0.5)), 0);
    setTotalPortfolioValue(totalValue);
  }, [purchasedContracts, market]);

  // Helper for Jetton nano
  const toJettonNano = (amount) => BigInt(Math.floor(amount * 10 ** USDT_DECIMALS));

  // Get Jetton wallet address
  const getJettonWalletAddress = async (masterAddress, ownerAddress) => {
    const inputCell = beginCell()
      .storeAddress(ownerAddress)
      .endCell();

    const response = await fetch(TON_API_URL, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'X-API-Key': TON_API_KEY 
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'runGetMethod',
        params: {
          address: masterAddress.toString(),
          method: 'get_wallet_address',
          stack: [
            ['slice', inputCell.toBoc().toString('base64')]
          ]
        }
      })
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error.message);

    const boc = data.result.stack[0][1];
    const cell = Cell.fromBoc(Buffer.from(boc, 'base64'))[0];
    const slice = cell.beginParse();
    return slice.loadAddress();
  };

  // Проверка баланса кошелька (USDT Jetton)
  const checkWalletBalance = async (userAddress) => {
    try {
      const jettonWallet = await getJettonWalletAddress(USDT_MASTER_ADDRESS, userAddress);

      const response = await fetch(TON_API_URL, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-API-Key': TON_API_KEY 
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: Date.now(),
          method: 'runGetMethod',
          params: {
            address: jettonWallet.toString(),
            method: 'get_balance',
            stack: []
          }
        })
      });

      const data = await response.json();
      if (data.error) throw new Error(data.error.message);

      const balanceNano = BigInt(data.result.stack[0][1]);
      return Number(balanceNano) / (10 ** USDT_DECIMALS);
    } catch (err) {
      console.error('Balance check error:', err);
      return 0;
    }
  };

  // ==================== ДЕПОЗИТ ФЛОУ ====================
  const handleDeposit = async () => {
    const amount = parseFloat(depositAmount);
    if (!amount || amount <= 0) {
      setError('Please enter a valid deposit amount');
      return;
    }

    if (!tonWalletConnected) {
      setError('Please connect your TON wallet first');
      return;
    }

    try {
      setTransactionStatus('pending');
      setError(null);
      setSuccess(null);

      // 1. Получаем адрес кошелька пользователя
      const userAddress = Address.parse(tonConnectUI.account.address);
      
      // 2. Проверка баланса USDT
      const walletBalance = await checkWalletBalance(userAddress);
      if (walletBalance < amount) {
        setError(`Insufficient wallet balance. Available: ${walletBalance.toFixed(2)} USDT`);
        setTransactionStatus(null);
        return;
      }

      // 3. Получаем Jetton адреса
      const userJettonWallet = await getJettonWalletAddress(USDT_MASTER_ADDRESS, userAddress);
      const platformJettonWallet = await getJettonWalletAddress(USDT_MASTER_ADDRESS, PLATFORM_WALLET);

      // 4. Генерируем queryId
      const queryId = BigInt(Math.floor(Math.random() * Number(2n ** 64n)));
      const jettonAmount = toJettonNano(amount);

      // 5. Создаем тело транзакции для Jetton transfer
      const body = beginCell()
        .storeUint(JETTON_TRANSFER_OP, 32)
        .storeUint(queryId, 64)
        .storeCoins(jettonAmount)
        .storeAddress(platformJettonWallet)
        .storeAddress(userAddress)
        .storeMaybeRef(null)
        .storeCoins(toNano('0.05'))
        .storeMaybeRef(beginCell().storeStringTail(`Deposit for user ${userId}`).endCell())
        .endCell();

      // 6. Инициируем транзакцию
      const transaction = {
        validUntil: Math.floor(Date.now() / 1000) + 360,
        messages: [
          {
            address: userJettonWallet.toString({ bounceable: true, urlSafe: true }),
            amount: toNano('0.1').toString(),
            payload: body.toBoc().toString('base64'),
          }
        ]
      };

      const result = await tonConnectUI.sendTransaction(transaction);
      setTransactionHash(result.boc);

      // 7. Создаем запись о депозите в БД
      const { data: depositData, error: depositError } = await supabase
        .from('deposits')
        .insert({
          user_id: userId,
          query_id: queryId.toString(),
          amount: amount,
          status: 'pending',
          user_wallet: userAddress.toString()
        })
        .select()
        .single();

      if (depositError) throw depositError;

      setSuccess('Transaction sent. Waiting for confirmation...');

      // 8. Отслеживаем статус транзакции
      await trackTransactionStatus(depositData.id, queryId, jettonAmount, amount, platformJettonWallet);

    } catch (err) {
      setError('Failed to process deposit: ' + err.message);
      setTransactionStatus('failed');
      console.error('Deposit error:', err);
    }
  };

  // Отслеживание статуса транзакции
  const trackTransactionStatus = async (depositId, queryId, jettonAmount, amount, platformJettonWallet) => {
    let attempts = 0;
    const maxAttempts = 30; // 3 минуты максимум

    const pollTransaction = async () => {
      try {
        const response = await fetch(TON_API_URL, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'X-API-Key': TON_API_KEY 
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: Date.now(),
            method: 'getTransactions',
            params: {
              address: platformJettonWallet.toString(),
              limit: 10
            }
          })
        });

        const data = await response.json();
        if (data.error) throw new Error(data.error.message);

        const transactions = data.result || [];
        for (const tx of transactions) {
          const inMsg = tx.in_msg;
          if (!inMsg?.body) continue;

          const bodyBoc = inMsg.body;
          const bodyCell = Cell.fromBoc(Buffer.from(bodyBoc, 'base64'))[0];
          const slice = bodyCell.beginParse();
          const op = slice.loadUint(32);

          if (op === BigInt(JETTON_TRANSFER_NOTIFICATION_OP)) {
            const txQueryId = slice.loadUint(64);
            const txAmount = slice.loadCoins();

            if (txQueryId === queryId && txAmount === jettonAmount) {
              // Транзакция подтверждена
              setTransactionStatus('confirmed');
              setSuccess(`Deposit confirmed! +${amount} USDT added to your balance`);

              // Обновляем баланс пользователя
              const { data: userData, error } = await supabase
                .from('users')
                .update({ balance: (user?.balance || 0) + amount })
                .eq('id', userId)
                .select()
                .single();

              if (error) throw error;
              setUser(userData);

              // Обновляем статус депозита
              await supabase
                .from('deposits')
                .update({ 
                  status: 'confirmed',
                  tx_hash: tx.transaction_id.hash 
                })
                .eq('id', depositId);

              setDepositAmount('');
              return;
            }
          }
        }

        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(pollTransaction, 6000); // Проверяем каждые 6 секунд
        } else {
          setTransactionStatus('failed');
          setError('Transaction timeout: not confirmed within 3 minutes');
          
          await supabase
            .from('deposits')
            .update({ status: 'failed' })
            .eq('id', depositId);
        }
      } catch (err) {
        console.error('Transaction tracking error:', err);
        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(pollTransaction, 6000);
        }
      }
    };

    pollTransaction();
  };

  // ==================== ВЫВОД ФЛОУ ====================
  const handleWithdraw = async () => {
    const amount = parseFloat(withdrawAmount);
    if (!amount || amount <= 0) {
      setError('Please enter a valid withdrawal amount');
      return;
    }
    
    if (amount > (user?.balance || 0)) {
      setError('Insufficient balance');
      return;
    }

    if (!tonWalletConnected) {
      setError('Please connect your TON wallet first');
      return;
    }

    try {
      setTransactionStatus('pending');
      setError(null);
      setSuccess(null);

      // 1. Создаем запись о выводе
      const { data: withdrawData, error: withdrawError } = await supabase
        .from('withdrawals')
        .insert({
          user_id: userId,
          amount: amount,
          status: 'pending',
          user_wallet: tonConnectUI.account.address
        })
        .select()
        .single();

      if (withdrawError) throw withdrawError;

      // 2. Вызываем API для инициации вывода (бэкенд с seed-фразой)
      const response = await fetch('/api/withdraw', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + process.env.REACT_APP_WITHDRAW_KEY
        },
        body: JSON.stringify({
          amount: amount,
          to_address: tonConnectUI.account.address,
          withdraw_id: withdrawData.id
        })
      });

      if (!response.ok) throw new Error('Withdrawal API error');

      const result = await response.json();
      setTransactionHash(result.tx_hash);
      setSuccess('Withdrawal transaction sent. Waiting for confirmation...');

      // 3. Отслеживаем статус (полинг на кошельке пользователя для Jetton)
      const userAddress = Address.parse(tonConnectUI.account.address);
      const userJettonWallet = await getJettonWalletAddress(USDT_MASTER_ADDRESS, userAddress);
      await trackWithdrawalStatus(withdrawData.id, result.tx_hash, amount, userJettonWallet);

    } catch (err) {
      setError('Failed to process withdrawal: ' + err.message);
      setTransactionStatus('failed');
      console.error('Withdrawal error:', err);
    }
  };

  // Отслеживание статуса вывода
  const trackWithdrawalStatus = async (withdrawId, txHash, amount, userJettonWallet) => {
    let attempts = 0;
    const maxAttempts = 30;
    const jettonAmount = toJettonNano(amount);

    const pollWithdrawal = async () => {
      try {
        const response = await fetch(TON_API_URL, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'X-API-Key': TON_API_KEY 
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: Date.now(),
            method: 'getTransactions',
            params: {
              address: userJettonWallet.toString(),
              limit: 10
            }
          })
        });

        const data = await response.json();
        if (data.error) throw new Error(data.error.message);

        const transactions = data.result || [];
        for (const tx of transactions) {
          const inMsg = tx.in_msg;
          if (!inMsg?.body) continue;

          const bodyBoc = inMsg.body;
          const bodyCell = Cell.fromBoc(Buffer.from(bodyBoc, 'base64'))[0];
          const slice = bodyCell.beginParse();
          const op = slice.loadUint(32);

          if (op === BigInt(JETTON_TRANSFER_NOTIFICATION_OP)) {
            const txAmount = slice.loadCoins();
            if (txAmount === jettonAmount && tx.transaction_id.hash === txHash) {
              setTransactionStatus('confirmed');
              setSuccess(`Withdrawal confirmed! ${amount} USDT sent to your wallet`);

              // Обновляем баланс пользователя
              const { data: userData, error } = await supabase
                .from('users')
                .update({ balance: (user?.balance || 0) - amount })
                .eq('id', userId)
                .select()
                .single();

              if (error) throw error;
              setUser(userData);

              await supabase
                .from('withdrawals')
                .update({ status: 'confirmed' })
                .eq('id', withdrawId);

              setWithdrawAmount('');
              return;
            }
          }
        }

        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(pollWithdrawal, 6000);
        } else {
          setTransactionStatus('failed');
          setError('Withdrawal timeout: not confirmed within 3 minutes');
          
          await supabase
            .from('withdrawals')
            .update({ status: 'failed' })
            .eq('id', withdrawId);
        }
      } catch (err) {
        console.error('Withdrawal tracking error:', err);
        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(pollWithdrawal, 6000);
        }
      }
    };

    pollWithdrawal();
  };

  // ==================== ПОКУПКА ФЛОУ ====================
  const handleBuy = async () => {
    const currentPrice = getCurrentPrice();
    const totalCost = currentPrice * betAmount;
    
    if (!user || user.balance < totalCost) {
      setError('Insufficient balance');
      return;
    }

    try {
      // 1. Блокируем средства
      const { data: userData, error: userError } = await supabase
        .from('users')
        .update({ 
          balance: (user.balance - totalCost),
          locked_balance: (user.locked_balance || 0) + totalCost
        })
        .eq('id', userId)
        .select()
        .single();

      if (userError) throw userError;

      // 2. Создаем ордер на покупку
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert({
          user_id: userId,
          market_id: marketId,
          outcome: prediction,
          order_type: 'buy',
          price: currentPrice,
          amount: totalCost,
          shares: betAmount,
          status: 'active'
        })
        .select()
        .single();

      if (orderError) throw orderError;

      setSuccess('Buy order created successfully! Order is now in the order book');
      setError(null);
      setUser(userData);
      setModalVisible(false);
      setPrediction(null);
      setBetAmount(1);

      // 3. Запускаем matching engine (в реальности это будет отдельный процесс)
      setTimeout(() => executeOrder(orderData.id), 1000);

    } catch (err) {
      setError(err.message || 'Failed to create buy order');
      console.error(err);
    }
  };

  // ==================== ПРОДАЖА ФЛОУ ====================
  const handleSellRequest = async () => {
    if (!selectedPosition) return;
    
    const sellShares = sellAmount || selectedPosition.shares;
    const totalValue = minPrice * sellShares;

    if (sellShares > selectedPosition.shares - (selectedPosition.locked_shares || 0)) {
      setError('Not enough shares to sell');
      return;
    }

    try {
      // 1. Блокируем акции
      const { error: lockError } = await supabase
        .from('positions')
        .update({
          locked_shares: (selectedPosition.locked_shares || 0) + sellShares
        })
        .eq('id', selectedPosition.id);

      if (lockError) throw lockError;

      // 2. Создаем ордер на продажу
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert({
          user_id: userId,
          market_id: marketId,
          outcome: selectedPosition.outcome,
          order_type: 'sell',
          price: minPrice,
          amount: totalValue,
          shares: sellShares,
          status: 'active'
        })
        .select()
        .single();

      if (orderError) throw orderError;

      setSuccess('Sell order created successfully! Order is now in the order book');
      setError(null);
      
      // Обновляем позиции
      const { data: positionsData } = await supabase
        .from('positions')
        .select('*, markets!inner(name, yes_price, no_price, resolved)')
        .eq('user_id', userId)
        .eq('markets.resolved', false);
      setPurchasedContracts(positionsData || []);
      
      setSelectedPosition(null);
      setSellAmount(0);
      setMinPrice(0);

      // 3. Запускаем matching engine
      setTimeout(() => executeOrder(orderData.id), 1000);

    } catch (err) {
      setError(err.message || 'Failed to create sell order');
      console.error(err);
    }
  };

  // ==================== MATCHING ENGINE ====================
  const executeOrder = async (newOrderId) => {
    try {
      const { data: newOrder, error: orderError } = await supabase
        .from('orders')
        .select('*')
        .eq('id', newOrderId)
        .single();

      if (orderError) throw orderError;

      const oppositeType = newOrder.order_type === 'buy' ? 'sell' : 'buy';
      
      // Ищем matching ордера
      const { data: matchingOrders, error: matchError } = await supabase
        .from('orders')
        .select('*')
        .eq('market_id', marketId)
        .eq('outcome', newOrder.outcome)
        .eq('order_type', oppositeType)
        .eq('status', 'active')
        .order('price', { ascending: newOrder.order_type === 'buy' })
        .limit(10);

      if (matchError) throw matchError;

      let remainingShares = newOrder.shares - (newOrder.filled_shares || 0);
      
      for (const matchingOrder of matchingOrders) {
        if (remainingShares <= 0) break;

        // Проверяем price matching
        if ((newOrder.order_type === 'buy' && newOrder.price >= matchingOrder.price) ||
            (newOrder.order_type === 'sell' && newOrder.price <= matchingOrder.price)) {
          
          const executableShares = Math.min(
            remainingShares,
            matchingOrder.shares - (matchingOrder.filled_shares || 0)
          );

          if (executableShares > 0) {
            const executionPrice = matchingOrder.price;
            const totalAmount = executionPrice * executableShares;
            const fee = totalAmount * 0.02;

            // Создаем сделку
            const { error: tradeError } = await supabase
              .from('trades')
              .insert({
                buy_order_id: newOrder.order_type === 'buy' ? newOrder.id : matchingOrder.id,
                sell_order_id: newOrder.order_type === 'sell' ? newOrder.id : matchingOrder.id,
                market_id: marketId,
                outcome: newOrder.outcome,
                price: executionPrice,
                shares: executableShares,
                fee: fee
              });

            if (tradeError) throw tradeError;

            // Обновляем ордера
            await updateOrderAfterExecution(newOrder.id, executableShares);
            await updateOrderAfterExecution(matchingOrder.id, executableShares);

            // Обновляем позиции и балансы
            await updateUserPositionsAfterTrade(newOrder, matchingOrder, executableShares, executionPrice, fee);

            remainingShares -= executableShares;
          }
        }
      }

      // Обновляем цены рынка
      await updateMarketPrices(marketId);

    } catch (err) {
      console.error('Error executing order:', err);
    }
  };

  const updateOrderAfterExecution = async (orderId, executedShares) => {
    const { data: order } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    const newFilledShares = (order.filled_shares || 0) + executedShares;
    const status = newFilledShares >= order.shares ? 'filled' : 
                  newFilledShares > 0 ? 'partially_filled' : 'active';

    await supabase
      .from('orders')
      .update({
        filled_shares: newFilledShares,
        status: status
      })
      .eq('id', orderId);
  };

  const updateUserPositionsAfterTrade = async (newOrder, matchingOrder, shares, price, fee) => {
    let buyerId, sellerId, buyerOutcome, sellerOutcome, buyerAmount, sellerAmount;

    if (newOrder.order_type === 'buy') {
      buyerId = newOrder.user_id;
      sellerId = matchingOrder.user_id;
      buyerOutcome = newOrder.outcome;
      sellerOutcome = matchingOrder.outcome;
      buyerAmount = price * shares;
      sellerAmount = buyerAmount - fee;
    } else {
      buyerId = matchingOrder.user_id;
      sellerId = newOrder.user_id;
      buyerOutcome = matchingOrder.outcome;
      sellerOutcome = newOrder.outcome;
      buyerAmount = price * shares;
      sellerAmount = buyerAmount - fee;
    }

    // Update buyer position and unlock funds
    const { data: buyerPosition } = await supabase
      .from('positions')
      .select('*')
      .eq('user_id', buyerId)
      .eq('market_id', marketId)
      .eq('outcome', buyerOutcome)
      .single();

    const buyerNewShares = (buyerPosition?.shares || 0) + shares;
    const buyerNewLocked = Math.max(0, (buyerPosition?.locked_shares || 0) - shares);

    await supabase
      .from('positions')
      .upsert({
        user_id: buyerId,
        market_id: marketId,
        outcome: buyerOutcome,
        shares: buyerNewShares,
        locked_shares: buyerNewLocked
      });

    await supabase
      .from('users')
      .update({ locked_balance: (user?.locked_balance || 0) - buyerAmount })
      .eq('id', buyerId);

    // Update seller position and add funds
    const { data: sellerPosition } = await supabase
      .from('positions')
      .select('*')
      .eq('user_id', sellerId)
      .eq('market_id', marketId)
      .eq('outcome', sellerOutcome)
      .single();

    const sellerNewShares = (sellerPosition?.shares || 0) - shares;
    const sellerNewLocked = Math.max(0, (sellerPosition?.locked_shares || 0) - shares);

    if (sellerNewShares <= 0) {
      await supabase
        .from('positions')
        .delete()
        .eq('id', sellerPosition.id);
    } else {
      await supabase
        .from('positions')
        .update({
          shares: sellerNewShares,
          locked_shares: sellerNewLocked
        })
        .eq('id', sellerPosition.id);
    }

    await supabase
      .from('users')
      .update({ balance: (user?.balance || 0) + sellerAmount })
      .eq('id', sellerId);
  };

  // ==================== ОСТАЛЬНЫЕ ФУНКЦИИ ====================
  
  const calculateMarketPrices = (bids, asks) => {
    if (bids.length === 0 && asks.length === 0) {
      return { yesPrice: 0.5, noPrice: 0.5 };
    }

    const bestBid = bids.length > 0 ? Math.max(...bids.map(bid => bid.price || 0)) : 0;
    const bestAsk = asks.length > 0 ? Math.min(...asks.map(ask => ask.price || 1)) : 1;

    let yesPrice;
    if (bids.length > 0 && asks.length > 0) {
      yesPrice = (bestBid + bestAsk) / 2;
    } else if (bids.length > 0) {
      yesPrice = bestBid * 0.99;
    } else {
      yesPrice = bestAsk * 1.01;
    }

    yesPrice = Math.max(0.01, Math.min(0.99, yesPrice));
    const noPrice = 1 - yesPrice;

    return { yesPrice, noPrice };
  };

  const updateMarketPrices = async (marketId) => {
    try {
      const { data: orders, error } = await supabase
        .from('orders')
        .select('*')
        .eq('market_id', marketId)
        .eq('status', 'active');

      if (error) throw error;

      const bids = orders.filter(order => order.order_type === 'buy' && order.outcome === 'yes');
      const asks = orders.filter(order => order.order_type === 'sell' && order.outcome === 'yes');

      const { yesPrice, noPrice } = calculateMarketPrices(bids, asks);

      const { error: updateError } = await supabase
        .from('markets')
        .update({ 
          yes_price: yesPrice,
          no_price: noPrice
        })
        .eq('id', marketId);

      if (updateError) throw updateError;

      setMarket({ ...market, yes_price: yesPrice, no_price: noPrice });
    } catch (err) {
      console.error('Error updating market prices:', err);
    }
  };

  const getCurrentPrice = () => {
    if (!prediction || !market) return 0.5;
    return prediction === 'yes' ? (market.yes_price || 0.5) : (market.no_price || 0.5);
  };

  const handlePositionSelect = (position) => {
    setSelectedPosition(position);
    setSellAmount(position.shares - (position.locked_shares || 0));
    setMinPrice(getCurrentPrice(position.outcome));
  };

  const getCurrentPrice = (outcome) => {
    if (!market) return 0.5;
    return outcome === 'yes' ? (market.yes_price || 0.5) : (market.no_price || 0.5);
  };

  if (market && market.resolved) {
    return (
      <Card>
        <Alert message="Market is closed" type="warning" />
      </Card>
    );
  }

  const sellableContracts = purchasedContracts.filter(
    contract => (contract.shares - (contract.locked_shares || 0)) > 0
  );

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
      {/* Transaction Status Modal */}
      <Modal
        title="Transaction Status"
        open={transactionStatus !== null}
        footer={null}
        closable={transactionStatus === 'confirmed' || transactionStatus === 'failed'}
        onCancel={() => setTransactionStatus(null)}
      >
        <div style={{ textAlign: 'center', padding: '20px' }}>
          {transactionStatus === 'pending' && (
            <>
              <Spin indicator={<LoadingOutlined style={{ fontSize: 48 }} spin />} />
              <Text style={{ display: 'block', marginTop: 16 }}>
                Waiting for transaction confirmation...
              </Text>
              {transactionHash && (
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  Hash: {transactionHash.slice(0, 10)}...{transactionHash.slice(-8)}
                </Text>
              )}
            </>
          )}
          {transactionStatus === 'confirmed' && (
            <>
              <Text type="success" strong style={{ fontSize: '16px' }}>
                ✅ Transaction Confirmed!
              </Text>
            </>
          )}
          {transactionStatus === 'failed' && (
            <>
              <Text type="danger" strong style={{ fontSize: '16px' }}>
                ❌ Transaction Failed
              </Text>
            </>
          )}
        </div>
      </Modal>

      {/* Portfolio Summary */}
      <div style={{ marginBottom: 16, padding: 12, background: '#f0f8ff', borderRadius: 8 }}>
        <Text strong>Портфель: </Text>
        <Text>{totalPortfolioValue.toFixed(2)} USDT</Text>
        <Text type="secondary" style={{ display: 'block', fontSize: '12px' }}>
          Баланс: {user?.balance?.toFixed(2) || '0.00'} USDT
          {user?.locked_balance > 0 && ` (Заблокировано: ${user.locked_balance.toFixed(2)} USDT)`}
        </Text>
      </div>

      {/* TON Wallet Connection */}
      <div style={{ marginBottom: 16, textAlign: 'center' }}>
        <TonConnectButton />
        {tonWalletConnected && (
          <Text type="success" style={{ display: 'block', fontSize: '12px' }}>
            Connected: {tonConnectUI.account?.address?.slice(0, 6)}...{tonConnectUI.account?.address?.slice(-4)}
          </Text>
        )}
      </div>

      {/* Deposit/Withdraw section */}
      <Space direction="vertical" style={{ width: '100%', marginBottom: 16 }}>
        <Space.Compact style={{ width: '100%' }}>
          <Input 
            placeholder="Deposit amount (USDT)" 
            value={depositAmount}
            onChange={(e) => setDepositAmount(e.target.value)}
            type="number"
            suffix="USDT"
          />
          <Button type="primary" onClick={handleDeposit} disabled={!tonWalletConnected}>
            Deposit via TON
          </Button>
        </Space.Compact>
        <Space.Compact style={{ width: '100%', marginTop: 8 }}>
          <Input 
            placeholder="Withdraw amount" 
            value={withdrawAmount}
            onChange={(e) => setWithdrawAmount(e.target.value)}
            type="number"
            suffix="USDT"
          />
          <Button type="primary" onClick={handleWithdraw} disabled={!tonWalletConnected}>Withdraw</Button>
        </Space.Compact>
      </Space>

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
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
            <Text type="secondary" style={{ fontSize: '12px' }}>
              ДА: {((market.yes_price || 0.5) * 100).toFixed(1)}%
            </Text>
            <Text type="secondary" style={{ fontSize: '12px' }}>
              НЕТ: {((market.no_price || 0.5) * 100).toFixed(1)}%
            </Text>
          </div>
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
                    ДА ({((market?.yes_price || 0.5) * 100).toFixed(1)}%)
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
                    НЕТ ({((market?.no_price || 0.5) * 100).toFixed(1)}%)
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
                disabled={!prediction}
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
                {sellableContracts.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 16, background: '#f9f9f9', borderRadius: 8 }}>
                    <Text type="secondary">У вас нет доступных контрактов для продажи</Text>
                  </div>
                ) : (
                  sellableContracts.map(contract => (
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
                          {contract.locked_shares > 0 && (
                            <Text type="secondary" style={{ fontSize: '12px', display: 'block' }}>
                              Заблокировано: {contract.locked_shares} шт.
                            </Text>
                          )}
                          <Text type="secondary" style={{ fontSize: '12px', display: 'block' }}>
                            Доступно: {(contract.shares - (contract.locked_shares || 0))} шт.
                          </Text>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <Text type="secondary" style={{ fontSize: '12px' }}>
                            Стоимость: {((contract.shares || 0) * getCurrentPrice(contract.outcome)).toFixed(2)} USDT
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
                      Количество для продажи (макс: {selectedPosition.shares - (selectedPosition.locked_shares || 0)})
                    </Text>
                    <Input 
                      type="number" 
                      placeholder="0" 
                      value={sellAmount}
                      onChange={(e) => {
                        const maxAvailable = selectedPosition.shares - (selectedPosition.locked_shares || 0);
                        const value = Math.min(maxAvailable, parseInt(e.target.value) || 0);
                        setSellAmount(value);
                      }}
                      min={1}
                      max={selectedPosition.shares - (selectedPosition.locked_shares || 0)}
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
                      <Text type="secondary">Потенциальная выручка:</Text>
                      <Text strong type="success">
                        {sellProfit.usdt.toFixed(2)} USDT
                      </Text>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Text type="secondary">Комиссия (2%):</Text>
                      <Text type="secondary">{(sellProfit.usdt * 0.02).toFixed(2)} USDT</Text>
                    </div>
                  </InfoBlock>

                  <Button 
                    type="primary" 
                    style={{ background: '#1890ff', borderColor: '#1890ff' }} 
                    block
                    onClick={handleSellRequest}
                    disabled={sellAmount <= 0 || minPrice <= 0 || sellAmount > (selectedPosition.shares - (selectedPosition.locked_shares || 0))}
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
            disabled={!prediction}
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
          
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Text>Доступный баланс:</Text>
            <Text strong>{user?.balance?.toFixed(2) || '0.00'} USDT</Text>
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