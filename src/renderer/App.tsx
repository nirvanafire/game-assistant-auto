import React, { useState } from 'react';
import { Tabs, Splitter, Button, Space } from 'antd';
import { UnorderedListOutlined, GroupOutlined } from '@ant-design/icons';
import { LogViewer } from './components/Tools/LogViewer';
import { NetworkLog } from './components/Network/NetworkLog';
import { TaskList } from './components/Assistant/TaskList';
import { TaskEditor } from './components/Assistant/TaskEditor';
import { TaskGroupList } from './components/Assistant/TaskGroupList';
import { TaskGroupEditor } from './components/Assistant/TaskGroupEditor';

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
      <Splitter.Panel defaultSize="50%" min="30%">
        <div style={{ padding: 16 }}>
          <h2>Browser</h2>
          <p>Embedded browser will be here</p>
        </div>
      </Splitter.Panel>
      <Splitter.Panel>
        <Tabs defaultActiveKey="assistant" items={[
          {
            key: 'assistant',
            label: 'Assistant',
            children: (
              <div>
                <Space style={{ marginBottom: 8 }}>
                  <Button
                    icon={<UnorderedListOutlined />}
                    type={view === 'tasks' || view === 'task-editor' ? 'primary' : 'default'}
                    onClick={() => setView('tasks')}
                    size="small"
                  >
                    Tasks
                  </Button>
                  <Button
                    icon={<GroupOutlined />}
                    type={view === 'groups' || view === 'group-editor' ? 'primary' : 'default'}
                    onClick={() => setView('groups')}
                    size="small"
                  >
                    Groups
                  </Button>
                </Space>
                {renderAssistantContent()}
              </div>
            ),
          },
          {
            key: 'tools',
            label: 'Tools',
            children: (
              <Tabs
                defaultActiveKey="log"
                items={[
                  { key: 'log', label: 'Log', children: <LogViewer /> },
                  { key: 'compare', label: 'Image Compare', children: <div>Image compare tool</div> },
                  { key: 'click', label: 'Click Test', children: <div>Click test tool</div> },
                ]}
              />
            ),
          },
          { key: 'network', label: 'Network', children: <NetworkLog /> },
        ]} />
      </Splitter.Panel>
    </Splitter>
  );
};
