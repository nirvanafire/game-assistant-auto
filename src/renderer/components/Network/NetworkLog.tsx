import React from 'react';
import { Table, Input, Select, Button, Space, Tag, message } from 'antd';
import { IPC_CHANNELS } from '@shared/constants';
import { useNetworkStore } from '../../stores/networkStore';

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'];

export const NetworkLog: React.FC = () => {
  const { filteredLogs, capturing, methodFilter, urlFilter, setCapturing, setMethodFilter, setUrlFilter, clearLogs } = useNetworkStore();

  const handleExport = async () => {
    const api = (window as any).electronAPI;
    if (!api) return;
    try {
      const result = await api.invoke(IPC_CHANNELS.NETWORK_EXPORT, {
        method: methodFilter || undefined,
        url: urlFilter || undefined,
      });
      const blob = new Blob([result.json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `network-logs-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      message.error('导出失败。');
    }
  };

  const columns = [
    { title: '时间', dataIndex: 'timestamp', key: 'timestamp', width: 80, render: (ts: string) => ts.substring(11, 19) },
    { title: '方法', dataIndex: 'method', key: 'method', width: 80, render: (m: string) => <Tag color={m === 'GET' ? 'green' : 'blue'}>{m}</Tag> },
    { title: 'URL', dataIndex: 'url', key: 'url', ellipsis: true },
    { title: '状态', dataIndex: 'statusCode', key: 'status', width: 70, render: (s: number) => <Tag color={s < 400 ? 'green' : 'red'}>{s}</Tag> },
    { title: '类型', dataIndex: 'resourceType', key: 'type', width: 80 },
    { title: '大小', dataIndex: 'size', key: 'size', width: 70, render: (s: number) => s ? `${(s / 1024).toFixed(1)}K` : '-' },
    { title: '耗时', dataIndex: 'durationMs', key: 'duration', width: 80, render: (d: number) => d ? `${d}ms` : '-' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Space style={{ padding: 8, flexWrap: 'wrap' }}>
        <Button type={capturing ? 'primary' : 'default'} onClick={() => setCapturing(!capturing)}>{capturing ? '停止' : '开始'}</Button>
        <Select placeholder="方法" allowClear style={{ width: 100 }} value={methodFilter} onChange={setMethodFilter} options={HTTP_METHODS.map(m => ({ label: m, value: m }))} />
        <Input.Search placeholder="筛选 URL" style={{ width: 200 }} value={urlFilter} onChange={e => setUrlFilter(e.target.value)} allowClear />
        <Button onClick={clearLogs}>清空</Button>
        <Button onClick={handleExport}>导出</Button>
      </Space>
      <Table dataSource={filteredLogs} columns={columns} size="small" pagination={false} scroll={{ y: 'calc(100vh - 300px)' }} rowKey={(_, i) => String(i)} />
    </div>
  );
};
