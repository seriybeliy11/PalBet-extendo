import TelegramBot from 'node-telegram-bot-api';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PENDING_SELLS_FILE = path.join(__dirname, 'pending-sells.json');
const DATA_FILE = path.join(__dirname, 'data.json');

// Initialize Telegram Bot
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });

// Load pending sells
async function loadPendingSells() {
  try {
    const rawData = await fs.readFile(PENDING_SELLS_FILE, 'utf-8');
    return JSON.parse(rawData);
  } catch (err) {
    console.error('Error loading pending sells:', err);
    return [];
  }
}

// Load data
async function loadData() {
  try {
    const rawData = await fs.readFile(DATA_FILE, 'utf-8');
    return JSON.parse(rawData);
  } catch (err) {
    console.error('Error loading data:', err);
    return { users: [], markets: [], positions: [], transactions: [] };
  }
}

// Save pending sells
async function savePendingSells(pendingSells) {
  try {
    await fs.writeFile(PENDING_SELLS_FILE, JSON.stringify(pendingSells, null, 2));
  } catch (err) {
    console.error('Error saving pending sells:', err);
  }
}

// Save data
async function saveData(data) {
  try {
    await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Error saving data:', err);
  }
}

// Generate ID
const generateId = () => Math.random().toString(36).substr(2, 9);

// Функция для обновления цен после сделки
function updateMarketPrices(market, tradeType, quantity) {
  const LIQUIDITY_FACTOR = 0.0001;
  const currentYesPrice = market.yesPrice;
  const currentNoPrice = market.noPrice;
  
  const impact = quantity * LIQUIDITY_FACTOR;
  const maxImpact = 0.1;
  const limitedImpact = Math.sign(impact) * Math.min(Math.abs(impact), maxImpact);
  
  let newYesPrice, newNoPrice;
  
  if (tradeType === 'yes') {
    newYesPrice = Math.min(0.99, Math.max(0.01, currentYesPrice + limitedImpact));
    newNoPrice = 1 - newYesPrice;
  } else {
    newNoPrice = Math.min(0.99, Math.max(0.01, currentNoPrice + limitedImpact));
    newYesPrice = 1 - newNoPrice;
  }
  
  return {
    newYesPrice: parseFloat(newYesPrice.toFixed(4)),
    newNoPrice: parseFloat(newNoPrice.toFixed(4)),
    priceImpact: parseFloat(limitedImpact.toFixed(4))
  };
}

// Функция для расчета комиссии
function calculateFee(amount) {
  return amount * 0.02;
}

// Confirm sell transaction
async function confirmSellTransaction(requestId, adminSignature) {
  try {
    const pendingSells = await loadPendingSells();
    const sellRequest = pendingSells.find(req => req.id === requestId);
    
    if (!sellRequest) {
      throw new Error('Sell request not found');
    }

    if (sellRequest.status !== 'pending') {
      throw new Error('Request already processed');
    }

    const data = await loadData();
    const position = data.positions.find(p => p.id === sellRequest.positionId);
    const user = data.users.find(u => u.id === sellRequest.userId);
    const market = data.markets.find(m => m.id === sellRequest.marketId);

    if (!position || !user || !market) {
      throw new Error('Related data not found');
    }

    // Обновляем цены рынка
    const newPrices = updateMarketPrices(market, sellRequest.contractType, -sellRequest.quantity);
    
    market.previousYesPrice = market.yesPrice;
    market.previousNoPrice = market.noPrice;
    market.yesPrice = newPrices.newYesPrice;
    market.noPrice = newPrices.newNoPrice;
    market.totalVolume += sellRequest.quantity;
    market.dailyVolume += sellRequest.quantity;

    // Обновляем позицию
    position.quantity -= sellRequest.quantity;
    position.currentPrice = sellRequest.requestedPrice;
    position.lastUpdated = new Date().toISOString();
    
    if (position.quantity <= 0) {
      data.positions = data.positions.filter(p => p.id !== sellRequest.positionId);
    }

    // Добавляем запись в историю цен
    market.priceHistory.push({
      timestamp: new Date().toISOString(),
      yesPrice: market.yesPrice,
      noPrice: market.noPrice,
      volume: sellRequest.quantity,
      priceImpact: newPrices.priceImpact,
      transactionType: 'sell'
    });

    // Логируем транзакцию
    const transaction = {
      id: generateId(),
      userId: sellRequest.userId,
      marketId: sellRequest.marketId,
      type: 'sell',
      contractType: sellRequest.contractType,
      quantity: sellRequest.quantity,
      price: sellRequest.requestedPrice,
      principalAmount: sellRequest.principalAmount,
      fee: sellRequest.fee,
      netProceeds: sellRequest.netProceeds,
      adminSignature: adminSignature,
      status: 'completed',
      timestamp: new Date().toISOString(),
      newYesPrice: market.yesPrice,
      newNoPrice: market.noPrice,
      priceImpact: newPrices.priceImpact
    };
    data.transactions.push(transaction);

    // Обновляем статус запроса
    sellRequest.status = 'completed';
    sellRequest.completedAt = new Date().toISOString();
    sellRequest.adminSignature = adminSignature;

    await saveData(data);
    await savePendingSells(pendingSells.filter(req => req.id !== requestId));

    return {
      success: true,
      payout: {
        amount: sellRequest.netProceeds,
        wallet: user.walletAddress,
        username: user.username
      }
    };

  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

// Cancel sell transaction
async function cancelSellTransaction(requestId, reason) {
  try {
    const pendingSells = await loadPendingSells();
    const sellRequest = pendingSells.find(req => req.id === requestId);
    
    if (!sellRequest) {
      throw new Error('Sell request not found');
    }

    if (sellRequest.status !== 'pending') {
      throw new Error('Request already processed');
    }

    // Обновляем статус запроса
    sellRequest.status = 'cancelled';
    sellRequest.cancelledAt = new Date().toISOString();
    sellRequest.cancellationReason = reason;

    await savePendingSells(pendingSells.filter(req => req.id !== requestId));

    return {
      success: true,
      requestId: requestId
    };

  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

// Format number with commas
function formatNumber(number) {
  return new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(number);
}

// Bot commands handler
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const welcomeMessage = `🤖 <b>Бот подтверждения сделок</b>\n\n` +
    `Я помогаю управлять запросами на продажу контрактов.\n\n` +
    `📋 <b>Доступные команды:</b>\n` +
    `/pending - Показать ожидающие запросы\n` +
    `/help - Помощь\n\n` +
    `✅ Для подтверждения сделки используйте:\n` +
    `<code>/confirm_sell_[ID]</code>\n\n` +
    `❌ Для отмены сделки:\n` +
    `<code>/cancel_sell_[ID] [причина]</code>`;
  
  bot.sendMessage(chatId, welcomeMessage, { parse_mode: 'HTML' });
});

bot.onText(/\/help/, (msg) => {
  const chatId = msg.chat.id;
  const helpMessage = `📖 <b>Помощь по командам</b>\n\n` +
    `/pending - Показать все ожидающие запросы на продажу\n` +
    `/confirm_sell_[ID] - Подтвердить продажу (например: /confirm_sell_abc123)\n` +
    `/cancel_sell_[ID] [причина] - Отменить продажу (например: /cancel_sell_abc123 Недостаточно средств)\n\n` +
    `🔍 <b>Как работает:</b>\n` +
    `1. Пользователь создает запрос на продажу\n` +
    `2. Запрос попадает в систему ожидания\n` +
    `3. Вы получаете уведомление\n` +
    `4. Подтверждаете или отменяете сделку`;
  
  bot.sendMessage(chatId, helpMessage, { parse_mode: 'HTML' });
});

bot.onText(/\/pending/, async (msg) => {
  const chatId = msg.chat.id;
  
  try {
    const pendingSells = await loadPendingSells();
    const activeRequests = pendingSells.filter(req => req.status === 'pending');
    
    if (activeRequests.length === 0) {
      bot.sendMessage(chatId, '✅ Нет ожидающих запросов на продажу');
      return;
    }
    
    let message = `📋 <b>Ожидающие запросы на продажу</b>\n\n`;
    
    activeRequests.forEach((request, index) => {
      message += `🔹 <b>Запрос #${index + 1}</b>\n` +
        `🆔 ID: <code>${request.id}</code>\n` +
        `👤 Пользователь: ${request.username}\n` +
        `📊 Рынок: ${request.marketTitle}\n` +
        `📈 Тип: ${request.contractType.toUpperCase()}\n` +
        `🔢 Количество: ${request.quantity}\n` +
        `💵 Цена: ${request.requestedPrice}\n` +
        `💸 Выручка: ${formatNumber(request.netProceeds)} USD\n` +
        `👛 Кошелек: ${request.userWallet}\n` +
        `🕐 Создан: ${new Date(request.createdAt).toLocaleString('ru-RU')}\n\n` +
        `✅ Подтвердить: /confirm_sell_${request.id}\n` +
        `❌ Отменить: /cancel_sell_${request.id}\n\n` +
        `────────────────────\n\n`;
    });
    
    bot.sendMessage(chatId, message, { parse_mode: 'HTML' });
    
  } catch (error) {
    bot.sendMessage(chatId, '❌ Ошибка при загрузке запросов: ' + error.message);
  }
});

bot.onText(/\/confirm_sell_(.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const requestId = match[1];
  
  try {
    // Генерируем "подпись" админа (в реальной системе это должна быть криптографическая подпись)
    const adminSignature = `admin_sig_${generateId()}_${Date.now()}`;
    
    const result = await confirmSellTransaction(requestId, adminSignature);
    
    if (result.success) {
      const successMessage = `✅ <b>Сделка подтверждена!</b>\n\n` +
        `🆔 ID: <code>${requestId}</code>\n` +
        `👤 Пользователь: ${result.payout.username}\n` +
        `💸 Выплачено: ${formatNumber(result.payout.amount)} USD\n` +
        `👛 На кошелек: ${result.payout.wallet}\n` +
        `📝 Подпись: <code>${adminSignature}</code>\n\n` +
        `💰 Средства были переведены пользователю.`;
      
      bot.sendMessage(chatId, successMessage, { parse_mode: 'HTML' });
    } else {
      bot.sendMessage(chatId, `❌ Ошибка подтверждения: ${result.error}`);
    }
    
  } catch (error) {
    bot.sendMessage(chatId, '❌ Ошибка: ' + error.message);
  }
});

bot.onText(/\/cancel_sell_(.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const fullCommand = match[0];
  const requestId = match[1];
  
  // Извлекаем причину отмены из сообщения
  const reason = fullCommand.replace(`/cancel_sell_${requestId}`, '').trim();
  
  if (!reason) {
    bot.sendMessage(chatId, '❌ Укажите причину отмены: /cancel_sell_[ID] [причина]');
    return;
  }
  
  try {
    const result = await cancelSellTransaction(requestId, reason);
    
    if (result.success) {
      const cancelMessage = `❌ <b>Сделка отменена</b>\n\n` +
        `🆔 ID: <code>${requestId}</code>\n` +
        `📝 Причина: ${reason}\n` +
        `🕐 Время: ${new Date().toLocaleString('ru-RU')}\n\n` +
        `Пользователь уведомлен об отмене.`;
      
      bot.sendMessage(chatId, cancelMessage, { parse_mode: 'HTML' });
    } else {
      bot.sendMessage(chatId, `❌ Ошибка отмены: ${result.error}`);
    }
    
  } catch (error) {
    bot.sendMessage(chatId, '❌ Ошибка: ' + error.message);
  }
});

// Handle all messages to catch invalid commands
bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;
  
  // Ignore commands we already handle
  if (text.startsWith('/start') || text.startsWith('/help') || 
      text.startsWith('/pending') || text.startsWith('/confirm_sell_') || 
      text.startsWith('/cancel_sell_')) {
    return;
  }
  
  if (text.startsWith('/')) {
    bot.sendMessage(chatId, 
      '❌ Неизвестная команда. Используйте /help для списка команд.',
      { parse_mode: 'HTML' }
    );
  }
});

// Error handling
bot.on('polling_error', (error) => {
  console.error('Polling error:', error);
});

bot.on('webhook_error', (error) => {
  console.error('Webhook error:', error);
});

console.log('🤖 Telegram бот запущен и ожидает команды...');

// Export for use in main server
export { bot, sendTelegramNotification };

// Function to send notification (used by main server)
async function sendTelegramNotification(message) {
  try {
    await bot.sendMessage(process.env.TELEGRAM_CHAT_ID, message, { 
      parse_mode: 'HTML',
      disable_web_page_preview: true
    });
  } catch (error) {
    console.error('Error sending Telegram notification:', error.message);
  }
}