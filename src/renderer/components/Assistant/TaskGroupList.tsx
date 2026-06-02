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
      message.error('加载任务组失败。');
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

  return (
    <>
      <Button icon={<PlusOutlined />} onClick={() => setShowCreate(true)} style={{ marginBottom: 8 }}>新建任务组</Button>
      <List
        dataSource={groups}
        renderItem={(group) => (
          <List.Item key={group.id} actions={[
            <Button icon={<PlayCircleOutlined />} type="primary" size="small" onClick={() => handleStart(group.id)} />,
            <Button icon={<StopOutlined />} size="small" onClick={() => handleStop(group.id)} />,
            <Button icon={<EditOutlined />} size="small" onClick={() => onEdit(group.id)} />,
            <Popconfirm title="确定删除？" onConfirm={() => handleDelete(group.id)}>
              <Button icon={<DeleteOutlined />} size="small" danger />
            </Popconfirm>,
          ]}>
            <List.Item.Meta title={group.name} description={<Tag>{group.failurePolicy}</Tag>} />
          </List.Item>
        )}
      />
      <Modal title="新建任务组" open={showCreate} onCancel={() => setShowCreate(false)} onOk={() => form.submit()}>
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item name="name" label="名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="failurePolicy" label="失败策略" initialValue="STOP">
            <Select options={[{ label: '停止', value: 'STOP' }, { label: '跳过', value: 'SKIP' }, { label: '重试', value: 'RETRY' }]} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};
