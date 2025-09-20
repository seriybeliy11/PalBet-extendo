import React, { useState, useEffect } from 'react';
import { Card, List, Avatar, Typography, Space, Button, Spin } from 'antd';
import { MessageOutlined, ReloadOutlined } from '@ant-design/icons';
import axios from 'axios';
import moment from 'moment'; // For timestamp formatting, install if needed: npm i moment

const { Text, Title } = Typography;

const CommentSection = ({ marketId = '1' }) => {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchComments = async () => {
    setLoading(true);
    setError(null);
    try {
      // Supabase Edge Function endpoint with Authorization header
      const response = await axios.get(`https://xgfxijjcebvgokwutcfx.supabase.co/functions/v1/fetch-comments`, {
        headers: {
          'Authorization': 'Bearer sbp_0e61ee801b49fb57e1a804b160165a7d1080477f',
          'Content-Type': 'application/json'
        }
      });
      const data = response.data;
      
      // Verify structure (assume data is array or data.comments)
      let commentsData = Array.isArray(data) ? data : (data.comments || []);
      if (Array.isArray(commentsData)) {
        // Format timestamps if needed (backend may return ISO, convert to relative)
        const formattedComments = commentsData.map(comment => ({
          ...comment,
          timestamp: moment(comment.timestamp || new Date()).fromNow() // e.g., "4 days ago"
        }));
        setComments(formattedComments);
      } else {
        throw new Error('Invalid comments data');
      }
    } catch (err) {
      console.error('Failed to fetch comments:', err);
      setError('Failed to load comments from backend.');
      setComments([]); // No fallback comments; rely only on endpoint
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComments(); // Initial load
    const interval = setInterval(fetchComments, 300000); // Auto-refresh every 5 minutes
    return () => clearInterval(interval);
  }, [marketId]);

  const refreshComments = () => {
    fetchComments();
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
        ) : error ? (
          <div style={{ padding: '20px', textAlign: 'center', color: '#ff4d4f' }}>
            <Text type="danger">{error}</Text>
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