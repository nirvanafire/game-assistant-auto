import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, Form, Input, InputNumber, Button, Space, Popconfirm, message, Modal } from 'antd';
import { PlusOutlined, DeleteOutlined, EditOutlined } from '@ant-design/icons';
import { StepEditor } from './StepEditor';
import { StepGroupCard } from './StepGroupCard';
import { IPC_CHANNELS } from '@shared/constants';
import type { Step, StepGroup, Task } from '@shared/types/task';

interface TaskEditorProps {
  taskId: string;
  onClose: () => void;
}

export const TaskEditor: React.FC<TaskEditorProps> = ({ taskId, onClose }) => {
  const [task, setTask] = useState<Task | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const [stepGroups, setStepGroups] = useState<StepGroup[]>([]);
  const [editingStep, setEditingStep] = useState<Step | null>(null);
  const [showStepEditor, setShowStepEditor] = useState(false);
  const [pendingGroupId, setPendingGroupId] = useState<string | undefined>(undefined);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState<StepGroup | null>(null);
  const [groupForm] = Form.useForm();

  const api = (window as any).electronAPI;

  const loadTask = useCallback(async () => {
    if (!api) return;
    try {
      const [taskResult, stepsResult, groupsResult] = await Promise.all([
        api.invoke(IPC_CHANNELS.TASK_GET, { taskId }),
        api.invoke(IPC_CHANNELS.TASK_GET_STEPS, { taskId }),
        api.invoke(IPC_CHANNELS.STEP_GROUP_LIST, { taskId }),
      ]);
      setTask(taskResult?.task ?? null);
      setSteps(stepsResult?.steps || []);
      setStepGroups(groupsResult?.groups || groupsResult || []);
    } catch (err) {
      console.error('Failed to load task:', err);
      message.error('加载任务数据失败。');
    }
  }, [taskId, api]);

  useEffect(() => {
    loadTask();
  }, [loadTask]);

  const handleSaveStep = async (stepData: Partial<Step>) => {
    try {
      const data = { ...stepData, groupId: pendingGroupId ?? stepData.groupId };
      if (editingStep) {
        await api.invoke(IPC_CHANNELS.TASK_UPDATE_STEP, { stepId: editingStep.id, updates: data });
      } else {
        await api.invoke(IPC_CHANNELS.TASK_CREATE_STEP, { step: { ...data, taskId } });
      }
      setShowStepEditor(false);
      setEditingStep(null);
      setPendingGroupId(undefined);
      loadTask();
    } catch (err) {
      console.error('Failed to save step:', err);
      message.error('保存步骤失败。');
    }
  };

  const handleDeleteStep = async (stepId: string) => {
    try {
      await api.invoke(IPC_CHANNELS.TASK_DELETE_STEP, { stepId });
      loadTask();
    } catch (err) {
      console.error('Failed to delete step:', err);
      message.error('删除步骤失败。');
    }
  };

  const handleAddStep = (groupId?: string) => {
    setEditingStep(null);
    setPendingGroupId(groupId);
    setShowStepEditor(true);
  };

  const handleEditStep = (step: Step) => {
    setEditingStep(step);
    setPendingGroupId(step.groupId);
    setShowStepEditor(true);
  };

  /* ---- Step Group CRUD ---- */

  const openCreateGroup = () => {
    setEditingGroup(null);
    groupForm.resetFields();
    groupForm.setFieldsValue({ name: '', loopCount: 1 });
    setShowGroupModal(true);
  };

  const openEditGroup = (group: StepGroup) => {
    setEditingGroup(group);
    groupForm.setFieldsValue({ name: group.name, loopCount: group.loopCount });
    setShowGroupModal(true);
  };

  const handleSaveGroup = async () => {
    try {
      const values = await groupForm.validateFields();
      if (editingGroup) {
        await api.invoke(IPC_CHANNELS.STEP_GROUP_UPDATE, {
          groupId: editingGroup.id,
          updates: { name: values.name, loopCount: values.loopCount },
        });
      } else {
        await api.invoke(IPC_CHANNELS.STEP_GROUP_CREATE, {
          group: { taskId, name: values.name, loopCount: values.loopCount },
        });
      }
      setShowGroupModal(false);
      setEditingGroup(null);
      loadTask();
    } catch (err) {
      console.error('Failed to save step group:', err);
      message.error('保存步骤组失败。');
    }
  };

  const handleDeleteGroup = async (groupId: string) => {
    try {
      await api.invoke(IPC_CHANNELS.STEP_GROUP_DELETE, { groupId });
      loadTask();
    } catch (err) {
      console.error('Failed to delete step group:', err);
      message.error('删除步骤组失败。');
    }
  };

  /* ---- Grouping logic ---- */

  const { groupedSteps, ungroupedSteps, emptyGroups } = useMemo(() => {
    const groupMap = new Map<string, Step[]>();
    for (const g of stepGroups) {
      groupMap.set(g.id, []);
    }
    const ungrouped: Step[] = [];
    for (const step of steps) {
      if (step.groupId && groupMap.has(step.groupId)) {
        groupMap.get(step.groupId)!.push(step);
      } else {
        ungrouped.push(step);
      }
    }
    const nonEmpty: Array<{ group: StepGroup; steps: Step[] }> = [];
    const empty: StepGroup[] = [];
    for (const g of stepGroups) {
      const s = groupMap.get(g.id)!;
      if (s.length > 0) {
        nonEmpty.push({ group: g, steps: s });
      } else {
        empty.push(g);
      }
    }
    nonEmpty.sort((a, b) => Math.min(...a.steps.map(s => s.order)) - Math.min(...b.steps.map(s => s.order)));
    return { groupedSteps: nonEmpty, ungroupedSteps: ungrouped, emptyGroups: empty };
  }, [steps, stepGroups]);

  if (!task) return null;

  return (
    <Space direction="vertical" style={{ width: '100%' }}>
      <Card title={`编辑任务: ${task.name}`} extra={<Button onClick={onClose}>关闭</Button>}>
        <Form layout="vertical" initialValues={task} onFinish={async (values) => {
          try {
            await api.invoke(IPC_CHANNELS.TASK_UPDATE, { taskId, updates: values });
            loadTask();
          } catch (err) {
            console.error('Failed to update task:', err);
            message.error('保存任务失败。');
          }
        }}>
          <Form.Item name="name" label="名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Button type="primary" htmlType="submit">保存任务</Button>
        </Form>
      </Card>

      <Card
        title="步骤"
        extra={
          <Space>
            <Button icon={<PlusOutlined />} onClick={openCreateGroup}>添加步骤组</Button>
            <Button icon={<PlusOutlined />} onClick={() => handleAddStep()}>添加步骤</Button>
          </Space>
        }
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          {/* Grouped steps */}
          {groupedSteps.map(({ group, steps: groupSteps }) => (
            <StepGroupCard
              key={group.id}
              group={group}
              steps={groupSteps}
              onEditGroup={openEditGroup}
              onDeleteGroup={handleDeleteGroup}
              onAddStep={handleAddStep}
              onEditStep={handleEditStep}
              onDeleteStep={handleDeleteStep}
            />
          ))}

          {/* Empty groups */}
          {emptyGroups.map(group => (
            <StepGroupCard
              key={group.id}
              group={group}
              steps={[]}
              onEditGroup={openEditGroup}
              onDeleteGroup={handleDeleteGroup}
              onAddStep={handleAddStep}
              onEditStep={handleEditStep}
              onDeleteStep={handleDeleteStep}
            />
          ))}

          {/* Ungrouped steps */}
          {ungroupedSteps.length > 0 && (
            <Card size="small" title="（未分组）" style={{ marginBottom: 8 }}>
              {ungroupedSteps.map(step => (
                <div key={step.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0' }}>
                  <span>{step.type} — {step.order}</span>
                  <Space>
                    <Button size="small" onClick={() => handleEditStep(step)}>编辑</Button>
                    <Popconfirm title="确定删除？" onConfirm={() => handleDeleteStep(step.id)}>
                      <Button size="small" danger>删除</Button>
                    </Popconfirm>
                  </Space>
                </div>
              ))}
            </Card>
          )}

          {steps.length === 0 && stepGroups.length === 0 && (
            <div style={{ textAlign: 'center', padding: 16, color: '#999' }}>暂无步骤</div>
          )}
        </Space>
      </Card>

      {showStepEditor && (
        <StepEditor
          step={editingStep || undefined}
          taskId={taskId}
          onSave={handleSaveStep}
          onCancel={() => { setShowStepEditor(false); setEditingStep(null); setPendingGroupId(undefined); }}
        />
      )}

      <Modal
        title={editingGroup ? '编辑步骤组' : '新建步骤组'}
        open={showGroupModal}
        onOk={handleSaveGroup}
        onCancel={() => { setShowGroupModal(false); setEditingGroup(null); }}
        destroyOnClose
      >
        <Form form={groupForm} layout="vertical" initialValues={{ name: '', loopCount: 1 }}>
          <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入步骤组名称' }]}>
            <Input placeholder="步骤组名称" />
          </Form.Item>
          <Form.Item name="loopCount" label="循环次数" extra="0 表示无限循环">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
};
