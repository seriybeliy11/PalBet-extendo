import React from 'react';
import { Layout, Typography, Space } from 'antd';
import { TonConnectButton } from '@tonconnect/ui-react';

const { Header: AntHeader } = Layout;
const { Title } = Typography;

const AppHeader = () => {
  return (
    <AntHeader style={{ 
      display: 'flex', 
      alignItems: 'center',
      justifyContent: 'space-between', // Добавлено для распределения пространства
      background: '#fff',
      padding: '0 24px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      height: 64
    }}>
      {/* Логотип и название */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ 
          width: 40, 
          height: 40, 
          background: '#1890ff', 
          borderRadius: 8,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontWeight: 'bold',
          fontSize: 16
        }}>
          L
        </div>
        <Title level={3} style={{ margin: 0, color: '#1890ff' }}>
          BetFriend
        </Title>
      </div>

      {/* Кнопка TonConnect в правой части */}
      <TonConnectButton />
    </AntHeader>
  );
};

export default AppHeader;