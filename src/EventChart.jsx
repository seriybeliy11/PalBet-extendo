import React, { useState, useEffect } from 'react';
import { Line } from '@ant-design/charts';
import { Card, Typography, Spin } from 'antd';

const { Title } = Typography;

const DarkBlueGradientChart = () => {
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchChartData = async () => {
      try {
        const response = await fetch('/api/user/1/monthly-performance');
        
        // Проверяем, что ответ успешный и содержит JSON
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          throw new Error('Response is not JSON');
        }
        
        const data = await response.json();
        setChartData(data);
      } catch (error) {
        console.error('Error fetching chart data:', error);
        // Fallback data with all months
        setChartData([
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
          { month: 'Дек', value: 0 }
        ]);
      } finally {
        setLoading(false);
      }
    };

    fetchChartData();
  }, []);

  const config = {
    data: chartData,
    xField: 'month',
    yField: 'value',
    height: 300,
    smooth: true,
    color: '#177ddc',
    area: {
      style: {
        fill: 'l(270) 0:#177ddc 0.5:#0654a2 1:#003a8c',
        fillOpacity: 0.6,
      },
    },
    line: {
      size: 4,
      color: '#177ddc',
      style: {
        shadowColor: '#177ddc',
        shadowBlur: 15,
        shadowOffsetX: 0,
        shadowOffsetY: 5,
      },
    },
    point: {
      size: 6,
      shape: 'diamond',
      style: {
        fill: '#ffffff',
        stroke: '#177ddc',
        lineWidth: 3,
        shadowColor: '#177ddc',
        shadowBlur: 8,
      },
    },
    xAxis: {
      tickCount: 12,
      line: {
        style: {
          stroke: '#434343',
        },
      },
      grid: {
        line: {
          style: {
            stroke: '#434343',
            opacity: 0.3,
          },
        },
      },
      label: {
        style: {
          fill: '#8c8c8c',
        },
      },
    },
    yAxis: {
      grid: {
        line: {
          style: {
            stroke: '#434343',
            opacity: 0.3,
          },
        },
      },
      label: {
        style: {
          fill: '#8c8c8c',
        },
      },
    },
    tooltip: {
      showMarkers: true,
      marker: {
        fill: '#177ddc',
      },
      domStyles: {
        'g2-tooltip': {
          background: 'rgba(23, 125, 220, 0.95)',
          color: 'white',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
        },
      },
    },
    theme: 'dark',
  };

  return (
    <Card
      styles={{
        body: { padding: '24px' }
      }}
    >
      <Title level={4} style={{ color: '#ffffff', marginBottom: '24px' }}>
        Прогресс показателей
      </Title>
      {loading ? (
        <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Spin size="large" />
        </div>
      ) : (
        <Line {...config} />
      )}
    </Card>
  );
};

export default DarkBlueGradientChart;