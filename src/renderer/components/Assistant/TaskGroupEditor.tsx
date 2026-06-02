import React, { useState, useEffect, useCallback } from 'react';
import { Card, Form, Input, InputNumber, Switch, Button, Select, Space, Popconfirm, message } from 'antd';
import { PlusOutlined, DeleteOutlined, HolderOutlined } from '@ant-design/icons';
import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { IPC_CHANNELS } from '@shared/constants';
import type { TaskGroup, TaskGroupItem } from '@shared/types/task-group';
import type { Task } from '@shared/types/task';

interface TaskGroupEditorProps {
  groupId: string;
  onClose: () => void;
}

interface SortableItemRowProps {
  item: TaskGroupItem;
  index: number;
  tasks: Task[];
  allItems: TaskGroupItem[];
  onRemove: (itemId: string) => void;
  onTargetChange: (itemId: string, field: 'onSuccess' | 'onFailure', value: string | null) => void;
}

const SortableItemRow: React.FC<SortableItemRowProps> = ({
  item,
  index,
  tasks,
  allItems,
  onRemove,
  onTargetChange,
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 12px',
    marginBottom: 4,
    background: '#fafafa',
    border: '1px solid #f0f0f0',
    borderRadius: 4,
  };

  const task = tasks.find((t) => t.id === item.taskId);
  const otherItems = allItems.filter((i) => i.id !== item.id);

  const jumpOptions = [
    { label: '结束', value: '__END__' },
    ...otherItems.map((i) => {
      const t = tasks.find((tk) => tk.id === i.taskId);
      return { label: t?.name || i.taskId, value: i.id };
    }),
  ];

  const toSelectValue = (val: string | null): string | undefined =>
    val === null ? undefined : val;

  const fromSelectValue = (val: string | undefined): string | null =>
    val === undefined ? null : val;

  return (
    <div ref={setNodeRef} style={style}>
      <HolderOutlined {...attributes} {...listeners} style={{ cursor: 'grab', color: '#999' }} />
      <span style={{ minWidth: 24, textAlign: 'center', color: '#666' }}>{index + 1}</span>
      <span style={{ flex: 1, fontWeight: 500 }}>{task?.name || item.taskId}</span>
      <Select
        allowClear
        placeholder="成功跳转"
        size="small"
        style={{ width: 120 }}
        value={toSelectValue(item.onSuccess)}
        onChange={(val) => onTargetChange(item.id, 'onSuccess', fromSelectValue(val))}
        options={jumpOptions}
      />
      <Select
        allowClear
        placeholder="失败跳转"
        size="small"
        style={{ width: 120 }}
        value={toSelectValue(item.onFailure)}
        onChange={(val) => onTargetChange(item.id, 'onFailure', fromSelectValue(val))}
        options={jumpOptions}
      />
      <Popconfirm title="确认删除？" onConfirm={() => onRemove(item.id)}>
        <Button icon={<DeleteOutlined />} size="small" danger />
      </Popconfirm>
    </div>
  );
};

export const TaskGroupEditor: React.FC<TaskGroupEditorProps> = ({ groupId, onClose }) => {
  const [group, setGroup] = useState<TaskGroup | null>(null);
  const [items, setItems] = useState<TaskGroupItem[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);

  const api = (window as any).electronAPI;

  const loadData = useCallback(async () => {
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
    } catch {
      message.error('加载分组数据失败');
    }
  }, [groupId, api]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSaveName = async (values: { name: string }) => {
    if (!api) return;
    try {
      await api.invoke(IPC_CHANNELS.TASK_GROUP_UPDATE, { taskGroupId: groupId, updates: { name: values.name } });
      message.success('名称已保存');
      loadData();
    } catch {
      message.error('保存名称失败');
    }
  };

  const handleSaveLoop = async (values: {
    loopEnabled: boolean;
    loopIntervalMs: number;
    loopMaxIterations: number;
  }) => {
    if (!api) return;
    try {
      await api.invoke(IPC_CHANNELS.TASK_GROUP_UPDATE_LOOP, {
        taskGroupId: groupId,
        loopEnabled: values.loopEnabled,
        loopIntervalMs: values.loopIntervalMs * 60 * 1000,
        loopMaxIterations: values.loopMaxIterations,
      });
      message.success('循环设置已保存');
      loadData();
    } catch {
      message.error('保存循环设置失败');
    }
  };

  const handleAddItem = async (taskId: string) => {
    if (!api) return;
    try {
      await api.invoke(IPC_CHANNELS.TASK_GROUP_ADD_ITEM, {
        taskGroupId: groupId,
        taskId,
        order: items.length,
      });
      loadData();
    } catch {
      message.error('添加任务失败');
    }
  };

  const handleRemoveItem = async (itemId: string) => {
    if (!api) return;
    try {
      await api.invoke(IPC_CHANNELS.TASK_GROUP_REMOVE_ITEM, { itemId });
      loadData();
    } catch {
      message.error('删除任务失败');
    }
  };

  const handleTargetChange = async (
    itemId: string,
    field: 'onSuccess' | 'onFailure',
    value: string | null,
  ) => {
    if (!api) return;
    try {
      await api.invoke(IPC_CHANNELS.TASK_GROUP_UPDATE_ITEM_TARGET, {
        itemId,
        [field]: value,
      });
      setItems((prev) =>
        prev.map((i) => (i.id === itemId ? { ...i, [field]: value } : i)),
      );
    } catch {
      message.error('更新跳转目标失败');
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = items.findIndex((i) => i.id === active.id);
    const newIndex = items.findIndex((i) => i.id === over.id);
    const reordered = arrayMove(items, oldIndex, newIndex);
    setItems(reordered);

    if (!api) return;
    try {
      await api.invoke(IPC_CHANNELS.TASK_GROUP_REORDER_ITEMS, {
        taskGroupId: groupId,
        itemIds: reordered.map((i) => i.id),
      });
    } catch {
      message.error('排序保存失败');
      loadData();
    }
  };

  if (!group) return null;

  const availableTasks = tasks.filter((t) => !items.some((i) => i.taskId === t.id));
  const intervalMinutes = Math.round(group.loopIntervalMs / 60 / 1000);

  return (
    <Space direction="vertical" style={{ width: '100%' }}>
      <Card
        title="基本信息"
        extra={<Button onClick={onClose}>关闭</Button>}
      >
        <Form
          layout="inline"
          initialValues={{ name: group.name }}
          onFinish={handleSaveName}
        >
          <Form.Item name="name" rules={[{ required: true, message: '请输入名称' }]}>
            <Input placeholder="分组名称" style={{ width: 240 }} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit">保存名称</Button>
          </Form.Item>
        </Form>
      </Card>

      <Card title="循环设置">
        <Form
          layout="inline"
          initialValues={{
            loopEnabled: group.loopEnabled,
            loopIntervalMs: intervalMinutes,
            loopMaxIterations: group.loopMaxIterations,
          }}
          onFinish={handleSaveLoop}
        >
          <Form.Item name="loopEnabled" label="启用循环" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="loopIntervalMs" label="间隔(分钟)">
            <InputNumber min={1} max={1440} />
          </Form.Item>
          <Form.Item name="loopMaxIterations" label="最大次数">
            <InputNumber min={1} max={9999} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit">保存循环</Button>
          </Form.Item>
        </Form>
      </Card>

      <Card title="任务编排">
        <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
            {items.map((item, index) => (
              <SortableItemRow
                key={item.id}
                item={item}
                index={index}
                tasks={tasks}
                allItems={items}
                onRemove={handleRemoveItem}
                onTargetChange={handleTargetChange}
              />
            ))}
          </SortableContext>
        </DndContext>

        {availableTasks.length > 0 && (
          <Select
            placeholder="添加任务"
            style={{ width: '100%', marginTop: 8 }}
            onChange={handleAddItem}
            value={undefined}
            options={availableTasks.map((t) => ({ label: t.name, value: t.id }))}
          />
        )}
      </Card>
    </Space>
  );
};
