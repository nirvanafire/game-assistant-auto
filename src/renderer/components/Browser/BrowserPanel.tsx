import React, { useState, useEffect } from 'react';
import { Input, Space, Button, message } from 'antd';
import { ReloadOutlined, ArrowLeftOutlined, ArrowRightOutlined } from '@ant-design/icons';
import { IPC_CHANNELS } from '@shared/constants';

export const BrowserPanel: React.FC = () => {
  const [url, setUrl] = useState('');
  const [currentUrl, setCurrentUrl] = useState('');

  useEffect(() => {
    loadCurrentUrl();
  }, []);

  const loadCurrentUrl = async () => {
    const api = (window as any).electronAPI;
    if (!api) return;
    const result = await api.invoke(IPC_CHANNELS.BROWSER_GET_URL);
    setCurrentUrl(result?.url || '');
    setUrl(result?.url || '');
  };

  const handleNavigate = async () => {
    const api = (window as any).electronAPI;
    if (!api) return;
    try {
      let targetUrl = url;
      if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://') && !targetUrl.startsWith('about:')) {
        targetUrl = 'https://' + targetUrl;
      }
      await api.invoke(IPC_CHANNELS.BROWSER_LOAD_URL, { url: targetUrl });
      setCurrentUrl(targetUrl);
    } catch {
      message.error('Failed to load URL');
    }
  };

  const handleRefresh = async () => {
    const api = (window as any).electronAPI;
    if (!api) return;
    await api.invoke(IPC_CHANNELS.BROWSER_RELOAD);
  };

  const handleBack = async () => {
    const api = (window as any).electronAPI;
    if (!api) return;
    await api.invoke(IPC_CHANNELS.BROWSER_GO_BACK);
    setTimeout(loadCurrentUrl, 100);
  };

  const handleForward = async () => {
    const api = (window as any).electronAPI;
    if (!api) return;
    await api.invoke(IPC_CHANNELS.BROWSER_GO_FORWARD);
    setTimeout(loadCurrentUrl, 100);
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Space style={{ padding: 8, background: '#fafafa', borderBottom: '1px solid #d9d9d9' }}>
        <Button icon={<ArrowLeftOutlined />} size="small" onClick={handleBack} />
        <Button icon={<ArrowRightOutlined />} size="small" onClick={handleForward} />
        <Button icon={<ReloadOutlined />} size="small" onClick={handleRefresh} />
        <Input
          value={url}
          onChange={e => setUrl(e.target.value)}
          onPressEnter={handleNavigate}
          placeholder="Enter URL..."
          style={{ width: 400 }}
          size="small"
        />
        <Button type="primary" size="small" onClick={handleNavigate}>Go</Button>
      </Space>
    </div>
  );
};
