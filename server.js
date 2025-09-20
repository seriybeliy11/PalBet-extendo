import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';
import crypto from 'crypto'; // Для generateId

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_FILE = path.join(__dirname, 'data.json');
const PENDING_SELLS_FILE = path.join(__dirname, 'pending-sells.json');

const INITIAL_VOLATILITY = 0;
const PLATFORM_FEE = 0.02;
const LIQUIDITY_FACTOR = 0.0001;

app.use(cors());
app.use(bodyParser.json());

// ========================
// Модель данных — СИНХРОНИЗИРОВАНА СО СПЕЦИФИКАЦИЕЙ
// ========================

const initialData = {
  users: [
    {
      id: '1',
      username: 'testuser',
      email: 'test@example.com',
      tonWalletAddress: null,
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ],
  markets: [
    {
      id: '1',
      title: 'Будет ли мирное соглашение в 2025 году?',
      description: 'Предсказание на мирное соглашение.',
      endDate: '2025-12-31',
      status: 'open',
      yesPrice: 0.50,
      noPrice: 0.50,
      previousYesPrice: 0.50,
      previousNoPrice: 0.50,
      totalVolume: 0,
      volume24h: 0,
      volatility: INITIAL_VOLATILITY,
      totalLiquidity: 10000,
      priceHistory: [
        { 
          timestamp: new Date().toISOString(), 
          yesPrice: 0.50, 
          noPrice: 0.50,
          volume: 0,
          priceImpact: 0,
          transactionType: 'buy'
        }
      ],
    },
  ],
  positions: [],
  transactions: [],
  system: {
    adminWallet: process.env.ADMIN_WALLET || 'EQAdminWalletAddress',
    telegramBotToken: process.env.TELEGRAM_BOT_TOKEN,
    telegramChatId: process.env.TELEGRAM_CHAT_ID
  }
};

// ========================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ (ДОБАВЛЕНЫ/ИСПРАВЛЕНЫ)
// ========================

const generateId = () => crypto.randomUUID().replace(/-/g, '').slice(0, 9);

async function initializeData() {
  try {
    await fs.access(DATA_FILE);
  } catch {
    await saveData(initialData);
  }
}

async function loadData() {
  try {
    const data = await fs.readFile(DATA_FILE, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.warn('Loading data failed, using initial:', err.message);
    return initialData;
  }
}

async function saveData(data) {
  try {
    await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Saving data failed:', err.message);
    throw err;
  }
}

async function loadPendingSells() {
  try {
    const data = await fs.readFile(PENDING_SELLS_FILE, 'utf8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

async function savePendingSells(data) {
  try {
    await fs.writeFile(PENDING_SELLS_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Saving pending sells failed:', err.message);
    throw err;
  }
}

async function sendTelegramNotification(message) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!botToken || !chatId) {
    console.warn('Telegram config missing, skipping notification');
    return;
  }
  try {
    await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      chat_id: chatId,
      text: message,
      parse_mode: 'HTML'
    });
    console.log('Telegram notification sent');
  } catch (err) {
    console.error('Telegram notification failed:', err.message);
  }
}

function calculatePriceImpact(quantity, currentPrice, liquidityFactor) {
  const impact = quantity * liquidityFactor;
  const maxImpact = 0.1;
  return Math.sign(impact) * Math.min(Math.abs(impact), maxImpact);
}

function calculateFee(amount) {
  return amount * PLATFORM_FEE;
}

function calculateTotalCost(principalAmount) {
  const fee = calculateFee(principalAmount);
  return principalAmount + fee;
}

function updateMarketPrices(market, tradeType, quantity) {
  const currentYesPrice = market.yesPrice;
  const currentNoPrice = market.noPrice;
  
  const impact = calculatePriceImpact(
    quantity,
    tradeType === 'yes' ? currentYesPrice : currentNoPrice,
    LIQUIDITY_FACTOR
  );
  
  let newYesPrice, newNoPrice;
  
  if (tradeType === 'yes') {
    newYesPrice = Math.min(0.99, Math.max(0.01, currentYesPrice + impact));
    newNoPrice = 1 - newYesPrice;
  } else {
    newNoPrice = Math.min(0.99, Math.max(0.01, currentNoPrice + impact));
    newYesPrice = 1 - newNoPrice;
  }
  
  return {
    newYesPrice: parseFloat(newYesPrice.toFixed(4)),
    newNoPrice: parseFloat(newNoPrice.toFixed(4)),
    priceImpact: parseFloat(impact.toFixed(4))
  };
}

function getMarketWithCoefficients(market) {
  if (!market) return null;

  const yesCoefficient = (1 / market.yesPrice).toFixed(2);
  const noCoefficient = (1 / market.noPrice).toFixed(2);
  const yesChange = (market.yesPrice - market.previousYesPrice).toFixed(4);
  const noChange = (market.noPrice - market.previousNoPrice).toFixed(4);
  const yesTrend = yesChange > 0 ? 'up' : 'down';
  const noTrend = noChange > 0 ? 'up' : 'down';

  return {
    ...market,
    yesCoefficient: parseFloat(yesCoefficient),
    noCoefficient: parseFloat(noCoefficient),
    yesChange: Math.abs(parseFloat(yesChange)),
    noChange: Math.abs(parseFloat(noChange)),
    yesTrend,
    noTrend,
  };
}

// ========================
// ЭНДПОИНТЫ
// ========================

// --- User ---
app.get('/api/user/:userId', async (req, res) => {
  try {
    const data = await loadData();
    const user = data.users.find(u => u.id === req.params.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

app.post('/api/user/:userId/wallet', async (req, res) => {
  try {
    const { walletAddress } = req.body;
    if (!walletAddress) return res.status(400).json({ message: 'Wallet address required' });
    const data = await loadData();
    const user = data.users.find(u => u.id === req.params.userId);
    
    if (!user) return res.status(404).json({ message: 'User not found' });
    
    user.tonWalletAddress = walletAddress;
    user.updatedAt = new Date().toISOString();
    await saveData(data);
    
    res.json({ message: 'Wallet updated successfully', tonWalletAddress: walletAddress });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// --- Positions ---
app.get('/api/positions/:userId', async (req, res) => {
  try {
    const data = await loadData();
    const userPositions = data.positions
      .filter(pos => pos.userId === req.params.userId)
      .map(pos => {
        const market = data.markets.find(m => m.id === pos.marketId);
        if (!market) return pos; // Fallback if market gone
        const currentPrice = pos.type === 'yes' ? market.yesPrice : market.noPrice;
        return {
          ...pos,
          currentPrice,
          currentValue: currentPrice * pos.quantity,
          unrealizedPnL: (currentPrice - pos.purchasePrice) * pos.quantity,
        };
      });
    res.json(userPositions);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// --- Market ---
app.get('/api/market/:marketId', async (req, res) => {
  try {
    const data = await loadData();
    const market = data.markets.find(m => m.id === req.params.marketId);
    if (!market) return res.status(404).json({ message: 'Market not found' });
    const marketData = getMarketWithCoefficients(market);
    res.json(marketData);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// --- Buy ---
app.post('/api/buy', async (req, res) => {
  const { userId, marketId, type, quantity, offerPrice, tonTxHash } = req.body;

  // Валидация
  if (!['yes', 'no'].includes(type)) return res.status(400).json({ message: 'Invalid type: must be "yes" or "no"' });
  if (quantity <= 0) return res.status(400).json({ message: 'Quantity must be positive' });

  try {
    const data = await loadData();
    const user = data.users.find(u => u.id === userId);
    const market = data.markets.find(m => m.id === marketId);

    if (!user || !market) return res.status(404).json({ message: 'User or Market not found' });
    if (!user.tonWalletAddress) return res.status(400).json({ message: 'Wallet address not set' });
    if (!tonTxHash) return res.status(400).json({ message: 'Payment transaction hash required' });

    // TODO: Verify TON txHash via TON API (e.g., toncenter.com)

    const currentPrice = type === 'yes' ? market.yesPrice : market.noPrice;
    if (offerPrice < currentPrice) {
      return res.status(400).json({ 
        message: 'Offer price too low (must be >= current price)', 
        currentPrice,
        offerPrice
      });
    }

    const principalAmount = currentPrice * quantity;
    const fee = calculateFee(principalAmount);
    const totalCost = calculateTotalCost(principalAmount);

    await sendTelegramNotification(
      `🛒 <b>НОВАЯ ПОКУПКА</b>\n\n` +
      `👤 Пользователь: ${user.username}\n` +
      `📊 Рынок: ${market.title}\n` +
      `📈 Тип: ${type.toUpperCase()}\n` +
      `🔢 Количество: ${quantity}\n` +
      `💰 Сумма: ${totalCost.toFixed(2)} USD\n` +
      `📝 TX Hash: ${tonTxHash}\n` +
      `👛 Кошелек: ${user.tonWalletAddress}`
    );

    const newPrices = updateMarketPrices(market, type, quantity);
    
    market.previousYesPrice = market.yesPrice;
    market.previousNoPrice = market.noPrice;
    market.yesPrice = newPrices.newYesPrice;
    market.noPrice = newPrices.newNoPrice;
    market.totalVolume += quantity;
    market.volume24h += quantity;
    market.volatility = (market.volatility * 0.9) + (Math.abs(newPrices.priceImpact) * 0.1);

    let position = data.positions.find(p => p.userId === userId && p.marketId === marketId && p.type === type);

    if (position) {
      const oldInvestment = position.purchasePrice * position.quantity;
      const newInvestment = currentPrice * quantity;
      position.purchasePrice = (oldInvestment + newInvestment) / (position.quantity + quantity);
      position.quantity += quantity;
      position.currentPrice = currentPrice;
      position.updatedAt = new Date().toISOString();
    } else {
      position = {
        id: generateId(),
        userId,
        marketId,
        type,
        quantity,
        purchasePrice: currentPrice,
        currentPrice: currentPrice,
        totalInvested: principalAmount,
        totalFees: fee,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      data.positions.push(position);
    }

    market.priceHistory.push({
      timestamp: new Date().toISOString(),
      yesPrice: market.yesPrice,
      noPrice: market.noPrice,
      volume: quantity,
      priceImpact: newPrices.priceImpact,
      transactionType: 'buy'
    });

    const transaction = {
      id: generateId(),
      userId,
      type: 'deposit',
      status: 'completed',
      amount: totalCost,
      currency: 'USDT',
      fromAddress: user.tonWalletAddress,
      toAddress: data.system.adminWallet,
      txHash: tonTxHash,
      createdAt: new Date().toISOString(),
      metadata: {
        marketId,
        contractType: type,
        quantity
      }
    };
    data.transactions.push(transaction);

    await saveData(data);

    res.json({
      message: 'Buy order placed successfully',
      position,
      transaction,
      marketUpdate: {
        newYesPrice: market.yesPrice,
        newNoPrice: market.noPrice,
        priceImpact: newPrices.priceImpact
      }
    });

  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// --- Sell Request ---
app.post('/api/sell/request', async (req, res) => {
  const { userId, positionId, quantity, minPrice } = req.body;

  // Валидация
  if (quantity <= 0) return res.status(400).json({ message: 'Quantity must be positive' });

  try {
    const data = await loadData();
    const position = data.positions.find(p => p.id === positionId);
    const user = data.users.find(u => u.id === userId);
    const market = data.markets.find(m => m.id === position?.marketId);

    if (!position || !user || !market)
      return res.status(404).json({ message: 'Not found' });
    if (position.userId !== userId)
      return res.status(403).json({ message: 'Unauthorized' });
    if (quantity > position.quantity)
      return res.status(400).json({ message: 'Insufficient quantity' });

    const currentPrice = position.type === 'yes' ? market.yesPrice : market.noPrice;
    if (minPrice > currentPrice) {
      return res.status(400).json({ 
        message: 'Min price higher than current price', 
        currentPrice,
        minPrice
      });
    }

    const principalAmount = currentPrice * quantity;
    const fee = calculateFee(principalAmount);
    const netProceeds = principalAmount - fee;

    const pendingSells = await loadPendingSells();
    const sellRequest = {
      id: generateId(),
      userId,
      positionId,
      marketId: position.marketId,
      contractType: position.type,
      quantity,
      requestedPrice: currentPrice,
      minPrice,
      principalAmount,
      fee,
      netProceeds,
      userWallet: user.tonWalletAddress,
      status: 'pending',
      createdAt: new Date().toISOString(),
      marketTitle: market.title,
      username: user.username
    };

    pendingSells.push(sellRequest);
    await savePendingSells(pendingSells);

    await sendTelegramNotification(
      `💰 <b>ЗАПРОС НА ПРОДАЖУ</b>\n\n` +
      `👤 Пользователь: ${user.username}\n` +
      `📊 Рынок: ${market.title}\n` +
      `📈 Тип: ${position.type.toUpperCase()}\n` +
      `🔢 Количество: ${quantity}\n` +
      `💵 Цена: ${currentPrice.toFixed(4)}\n` +
      `📉 Min цена: ${minPrice}\n` +
      `💸 Выручка: ${netProceeds.toFixed(2)} USD\n` +
      `👛 Кошелек: ${user.tonWalletAddress}\n\n` +
      `🆔 ID: ${sellRequest.id}\n\n` +
      `✅ Для подтверждения: /confirm_sell_${sellRequest.id}\n` +
      `❌ Для отмены: /cancel_sell_${sellRequest.id}`
    );

    res.json({
      message: 'Sell request submitted. Waiting for admin confirmation.',
      requestId: sellRequest.id,
      status: 'pending'
    });

  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// --- Confirm Sell ---
app.post('/api/sell/confirm/:requestId', async (req, res) => {
  const { requestId } = req.params;
  const { adminSignature } = req.body;

  try {
    const pendingSells = await loadPendingSells();
    const sellRequest = pendingSells.find(req => req.id === requestId);
    
    if (!sellRequest) return res.status(404).json({ message: 'Sell request not found' });
    if (sellRequest.status !== 'pending') return res.status(400).json({ message: 'Request already processed' });
    if (!adminSignature) return res.status(400).json({ message: 'Admin signature required' });

    const data = await loadData();
    const position = data.positions.find(p => p.id === sellRequest.positionId);
    const user = data.users.find(u => u.id === sellRequest.userId);
    const market = data.markets.find(m => m.id === sellRequest.marketId);

    if (!position || !user || !market) return res.status(404).json({ message: 'Related data not found' });

    // Проверяем, не упала ли цена ниже minPrice на момент confirm
    const currentPrice = sellRequest.contractType === 'yes' ? market.yesPrice : market.noPrice;
    if (currentPrice < sellRequest.minPrice) {
      return res.status(400).json({ 
        message: 'Current price below minPrice', 
        currentPrice,
        minPrice: sellRequest.minPrice
      });
    }

    const newPrices = updateMarketPrices(market, sellRequest.contractType, -sellRequest.quantity);
    
    market.previousYesPrice = market.yesPrice;
    market.previousNoPrice = market.noPrice;
    market.yesPrice = newPrices.newYesPrice;
    market.noPrice = newPrices.newNoPrice;
    market.totalVolume += sellRequest.quantity;
    market.volume24h += sellRequest.quantity;

    position.quantity -= sellRequest.quantity;
    position.currentPrice = sellRequest.requestedPrice;
    position.updatedAt = new Date().toISOString();
    
    if (position.quantity <= 0) {
      data.positions = data.positions.filter(p => p.id !== sellRequest.positionId);
    }

    market.priceHistory.push({
      timestamp: new Date().toISOString(),
      yesPrice: market.yesPrice,
      noPrice: market.noPrice,
      volume: sellRequest.quantity,
      priceImpact: newPrices.priceImpact,
      transactionType: 'sell'
    });

    const transaction = {
      id: generateId(),
      userId: sellRequest.userId,
      type: 'payout',
      status: 'completed',
      amount: sellRequest.netProceeds,
      currency: 'USDT',
      fromAddress: data.system.adminWallet,
      toAddress: user.tonWalletAddress,
      txHash: `payout_${generateId()}`, // TODO: Заменить на реальный хэш после отправки в TON
      createdAt: new Date().toISOString(),
      confirmedAt: new Date().toISOString(),
      metadata: {
        marketId: sellRequest.marketId,
        contractType: sellRequest.contractType,
        quantity: sellRequest.quantity,
        positionId: sellRequest.positionId,
        adminSignature
      }
    };
    data.transactions.push(transaction);

    sellRequest.status = 'completed';
    sellRequest.completedAt = new Date().toISOString();
    sellRequest.adminSignature = adminSignature;

    await saveData(data);
    await savePendingSells(pendingSells.filter(req => req.id !== requestId));

    await sendTelegramNotification(
      `✅ <b>ПРОДАЖА ПОДТВЕРЖДЕНА</b>\n\n` +
      `🆔 ID: ${requestId}\n` +
      `👤 Пользователь: ${user.username}\n` +
      `💸 Выплачено: ${sellRequest.netProceeds.toFixed(2)} USD\n` +
      `👛 На кошелек: ${user.tonWalletAddress}`
    );

    res.json({
      message: 'Sell confirmed successfully',
      transaction,
      payout: {
        amount: sellRequest.netProceeds,
        wallet: user.tonWalletAddress
      }
    });

  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// --- Cancel Sell (ДОБАВЛЕН) ---
app.post('/api/sell/cancel/:requestId', async (req, res) => {
  const { requestId } = req.params;
  const { adminSignature } = req.body;

  try {
    if (!adminSignature) return res.status(400).json({ message: 'Admin signature required' });

    const pendingSells = await loadPendingSells();
    const sellRequestIndex = pendingSells.findIndex(req => req.id === requestId);
    
    if (sellRequestIndex === -1) return res.status(404).json({ message: 'Sell request not found' });
    if (pendingSells[sellRequestIndex].status !== 'pending') return res.status(400).json({ message: 'Request already processed' });

    const sellRequest = pendingSells[sellRequestIndex];
    sellRequest.status = 'cancelled';
    sellRequest.cancelledAt = new Date().toISOString();
    sellRequest.adminSignature = adminSignature;

    await savePendingSells(pendingSells);

    const data = await loadData();
    const user = data.users.find(u => u.id === sellRequest.userId);
    await sendTelegramNotification(
      `❌ <b>ПРОДАЖА ОТМЕНЕНА</b>\n\n` +
      `🆔 ID: ${requestId}\n` +
      `👤 Пользователь: ${user?.username || 'Unknown'}\n` +
      `📊 Рынок: ${sellRequest.marketTitle}`
    );

    res.json({ message: 'Sell request cancelled successfully' });

  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// --- Monthly Performance (ИСПРАВЛЕН: по последним 12 месяцам) ---
app.get('/api/user/:userId/monthly-performance', async (req, res) => {
  try {
    const data = await loadData();
    const userId = req.params.userId;
    const userTransactions = data.transactions.filter(t => t.userId === userId && t.status === 'completed');
    
    if (userTransactions.length === 0) {
      const months = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];
      const emptyData = months.map(month => ({ month, value: 0 }));
      return res.json(emptyData);
    }
    
    // Группировка по последним 12 месяцам
    const now = new Date();
    const monthlyPerformance = {};
    for (let i = 11; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      monthlyPerformance[monthKey] = 0;
    }
    
    userTransactions.forEach(transaction => {
      const date = new Date(transaction.createdAt);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (monthlyPerformance[monthKey] !== undefined) {
        if (transaction.type === 'deposit') {
          monthlyPerformance[monthKey] -= transaction.amount;
        } else if (transaction.type === 'payout') {
          monthlyPerformance[monthKey] += transaction.amount;
        }
      }
    });
    
    const months = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];
    const chartData = Object.keys(monthlyPerformance).sort().map(key => {
      const [year, monthNum] = key.split('-');
      const monthIndex = parseInt(monthNum) - 1;
      return {
        month: months[monthIndex],
        value: Math.round(monthlyPerformance[key] * 100) / 100
      };
    });
    
    res.json(chartData);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

app.listen(PORT, async () => {
  await initializeData(); // Инициализация при старте
  console.log(`Server running on port ${PORT}`);
});