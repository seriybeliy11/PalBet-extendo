import React from 'react';
import { Card, List, Avatar, Typography, Space, Button, Spin } from 'antd';
import { MessageOutlined, ReloadOutlined } from '@ant-design/icons';

const { Text, Title } = Typography;

const CommentSection = () => {
  // Заглушка данных комментариев
  const mockComments = [
    {
      id: 1,
      author: 'Иван Петров',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=ivan',
      content: 'Отличная новость! Жду роста акций в ближайшее время 🚀',
      timestamp: '2 минуты назад',
      likes: 5
    },
    {
      id: 2,
      author: 'Мария Сидорова',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=maria',
      content: 'Какие прогнозы по дивидендам на следующий квартал?',
      timestamp: '15 минут назад',
      likes: 3
    },
    {
      id: 3,
      author: 'Алексей Козлов',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=alexey',
      content: 'Только что купил ещё пачку акций. Верю в компанию! 💪',
      timestamp: '1 час назад',
      likes: 12
    },
    {
      id: 4,
      author: 'Телеграм Канал',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=telegram',
      content: '📊 Обновление: Торговый объем превысил средние значения на 45%',
      timestamp: '2 часа назад',
      likes: 8,
      isChannel: true
    }
  ];

  const [comments, setComments] = React.useState(mockComments);
  const [loading, setLoading] = React.useState(false);

  const refreshComments = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      // В реальном приложении здесь будет запрос к API
    }, 1000);
  };

  return (
    <Card
      style={{
        background: 'linear-gradient(135deg, #fafafa 0%, #ffffff 100%)',
        border: '1px solid #d9d9d9',
        borderRadius: '12px'
      }}
      bodyStyle={{ padding: 0 }}
    >
      {/* Заголовок */}
      <div style={{ 
        padding: '16px 24px', 
        borderBottom: '1px solid #f0f0f0',
        background: 'linear-gradient(90deg, #1890ff 0%, #36cfc9 100%)'
      }}>
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <Space>
            <MessageOutlined style={{ color: 'white', fontSize: '18px' }} />
            <Title level={5} style={{ color: 'white', margin: 0 }}>
              Комментарии из Telegram
            </Title>
          </Space>
          <Button 
            icon={<ReloadOutlined />} 
            size="small"
            onClick={refreshComments}
            loading={loading}
            style={{ color: 'white', borderColor: 'white' }}
          >
            Обновить
          </Button>
        </Space>
        <Text style={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: '12px' }}>
          Комментарии синхронизируются с Telegram-каналом в реальном времени
        </Text>
      </div>

      {/* Список комментариев */}
      <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center' }}>
            <Spin size="large" />
            <div style={{ marginTop: '16px' }}>
              <Text type="secondary">Загрузка новых комментариев...</Text>
            </div>
          </div>
        ) : (
          <List
            dataSource={comments}
            renderItem={(item) => (
              <List.Item
                style={{ 
                  padding: '16px 24px',
                  borderBottom: '1px solid #f0f0f0',
                  background: item.isChannel ? '#e6f7ff' : 'transparent'
                }}
              >
                <List.Item.Meta
                  avatar={
                    <Avatar 
                      src={item.avatar} 
                      style={item.isChannel ? { border: '2px solid #1890ff' } : {}}
                    />
                  }
                  title={
                    <Space>
                      <Text strong>{item.author}</Text>
                      {item.isChannel && (
                        <Text type="secondary" style={{ fontSize: '12px' }}>
                          📢 Официальный канал
                        </Text>
                      )}
                    </Space>
                  }
                  description={
                    <Space direction="vertical" size={2} style={{ width: '100%' }}>
                      <Text>{item.content}</Text>
                      <Space>
                        <Text type="secondary" style={{ fontSize: '12px' }}>
                          {item.timestamp}
                        </Text>
                        {item.likes > 0 && (
                          <Text type="secondary" style={{ fontSize: '12px' }}>
                            ❤️ {item.likes}
                          </Text>
                        )}
                      </Space>
                    </Space>
                  }
                />
              </List.Item>
            )}
          />
        )}
      </div>

      {/* Футер */}
      <div style={{ 
        padding: '12px 24px', 
        background: '#f9f9f9',
        borderTop: '1px solid #f0f0f0',
        textAlign: 'center'
      }}>
        <Text type="secondary" style={{ fontSize: '12px' }}>
          Комментарии обновляются автоматически каждые 5 минут
        </Text>
      </div>
    </Card>
  );
};

export default CommentSection;