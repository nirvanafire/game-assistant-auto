import React, { useState } from 'react';
import { Tabs, Splitter, Button, Space } from 'antd';
import { UnorderedListOutlined, GroupOutlined } from '@ant-design/icons';
import { LogViewer } from './components/Tools/LogViewer';
import { ImageCompare } from './components/Tools/ImageCompare';
import { ClickTest } from './components/Tools/ClickTest';
import { NetworkLog } from './components/Network/NetworkLog';
import { TaskList } from './components/Assistant/TaskList';
import { TaskGroupList } from './components/Assistant/TaskGroupList';
import { ExecutionStatus } from './components/Assistant/ExecutionStatus';
import { BrowserPanel } from './components/Browser/BrowserPanel';
import { SizeIndicator } from './components/SizeIndicator';

type AssistantView = 'tasks' | 'groups';

export const App: React.FC = () => {
  const [view, setView] = useState<AssistantView>('tasks');

  const renderAssistantContent = () => {
    switch (view) {
      case 'groups':
        return <TaskGroupList />;
      case 'tasks':
      default:
        return <TaskList />;
    }
  };

  return (
    <Splitter style={{ height: '100vh', overflow: 'hidden' }}>
      <Splitter.Panel defaultSize="70%" min="30%" style={{ overflow: 'hidden' }}>
        <BrowserPanel />
      </Splitter.Panel>
      <Splitter.Panel style={{ overflow: 'hidden' }}>
        <SizeIndicator />
        <Tabs defaultActiveKey="assistant" items={[
          {
            key: 'assistant',
            label: '辅助',
            children: (
              <div>
                <Space style={{ marginBottom: 8 }}>
                  <Button
                    icon={<UnorderedListOutlined />}
                    type={view === 'tasks' ? 'primary' : 'default'}
                    onClick={() => setView('tasks')}
                    size="small"
                  >
                    任务
                  </Button>
                  <Button
                    icon={<GroupOutlined />}
                    type={view === 'groups' ? 'primary' : 'default'}
                    onClick={() => setView('groups')}
                    size="small"
                  >
                    任务组
                  </Button>
                </Space>
                <ExecutionStatus />
                {renderAssistantContent()}
              </div>
            ),
          },
          {
            key: 'tools',
            label: '工具',
            children: (
              <Tabs
                defaultActiveKey="log"
                items={[
                  { key: 'log', label: '日志', children: <LogViewer /> },
                  { key: 'compare', label: '图像对比', children: <ImageCompare /> },
                  { key: 'click', label: '点击测试', children: <ClickTest /> },
                ]}
              />
            ),
          },
          { key: 'network', label: '网络', children: <NetworkLog /> },
        ]} />
      </Splitter.Panel>
    </Splitter>
  );
};
