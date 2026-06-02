import React, { useEffect, useState } from 'react';
import { Card, Tag, List, Space, Typography } from 'antd';
import { IPC_CHANNELS } from '@shared/constants';

const { Text } = Typography;

interface StepResult {
  stepId: string;
  matched: boolean;
  timestamp: string;
}

export const ExecutionStatus: React.FC = () => {
  const [taskStatus, setTaskStatus] = useState<{ taskId: string; status: string; currentStepId?: string } | null>(null);
  const [stepResults, setStepResults] = useState<StepResult[]>([]);

  useEffect(() => {
    const api = (window as any).electronAPI;
    if (!api) return;

    const handleStatusChanged = (data: any) => {
      setTaskStatus(data);
      if (data.status !== 'running') {
        setStepResults([]);
      }
    };

    const handleStepResult = (data: StepResult) => {
      setStepResults(prev => [data, ...prev].slice(0, 50));
    };

    api.on(IPC_CHANNELS.TASK_STATUS_CHANGED, handleStatusChanged);
    api.on(IPC_CHANNELS.TASK_STEP_RESULT, handleStepResult);

    return () => {
      api.removeAllListeners(IPC_CHANNELS.TASK_STATUS_CHANGED);
      api.removeAllListeners(IPC_CHANNELS.TASK_STEP_RESULT);
    };
  }, []);

  if (!taskStatus || taskStatus.status === 'idle') return null;

  const statusColor: Record<string, string> = {
    running: 'processing', completed: 'success', failed: 'error', stopped: 'default',
  };

  return (
    <Card size="small" title="Execution Status" style={{ marginBottom: 8 }}>
      <Space direction="vertical" style={{ width: '100%' }}>
        <Space>
          <Text>Task:</Text>
          <Tag color={statusColor[taskStatus.status]}>{taskStatus.status}</Tag>
          {taskStatus.currentStepId && <Text type="secondary">Step: {taskStatus.currentStepId}</Text>}
        </Space>
        {stepResults.length > 0 && (
          <List
            size="small"
            dataSource={stepResults}
            renderItem={(r) => (
              <List.Item>
                <Tag color={r.matched ? 'green' : 'red'}>{r.matched ? 'MATCH' : 'MISS'}</Tag>
                <Text type="secondary">{r.stepId}</Text>
              </List.Item>
            )}
          />
        )}
      </Space>
    </Card>
  );
};
