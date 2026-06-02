import React, { useState } from 'react';
import { Card, Form, InputNumber, Button, Select, message } from 'antd';
import { IPC_CHANNELS } from '@shared/constants';

export const ClickTest: React.FC = () => {
  const [loading, setLoading] = useState(false);

  const handleClick = async (values: { x: number; y: number; button: string; count: number }) => {
    setLoading(true);
    try {
      const api = (window as any).electronAPI;
      await api.invoke(IPC_CHANNELS.CAPTURE_CLICK, {
        x: values.x,
        y: values.y,
        button: values.button,
        count: values.count,
      });
      message.success(`Clicked at (${values.x}, ${values.y})`);
    } catch (err) {
      message.error('Click failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card title="Click Test" size="small">
      <Form layout="inline" onFinish={handleClick} initialValues={{ x: 0, y: 0, button: 'left', count: 1 }}>
        <Form.Item name="x" label="X" rules={[{ required: true }]}>
          <InputNumber />
        </Form.Item>
        <Form.Item name="y" label="Y" rules={[{ required: true }]}>
          <InputNumber />
        </Form.Item>
        <Form.Item name="button" label="Button">
          <Select options={[{ label: 'Left', value: 'left' }, { label: 'Right', value: 'right' }]} />
        </Form.Item>
        <Form.Item name="count" label="Count">
          <InputNumber min={1} max={10} />
        </Form.Item>
        <Form.Item>
          <Button type="primary" htmlType="submit" loading={loading}>Click</Button>
        </Form.Item>
      </Form>
    </Card>
  );
};
