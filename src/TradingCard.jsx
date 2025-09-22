import React, { useState, useEffect } from 'react';
import { Button, Card, Space, Typography, Input, Slider, Divider, Modal, Tag, Alert } from 'antd';
import { ShoppingCartOutlined, DollarOutlined } from '@ant-design/icons';
import styled from 'styled-components';
import { createClient } from '@supabase/supabase-js';
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
  const [offerPrice, setOfferPrice] = useState(0.5);
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

  const userId = 1;
  const marketId = 1;

  // Validate platform wallet
  const validateTonAddress = (addressStr) => {
    try {
      Address.parse(addressStr);
      return true;
    } catch {
      return false;
    }
  };

  const isPlatformWalletValid = validateTonAddress(PLATFORM_WALLET.toString());

  useEffect(() => {
    setTonWalletConnected(tonConnectUI.connected);
  }, [tonConnectUI.connected]);

  // Helper for Jetton nano
  const toJettonNano = (amount) => BigInt(Math.floor(amount * 10 ** USDT_DECIMALS));

  // Get Jetton wallet address via runGetMethod
  const getJettonWalletAddress = async (masterAddress, ownerAddress) => {
    const inputCell = beginCell()
      .storeUint(0, 32) // op get_wallet_address
      .storeAddress(ownerAddress)
      .endCell();

    const response = await fetch(TON_API_URL, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        ...(TON_API_KEY && { 'X-API-Key': TON_API_KEY })
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

    if (data.result.exit_code !== 0) throw new Error(`Exit code: ${data.result.exit_code}`);

    const boc = data.result.stack[0][1]; // base64 BOC of address
    const cell = Cell.fromBoc(Buffer.from(boc, 'base64'))[0];
    const slice = cell.beginParse();
    return slice.loadAddress();
  };

  // Check deposit status via getTransactions polling
  const checkDepositStatus = async (depositId, queryId, expectedAmount) => {
    const platformJettonWallet = await getJettonWalletAddress(USDT_MASTER_ADDRESS, PLATFORM_WALLET);
    const platformJettonWalletStr = platformJettonWallet.toString();
    const jettonAmount = toJettonNano(expectedAmount);
    let attempts = 0;
    const maxAttempts = 12; // ~1 min at 5s

    const poll = async () => {
      try {
        const response = await fetch(TON_API_URL, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            ...(TON_API_KEY && { 'X-API-Key': TON_API_KEY })
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: Date.now(),
            method: 'getTransactions',
            params: {
              address: platformJettonWalletStr,
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
              // Confirmed: Update DB and balance
              const { error: updateError } = await supabase
                .from('deposits')
                .update({ 
                  status: 'confirmed',
                  tx_lt: BigInt(tx.transaction_id.lt),
                  tx_hash: tx.transaction_id.hash 
                })
                .eq('id', depositId);

              if (updateError) {
                console.error('Deposit update error:', updateError);
                return;
              }

              const { data: userData, error: balError } = await supabase
                .from('users')
                .update({ balance: (user?.balance || 0) + expectedAmount })
                .eq('id', userId)
                .select()
                .single();

              if (balError) {
                console.error('Balance update error:', balError);
              } else {
                setUser(userData);
                setSuccess(`Deposit confirmed: +${expectedAmount.toFixed(2)} USDT`);
              }
              return true; // Stop polling
            }
          }
        }
      } catch (err) {
        console.error('Polling error:', err);
      }

      attempts++;
      if (attempts < maxAttempts) {
        setTimeout(poll, 5000);
      } else {
        const { error } = await supabase
          .from('deposits')
          .update({ status: 'failed' })
          .eq('id', depositId);
        if (!error) {
          setError('Deposit timeout: Transaction not confirmed within 1 minute');
        }
      }
    };

    poll();
  };

  // Функции для расчета и обновления коэффициентов
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

      return { yesPrice, noPrice };
    } catch (err) {
      console.error('Error updating market prices:', err);
      return { yesPrice: 0.5, noPrice: 0.5 };
    }
  };

  const unlockUserFunds = async (userId, amount) => {
    try {
      const { data: userData } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (userData) {
        await supabase
          .from('users')
          .update({ 
            locked_balance: Math.max(0, (userData.locked_balance || 0) - amount)
          })
          .eq('id', userId);
      }
    } catch (err) {
      console.error('Error unlocking funds:', err);
    }
  };

  const updateOrderFill = async (orderId, shares) => {
    try {
      const { data: order } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .single();

      if (!order) return;

      const newFilledShares = (order.filled_shares || 0) + shares;
      const status = newFilledShares >= order.shares ? 'filled' : 
                    newFilledShares > 0 ? 'partially_filled' : 'active';

      await supabase
        .from('orders')
        .update({
          filled_shares: newFilledShares,
          status: status,
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId);
    } catch (err) {
      console.error('Error updating order fill:', err);
    }
  };

  const updateUserPosition = async (userId, marketId, outcome, shares, amount, type) => {
    try {
      const { data: existingPosition } = await supabase
        .from('positions')
        .select('*')
        .eq('user_id', userId)
        .eq('market_id', marketId)
        .eq('outcome', outcome)
        .single();

      const newShares = (existingPosition?.shares || 0) + shares;
      const newLockedShares = Math.max(0, (existingPosition?.locked_shares || 0) - Math.abs(shares));
      
      if (newShares === 0 && existingPosition) {
        await supabase
          .from('positions')
          .delete()
          .eq('id', existingPosition.id);
      } else {
        await supabase
          .from('positions')
          .upsert({
            user_id: userId,
            market_id: marketId,
            outcome: outcome,
            shares: newShares,
            locked_shares: newLockedShares,
            ...(existingPosition ? {} : { id: undefined })
          }, {
            onConflict: ['user_id', 'market_id', 'outcome']
          });
      }

      const { data: userData } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (userData) {
        if (type === 'buy') {
          await supabase
            .from('users')
            .update({ balance: userData.balance - amount })
            .eq('id', userId);
        } else {
          await supabase
            .from('users')
            .update({ balance: userData.balance + amount })
            .eq('id', userId);
        }
      }
    } catch (err) {
      console.error('Error updating user position:', err);
    }
  };

  const executeOrder = async (newOrderId) => {
    try {
      const { data: newOrder, error: orderError } = await supabase
        .from('orders')
        .select('*')
        .eq('id', newOrderId)
        .single();

      if (orderError) throw orderError;

      const oppositeType = newOrder.order_type === 'buy' ? 'sell' : 'buy';
      
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

            await updateOrderFill(newOrder.id, executableShares);
            await updateOrderFill(matchingOrder.id, executableShares);

            await updateUserPosition(
              newOrder.user_id, 
              marketId, 
              newOrder.outcome, 
              executableShares, 
              totalAmount, 
              'buy'
            );

            await updateUserPosition(
              matchingOrder.user_id, 
              marketId, 
              matchingOrder.outcome, 
              -executableShares, 
              totalAmount - fee, 
              'sell'
            );

            await unlockUserFunds(newOrder.user_id, totalAmount);
            await unlockUserFunds(matchingOrder.user_id, totalAmount);

            remainingShares -= executableShares;
          }
        }
      }

      if (remainingShares === 0) {
        await supabase
          .from('orders')
          .update({ status: 'filled' })
          .eq('id', newOrder.id);
      } else if (remainingShares < newOrder.shares) {
        await supabase
          .from('orders')
          .update({ status: 'partially_filled' })
          .eq('id', newOrder.id);
      }

    } catch (err) {
      console.error('Error executing order:', err);
    }
  };

  // Calculate total portfolio value
  useEffect(() => {
    const calculatePortfolioValue = async () => {
      if (!purchasedContracts.length || !market) return;
      
      let totalValue = 0;
      for (const pos of purchasedContracts) {
        const price = pos.outcome === 'yes' ? (market.yes_price || 0.5) : (market.no_price || 0.5);
        totalValue += (pos.shares || 0) * price;
      }
      setTotalPortfolioValue(totalValue);
    };
    calculatePortfolioValue();
  }, [purchasedContracts, market]);

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
        const { data, error } = await supabase
          .from('orders')
          .select('*')
          .eq('market_id', marketId)
          .eq('outcome', prediction)
          .eq('status', 'active');

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
  }, [prediction, marketId]);

  // Real-time subscriptions
  useEffect(() => {
    const ordersSubscription = supabase
      .channel('orders-changes')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'orders',
          filter: `market_id=eq.${marketId}`
        }, 
        async () => {
          if (prediction) {
            const { data } = await supabase
              .from('orders')
              .select('*')
              .eq('market_id', marketId)
              .eq('outcome', prediction)
              .eq('status', 'active');
            
            if (data) {
              const bids = data.filter(order => order.order_type === 'buy');
              const asks = data.filter(order => order.order_type === 'sell');
              setOrderBook({ bids, asks });
            }
          }
          await updateMarketPrices(marketId);
        }
      )
      .subscribe();

    const marketsSubscription = supabase
      .channel('markets-changes')
      .on('postgres_changes', 
        { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'markets',
          filter: `id=eq.${marketId}`
        }, 
        (payload) => {
          setMarket(payload.new);
        }
      )
      .subscribe();

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
      marketsSubscription.unsubscribe();
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
  }, [prediction, betAmount, orderBook, market]);

  // Calculate sell value
  useEffect(() => {
    if (selectedPosition && minPrice > 0) {
      const sellValue = minPrice * (sellAmount || selectedPosition.shares || 0);
      setSellProfit({ usdt: sellValue });
    } else {
      setSellProfit({ usdt: 0 });
    }
  }, [selectedPosition, minPrice, sellAmount]);

  // Get current price based on market data
  const getCurrentPrice = () => {
    if (!prediction || !market) return 0.5;
    return prediction === 'yes' ? (market.yes_price || 0.5) : (market.no_price || 0.5);
  };

  const handleDeposit = async () => {
    if (!isPlatformWalletValid) {
      setError('Invalid platform wallet address');
      return;
    }

    if (!tonWalletConnected) {
      setError('Please connect your TON wallet first');
      return;
    }

    const amount = parseFloat(depositAmount);
    if (!amount || amount <= 0) {
      setError('Please enter a valid deposit amount');
      return;
    }

    try {
      const userAddr = Address.parse(tonConnectUI.account.address);
      const userJettonWallet = await getJettonWalletAddress(USDT_MASTER_ADDRESS, userAddr);
      const platformJettonWallet = await getJettonWalletAddress(USDT_MASTER_ADDRESS, PLATFORM_WALLET);

      // Generate unique queryId
      const queryId = BigInt(Math.floor(Math.random() * Number(2n ** 64n)));
      const jettonAmount = toJettonNano(amount);

      const body = beginCell()
        .storeUint(JETTON_TRANSFER_OP, 32)
        .storeUint(queryId, 64)
        .storeCoins(jettonAmount)
        .storeAddress(platformJettonWallet)
        .storeAddress(userAddr)
        .storeMaybeRef(null)
        .storeCoins(toNano('0.05'))
        .storeMaybeRef(beginCell().storeStringTail('Deposit to platform').endCell())
        .endCell();

      const messages = [
        {
          address: userJettonWallet.toString({ bounceable: true, urlSafe: true }),
          amount: toNano('0.1').toString(),
          payload: body.toBoc().toString('base64'),
        },
      ];

      const txResult = await tonConnectUI.sendTransaction({
        validUntil: Math.floor(Date.now() / 1000) + 360,
        messages,
      });

      // Record pending in deposits
      const { data: depositData, error: depositError } = await supabase
        .from('deposits')
        .insert({
          user_id: userId,
          query_id: queryId.toString(),
          amount,
          status: 'pending'
        })
        .select()
        .single();

      if (depositError) throw depositError;

      setSuccess(`Deposit initiated. Query ID: ${queryId.toString()}. Awaiting confirmation...`);
      setError(null);
      setDepositAmount('');

      // Start polling for confirmation
      checkDepositStatus(depositData.id, queryId, amount);

    } catch (err) {
      setError('Failed to process TON deposit: ' + err.message);
      console.error(err);
    }
  };

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

    try {
      const { data: userData, error } = await supabase
        .from('users')
        .update({ balance: (user?.balance || 0) - amount })
        .eq('id', userId)
        .select()
        .single();

      if (error) throw error;

      setUser(userData);
      setSuccess(`Successfully withdrew ${amount} USDT`);
      setError(null);
      setWithdrawAmount('');
    } catch (err) {
      setError('Failed to process withdrawal');
      console.error(err);
    }
  };

  const handleBuy = async () => {
    const currentPrice = getCurrentPrice();
    const totalCost = currentPrice * betAmount;
    
    if (!user || user.balance < totalCost) {
      setError('Insufficient balance');
      return;
    }

    try {
      // Block funds
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

      // Create order
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

      // Execute order against matching orders
      await executeOrder(orderData.id);

      // Update market prices
      await updateMarketPrices(marketId);

      setSuccess('Buy order placed successfully!');
      setError(null);
      setUser(userData);
      setModalVisible(false);
      setPrediction(null);
      setBetAmount(1);
    } catch (err) {
      setError(err.message || 'Failed to buy contracts');
      console.error(err);
    }
  };

  const handleSellRequest = async () => {
    if (!selectedPosition) return;
    
    const sellShares = sellAmount || selectedPosition.shares;
    const currentPrice = getCurrentPrice();
    const totalValue = currentPrice * sellShares;

    if (sellShares > selectedPosition.shares) {
      setError('Not enough shares to sell');
      return;
    }

    try {
      // Block shares
      const { error: lockError } = await supabase
        .from('positions')
        .update({
          locked_shares: (selectedPosition.locked_shares || 0) + sellShares
        })
        .eq('id', selectedPosition.id);

      if (lockError) throw lockError;

      // Create sell order
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

      // Execute order
      await executeOrder(orderData.id);

      // Update market prices
      await updateMarketPrices(marketId);

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
          <Button type="primary" onClick={handleDeposit} disabled={!tonWalletConnected || !isPlatformWalletValid}>
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
          <Button type="primary" onClick={handleWithdraw}>Withdraw</Button>
        </Space.Compact>
        {!isPlatformWalletValid && (
          <Alert message="Platform wallet validation failed" type="error" />
        )}
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
              ДА: {(market.yes_price * 100).toFixed(1)}%
            </Text>
            <Text type="secondary" style={{ fontSize: '12px' }}>
              НЕТ: {(market.no_price * 100).toFixed(1)}%
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
                    ДА ({(market?.yes_price * 100)?.toFixed(1)}%)
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
                    НЕТ ({(market?.no_price * 100)?.toFixed(1)}%)
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
                          {contract.locked_shares > 0 && (
                            <Text type="secondary" style={{ fontSize: '12px', display: 'block' }}>
                              Заблокировано: {contract.locked_shares} шт.
                            </Text>
                          )}
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