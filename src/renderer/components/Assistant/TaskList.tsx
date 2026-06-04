import React, { useState, useEffect } from 'react';
import { Button, Tag, Popconfirm, Drawer, Modal, Form, Input, Space, message } from 'antd';
import { PlusOutlined, PlayCircleOutlined, PauseCircleOutlined, DeleteOutlined, EditOutlined } from '@ant-design/icons';
import { IPC_CHANNELS } from '@shared/constants';
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

export const TaskList: React.FC = () => {
  const { tasks, removeTask, setTasks, addTask } = useTaskStore();
  const [drawerTaskId, setDrawerTaskId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => { loadTasks(); }, []);

  const loadTasks = async () => {
    const api = (window as any).electronAPI;
    if (!api) return;
    try {
      const result = await api.invoke(IPC_CHANNELS.TASK_LIST);
      setTasks(result?.tasks || []);
    } catch (err) {
      message.error('加载任务列表失败。');
    }
  };

  const handleCreate = async (values: { name: string }) => {
    const api = (window as any).electronAPI;
    if (!api) {
      console.error('electronAPI is not available');
      message.error('系统接口不可用。');
      return;
    }
    try {
      console.log('Creating task with values:', values);
      const result = await api.invoke(IPC_CHANNELS.TASK_CREATE, values);
      console.log('Task create result:', result);
      if (result?.task) {
        addTask(result.task);
      } else {
        console.warn('Task create returned no task:', result);
      }
      setShowCreate(false);
      form.resetFields();
    } catch (err) {
      console.error('Failed to create task:', err);
      message.error('创建任务失败。');
    }
  };

  const handleDelete = async (taskId: string) => {
    const api = (window as any).electronAPI;
    if (!api) return;
    try {
      await api.invoke(IPC_CHANNELS.TASK_DELETE, { taskId });
      removeTask(taskId);
    } catch (err) {
      message.error('删除任务失败。');
    }
  };

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
  };

  return (
    <>
      <Button icon={<PlusOutlined />} onClick={() => setShowCreate(true)} style={{ marginBottom: 8 }}>新建任务</Button>
      <Space direction="vertical" style={{ width: '100%' }}>
        {tasks.map((task) => (
          <div
            key={task.id}
            onDoubleClick={() => handleDoubleClick(task.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 12px',
              border: '1px solid #f0f0f0',
              borderRadius: 4,
              background: '#fafafa',
            }}
          >
            <span style={{ flex: 1, fontWeight: 500 }}>{task.name}</span>
            <Tag color={statusColors[task.status]}>{statusLabels[task.status]}</Tag>
            {task.status === 'running' ? (
              <Button icon={<PauseCircleOutlined />} size="small" onClick={() => handleStop(task.id)} />
            ) : (
              <Button icon={<PlayCircleOutlined />} type="primary" size="small" onClick={() => handleStart(task.id)} />
            )}
            <Button icon={<EditOutlined />} size="small" onClick={() => handleEditClick(task.id)} />
            <Popconfirm title="确定删除？" onConfirm={() => handleDelete(task.id)}>
              <Button icon={<DeleteOutlined />} size="small" danger />
            </Popconfirm>
          </div>
        ))}
      </Space>
      <Modal title="新建任务" open={showCreate} onCancel={() => setShowCreate(false)} onOk={() => form.submit()}>
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入任务名称' }]}><Input /></Form.Item>
        </Form>
      </Modal>
      <Drawer
        title="编辑任务"
        open={drawerTaskId !== null}
        onClose={() => setDrawerTaskId(null)}
        size="large"
        destroyOnClose
      >
        {drawerTaskId && (
          <TaskEditor taskId={drawerTaskId} onClose={() => setDrawerTaskId(null)} />
        )}
      </Drawer>
    </>
  );
};
