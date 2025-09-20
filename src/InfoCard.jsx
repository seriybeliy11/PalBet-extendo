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

const OrderBook = () => {
  const [outcomes, setOutcomes] = useState([]);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [isUpdating, setIsUpdating] = useState(false);
  const [market, setMarket] = useState(null);

  const marketId = '1'; // Assume the market ID, replace with dynamic if needed

  const fetchMarketData = async () => {
    setIsUpdating(true);
    try {
      const response = await axios.get(`http://localhost:5000/api/market/${marketId}`);
      const marketData = response.data;
      setMarket(marketData);
      setOutcomes([
        { 
          id: 'yes', 
          outcome: 'Да', 
          price: marketData.yesCoefficient, 
          change: marketData.yesChange, 
          trend: marketData.yesTrend 
        },
        { 
          id: 'no', 
          outcome: 'Нет', 
          price: marketData.noCoefficient, 
          change: marketData.noChange, 
          trend: marketData.noTrend 
        }
      ]);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Failed to fetch market data:', err);
    }
    setIsUpdating(false);
  };

  useEffect(() => {
    fetchMarketData(); // Initial fetch
    const interval = setInterval(fetchMarketData, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Container>
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
                  {item.price}x
                </span>
              </TableCell>
              <TableCell>
                <PriceChange type={item.trend}>
                  {item.trend === 'up' ? (
                    <RiseOutlined style={{ marginRight: 4 }} />
                  ) : (
                    <FallOutlined style={{ marginRight: 4 }} />
                  )}
                  {item.change}x
                </PriceChange>
              </TableCell>
            </tr>
          ))}
        </tbody>
      </OutcomesTable>
      
      <EventInfo>
        <p style={{ margin: '0 0 8px 0', fontWeight: '500' }}>
          Событие: {market?.title || 'Loading...'}
        </p>
        <p style={{ margin: 0, color: '#666' }}>
          Текущие коэффициенты и изменения за последний период. 
          Данные обновляются автоматически каждые 4 секунды.
        </p>
        <p style={{ margin: '8px 0 0 0', fontSize: '12px', color: '#999' }}>
          Обновлено: {lastUpdated.toLocaleTimeString()}
        </p>
      </EventInfo>
      
      <LegendSection>
        <p style={{ margin: 0, lineHeight: 1.5, color: '#555' }}>
          {market?.description || 'Loading description...'}
        </p>
      </LegendSection>
    </Container>
  );
};

export default OrderBook;