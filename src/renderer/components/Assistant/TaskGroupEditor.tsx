import React, { useState, useEffect, useCallback } from 'react';
import { Card, Form, Input, Select, Button, Space, List, Popconfirm, message } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { IPC_CHANNELS } from '@shared/constants';
import type { TaskGroup } from '@shared/types/task-group';
import type { Task } from '@shared/types/task';

interface TaskGroupEditorProps {
  groupId: string;
  onClose: () => void;
}

export const TaskGroupEditor: React.FC<TaskGroupEditorProps> = ({ groupId, onClose }) => {
  const [group, setGroup] = useState<TaskGroup | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);

  const loadData = useCallback(async () => {
    const api = (window as any).electronAPI;
    if (!api) return;
    try {
      const [groupResult, itemsResult, tasksResult] = await Promise.all([
        api.invoke(IPC_CHANNELS.TASK_GROUP_GET, { taskGroupId: groupId }),
        api.invoke(IPC_CHANNELS.TASK_GROUP_GET_ITEMS, { taskGroupId: groupId }),
        api.invoke(IPC_CHANNELS.TASK_LIST),
      ]);
      setGroup(groupResult?.group ?? null);
      setItems(itemsResult?.items || []);
      setTasks(tasksResult?.tasks || []);
    } catch (err) {
      message.error('Failed to load group data.');
    }
  }, [groupId]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleAddItem = async (taskId: string) => {
    const api = (window as any).electronAPI;
    try {
      await api.invoke(IPC_CHANNELS.TASK_GROUP_ADD_ITEM, { taskGroupId: groupId, taskId, order: items.length });
      loadData();
    } catch (err) {
      message.error('Failed to add task to group.');
    }
  };

  const handleRemoveItem = async (itemId: string) => {
    const api = (window as any).electronAPI;
    try {
      await api.invoke(IPC_CHANNELS.TASK_GROUP_REMOVE_ITEM, { itemId });
      loadData();
    } catch (err) {
      message.error('Failed to remove task from group.');
    }
  };

  if (!group) return null;

  const availableTasks = tasks.filter(t => !items.some(i => i.taskId === t.id));

  return (
    <Space direction="vertical" style={{ width: '100%' }}>
      <Card title={`Edit Group: ${group.name}`} extra={<Button onClick={onClose}>Close</Button>}>
        <Form layout="vertical" initialValues={{ name: group.name, failurePolicy: group.failurePolicy }} onFinish={async (values) => {
          const api = (window as any).electronAPI;
          try {
            await api.invoke(IPC_CHANNELS.TASK_GROUP_UPDATE, { taskGroupId: groupId, updates: values });
            loadData();
          } catch (err) {
            message.error('Failed to update group.');
          }
        }}>
          <Form.Item name="name" label="Name" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="failurePolicy" label="Failure Policy">
            <Select options={[{ label: 'Stop', value: 'STOP' }, { label: 'Skip', value: 'SKIP' }, { label: 'Retry', value: 'RETRY' }]} />
          </Form.Item>
          <Button type="primary" htmlType="submit">Save Group</Button>
        </Form>
      </Card>

      <Card title="Tasks in Group">
        <List
          dataSource={items}
          renderItem={(item: any, index: number) => {
            const task = tasks.find(t => t.id === item.taskId);
            return (
              <List.Item key={item.id} actions={[
                <Popconfirm title="Remove?" onConfirm={() => handleRemoveItem(item.id)}>
                  <Button icon={<DeleteOutlined />} size="small" danger />
                </Popconfirm>,
              ]}>
                <List.Item.Meta title={`${index + 1}. ${task?.name || item.taskId}`} />
              </List.Item>
            );
          }}
        />
        {availableTasks.length > 0 && (
          <Select
            placeholder="Add task to group"
            style={{ width: '100%', marginTop: 8 }}
            onChange={handleAddItem}
            value={undefined}
            options={availableTasks.map(t => ({ label: t.name, value: t.id }))}
          />
        )}
      </Card>
    </Space>
  );
};
