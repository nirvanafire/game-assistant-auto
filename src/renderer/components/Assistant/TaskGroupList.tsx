import React, { useState, useEffect } from 'react';
import { List, Button, Tag, Popconfirm, Modal, Form, Input, Select, message } from 'antd';
import { PlusOutlined, PlayCircleOutlined, StopOutlined, DeleteOutlined, EditOutlined } from '@ant-design/icons';
import { IPC_CHANNELS } from '@shared/constants';
import type { TaskGroup } from '@shared/types/task-group';

interface TaskGroupListProps {
  onEdit: (groupId: string) => void;
}

export const TaskGroupList: React.FC<TaskGroupListProps> = ({ onEdit }) => {
  const [groups, setGroups] = useState<TaskGroup[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => { loadGroups(); }, []);

  const loadGroups = async () => {
    const api = (window as any).electronAPI;
    if (!api) return;
    try {
      const result = await api.invoke(IPC_CHANNELS.TASK_GROUP_LIST);
      setGroups(result?.groups || []);
    } catch (err) {
      message.error('Failed to load task groups.');
    }
  };

  const handleCreate = async (values: any) => {
    const api = (window as any).electronAPI;
    try {
      await api.invoke(IPC_CHANNELS.TASK_GROUP_CREATE, values);
      setShowCreate(false);
      form.resetFields();
      loadGroups();
    } catch (err) {
      message.error('Failed to create task group.');
    }
  };

  const handleDelete = async (groupId: string) => {
    const api = (window as any).electronAPI;
    try {
      await api.invoke(IPC_CHANNELS.TASK_GROUP_DELETE, { taskGroupId: groupId });
      loadGroups();
    } catch (err) {
      message.error('Failed to delete task group.');
    }
  };

  const handleStart = async (groupId: string) => {
    const api = (window as any).electronAPI;
    try {
      await api.invoke(IPC_CHANNELS.TASK_GROUP_START, { taskGroupId: groupId });
    } catch (err) {
      message.error('Failed to start task group.');
    }
  };

  const handleStop = async (groupId: string) => {
    const api = (window as any).electronAPI;
    try {
      await api.invoke(IPC_CHANNELS.TASK_GROUP_STOP, { taskGroupId: groupId });
    } catch (err) {
      message.error('Failed to stop task group.');
    }
  };

  return (
    <>
      <Button icon={<PlusOutlined />} onClick={() => setShowCreate(true)} style={{ marginBottom: 8 }}>New Group</Button>
      <List
        dataSource={groups}
        renderItem={(group) => (
          <List.Item key={group.id} actions={[
            <Button icon={<PlayCircleOutlined />} type="primary" size="small" onClick={() => handleStart(group.id)} />,
            <Button icon={<StopOutlined />} size="small" onClick={() => handleStop(group.id)} />,
            <Button icon={<EditOutlined />} size="small" onClick={() => onEdit(group.id)} />,
            <Popconfirm title="Delete?" onConfirm={() => handleDelete(group.id)}>
              <Button icon={<DeleteOutlined />} size="small" danger />
            </Popconfirm>,
          ]}>
            <List.Item.Meta title={group.name} description={<Tag>{group.failurePolicy}</Tag>} />
          </List.Item>
        )}
      />
      <Modal title="New Task Group" open={showCreate} onCancel={() => setShowCreate(false)} onOk={() => form.submit()}>
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item name="name" label="Name" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="failurePolicy" label="Failure Policy" initialValue="STOP">
            <Select options={[{ label: 'Stop', value: 'STOP' }, { label: 'Skip', value: 'SKIP' }, { label: 'Retry', value: 'RETRY' }]} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};
