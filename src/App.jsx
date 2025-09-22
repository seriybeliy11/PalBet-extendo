import { TonConnectUIProvider } from '@tonconnect/ui-react';
import Header from './Header';
import { Divider, Row, Col } from 'antd'; // Добавляем Row и Col для сетки
import TwoLinesTransparentChart from './EventChart';
import TradeInterfaceBlue from './TradingCard';
import CommentSection from './CommentsSection';
import OrderBook from './InfoCard';

const manifestUrl = 'https://pal-bet-extendo-glqw-n7b181nar-xaronjilom-2121s-projects.vercel.app/public/tonconnect-manifest.json';

function App() {
  return (
    <TonConnectUIProvider manifestUrl={manifestUrl}>
      <Header />
      <div style={{ padding: '16px', maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ marginBottom: '24px' }}>
          <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>
            Политика → Мирное соглашение 2025
          </div>
          <h1 style={{ margin: 0, fontSize: '24px', fontWeight: '600' }}>
            Будет ли мирное соглашение в сентябре 2025?
          </h1>
        </div>
        <Row gutter={[24, 24]} wrap={false}>
          <Col xs={24} md={16} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <TwoLinesTransparentChart />
            <OrderBook />
            <CommentSection />
          </Col>
          <Col xs={24} md={8}>
            <TradeInterfaceBlue />
          </Col>
        </Row>
      </div>
    </TonConnectUIProvider>
  );
}

export default App;