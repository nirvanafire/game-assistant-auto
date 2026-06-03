import React, { useState } from 'react';
import { List, Button, Tag, Popconfirm, Drawer } from 'antd';
import { PlayCircleOutlined, PauseCircleOutlined, DeleteOutlined, EditOutlined } from '@ant-design/icons';
import { useTaskStore } from '../../stores/taskStore';
import { TaskEditor } from './TaskEditor';
import type { TaskStatus } from '@shared/types/task';

const statusColors: Record<TaskStatus, string> = {
  idle: 'default', running: 'processing', paused: 'warning',
  completed: 'success', failed: 'error', stopped: 'default',
};

const statusLabels: Record<TaskStatus, string> = {
  idle: '空闲', running: '运行中', paused: '已暂停',
  completed: '已完成', failed: '失败', stopped: '已停止',
};

interface TaskListProps {
  onEdit: (taskId: string) => void;
}

export const TaskList: React.FC<TaskListProps> = ({ onEdit }) => {
  const { tasks, removeTask } = useTaskStore();
  const [drawerTaskId, setDrawerTaskId] = useState<string | null>(null);

  const handleStart = (taskId: string) => {
    (window as any).electronAPI?.invoke('task:start', { taskId });
  };

  const handleStop = (taskId: string) => {
    (window as any).electronAPI?.invoke('task:stop', { taskId });
  };

  const handleDoubleClick = (taskId: string) => {
    setDrawerTaskId(taskId);
  };

  const handleEditClick = (taskId: string) => {
    setDrawerTaskId(taskId);
    onEdit(taskId);
  };

  return (
    <>
      <List
        dataSource={tasks}
        renderItem={(task) => (
          <List.Item
            onDoubleClick={() => handleDoubleClick(task.id)}
            actions={[
              task.status === 'running' ? (
                <Button icon={<PauseCircleOutlined />} size="small" onClick={() => handleStop(task.id)} />
              ) : (
                <Button icon={<PlayCircleOutlined />} type="primary" size="small" onClick={() => handleStart(task.id)} />
              ),
              <Button icon={<EditOutlined />} size="small" onClick={() => handleEditClick(task.id)} />,
              <Popconfirm title="确定删除？" onConfirm={() => removeTask(task.id)}>
                <Button icon={<DeleteOutlined />} size="small" danger />
              </Popconfirm>,
            ]}
          >
            <List.Item.Meta
              title={task.name}
              description={<Tag color={statusColors[task.status]}>{statusLabels[task.status]}</Tag>}
            />
          </List.Item>
        )}
      />
      <Drawer
        title="编辑任务"
        open={drawerTaskId !== null}
        onClose={() => setDrawerTaskId(null)}
        width={600}
        destroyOnClose
      >
        {drawerTaskId && (
          <TaskEditor taskId={drawerTaskId} onClose={() => setDrawerTaskId(null)} />
        )}
      </Drawer>
    </>
  );
};
