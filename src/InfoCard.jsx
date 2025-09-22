import React, { useState, useEffect, useRef } from 'react';
import { RiseOutlined, FallOutlined } from '@ant-design/icons';
import styled from 'styled-components';
import { createClient } from '@supabase/supabase-js';

// Инициализация Supabase клиента
const supabaseUrl = 'https://dlwjjtvrtdohtfxsrcbd.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRsd2pqdHZydGRvaHRmeHNyY2JkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg0MDQxNTQsImV4cCI6MjA3Mzk4MDE1NH0.eLbGiCej5jwJ5-NKRgCBhLsE9Q0fz8pFbpiadE-Cwe8';
const supabase = createClient(supabaseUrl, supabaseKey);

const Container = styled.div`
  padding: 0;
  width: 100%;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background-color: transparent;
`;

const OutcomesTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 20px;
  background-color: white;
  border: 1px solid #e8e8e8;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
`;

const TableHeader = styled.th`
  background-color: #fafafa;
  color: #666;
  padding: 14px;
  text-align: center;
  font-weight: 500;
  font-size: 14px;
  border-bottom: 2px solid #e8e8e8;
`;

const TableCell = styled.td`
  padding: 16px;
  text-align: center;
  border-bottom: 1px solid #f0f0f0;
  transition: background-color 0.2s;
  
  &:first-child {
    font-weight: 600;
    background-color: #fafafa;
  }
  
  &:hover {
    background-color: #f8f9fa;
  }
`;

const PriceChange = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${props => {
    if (props.type === 'up') return '#52c41a';
    if (props.type === 'down') return '#ff4d4f';
    return '#666';
  }};
  font-weight: 500;
`;

const EventInfo = styled.div`
  padding: 16px;
  background-color: #f9f9f9;
  border-radius: 8px;
  font-size: 14px;
  line-height: 1.5;
  margin-bottom: 16px;
  border-left: 4px solid #1890ff;
`;

const LegendSection = styled.div`
  padding: 16px;
  background-color: white;
  margin-top: 16px;
  border-radius: 8px;
  border: 1px solid #f0f0f0;
`;

const Title = styled.h3`
  text-align: center;
  margin: 0;
  padding: 20px;
  color: #333;
  font-weight: 600;
  font-size: 20px;
  background-color: transparent;
  border-bottom: none;
  
  &:after {
    content: '';
    display: block;
    width: 60px;
    height: 3px;
    background: linear-gradient(90deg, #1890ff, #52c41a);
    margin: 8px auto 0;
    border-radius: 2px;
  }
`;

const Subtitle = styled.h4`
  margin-bottom: 12px;
  color: #333;
  font-weight: 600;
  font-size: 16px;
`;

const UpdateIndicator = styled.span`
  display: inline-block;
  padding: 4px 8px;
  background-color: ${props => props.updating ? '#1890ff' : '#f0f0f0'};
  color: ${props => props.updating ? 'white' : '#666'};
  border-radius: 12px;
  font-size: 11px;
  margin-left: 8px;
  transition: all 0.3s;
`;

const LoadingSkeleton = styled.div`
  padding: 20px;
  text-align: center;
  color: #666;
  
  &:after {
    content: '⏳';
    display: block;
    font-size: 24px;
    margin-top: 8px;
    animation: spin 1s linear infinite;
  }
  
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;

const ErrorMessage = styled.div`
  padding: 16px;
  background-color: #fff2f0;
  border: 1px solid #ffccc7;
  border-radius: 8px;
  color: #a8071a;
  text-align: center;
  margin: 10px 0;
`;

const OrderBook = ({
  marketId = '1',
  autoRefreshInterval = 4000,
  showDescription = true,
  showEventInfo = true,
  onMarketUpdate,
  compact = false,
}) => {
  const [outcomes, setOutcomes] = useState([]);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [isUpdating, setIsUpdating] = useState(false);
  const [market, setMarket] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const previousCoefficientsRef = useRef({ yes: 2.0, no: 2.0 });
  const updateTimeoutRef = useRef(null);

  // Функция для безопасного получения данных с обработкой ошибок
  const safeFetch = async (query) => {
    try {
      const { data, error } = await query;
      if (error) throw error;
      return data;
    } catch (err) {
      console.warn(`Query warning: ${err.message}`);
      return null;
    }
  };

  const fetchMarketData = async () => {
    if (isUpdating) return; // Предотвращаем параллельные запросы
    
    setIsUpdating(true);
    setError(null);

    try {
      // 1. Получаем информацию о рынке
      const marketData = await safeFetch(
        supabase
          .from('markets')
          .select('id, name, description, end_date, resolved, winner_outcome, yes_price, no_price')
          .eq('id', marketId)
          .single()
      );

      if (!marketData) {
        throw new Error('Рынок не найден');
      }

      // 2. Параллельно получаем лучшие цены для обоих исходов
      const [
        bestYesBid,
        bestNoBid,
        bestYesAsk, 
        bestNoAsk
      ] = await Promise.all([
        safeFetch(
          supabase
            .from('orders')
            .select('price')
            .eq('market_id', marketId)
            .eq('outcome', 'yes')
            .eq('order_type', 'buy')
            .eq('status', 'active')
            .order('price', { ascending: false })
            .limit(1)
            .single()
        ),
        safeFetch(
          supabase
            .from('orders')
            .select('price')
            .eq('market_id', marketId)
            .eq('outcome', 'no')
            .eq('order_type', 'buy')
            .eq('status', 'active')
            .order('price', { ascending: false })
            .limit(1)
            .single()
        ),
        safeFetch(
          supabase
            .from('orders')
            .select('price')
            .eq('market_id', marketId)
            .eq('outcome', 'yes')
            .eq('order_type', 'sell')
            .eq('status', 'active')
            .order('price', { ascending: true })
            .limit(1)
            .single()
        ),
        safeFetch(
          supabase
            .from('orders')
            .select('price')
            .eq('market_id', marketId)
            .eq('outcome', 'no')
            .eq('order_type', 'sell')
            .eq('status', 'active')
            .order('price', { ascending: true })
            .limit(1)
            .single()
        )
      ]);

      // 3. Рассчитываем текущие рыночные цены с приоритетом на данные из markets
      const calculateMarketPrice = (bestBid, bestAsk, marketPrice) => {
        // Если есть рыночная цена из БД - используем её
        if (marketPrice !== null && marketPrice !== undefined) {
          return marketPrice;
        }
        
        // Иначе рассчитываем из ордеров
        if (bestBid?.price && bestAsk?.price) {
          return (bestBid.price + bestAsk.price) / 2;
        }
        if (bestBid?.price) return bestBid.price * 0.99; // Учитываем спред
        if (bestAsk?.price) return bestAsk.price * 1.01; // Учитываем спред
        
        return 0.5; // Значение по умолчанию
      };

      const currentYesPrice = calculateMarketPrice(bestYesBid, bestYesAsk, marketData.yes_price);
      const currentNoPrice = calculateMarketPrice(bestNoBid, bestNoAsk, marketData.no_price);

      // 4. Рассчитываем коэффициенты с защитой от некорректных значений
      const calculateCoefficient = (price) => {
        if (!price || price <= 0.01) return 100.0; // Максимальный коэффициент
        if (price >= 0.99) return 1.01; // Минимальный коэффициент
        return Math.min(100, Math.max(1.01, 1 / price)); // Ограничиваем диапазон
      };

      const yesCoefficient = Number(calculateCoefficient(currentYesPrice).toFixed(2));
      const noCoefficient = Number(calculateCoefficient(currentNoPrice).toFixed(2));

      // 5. Рассчитываем изменения с улучшенной логикой
      const calculateChange = (currentCoeff, outcome) => {
        const previousCoeff = previousCoefficientsRef.current[outcome];
        
        if (previousCoeff === undefined) {
          previousCoefficientsRef.current[outcome] = currentCoeff;
          return { change: 0, trend: 'neutral', delta: 0 };
        }

        const delta = currentCoeff - previousCoeff;
        const changePercent = previousCoeff > 0 ? (delta / previousCoeff) * 100 : 0;
        
        // Сохраняем только значительные изменения (> 0.5%)
        let trend = 'neutral';
        if (changePercent > 0.5) trend = 'up';
        else if (changePercent < -0.5) trend = 'down';

        previousCoefficientsRef.current[outcome] = currentCoeff;
        
        return {
          change: Math.abs(delta),
          trend,
          delta,
          changePercent: Math.abs(changePercent)
        };
      };

      const yesChange = calculateChange(yesCoefficient, 'yes');
      const noChange = calculateChange(noCoefficient, 'no');

      // 6. Формируем данные для отображения
      const marketInfo = {
        ...marketData,
        currentYesPrice,
        currentNoPrice,
        yesCoefficient,
        noCoefficient,
        bestYesBid: bestYesBid?.price,
        bestNoBid: bestNoBid?.price,
        bestYesAsk: bestYesAsk?.price,
        bestNoAsk: bestNoAsk?.price,
        lastUpdated: new Date()
      };

      const newOutcomes = [
        {
          id: 'yes',
          outcome: 'Да',
          price: yesCoefficient,
          change: yesChange.change,
          trend: yesChange.trend,
          delta: yesChange.delta,
          changePercent: yesChange.changePercent,
          rawPrice: currentYesPrice,
          probability: (currentYesPrice * 100).toFixed(1)
        },
        {
          id: 'no',
          outcome: 'Нет', 
          price: noCoefficient,
          change: noChange.change,
          trend: noChange.trend,
          delta: noChange.delta,
          changePercent: noChange.changePercent,
          rawPrice: currentNoPrice,
          probability: (currentNoPrice * 100).toFixed(1)
        },
      ];

      setMarket(marketInfo);
      setOutcomes(newOutcomes);
      setLastUpdated(new Date());
      setIsLoading(false);

      if (onMarketUpdate) {
        onMarketUpdate(marketInfo);
      }

    } catch (err) {
      console.error('Failed to fetch market data:', err);
      setError(err.message || 'Не удалось загрузить данные рынка');
      setIsLoading(false);
    } finally {
      setIsUpdating(false);
    }
  };

  // Дебаунсинг функция
  const debouncedFetch = () => {
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }
    
    updateTimeoutRef.current = setTimeout(() => {
      fetchMarketData();
    }, 500);
  };

  useEffect(() => {
    // Initial fetch
    fetchMarketData();

    // Real-time subscriptions
    const ordersSubscription = supabase
      .channel('orders-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `market_id=eq.${marketId}`,
        },
        debouncedFetch
      )
      .subscribe();

    const tradesSubscription = supabase
      .channel('trades-changes')
      .on(
        'postgres_changes',
        {
          event: '*', 
          schema: 'public',
          table: 'trades',
          filter: `market_id=eq.${marketId}`,
        },
        debouncedFetch
      )
      .subscribe();

    const marketsSubscription = supabase
      .channel('markets-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public', 
          table: 'markets',
          filter: `id=eq.${marketId}`,
        },
        debouncedFetch
      )
      .subscribe();

    // Auto-refresh interval
    let interval;
    if (autoRefreshInterval > 0) {
      interval = setInterval(fetchMarketData, autoRefreshInterval);
    }

    return () => {
      ordersSubscription.unsubscribe();
      tradesSubscription.unsubscribe();
      marketsSubscription.unsubscribe();
      if (interval) clearInterval(interval);
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, [marketId, autoRefreshInterval]);

  if (isLoading) {
    return (
      <Container>
        <LoadingSkeleton>Загрузка коэффициентов...</LoadingSkeleton>
      </Container>
    );
  }

  if (error) {
    return (
      <Container>
        <ErrorMessage>Ошибка: {error}</ErrorMessage>
      </Container>
    );
  }

  if (!market) {
    return (
      <Container>
        <ErrorMessage>Данные о рынке недоступны</ErrorMessage>
      </Container>
    );
  }

  return (
    <Container>
      <Title>
        Коэффициенты исходов
        <UpdateIndicator updating={isUpdating}>
          {isUpdating ? 'Обновление...' : 'LIVE'}
        </UpdateIndicator>
      </Title>

      <OutcomesTable>
        <thead>
          <tr>
            <TableHeader>Исход</TableHeader>
            <TableHeader>Коэффициент</TableHeader>
            <TableHeader>Вероятность</TableHeader>
            <TableHeader>Изменение</TableHeader>
          </tr>
        </thead>
        <tbody>
          {outcomes.map((item) => (
            <tr key={item.id}>
              <TableCell>
                <div>
                  {item.outcome}
                  {market.resolved && market.winner_outcome === item.id.toLowerCase() && (
                    <span style={{ color: '#52c41a', marginLeft: '4px', fontSize: '12px' }}>✓</span>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <span
                  style={{
                    fontWeight: 'bold',
                    color: item.trend === 'up' ? '#52c41a' : item.trend === 'down' ? '#ff4d4f' : '#1890ff',
                    fontSize: '16px',
                  }}
                >
                  {item.price.toFixed(2)}x
                </span>
              </TableCell>
              <TableCell>
                <span style={{ color: '#666', fontSize: '14px' }}>
                  {item.probability}%
                </span>
              </TableCell>
              <TableCell>
                <PriceChange type={item.trend}>
                  {item.trend !== 'neutral' ? (
                    <>
                      {item.trend === 'up' ? (
                        <RiseOutlined style={{ marginRight: 4 }} />
                      ) : (
                        <FallOutlined style={{ marginRight: 4 }} />
                      )}
                      <span>
                        {item.delta > 0 ? '+' : ''}
                        {item.change.toFixed(2)}x
                      </span>
                    </>
                  ) : (
                    <span style={{ color: '#999' }}>→</span>
                  )}
                </PriceChange>
              </TableCell>
            </tr>
          ))}
        </tbody>
      </OutcomesTable>

      {showEventInfo && (
        <EventInfo>
          <p style={{ margin: '0 0 8px 0', fontWeight: '500', display: 'flex', alignItems: 'center' }}>
            📊 {market.name}
          </p>
          <p style={{ margin: 0, color: '#666', fontSize: '13px' }}>
            Коэффициенты обновляются в реальном времени на основе рыночных ордеров
          </p>
          <p style={{ margin: '8px 0 0 0', fontSize: '12px', color: '#999' }}>
            🔄 Обновлено: {lastUpdated.toLocaleTimeString('ru-RU')}
          </p>
        </EventInfo>
      )}

      {showDescription && market.description && (
        <LegendSection>
          <Subtitle>📝 Описание события</Subtitle>
          <p style={{ margin: 0, lineHeight: 1.5, color: '#555', fontSize: '14px' }}>
            {market.description}
          </p>
          <div style={{ marginTop: '12px', fontSize: '12px', color: '#999' }}>
            {market.end_date && (
              <div>📅 Завершение: {new Date(market.end_date).toLocaleDateString('ru-RU')}</div>
            )}
            <div>
              🏁 Статус: 
              <span style={{ 
                color: market.resolved ? '#ff4d4f' : '#52c41a',
                fontWeight: '500',
                marginLeft: '4px'
              }}>
                {market.resolved ? 'Завершено' : 'Активно'}
              </span>
              {market.resolved && market.winner_outcome && (
                <span style={{ marginLeft: '8px' }}>
                  Победитель: <strong>{market.winner_outcome === 'yes' ? 'Да' : 'Нет'}</strong>
                </span>
              )}
            </div>
          </div>
        </LegendSection>
      )}
    </Container>
  );
};

export default OrderBook;