import React from 'react';
import { Card, Tag, Button, Space, Popconfirm } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import type { StepGroup, Step } from '@shared/types/task';

interface StepGroupCardProps {
  group: StepGroup;
  steps: Step[];
  onEditGroup: (group: StepGroup) => void;
  onDeleteGroup: (groupId: string) => void;
  onAddStep: (groupId: string) => void;
  onEditStep: (step: Step) => void;
  onDeleteStep: (stepId: string) => void;
}

export const StepGroupCard: React.FC<StepGroupCardProps> = ({
  group, steps, onEditGroup, onDeleteGroup, onAddStep, onEditStep, onDeleteStep,
}) => {
  const loopLabel = group.loopCount === 0 ? '循环 ∞' : `循环 ×${group.loopCount}`;
  return (
    <Card
      size="small"
      title={<Space>{group.name}<Tag color="blue">{loopLabel}</Tag></Space>}
      extra={
        <Space>
          <Button icon={<EditOutlined />} size="small" onClick={() => onEditGroup(group)} />
          <Popconfirm title="确定删除该步骤组？组内步骤将变为未分组。" onConfirm={() => onDeleteGroup(group.id)}>
            <Button icon={<DeleteOutlined />} size="small" danger />
          </Popconfirm>
        </Space>
      }
      style={{ marginBottom: 8 }}
    >
      {steps.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 16, color: '#999' }}>暂无步骤</div>
      ) : (
        steps.map(step => (
          <div key={step.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0' }}>
            <span>{step.type} — {step.order}</span>
            <Space>
              <Button size="small" onClick={() => onEditStep(step)}>编辑</Button>
              <Popconfirm title="确定删除？" onConfirm={() => onDeleteStep(step.id)}>
                <Button size="small" danger>删除</Button>
              </Popconfirm>
            </Space>
          </div>
        ))
      )}
      <Button icon={<PlusOutlined />} size="small" type="dashed" block style={{ marginTop: 8 }} onClick={() => onAddStep(group.id)}>
        在该组添加步骤
      </Button>
    </Card>
  );
};
