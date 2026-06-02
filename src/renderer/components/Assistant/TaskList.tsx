import React from 'react';
import { List, Button, Tag, Popconfirm } from 'antd';
import { PlayCircleOutlined, PauseCircleOutlined, DeleteOutlined, EditOutlined } from '@ant-design/icons';
import { useTaskStore } from '../../stores/taskStore';
import type { TaskStatus } from '@shared/types/task';

const statusColors: Record<TaskStatus, string> = {
  idle: 'default', running: 'processing', paused: 'warning',
  completed: 'success', failed: 'error', stopped: 'default',
};

interface TaskListProps {
  onEdit: (taskId: string) => void;
}

export const TaskList: React.FC<TaskListProps> = ({ onEdit }) => {
  const { tasks, removeTask } = useTaskStore();

  const handleStart = (taskId: string) => {
    (window as any).electronAPI?.invoke('task:start', { taskId });
  };

  const handleStop = (taskId: string) => {
    (window as any).electronAPI?.invoke('task:stop', { taskId });
  };

  return (
    <List
      dataSource={tasks}
      renderItem={(task) => (
        <List.Item
          actions={[
            task.status === 'running' ? (
              <Button icon={<PauseCircleOutlined />} size="small" onClick={() => handleStop(task.id)} />
            ) : (
              <Button icon={<PlayCircleOutlined />} type="primary" size="small" onClick={() => handleStart(task.id)} />
            ),
            <Button icon={<EditOutlined />} size="small" onClick={() => onEdit(task.id)} />,
            <Popconfirm title="Delete?" onConfirm={() => removeTask(task.id)}>
              <Button icon={<DeleteOutlined />} size="small" danger />
            </Popconfirm>,
          ]}
        >
          <List.Item.Meta
            title={task.name}
            description={<Tag color={statusColors[task.status]}>{task.status}</Tag>}
          />
        </List.Item>
      )}
    />
  );
};
