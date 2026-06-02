import React, { useState, useRef, useEffect } from 'react';
import { Input, Space, Button, Spin, message } from 'antd';
import { ReloadOutlined, ArrowLeftOutlined, ArrowRightOutlined } from '@ant-design/icons';

export const BrowserPanel: React.FC = () => {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const webviewRef = useRef<Electron.WebviewTag>(null);

  useEffect(() => {
    const wv = webviewRef.current;
    if (!wv) return;

    const onStartLoading = () => setLoading(true);
    const onStopLoading = () => {
      setLoading(false);
      setUrl(wv.getURL());
    };
    const onFailLoad = (e: any) => {
      setLoading(false);
      message.error(`Page load failed: ${e.errorDescription}`);
    };

    wv.addEventListener('did-start-loading', onStartLoading);
    wv.addEventListener('did-stop-loading', onStopLoading);
    wv.addEventListener('did-fail-load', onFailLoad);

    return () => {
      wv.removeEventListener('did-start-loading', onStartLoading);
      wv.removeEventListener('did-stop-loading', onStopLoading);
      wv.removeEventListener('did-fail-load', onFailLoad);
    };
  }, []);

  const handleNavigate = () => {
    const wv = webviewRef.current;
    if (!wv) return;
    let targetUrl = url;
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://') && !targetUrl.startsWith('about:')) {
      targetUrl = 'https://' + targetUrl;
    }
    wv.loadURL(targetUrl);
  };

  const handleRefresh = () => {
    webviewRef.current?.reload();
  };

  const handleBack = () => {
    webviewRef.current?.goBack();
  };

  const handleForward = () => {
    webviewRef.current?.goForward();
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Space style={{ padding: 8, background: '#fafafa', borderBottom: '1px solid #d9d9d9' }}>
        <Button icon={<ArrowLeftOutlined />} size="small" onClick={handleBack} />
        <Button icon={<ArrowRightOutlined />} size="small" onClick={handleForward} />
        <Button icon={<ReloadOutlined />} size="small" onClick={handleRefresh} />
        <Spin spinning={loading}>
          <Input
            value={url}
            onChange={e => setUrl(e.target.value)}
            onPressEnter={handleNavigate}
            placeholder="Enter URL..."
            style={{ width: 400 }}
            size="small"
          />
        </Spin>
        <Button type="primary" size="small" onClick={handleNavigate}>Go</Button>
      </Space>
      {/* @ts-expect-error webview tag is Electron-specific */}
      <webview
        ref={webviewRef}
        src="about:blank"
        style={{ flex: 1 }}
        partition="persist:webview:browser"
        useragent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36"
      />
    </div>
  );
};
