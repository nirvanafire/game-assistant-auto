import React, { useState, useEffect } from 'react';
import { Button, Tag, Popconfirm, Modal, Form, Input, Select, message, Drawer, Space } from 'antd';
import { PlusOutlined, PlayCircleOutlined, StopOutlined, DeleteOutlined, EditOutlined } from '@ant-design/icons';
import { IPC_CHANNELS } from '@shared/constants';
import { TaskGroupEditor } from './TaskGroupEditor';
import type { TaskGroup } from '@shared/types/task-group';

export const TaskGroupList: React.FC = () => {
  const [groups, setGroups] = useState<TaskGroup[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [drawerGroupId, setDrawerGroupId] = useState<string | null>(null);
  const [form] = Form.useForm();

  useEffect(() => { loadGroups(); }, []);

  const loadGroups = async () => {
    const api = (window as any).electronAPI;
    if (!api) return;
    try {
      const result = await api.invoke(IPC_CHANNELS.TASK_GROUP_LIST);
      setGroups(result?.groups || []);
    } catch (err) {
      message.error('加载任务组失败。');
    }
  };

  const handleCreate = async (values: any) => {
    const api = (window as any).electronAPI;
    if (!api) {
      console.error('electronAPI is not available');
      message.error('系统接口不可用。');
      return;
    }
    try {
      console.log('Creating task group with values:', values);
      const result = await api.invoke(IPC_CHANNELS.TASK_GROUP_CREATE, values);
      console.log('Task group create result:', result);
      setShowCreate(false);
      form.resetFields();
      loadGroups();
    } catch (err) {
      console.error('Failed to create task group:', err);
      message.error('创建任务组失败。');
    }
  };

  const handleDelete = async (groupId: string) => {
    const api = (window as any).electronAPI;
    try {
      await api.invoke(IPC_CHANNELS.TASK_GROUP_DELETE, { taskGroupId: groupId });
      loadGroups();
    } catch (err) {
      message.error('删除任务组失败。');
    }
  };

  const handleStart = async (groupId: string) => {
    const api = (window as any).electronAPI;
    try {
      await api.invoke(IPC_CHANNELS.TASK_GROUP_START, { taskGroupId: groupId });
    } catch (err) {
      message.error('启动任务组失败。');
    }
  };

  const handleStop = async (groupId: string) => {
    const api = (window as any).electronAPI;
    try {
      await api.invoke(IPC_CHANNELS.TASK_GROUP_STOP, { taskGroupId: groupId });
    } catch (err) {
      message.error('停止任务组失败。');
    }
  };

  const handleDoubleClick = (groupId: string) => {
    setDrawerGroupId(groupId);
  };

  const handleEditClick = (groupId: string) => {
    setDrawerGroupId(groupId);
  };

  return (
    <>
      <Button icon={<PlusOutlined />} onClick={() => setShowCreate(true)} style={{ marginBottom: 8 }}>新建任务组</Button>
      <Space direction="vertical" style={{ width: '100%' }}>
        {groups.map((group) => (
          <div
            key={group.id}
            onDoubleClick={() => handleDoubleClick(group.id)}
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
            <span style={{ flex: 1, fontWeight: 500 }}>{group.name}</span>
            {group.loopEnabled && <Tag color="blue">循环</Tag>}
            <Tag>{group.failurePolicy}</Tag>
            <Button icon={<PlayCircleOutlined />} type="primary" size="small" onClick={() => handleStart(group.id)} />
            <Button icon={<StopOutlined />} size="small" onClick={() => handleStop(group.id)} />
            <Button icon={<EditOutlined />} size="small" onClick={() => handleEditClick(group.id)} />
            <Popconfirm title="确定删除？" onConfirm={() => handleDelete(group.id)}>
              <Button icon={<DeleteOutlined />} size="small" danger />
            </Popconfirm>
          </div>
        ))}
      </Space>
      <Modal title="新建任务组" open={showCreate} onCancel={() => setShowCreate(false)} onOk={() => form.submit()}>
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item name="name" label="名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="failurePolicy" label="失败策略" initialValue="STOP">
            <Select options={[{ label: '停止', value: 'STOP' }, { label: '跳过', value: 'SKIP' }, { label: '重试', value: 'RETRY' }]} />
          </Form.Item>
        </Form>
      </Modal>
      <Drawer
        title="编辑任务组"
        open={drawerGroupId !== null}
        onClose={() => setDrawerGroupId(null)}
        size="large"
        destroyOnClose
      >
        {drawerGroupId && (
          <TaskGroupEditor groupId={drawerGroupId} onClose={() => setDrawerGroupId(null)} />
        )}
      </Drawer>
    </>
  );
};
