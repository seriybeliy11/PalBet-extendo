import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Get __dirname in ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to JSON file
const DATA_FILE = path.join(__dirname, 'data.json');

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Initial data structure
const initialData = {
  users: [
    {
      id: '1',
      username: 'testuser',
      email: 'test@example.com',
      password: 'testpassword',
      balance: 1000,
    },
  ],
  markets: [
    {
      id: '1',
      title: 'Будет ли мирное соглашение в 2025 году?',
      description: 'Предсказание на мирное соглашение.',
      resolutionDate: '2025-12-31',
      status: 'open',
      yesPrice: 0.62,
      noPrice: 0.38,
      previousYesPrice: 0.62,
      previousNoPrice: 0.38,
      priceHistory: [
        { timestamp: '2023-01-01T00:00:00Z', yesPrice: 0.50, noPrice: 0.50 },
        { timestamp: '2023-02-01T00:00:00Z', yesPrice: 0.55, noPrice: 0.45 },
        { timestamp: '2023-03-01T00:00:00Z', yesPrice: 0.52, noPrice: 0.48 },
        { timestamp: '2023-04-01T00:00:00Z', yesPrice: 0.58, noPrice: 0.42 },
        { timestamp: '2023-05-01T00:00:00Z', yesPrice: 0.60, noPrice: 0.40 },
        { timestamp: '2023-06-01T00:00:00Z', yesPrice: 0.62, noPrice: 0.38 },
      ],
    },
  ],
  positions: [
    {
      id: '1',
      userId: '1',
      marketId: '1',
      type: 'yes',
      quantity: 10,
      purchasePrice: 0.45,
      currentPrice: 0.62,
      purchaseDate: '2023-10-15',
    },
    {
      id: '2',
      userId: '1',
      marketId: '1',
      type: 'no',
      quantity: 5,
      purchasePrice: 0.55,
      currentPrice: 0.38,
      purchaseDate: '2023-10-10',
    },
    {
      id: '3',
      userId: '1',
      marketId: '1',
      type: 'yes',
      quantity: 3,
      purchasePrice: 0.52,
      currentPrice: 0.62,
      purchaseDate: '2023-10-05',
    },
  ],
  transactions: [],
};

// Initialize data file if it doesn't exist
async function initializeData() {
  try {
    await fs.access(DATA_FILE);
  } catch {
    await fs.writeFile(DATA_FILE, JSON.stringify(initialData, null, 2));
  }
}

// Load data from JSON file
async function loadData() {
  try {
    const rawData = await fs.readFile(DATA_FILE, 'utf-8');
    return JSON.parse(rawData);
  } catch (err) {
    console.error('Error loading data:', err);
    return initialData;
  }
}

// Save data to JSON file
async function saveData(data) {
  try {
    await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Error saving data:', err);
  }
}

// Helper to generate unique IDs
const generateId = () => Math.random().toString(36).substr(2, 9);

// Helper to compute coefficients and changes
function getMarketWithCoefficients(market) {
  if (!market) return null;

  const yesCoefficient = (1 / market.yesPrice).toFixed(2);
  const noCoefficient = (1 / market.noPrice).toFixed(2);
  const yesChange = (market.yesPrice - market.previousYesPrice).toFixed(2);
  const noChange = (market.noPrice - market.previousNoPrice).toFixed(2);
  const yesTrend = yesChange > 0 ? 'up' : 'down';
  const noTrend = noChange > 0 ? 'up' : 'down';

  return {
    ...market,
    yesCoefficient,
    noCoefficient,
    yesChange: Math.abs(yesChange),
    noChange: Math.abs(noChange),
    yesTrend,
    noTrend,
  };
}

// Initialize data file
initializeData();

// Endpoints

// Get User Info
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

// Get Positions for User
app.get('/api/positions/:userId', async (req, res) => {
  try {
    const data = await loadData();
    const userPositions = data.positions
      .filter(pos => pos.userId === req.params.userId)
      .map(pos => {
        const market = data.markets.find(m => m.id === pos.marketId);
        return {
          ...pos,
          currentPrice: pos.type === 'yes' ? market.yesPrice : market.noPrice,
        };
      });
    res.json(userPositions);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Get Market Info with Coefficients
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

// Get Market Price History
app.get('/api/market/:marketId/price-history', async (req, res) => {
  try {
    const data = await loadData();
    const market = data.markets.find(m => m.id === req.params.marketId);
    if (!market) return res.status(404).json({ message: 'Market not found' });
    res.json(market.priceHistory || []);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Buy Contract
app.post('/api/buy', async (req, res) => {
  const { userId, marketId, type, quantity, offerPrice } = req.body;

  try {
    const data = await loadData();
    const user = data.users.find(u => u.id === userId);
    const market = data.markets.find(m => m.id === marketId);

    if (!user || !market) return res.status(404).json({ message: 'User or Market not found' });

    const currentPrice = type === 'yes' ? market.yesPrice : market.noPrice;
    if (offerPrice > currentPrice)
      return res.status(400).json({ message: 'Offer price too high' });

    const totalCost = offerPrice * quantity;
    if (user.balance < totalCost)
      return res.status(400).json({ message: 'Insufficient balance' });

    // Update user balance
    user.balance -= totalCost;

    // Create or update position
    let position = data.positions.find(p => p.userId === userId && p.marketId === marketId && p.type === type);
    if (position) {
      const oldTotal = position.purchasePrice * position.quantity;
      const newTotal = oldTotal + totalCost;
      position.purchasePrice = newTotal / (position.quantity + quantity);
      position.quantity += quantity;
      position.currentPrice = currentPrice;
    } else {
      position = {
        id: generateId(),
        userId,
        marketId,
        type,
        quantity,
        purchasePrice: offerPrice,
        currentPrice,
        purchaseDate: new Date().toISOString().split('T')[0],
      };
      data.positions.push(position);
    }

    // Log transaction
    data.transactions.push({
      id: generateId(),
      userId,
      marketId,
      type: 'buy',
      contractType: type,
      quantity,
      price: offerPrice,
      totalCost,
      timestamp: new Date().toISOString(),
    });

    // Update market prices and add to price history
    if (type === 'yes') {
      market.previousYesPrice = market.yesPrice;
      market.yesPrice = Math.min(0.99, market.yesPrice + 0.01);
      market.noPrice = 1 - market.yesPrice;
      market.previousNoPrice = market.noPrice;
    } else {
      market.previousNoPrice = market.noPrice;
      market.noPrice = Math.min(0.99, market.noPrice + 0.01);
      market.yesPrice = 1 - market.noPrice;
      market.previousYesPrice = market.yesPrice;
    }
    if (!market.priceHistory) market.priceHistory = [];
    market.priceHistory.push({
      timestamp: new Date().toISOString(),
      yesPrice: market.yesPrice,
      noPrice: market.noPrice,
    });

    // Save updated data
    await saveData(data);

    res.json({ message: 'Buy successful', position });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Sell Contract
app.post('/api/sell', async (req, res) => {
  const { userId, positionId, quantity, sellPrice } = req.body;

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
    if (sellPrice < currentPrice)
      return res.status(400).json({ message: 'Sell price too low' });

    const totalRevenue = sellPrice * quantity;

    // Update user balance
    user.balance += totalRevenue;

    // Update position
    position.quantity -= quantity;
    if (position.quantity <= 0) {
      data.positions = data.positions.filter(p => p.id !== positionId);
    }

    // Log transaction
    data.transactions.push({
      id: generateId(),
      userId,
      marketId: position.marketId,
      type: 'sell',
      contractType: position.type,
      quantity,
      price: sellPrice,
      totalCost: -totalRevenue,
      timestamp: new Date().toISOString(),
    });

    // Update market prices and add to price history
    if (position.type === 'yes') {
      market.previousYesPrice = market.yesPrice;
      market.yesPrice = Math.max(0.01, market.yesPrice - 0.01);
      market.noPrice = 1 - market.yesPrice;
      market.previousNoPrice = market.noPrice;
    } else {
      market.previousNoPrice = market.noPrice;
      market.noPrice = Math.max(0.01, market.noPrice - 0.01);
      market.yesPrice = 1 - market.noPrice;
      market.previousYesPrice = market.yesPrice;
    }
    if (!market.priceHistory) market.priceHistory = [];
    market.priceHistory.push({
      timestamp: new Date().toISOString(),
      yesPrice: market.yesPrice,
      noPrice: market.noPrice,
    });

    // Save updated data
    await saveData(data);

    res.json({ message: 'Sell successful', position });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Get Monthly Performance Data based on real transactions
app.get('/api/user/:userId/monthly-performance', async (req, res) => {
  try {
    const data = await loadData();
    const userId = req.params.userId;
    
    // Получаем все транзакции пользователя
    const userTransactions = data.transactions.filter(t => t.userId === userId);
    
    if (userTransactions.length === 0) {
      // Если нет транзакций, возвращаем нулевые данные
      const emptyData = [
        { month: 'Янв', value: 0 },
        { month: 'Фев', value: 0 },
        { month: 'Мар', value: 0 },
        { month: 'Апр', value: 0 },
        { month: 'Май', value: 0 },
        { month: 'Июн', value: 0 },
        { month: 'Июл', value: 0 },
        { month: 'Авг', value: 0 },
        { month: 'Сен', value: 0 },
        { month: 'Окт', value: 0 },
        { month: 'Ноя', value: 0 },
        { month: 'Дек', value: 0 },
      ];
      return res.json(emptyData);
    }
    
    // Группируем транзакции по месяцам
    const monthlyPerformance = {};
    const months = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];
    
    // Инициализируем все месяцы нулями
    months.forEach(month => {
      monthlyPerformance[month] = 0;
    });
    
    // Обрабатываем каждую транзакцию
    userTransactions.forEach(transaction => {
      const date = new Date(transaction.timestamp);
      const monthIndex = date.getMonth();
      const monthName = months[monthIndex];
      
      if (transaction.type === 'buy') {
        // Покупка - отрицательное влияние на баланс
        monthlyPerformance[monthName] -= transaction.totalCost;
      } else if (transaction.type === 'sell') {
        // Продажа - положительное влияние на баланс
        monthlyPerformance[monthName] += Math.abs(transaction.totalCost);
      }
    });
    
    // Преобразуем в массив для графика
    const chartData = months.map(month => ({
      month,
      value: Math.round(monthlyPerformance[month] * 100) / 100
    }));
    
    res.json(chartData);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Get Portfolio Value Over Time
app.get('/api/user/:userId/portfolio-value', async (req, res) => {
  try {
    const data = await loadData();
    const userId = req.params.userId;
    
    // Получаем все позиции пользователя
    const userPositions = data.positions.filter(pos => pos.userId === userId);
    
    if (userPositions.length === 0) {
      return res.json([]);
    }
    
    // Собираем все уникальные даты из истории цен всех рынков
    const allDates = new Set();
    
    userPositions.forEach(position => {
      const market = data.markets.find(m => m.id === position.marketId);
      if (market && market.priceHistory) {
        market.priceHistory.forEach(ph => {
          const date = new Date(ph.timestamp).toISOString().split('T')[0];
          allDates.add(date);
        });
      }
    });
    
    // Сортируем даты
    const sortedDates = Array.from(allDates).sort();
    
    // Рассчитываем стоимость портфеля для каждой даты
    const portfolioValue = sortedDates.map(date => {
      let totalValue = 0;
      
      userPositions.forEach(position => {
        const market = data.markets.find(m => m.id === position.marketId);
        if (market && market.priceHistory) {
          // Находим ближайшую историческую цену к этой дате
          const pricePoint = market.priceHistory
            .filter(ph => new Date(ph.timestamp).toISOString().split('T')[0] <= date)
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];
          
          if (pricePoint) {
            const price = position.type === 'yes' ? pricePoint.yesPrice : pricePoint.noPrice;
            totalValue += price * position.quantity;
          }
        }
      });
      
      return {
        date,
        value: Math.round(totalValue * 100) / 100
      };
    });
    
    res.json(portfolioValue);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Get Market Price History for Specific Market
app.get('/api/market/:marketId/price-history-chart', async (req, res) => {
  try {
    const data = await loadData();
    const market = data.markets.find(m => m.id === req.params.marketId);
    
    if (!market) {
      return res.status(404).json({ message: 'Market not found' });
    }
    
    if (!market.priceHistory || market.priceHistory.length === 0) {
      return res.json([]);
    }
    
    // Преобразуем историю цен в формат для графика
    const chartData = market.priceHistory.map(ph => {
      const date = new Date(ph.timestamp);
      return {
        timestamp: ph.timestamp,
        date: date.toLocaleDateString('ru-RU'),
        yesPrice: Math.round(ph.yesPrice * 100) / 100,
        noPrice: Math.round(ph.noPrice * 100) / 100,
        month: date.toLocaleString('ru-RU', { month: 'short' })
      };
    });
    
    res.json(chartData);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Get User Balance History
app.get('/api/user/:userId/balance-history', async (req, res) => {
  try {
    const data = await loadData();
    const userId = req.params.userId;
    
    const userTransactions = data.transactions
      .filter(t => t.userId === userId)
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    
    if (userTransactions.length === 0) {
      return res.json([]);
    }
    
    let currentBalance = data.users.find(u => u.id === userId)?.balance || 0;
    const balanceHistory = [];
    
    // Восстанавливаем историю баланса от последней транзакции к первой
    for (let i = userTransactions.length - 1; i >= 0; i--) {
      const transaction = userTransactions[i];
      
      if (transaction.type === 'buy') {
        currentBalance += transaction.totalCost; // Откатываем покупку
      } else if (transaction.type === 'sell') {
        currentBalance -= Math.abs(transaction.totalCost); // Откатываем продажу
      }
      
      balanceHistory.unshift({
        timestamp: transaction.timestamp,
        date: new Date(transaction.timestamp).toLocaleDateString('ru-RU'),
        balance: Math.round(currentBalance * 100) / 100,
        transactionType: transaction.type
      });
    }
    
    // Добавляем текущий баланс
    if (balanceHistory.length > 0) {
      balanceHistory.push({
        timestamp: new Date().toISOString(),
        date: new Date().toLocaleDateString('ru-RU'),
        balance: data.users.find(u => u.id === userId)?.balance || 0,
        transactionType: 'current'
      });
    }
    
    res.json(balanceHistory);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});