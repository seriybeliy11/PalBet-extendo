// ========================
// 🧾 ОСНОВНЫЕ СУЩНОСТИ (обновлённые)
// ========================
/**
 * Пользователь системы — с привязкой к TON-кошельку
 */
export interface User {
  id: string | number;
  username?: string;
  email?: string;
  balance: number;              // Внутренний баланс в USDT
  currency: Currency;
  tonWalletAddress?: string;    // 👈 Адрес TON-кошелька пользователя
  tonConnectionStatus?: TonConnectionStatus;
  createdAt?: string;
  updatedAt?: string;
  avatarUrl?: string;
  status?: UserStatus;
}

export type Currency = 'USDT' | 'BTC' | 'ETH' | 'RUB' | 'USD' | string;

export type UserStatus = 'active' | 'suspended' | 'banned' | 'new';

export type TonConnectionStatus = 'connected' | 'disconnected' | 'connecting' | 'error';

// ========================

/**
 * Рынок (прогнозный контракт) — без изменений
 */
export interface Market {
  id: string | number;
  title: string;
  description?: string;
  category?: string;
  yesPrice: number;
  noPrice: number;
  totalLiquidity: number;
  volume24h: number;
  endDate?: string;
  resolved?: boolean;
  resolution?: 'yes' | 'no' | 'invalid' | null;
  createdAt?: string;
  updatedAt?: string;
  tags?: string[];
  imageUrl?: string;
  status?: MarketStatus;

  // Поля для OrderBook
  yesCoefficient: number;
  noCoefficient: number;
  yesChange: number;
  noChange: number;
  yesTrend: TrendType;
  noTrend: TrendType;
}

export type MarketStatus = 'active' | 'paused' | 'resolved' | 'cancelled';
export type TrendType = 'up' | 'down';

// ========================

/**
 * Позиция пользователя на рынке
 */
export interface Position {
  id: string | number;
  userId: string | number;
  marketId: string | number;
  type: 'yes' | 'no';
  quantity: number;
  purchasePrice: number;
  currentPrice: number;
  totalInvested: number;
  currentValue: number;
  unrealizedPnL: number;
  realizedPnL?: number;
  createdAt: string;
  updatedAt: string;
  closedAt?: string;
  remainingQuantity?: number;
}

// ========================
// 💸 TON CONNECT & ТРАНЗАКЦИИ
// ========================

/**
 * Адрес в сети TON
 */
export type TonAddress = string; // обычно начинается с EQ...

/**
 * Данные кошелька приложения (администратора/казны)
 */
export interface AppTonWallet {
  address: TonAddress;
  publicKey?: string;
  balance: number; // USDT
  lastUpdated: string;
}

/**
 * Структура транзакции TON (входящая или исходящая)
 */
export interface TonTransaction {
  id: string; // hash транзакции
  userId?: string | number; // если связана с пользователем
  type: 'deposit' | 'withdrawal' | 'refund' | 'payout';
  status: TransactionStatus;
  amount: number; // в USDT
  currency: 'USDT'; // пока только USDT, можно расширить
  tonAmountNano?: string; // сумма в нанотокенах (если нужно)
  fromAddress: TonAddress;
  toAddress: TonAddress;
  comment?: string; // например: "Пополнение баланса #123"
  txHash?: string;
  createdAt: string;
  confirmedAt?: string;
  error?: string;
  metadata?: Record<string, any>; // например: { contractId: '1', marketId: '5' }
}

export type TransactionStatus = 
  | 'pending'     // отправлена, но не подтверждена
  | 'confirmed'   // успешно завершена
  | 'failed'      // ошибка
  | 'cancelled';  // отменена пользователем

/**
 * Payload для инициации транзакции через TON Connect
 */
export interface TonTransferPayload {
  to: TonAddress;
  amount: string; // в нанотокенах (например, "1000000000" = 1 USDT)
  comment?: string;
  stateInit?: string; // если нужно создать новый кошелёк
  validUntil?: number; // timestamp
}

/**
 * Состояние TON Connect в приложении
 */
export interface TonConnectState {
  connected: boolean;
  walletAddress: TonAddress | null;
  walletName?: string; // "Tonkeeper", "MyTonWallet" и т.д.
  network: 'mainnet' | 'testnet';
  balance: number; // USDT
  lastSync: Date | null;
  error: string | null;
  connecting: boolean;
}

/**
 * Пропсы для компонента TON Connect
 */
export interface TonConnectButtonProps {
  onConnect?: (address: TonAddress, name?: string) => void;
  onDisconnect?: () => void;
  onError?: (error: string) => void;
  network?: 'mainnet' | 'testnet';
  className?: string;
}

// ========================
// 🔄 API PAYLOADS (обновлённые)
// ========================

export interface BuyContractPayload {
  userId: string | number;
  marketId: string | number;
  type: 'yes' | 'no';
  quantity: number;
  offerPrice: number;
  slippageTolerance?: number;
  expiresAt?: string;
  // 👇 Связь с TON
  paymentMethod?: 'internal' | 'ton_usdt';
  tonTxHash?: string; // если оплата через TON
}

export interface SellContractPayload {
  userId: string | number;
  positionId: string | number;
  quantity: number;
  sellPrice: number;
  slippageTolerance?: number;
  expiresAt?: string;
  // 👇 Для выплаты через TON
  payoutToTon?: boolean;
  tonWalletAddress?: TonAddress;
}

// ========================
// 📦 API RESPONSES (обновлённые)
// ========================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ========================
// 🎛 СОСТОНИЯ КОМПОНЕНТОВ (обновлённые)
// ========================

/**
 * Состояние TradeInterfaceBlue — с поддержкой TON
 */
export interface TradeState {
  activeMenu: 'buy' | 'sell';
  prediction: 'yes' | 'no' | null;
  betAmount: number;
  modalVisible: boolean;
  offerPrice: number;
  sellAmount: number;
  sellPrice: number;
  potentialProfit: number;
  market: Market | null;
  user: User | null;
  purchasedContracts: Position[];
  selectedPosition: Position | null;
  sellProfit: {
    usdt: number;
    percent: number;
    currency: Currency;
  };
  error: string | null;
  isLoading: boolean;
  availableBalance: number;
  // 👇 TON-интеграция
  tonConnectState: TonConnectState;
  pendingTransaction: TonTransaction | null;
}

/**
 * Состояние DarkBlueGradientChart — без изменений
 */
export interface ChartState {
  data: ChartSeriesData[];
  rawData: MonthlyLiquidityRaw[];
  loading: boolean;
  error: string | null;
  selectedMarketId?: string | number;
  dateRange?: {
    from: string;
    to: string;
  };
}

/**
 * Состояние OrderBook — без изменений
 */
export interface OrderBookState {
  outcomes: OutcomeRow[];
  lastUpdated: Date;
  isUpdating: boolean;
  market: Market | null;
}

// ========================
// 📥 ПРОПСЫ КОМПОНЕНТОВ (обновлённые)
// ========================

export interface TradeInterfaceBlueProps {
  userId?: string | number;
  marketId?: string | number;
  initialPrediction?: 'yes' | 'no';
  onTradeSuccess?: (trade: { type: 'buy' | 'sell'; amount: number; txHash?: string }) => void;
  theme?: 'light' | 'dark';
  showHeader?: boolean;
  compact?: boolean;
  // 👇 TON
  onTonConnect?: () => void;
  tonConnected?: boolean;
}

export interface DarkBlueGradientChartProps {
  userId?: string | number;
  marketId?: string | number;
  title?: string;
  height?: number;
  config?: ChartConfig;
  onDataLoaded?: (data: ChartSeriesData[]) => void;
  onError?: (error: string) => void;
  dateRange?: ChartState['dateRange'];
  showLegend?: boolean;
  interactive?: boolean;
}

export interface OrderBookProps {
  marketId?: string | number;
  autoRefreshInterval?: number;
  showDescription?: boolean;
  showEventInfo?: boolean;
  onMarketUpdate?: (market: Market) => void;
  compact?: boolean;
}

// ========================
// 📊 ГРАФИКИ: без изменений
// ========================

export interface MonthlyLiquidityRaw {
  month: string;
  year?: number;
  yes: number;
  no: number;
  total?: number;
}

export interface ChartSeriesData {
  month: string;
  year?: number;
  value: number;
  type: 'ДА' | 'НЕТ';
  marketId?: string | number;
  marketTitle?: string;
}

export interface ChartConfig {
  title?: string;
  height?: number;
  showArea?: boolean;
  showPoints?: boolean;
  colorScheme?: [string, string];
  currency?: Currency;
  tooltipFormatter?: (datum: ChartSeriesData) => string;
  xAxisLabelFormatter?: (month: string) => string;
}

// ========================
// 📈 OrderBook — без изменений
// ========================

export interface OutcomeRow {
  id: 'yes' | 'no';
  outcome: 'Да' | 'Нет';
  price: number;
  change: number;
  trend: TrendType;
}

// ========================
// 🧩 ВСПОМОГАТЕЛЬНЫЕ ТИПЫ
// ========================

export type PredictionType = 'yes' | 'no';
export type TradeMenu = 'buy' | 'sell';
export type TradeAction = 'buy' | 'sell' | 'close' | 'cancel';

export type SortOrder = 'asc' | 'desc';
export type SortBy = 'price' | 'quantity' | 'pnl' | 'date';

export interface FilterOptions {
  marketIds?: (string | number)[];
  types?: ('yes' | 'no')[];
  minPrice?: number;
  maxPrice?: number;
  startDate?: string;
  endDate?: string;
}

// ========================
// 📈 РАСШИРЕННЫЕ МЕТРИКИ
// ========================

export interface MarketAnalytics {
  marketId: string | number;
  avgYesPrice: number;
  avgNoPrice: number;
  volatility: number;
  tradeCount: number;
  uniqueTraders: number;
}

export interface UserPerformance {
  userId: string | number;
  totalPnL: number;
  winRate: number;
  avgProfit: number;
  avgLoss: number;
  maxDrawdown: number;
  monthlyBreakdown: MonthlyLiquidityRaw[];
}