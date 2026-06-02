import React, { useMemo } from 'react';
import { Input, Select, Button, Table, Space, Switch } from 'antd';
import { useLogStore } from '../../stores/logStore';
import type { LogLevel, LogSource } from '@shared/types/log';

const LOG_LEVELS: LogLevel[] = ['ERROR', 'WARN', 'INFO', 'DEBUG'];
const LOG_SOURCES: LogSource[] = ['TaskEngine', 'Matcher', 'Clicker', 'Network', 'Python', 'Storage', 'App'];

export const LogViewer: React.FC = () => {
  const { filteredLogs, debugEnabled, levelFilter, sourceFilter, searchText, setDebug, setLevelFilter, setSourceFilter, setSearchText, clearLogs } = useLogStore();

  const columns = useMemo(() => [
    { title: 'Time', dataIndex: 'timestamp', key: 'timestamp', width: 100, render: (ts: string) => ts.substring(11, 19) },
    { title: 'Level', dataIndex: 'level', key: 'level', width: 80 },
    { title: 'Source', dataIndex: 'source', key: 'source', width: 100 },
    { title: 'Message', dataIndex: 'message', key: 'message' },
  ], []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Space style={{ padding: 8, flexWrap: 'wrap' }}>
        <Switch checked={debugEnabled} onChange={setDebug} checkedChildren="DEBUG" unCheckedChildren="DEBUG" />
        <Select placeholder="Level" allowClear style={{ width: 100 }} value={levelFilter} onChange={setLevelFilter} options={LOG_LEVELS.map(l => ({ label: l, value: l }))} />
        <Select placeholder="Source" allowClear style={{ width: 120 }} value={sourceFilter} onChange={setSourceFilter} options={LOG_SOURCES.map(s => ({ label: s, value: s }))} />
        <Input.Search placeholder="Search" style={{ width: 200 }} value={searchText} onChange={e => setSearchText(e.target.value)} allowClear />
        <Button onClick={clearLogs}>Clear</Button>
      </Space>
      <Table dataSource={filteredLogs} columns={columns} size="small" pagination={false} scroll={{ y: 'calc(100vh - 300px)' }} rowKey={(_, i) => String(i)} />
    </div>
  );
};
