import React, { useState, useEffect } from 'react';
import { RiseOutlined, FallOutlined } from '@ant-design/icons';
import styled from 'styled-components';
import axios from 'axios';

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
`;

const TableHeader = styled.th`
  background-color: transparent;
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
  
  &:first-child {
    font-weight: 600;
    background-color: #fafafa;
  }
`;

const PriceChange = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${props => props.type === 'up' ? '#52c41a' : '#ff4d4f'};
  font-weight: 500;
`;

const EventInfo = styled.div`
  padding: 16px;
  background-color: #f9f9f9;
  border-radius: 0;
  font-size: 14px;
  line-height: 1.5;
  margin-bottom: 16px;
  border-left: 4px solid #d9d9d9;
`;

const LegendSection = styled.div`
  padding: 16px;
  background-color: white;
  margin-top: 16px;
  border-top: 1px solid #f0f0f0;
`;

const Title = styled.h3`
  text-align: center;
  margin: 0;
  padding: 20px;
  color: #333;
  font-weight: 600;
  font-size: 20px;
  background-color: transparent;
  border-bottom: 1px solid #e8e8e8;
  
  &:after {
    content: '';
    display: block;
    width: 60px;
    height: 2px;
    background-color: #d9d9d9;
    margin: 8px auto 0;
    border-radius: 2px;
  }
`;

const Subtitle = styled.h4`
  margin-bottom: 12px;
  color: #333;
  font-weight: 600;
`;

const UpdateIndicator = styled.span`
  display: inline-block;
  padding: 4px 8px;
  background-color: #f0f0f0;
  border-radius: 4px;
  font-size: 12px;
  color: #666;
  margin-left: 8px;
  animation: ${props => props.updating ? 'pulse 1.5s infinite' : 'none'};
  
  @keyframes pulse {
    0% { opacity: 0.6; }
    50% { opacity: 1; }
    100% { opacity: 0.6; }
  }
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

  const fetchMarketData = async () => {
    setIsUpdating(true);
    setError(null);
    try {
      const response = await axios.get(`http://localhost:5000/api/market/${marketId}`);
      const marketData = response.data;
      setMarket(marketData);

      // Верификация данных
      if (!marketData.id || typeof marketData.yesPrice !== 'number' || typeof marketData.noPrice !== 'number') {
        throw new Error('Invalid market data structure');
      }

      // Проверка статуса рынка (учитывая текущую дату: 2025-09-20)
      const currentDate = new Date('2025-09-20');
      const endDate = marketData.endDate ? new Date(marketData.endDate) : null;
      if (endDate && currentDate > endDate && marketData.status !== 'resolved') {
        console.warn('Market may need resolution check');
      }

      // Вычисление изменений коэффициентов
      const prevYesCoeff = 1 / (marketData.previousYesPrice || marketData.yesPrice);
      const yesCoeffChange = marketData.yesCoefficient - prevYesCoeff;
      const yesAbsChange = Math.abs(parseFloat(yesCoeffChange.toFixed(4)));
      const yesTrend = yesCoeffChange > 0 ? 'up' : 'down';

      const prevNoCoeff = 1 / (marketData.previousNoPrice || marketData.noPrice);
      const noCoeffChange = marketData.noCoefficient - prevNoCoeff;
      const noAbsChange = Math.abs(parseFloat(noCoeffChange.toFixed(4)));
      const noTrend = noCoeffChange > 0 ? 'up' : 'down';

      const newOutcomes = [
        { 
          id: 'yes', 
          outcome: 'Да', 
          price: marketData.yesCoefficient, 
          change: yesAbsChange, 
          trend: yesTrend 
        },
        { 
          id: 'no', 
          outcome: 'Нет', 
          price: marketData.noCoefficient, 
          change: noAbsChange, 
          trend: noTrend 
        }
      ];

      setOutcomes(newOutcomes);
      setLastUpdated(new Date());

      if (onMarketUpdate) {
        onMarketUpdate(marketData);
      }
    } catch (err) {
      console.error('Failed to fetch market data:', err);
      setError(err.message);
    } finally {
      setIsUpdating(false);
    }
  };

  useEffect(() => {
    fetchMarketData(); // Initial fetch
    if (autoRefreshInterval > 0) {
      const interval = setInterval(fetchMarketData, autoRefreshInterval);
      return () => clearInterval(interval);
    }
  }, [marketId, autoRefreshInterval]);

  if (error) {
    return (
      <Container>
        <p>Error: {error}</p>
      </Container>
    );
  }

  if (!market) {
    return (
      <Container>
        <p>Loading...</p>
      </Container>
    );
  }

  // Если рынок resolved, показать предупреждение
  if (market.resolved) {
    return (
      <Container>
        <Title>Рынок завершён</Title>
        <EventInfo>
          <p>Разрешение: {market.resolution || 'Не определено'}</p>
        </EventInfo>
      </Container>
    );
  }

  return (
    <Container>
      <Title>Коэффициенты исходов</Title>
      
      <OutcomesTable>
        <thead>
          <tr>
            <TableHeader>Исход</TableHeader>
            <TableHeader>Коэффициент</TableHeader>
            <TableHeader>Изменение</TableHeader>
          </tr>
        </thead>
        <tbody>
          {outcomes.map((item) => (
            <tr key={item.id}>
              <TableCell>{item.outcome}</TableCell>
              <TableCell>
                <span style={{ 
                  fontWeight: 'bold', 
                  color: item.outcome === 'Да' ? '#52c41a' : '#ff4d4f',
                  fontSize: '16px'
                }}>
                  {item.price.toFixed(2)}x
                </span>
              </TableCell>
              <TableCell>
                <PriceChange type={item.trend}>
                  {item.trend === 'up' ? (
                    <RiseOutlined style={{ marginRight: 4 }} />
                  ) : (
                    <FallOutlined style={{ marginRight: 4 }} />
                  )}
                  {item.change.toFixed(4)}x
                </PriceChange>
              </TableCell>
            </tr>
          ))}
        </tbody>
      </OutcomesTable>
      
      {showEventInfo && (
        <EventInfo>
          <p style={{ margin: '0 0 8px 0', fontWeight: '500' }}>
            Событие: {market.title}
            <UpdateIndicator updating={isUpdating}>
              {isUpdating ? 'Обновление...' : ''}
            </UpdateIndicator>
          </p>
          <p style={{ margin: 0, color: '#666' }}>
            Текущие коэффициенты и изменения за последний период. 
            Данные обновляются автоматически каждые {autoRefreshInterval / 1000} секунды.
          </p>
          <p style={{ margin: '8px 0 0 0', fontSize: '12px', color: '#999' }}>
            Обновлено: {lastUpdated.toLocaleTimeString()}
          </p>
        </EventInfo>
      )}
      
      {showDescription && (
        <LegendSection>
          <Subtitle>Описание события</Subtitle>
          <p style={{ margin: 0, lineHeight: 1.5, color: '#555' }}>
            {market.description || 'Описание отсутствует.'}
          </p>
          {market.endDate && (
            <p style={{ margin: '8px 0 0 0', fontSize: '12px', color: '#999' }}>
              Завершение: {new Date(market.endDate).toLocaleDateString('ru-RU')}
            </p>
          )}
          {market.status && (
            <p style={{ margin: '8px 0 0 0', fontSize: '12px', color: market.status === 'active' ? '#52c41a' : '#ff4d4f' }}>
              Статус: {market.status}
            </p>
          )}
        </LegendSection>
      )}
    </Container>
  );
};

export default OrderBook;