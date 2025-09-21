import React, { useState, useEffect } from 'react';
import { Line } from '@ant-design/charts';
import { Card, Typography, Spin } from 'antd';
import { createClient } from '@supabase/supabase-js';

// Инициализация Supabase клиента
const supabaseUrl = 'https://dlwjjtvrtdohtfxsrcbd.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRsd2pqdHZydGRvaHRmeHNyY2JkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg0MDQxNTQsImV4cCI6MjA3Mzk4MDE1NH0.eLbGiCej5jwJ5-NKRgCBhLsE9Q0fz8pFbpiadE-Cwe8';
const supabase = createClient(supabaseUrl, supabaseKey);

const { Title } = Typography;

const MonthlyTradingVolumeChart = ({ title = 'Суммарный объем торгов по месяцам', height = 300, onDataLoaded, onError }) => {
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setErrorState] = useState(null);

  useEffect(() => {
    const fetchChartData = async () => {
      setLoading(true);
      setErrorState(null);
      
      try {
        // Запрос для получения всех сделок за текущий год
        const { data, error: supabaseError } = await supabase
          .from('trades')
          .select('timestamp, shares, price')
          .gte('timestamp', new Date(new Date().getFullYear(), 0, 1).toISOString())
          .order('timestamp', { ascending: true });

        if (supabaseError) {
          throw new Error(supabaseError.message);
        }

        // Обрабатываем данные
        const monthlyData = processTradeData(data || []);
        setChartData(monthlyData);
        
        if (onDataLoaded) {
          onDataLoaded(monthlyData);
        }

      } catch (error) {
        console.error('Error fetching chart data:', error);
        if (onError) {
          onError(error.message);
        }
        setErrorState(error.message);
        // Fallback data
        const months = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];
        setChartData(months.map(month => ({ month, value: 0 })));
      } finally {
        setLoading(false);
      }
    };

    fetchChartData();
  }, []);

  // Функция для обработки данных о торгах
  const processTradeData = (trades) => {
    const monthNames = {
      'Jan': 'Янв', 'Feb': 'Фев', 'Mar': 'Мар', 'Apr': 'Апр',
      'May': 'Май', 'Jun': 'Июн', 'Jul': 'Июл', 'Aug': 'Авг',
      'Sep': 'Сен', 'Oct': 'Окт', 'Nov': 'Ноя', 'Dec': 'Дек'
    };

    // Группируем по месяцам
    const monthlyVolume = {};
    
    trades.forEach(trade => {
      const date = new Date(trade.timestamp);
      const monthKey = date.toLocaleString('en', { month: 'short' });
      const monthName = monthNames[monthKey];
      const volume = Number(trade.shares) * Number(trade.price);

      if (!monthlyVolume[monthName]) {
        monthlyVolume[monthName] = 0;
      }
      monthlyVolume[monthName] += volume;
    });

    // Создаем массив данных для графика в правильном порядке
    const monthOrder = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];
    
    return monthOrder.map(month => ({
      month,
      value: monthlyVolume[month] || 0
    }));
  };

  const config = {
    data: chartData,
    xField: 'month',
    yField: 'value',
    height,
    smooth: true,
    color: '#177ddc',
    background: 'transparent',
    padding: [20, 40, 40, 60],
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
          stroke: '#8c8c8c',
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
          stroke: '#8c8c8c',
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
        formatter: (value) => `$${value.toFixed(2)}`,
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
      formatter: (datum) => {
        return { name: 'Объем торгов', value: `$${datum.value.toFixed(2)}` };
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
      background: 'transparent',
    },
  };

  return (
    <Card
      styles={{
        body: { 
          padding: '24px',
          background: 'transparent',
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
          Ошибка: {error}
        </div>
      ) : (
        <Line {...config} />
      )}
    </Card>
  );
};

export default MonthlyTradingVolumeChart;