import React, { useState, useEffect } from 'react';
import { Line } from '@ant-design/charts';
import { Card, Typography, Spin } from 'antd';
import axios from 'axios';

const { Title } = Typography;

const DarkBlueGradientChart = ({ userId = '1', title = 'Прогресс показателей', height = 300, onDataLoaded, onError }) => {
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setErrorState] = useState(null);

  useEffect(() => {
    const fetchChartData = async () => {
      setLoading(true);
      setErrorState(null);
      try {
        const response = await axios.get(`http://localhost:5000/api/user/${userId}/monthly-performance`);
        const data = response.data;
        
        // Verify data structure
        if (!Array.isArray(data) || data.some(item => !item.month || typeof item.value !== 'number')) {
          throw new Error('Invalid data structure');
        }

        setChartData(data);
        if (onDataLoaded) {
          onDataLoaded(data);
        }
      } catch (error) {
        console.error('Error fetching chart data:', error);
        if (onError) {
          onError(error.message);
        }
        setErrorState(error.message);
        // Fallback data with last 12 months (generic months)
        const months = ['Окт', 'Ноя', 'Дек', 'Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен'];
        setChartData(months.map(month => ({ month, value: 0 })));
      } finally {
        setLoading(false);
      }
    };

    fetchChartData();
  }, [userId]);

  const config = {
    data: chartData,
    xField: 'month',
    yField: 'value',
    height,
    smooth: true,
    color: '#177ddc',
    background: 'transparent', // Прозрачный фон графика
    padding: [20, 40, 40, 60], // Отступы для лучшего отображения осей
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
          stroke: '#8c8c8c', // Видимая линия оси X
          lineWidth: 1,
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
      line: {
        style: {
          stroke: '#8c8c8c', // Видимая линия оси Y
          lineWidth: 1,
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
    theme: {
      background: 'transparent', // Прозрачный фон темы
      ...'dark', // Сохраняем тёмную тему для других элементов
    },
  };

  return (
    <Card
      styles={{
        body: { 
          padding: '24px',
          background: 'transparent', // Прозрачный фон Card
        }
      }}
    >
      <Title level={4} style={{ color: '#ffffff', marginBottom: '24px' }}>
        {title}
      </Title>
      {loading ? (
        <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Spin size="large" />
        </div>
      ) : error ? (
        <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ff4d4f' }}>
          Error: {error}
        </div>
      ) : (
        <Line {...config} />
      )}
    </Card>
  );
};

export default DarkBlueGradientChart;