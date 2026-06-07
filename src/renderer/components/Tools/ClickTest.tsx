import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, Form, InputNumber, Button, Select, message, Space, Tag } from 'antd';
import { IPC_CHANNELS } from '@shared/constants';

export const ClickTest: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [windowOffset, setWindowOffset] = useState<{ x: number; y: number } | null>(null);
  const [webviewOffset, setWebviewOffset] = useState<{ x: number; y: number } | null>(null);
  const loadingRef = useRef(false);
  const formRef = useRef<any>(null);

  const refreshOffset = useCallback(async () => {
    const api = (window as any).electronAPI;
    const [winPos, wvPos] = await Promise.all([
      api.invoke(IPC_CHANNELS.BROWSER_GET_POSITION),
      api.invoke(IPC_CHANNELS.BROWSER_GET_WEBVIEW_POSITION),
    ]);
    setWindowOffset(winPos);
    setWebviewOffset(wvPos);
  }, []);

  useEffect(() => {
    refreshOffset();
  }, [refreshOffset]);

  useEffect(() => {
    const api = (window as any).electronAPI;

    const handleEsc = () => {
      if (loadingRef.current) {
        api.invoke(IPC_CHANNELS.PYTHON_CLICK_ABORT);
      }
    };

    const handleSpace = () => {
      if (!loadingRef.current) {
        formRef.current?.submit();
      }
    };

    api.on(IPC_CHANNELS.KEY_ESC, handleEsc);
    api.on(IPC_CHANNELS.KEY_SPACE, handleSpace);

    return () => {
      api.removeAllListeners(IPC_CHANNELS.KEY_ESC);
      api.removeAllListeners(IPC_CHANNELS.KEY_SPACE);
    };
  }, []);

  const handleClick = async (values: { x: number; y: number; button: string; count: number; intervalMs: number }) => {
    setLoading(true);
    loadingRef.current = true;
    try {
      const api = (window as any).electronAPI;
      const result = await api.invoke(IPC_CHANNELS.PYTHON_CLICK, {
        x: values.x,
        y: values.y,
        button: values.button,
        count: values.count,
        interval: values.intervalMs / 1000,
      });
      if (result?.aborted) {
        message.warning(`已中止，完成 ${result.completed}/${values.count} 次点击`);
      } else if (result?.success) {
        message.success(`点击 (${values.x}, ${values.y})`);
      } else {
        message.error(`点击失败: ${result?.error || '未知错误'}`);
      }
    } catch (err) {
      message.error('点击失败。');
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  };

  return (
    <Card
      title="点击测试"
      size="small"
      extra={
        <Space direction="vertical" size={2} style={{ textAlign: 'right' }}>
          <Space size="small">
            <span style={{ fontSize: 12, color: '#888' }}>窗口偏移:</span>
            {windowOffset ? (
              <>
                <Tag>X: {windowOffset.x}</Tag>
                <Tag>Y: {windowOffset.y}</Tag>
              </>
            ) : (
              <Tag>加载中...</Tag>
            )}
          </Space>
          <Space size="small">
            <span style={{ fontSize: 12, color: '#888' }}>浏览器偏移:</span>
            {webviewOffset ? (
              <>
                <Tag>X: {webviewOffset.x}</Tag>
                <Tag>Y: {webviewOffset.y}</Tag>
              </>
            ) : (
              <Tag>加载中...</Tag>
            )}
            <Button size="small" onClick={refreshOffset}>刷新</Button>
          </Space>
        </Space>
      }
    >
      <Form ref={formRef} layout="inline" onFinish={handleClick} initialValues={{ x: 0, y: 0, button: 'left', count: 1, intervalMs: 0 }}>
        <Form.Item name="x" label="X坐标" rules={[{ required: true }]}>
          <InputNumber />
        </Form.Item>
        <Form.Item name="y" label="Y坐标" rules={[{ required: true }]}>
          <InputNumber />
        </Form.Item>
        <Form.Item name="button" label="按键">
          <Select options={[{ label: '左键', value: 'left' }, { label: '右键', value: 'right' }]} />
        </Form.Item>
        <Form.Item name="count" label="次数">
          <InputNumber min={1} max={10} />
        </Form.Item>
        <Form.Item name="intervalMs" label="间隔(ms)">
          <InputNumber min={0} max={10000} step={100} />
        </Form.Item>
        <Form.Item>
          <Button type="primary" htmlType="submit" loading={loading}>
            {loading ? '点击中 (ESC终止)' : '点击 (Space)'}
          </Button>
        </Form.Item>
      </Form>
    </Card>
  );
};
