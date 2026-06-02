import React, { useState } from 'react';
import { Tabs, Splitter, Button, Space } from 'antd';
import { UnorderedListOutlined, GroupOutlined } from '@ant-design/icons';
import { LogViewer } from './components/Tools/LogViewer';
import { ImageCompare } from './components/Tools/ImageCompare';
import { ClickTest } from './components/Tools/ClickTest';
import { NetworkLog } from './components/Network/NetworkLog';
import { TaskList } from './components/Assistant/TaskList';
import { TaskEditor } from './components/Assistant/TaskEditor';
import { TaskGroupList } from './components/Assistant/TaskGroupList';
import { TaskGroupEditor } from './components/Assistant/TaskGroupEditor';
import { ExecutionStatus } from './components/Assistant/ExecutionStatus';
import { BrowserPanel } from './components/Browser/BrowserPanel';

type AssistantView = 'tasks' | 'task-editor' | 'groups' | 'group-editor';

export const App: React.FC = () => {
  const [view, setView] = useState<AssistantView>('tasks');
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);

  const handleEditTask = (taskId: string) => {
    setEditingTaskId(taskId);
    setView('task-editor');
  };

  const handleEditGroup = (groupId: string) => {
    setEditingGroupId(groupId);
    setView('group-editor');
  };

  const renderAssistantContent = () => {
    switch (view) {
      case 'task-editor':
        return editingTaskId ? <TaskEditor taskId={editingTaskId} onClose={() => setView('tasks')} /> : null;
      case 'group-editor':
        return editingGroupId ? <TaskGroupEditor groupId={editingGroupId} onClose={() => setView('groups')} /> : null;
      case 'groups':
        return <TaskGroupList onEdit={handleEditGroup} />;
      case 'tasks':
      default:
        return <TaskList onEdit={handleEditTask} />;
    }
  };

  return (
    <Splitter style={{ height: '100vh' }}>
      <Splitter.Panel defaultSize="70%" min="30%">
        <BrowserPanel />
      </Splitter.Panel>
      <Splitter.Panel>
        <Tabs defaultActiveKey="assistant" items={[
          {
            key: 'assistant',
            label: '辅助',
            children: (
              <div>
                <Space style={{ marginBottom: 8 }}>
                  <Button
                    icon={<UnorderedListOutlined />}
                    type={view === 'tasks' || view === 'task-editor' ? 'primary' : 'default'}
                    onClick={() => setView('tasks')}
                    size="small"
                  >
                    任务
                  </Button>
                  <Button
                    icon={<GroupOutlined />}
                    type={view === 'groups' || view === 'group-editor' ? 'primary' : 'default'}
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
