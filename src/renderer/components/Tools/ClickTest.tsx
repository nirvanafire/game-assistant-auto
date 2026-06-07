import React, { useState } from 'react';
import { Card, Form, InputNumber, Button, Select, message } from 'antd';
import { IPC_CHANNELS } from '@shared/constants';

export const ClickTest: React.FC = () => {
  const [loading, setLoading] = useState(false);

  const handleClick = async (values: { x: number; y: number; button: string; count: number; intervalMs: number }) => {
    setLoading(true);
    try {
      const api = (window as any).electronAPI;
      const result = await api.invoke(IPC_CHANNELS.PYTHON_CLICK, {
        x: values.x,
        y: values.y,
        button: values.button,
        count: values.count,
        interval: values.intervalMs / 1000,
      });
      if (result?.success) {
        message.success(`点击 (${values.x}, ${values.y})`);
      } else {
        message.error(`点击失败: ${result?.error || '未知错误'}`);
      }
    } catch (err) {
      message.error('点击失败。');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card title="点击测试" size="small">
      <Form layout="inline" onFinish={handleClick} initialValues={{ x: 0, y: 0, button: 'left', count: 1, intervalMs: 0 }}>
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
          <Button type="primary" htmlType="submit" loading={loading}>点击</Button>
        </Form.Item>
      </Form>
    </Card>
  );
};
