import React from 'react';
import { Space, Typography } from 'antd';
import { useSizeStore } from '../stores/sizeStore';

const { Text } = Typography;

export const SizeIndicator: React.FC = () => {
  const windowSize = useSizeStore((s) => s.windowSize);
  const browserSize = useSizeStore((s) => s.browserSize);

  return (
    <div
      style={{
        padding: '4px 12px',
        background: '#fafafa',
        borderBottom: '1px solid #d9d9d9',
        display: 'flex',
        gap: 24,
        fontSize: 12,
        color: '#666',
      }}
    >
      <Space size={4}>
        <span>窗口:</span>
        <Text strong>{windowSize ? `${windowSize.width} × ${windowSize.height}` : '—'}</Text>
      </Space>
      <Space size={4}>
        <span>浏览器:</span>
        <Text strong>{browserSize ? `${browserSize.width} × ${browserSize.height}` : '—'}</Text>
      </Space>
    </div>
  );
};
