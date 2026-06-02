import React, { useMemo } from 'react';
import { Input, Select, Button, Table, Space, Switch } from 'antd';
import { useLogStore } from '../../stores/logStore';
import type { LogLevel, LogSource } from '@shared/types/log';

const LOG_LEVELS: LogLevel[] = ['ERROR', 'WARN', 'INFO', 'DEBUG'];
const LOG_SOURCES: LogSource[] = ['TaskEngine', 'Matcher', 'Clicker', 'Network', 'Python', 'Storage', 'App'];

export const LogViewer: React.FC = () => {
  const { filteredLogs, debugEnabled, levelFilter, sourceFilter, searchText, setDebug, setLevelFilter, setSourceFilter, setSearchText, clearLogs } = useLogStore();

  const columns = useMemo(() => [
    { title: '时间', dataIndex: 'timestamp', key: 'timestamp', width: 100, render: (ts: string) => ts.substring(11, 19) },
    { title: '级别', dataIndex: 'level', key: 'level', width: 80 },
    { title: '来源', dataIndex: 'source', key: 'source', width: 100 },
    { title: '消息', dataIndex: 'message', key: 'message' },
  ], []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Space style={{ padding: 8, flexWrap: 'wrap' }}>
        <Switch checked={debugEnabled} onChange={setDebug} checkedChildren="调试" unCheckedChildren="调试" />
        <Select placeholder="级别" allowClear style={{ width: 100 }} value={levelFilter} onChange={setLevelFilter} options={LOG_LEVELS.map(l => ({ label: l, value: l }))} />
        <Select placeholder="来源" allowClear style={{ width: 120 }} value={sourceFilter} onChange={setSourceFilter} options={LOG_SOURCES.map(s => ({ label: s, value: s }))} />
        <Input.Search placeholder="搜索" style={{ width: 200 }} value={searchText} onChange={e => setSearchText(e.target.value)} allowClear />
        <Button onClick={clearLogs}>清空</Button>
      </Space>
      <Table dataSource={filteredLogs} columns={columns} size="small" pagination={false} scroll={{ y: 'calc(100vh - 300px)' }} rowKey={(_, i) => String(i)} />
    </div>
  );
};
