import React, { useState, useRef, useEffect } from 'react';
import { Input, Space, Button, Spin, message } from 'antd';
import { ReloadOutlined, ArrowLeftOutlined, ArrowRightOutlined } from '@ant-design/icons';
import { IPC_CHANNELS } from '@shared/constants';
import { useSizeStore } from '../../stores/sizeStore';

export const BrowserPanel: React.FC = () => {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const setWindowSize = useSizeStore((s) => s.setWindowSize);
  const setBrowserSize = useSizeStore((s) => s.setBrowserSize);
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

    // Track webview/browser content size
    const measureBrowser = () => {
      const rect = wv.getBoundingClientRect();
      setBrowserSize({ width: Math.round(rect.width), height: Math.round(rect.height) });
    };
    measureBrowser();

    // Forward resize events to main process for coordinate cache invalidation
    let resizeTimer: ReturnType<typeof setTimeout>;
    const observer = new ResizeObserver(() => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        (window as any).electronAPI?.invoke(IPC_CHANNELS.BROWSER_RESIZED);
        measureBrowser();
      }, 300);
    });

    const container = wv.parentElement;
    if (container) {
      observer.observe(container);
    }

    // Fetch initial main window size and listen for resize events
    const api = (window as any).electronAPI;
    if (api) {
      api.invoke(IPC_CHANNELS.BROWSER_GET_SIZE).then((size: { width: number; height: number }) => {
        setWindowSize(size);
      }).catch(() => {});
      const handleWindowResized = (size: { width: number; height: number }) => {
        setWindowSize(size);
      };
      api.on(IPC_CHANNELS.BROWSER_WINDOW_RESIZED, handleWindowResized);
    }

    return () => {
      wv.removeEventListener('did-start-loading', onStartLoading);
      wv.removeEventListener('did-stop-loading', onStopLoading);
      wv.removeEventListener('did-fail-load', onFailLoad);
      clearTimeout(resizeTimer);
      observer.disconnect();
      (window as any).electronAPI?.removeAllListeners(IPC_CHANNELS.BROWSER_WINDOW_RESIZED);
    };
  }, [setWindowSize, setBrowserSize]);

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
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Space style={{ padding: 8, background: '#fafafa', borderBottom: '1px solid #d9d9d9', flexShrink: 0 }}>
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
