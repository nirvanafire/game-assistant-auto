import React, { useState, useEffect, useCallback } from 'react';
import { Card, Form, Input, Button, Space, List, Popconfirm, message } from 'antd';
import { PlusOutlined, DeleteOutlined, EditOutlined } from '@ant-design/icons';
import { StepEditor } from './StepEditor';
import { IPC_CHANNELS } from '@shared/constants';
import type { Step, Task } from '@shared/types/task';

interface TaskEditorProps {
  taskId: string;
  onClose: () => void;
}

export const TaskEditor: React.FC<TaskEditorProps> = ({ taskId, onClose }) => {
  const [task, setTask] = useState<Task | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const [editingStep, setEditingStep] = useState<Step | null>(null);
  const [showStepEditor, setShowStepEditor] = useState(false);

  const loadTask = useCallback(async () => {
    const api = (window as any).electronAPI;
    if (!api) return;
    try {
      const [taskResult, stepsResult] = await Promise.all([
        api.invoke(IPC_CHANNELS.TASK_GET, { taskId }),
        api.invoke(IPC_CHANNELS.TASK_GET_STEPS, { taskId }),
      ]);
      setTask(taskResult?.task ?? null);
      setSteps(stepsResult?.steps || []);
    } catch (err) {
      console.error('Failed to load task:', err);
      message.error('加载任务数据失败。');
    }
  }, [taskId]);

  useEffect(() => {
    loadTask();
  }, [loadTask]);

  const handleSaveStep = async (stepData: Partial<Step>) => {
    const api = (window as any).electronAPI;
    try {
      if (editingStep) {
        await api.invoke(IPC_CHANNELS.TASK_UPDATE_STEP, { stepId: editingStep.id, updates: stepData });
      } else {
        await api.invoke(IPC_CHANNELS.TASK_CREATE_STEP, { step: { ...stepData, taskId } });
      }
      setShowStepEditor(false);
      setEditingStep(null);
      loadTask();
    } catch (err) {
      console.error('Failed to save step:', err);
      message.error('保存步骤失败。');
    }
  };

  const handleDeleteStep = async (stepId: string) => {
    const api = (window as any).electronAPI;
    try {
      await api.invoke(IPC_CHANNELS.TASK_DELETE_STEP, { stepId });
      loadTask();
    } catch (err) {
      console.error('Failed to delete step:', err);
      message.error('删除步骤失败。');
    }
  };

  if (!task) return null;

  return (
    <Space direction="vertical" style={{ width: '100%' }}>
      <Card title={`编辑任务: ${task.name}`} extra={<Button onClick={onClose}>关闭</Button>}>
        <Form layout="vertical" initialValues={task} onFinish={async (values) => {
          const api = (window as any).electronAPI;
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

      <Card title="步骤" extra={<Button icon={<PlusOutlined />} onClick={() => { setEditingStep(null); setShowStepEditor(true); }}>添加步骤</Button>}>
        <List
          dataSource={steps}
          renderItem={(step, index) => (
            <List.Item key={step.id} actions={[
              <Button icon={<EditOutlined />} size="small" onClick={() => { setEditingStep(step); setShowStepEditor(true); }} />,
              <Popconfirm title="确定删除？" onConfirm={() => handleDeleteStep(step.id)}>
                <Button icon={<DeleteOutlined />} size="small" danger />
              </Popconfirm>,
            ]}>
              <List.Item.Meta title={`${index + 1}. ${step.type}`} description={step.config && 'templatePath' in step.config ? (step.config as any).templatePath : ''} />
            </List.Item>
          )}
        />
      </Card>

      {showStepEditor && (
        <StepEditor step={editingStep || undefined} taskId={taskId} onSave={handleSaveStep} onCancel={() => { setShowStepEditor(false); setEditingStep(null); }} />
      )}
    </Space>
  );
};
