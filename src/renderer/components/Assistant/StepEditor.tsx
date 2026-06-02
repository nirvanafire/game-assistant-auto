import React from 'react';
import { Form, Input, InputNumber, Select, Switch, Card, Space, Button } from 'antd';
import type { Step, StepType } from '@shared/types/task';

interface StepEditorProps {
  step?: Step;
  taskId: string;
  order?: number;
  onSave: (step: Partial<Step>) => void;
  onCancel: () => void;
}

const STEP_TYPES: { label: string; value: StepType }[] = [
  { label: 'Image Match', value: 'IMAGE_MATCH' },
  { label: 'Image Group', value: 'IMAGE_GROUP' },
  { label: 'Click', value: 'CLICK' },
];

const TRANSITION_ACTIONS = [
  { label: '(none)', value: undefined },
  { label: 'End Task', value: 'END_TASK' },
  { label: 'End Group Loop', value: 'END_GROUP_LOOP' },
];

export const StepEditor: React.FC<StepEditorProps> = ({ step, taskId, order = 0, onSave, onCancel }) => {
  const [form] = Form.useForm();

  const handleSubmit = (values: any) => {
    onSave({
      ...values,
      taskId,
      order: step?.order ?? order,
      config: buildConfig(values),
      onMatch: { action: values.onMatchAction, nextStepId: values.onMatchNextStepId },
      onMiss: { action: values.onMissAction, nextStepId: values.onMissNextStepId },
    });
  };

  return (
    <Card title={step ? 'Edit Step' : 'Add Step'} size="small">
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        initialValues={
          step
            ? {
                type: step.type,
                screenshotBeforeMatch: step.screenshotBeforeMatch,
                ...(step.config as Record<string, unknown>),
                onMatchAction: step.onMatch.action,
                onMatchNextStepId: step.onMatch.nextStepId,
                onMissAction: step.onMiss.action,
                onMissNextStepId: step.onMiss.nextStepId,
              }
            : {
                type: 'IMAGE_MATCH',
                threshold: 0.8,
                scaleRange: [0.5, 2.0],
                screenshotBeforeMatch: false,
              }
        }
      >
        <Form.Item name="type" label="Type" rules={[{ required: true }]}>
          <Select options={STEP_TYPES} />
        </Form.Item>
        <Form.Item name="screenshotBeforeMatch" label="Fresh Screenshot" valuePropName="checked">
          <Switch />
        </Form.Item>

        <Form.Item noStyle shouldUpdate={(prev, cur) => prev.type !== cur.type}>
          {({ getFieldValue }) => {
            const type = getFieldValue('type');
            if (type === 'IMAGE_MATCH') return <ImageMatchFields />;
            if (type === 'CLICK') return <ClickFields />;
            return null;
          }}
        </Form.Item>

        <Card type="inner" title="On Match" size="small" style={{ marginTop: 16 }}>
          <Form.Item name="onMatchAction" label="Action">
            <Select options={TRANSITION_ACTIONS} allowClear />
          </Form.Item>
          <Form.Item name="onMatchNextStepId" label="Next Step ID">
            <Input placeholder="optional step ID" />
          </Form.Item>
        </Card>

        <Card type="inner" title="On Miss" size="small" style={{ marginTop: 8 }}>
          <Form.Item name="onMissAction" label="Action">
            <Select options={TRANSITION_ACTIONS} allowClear />
          </Form.Item>
          <Form.Item name="onMissNextStepId" label="Next Step ID">
            <Input placeholder="optional step ID" />
          </Form.Item>
        </Card>

        <Space style={{ width: '100%', justifyContent: 'flex-end', marginTop: 16 }}>
          <Button onClick={onCancel}>Cancel</Button>
          <Button type="primary" htmlType="submit">
            Save
          </Button>
        </Space>
      </Form>
    </Card>
  );
};

const ImageMatchFields: React.FC = () => (
  <>
    <Form.Item name="templatePath" label="Template Path" rules={[{ required: true }]}>
      <Input placeholder="/path/to/template.png" />
    </Form.Item>
    <Form.Item name="threshold" label="Threshold">
      <InputNumber min={0} max={1} step={0.05} style={{ width: '100%' }} />
    </Form.Item>
  </>
);

const ClickFields: React.FC = () => (
  <>
    <Form.Item name="source" label="Source" rules={[{ required: true }]}>
      <Select
        options={[
          { label: 'Fixed', value: 'fixed' },
          { label: 'From Step', value: 'from_step' },
        ]}
      />
    </Form.Item>
    <Form.Item name={['fixedCoords', 'x']} label="X">
      <InputNumber style={{ width: '100%' }} />
    </Form.Item>
    <Form.Item name={['fixedCoords', 'y']} label="Y">
      <InputNumber style={{ width: '100%' }} />
    </Form.Item>
    <Form.Item name="stepId" label="Source Step ID">
      <Input placeholder="used when source is 'from_step'" />
    </Form.Item>
  </>
);

function buildConfig(values: Record<string, unknown>): Step['config'] {
  if (values.type === 'IMAGE_MATCH') {
    return {
      templatePath: values.templatePath as string,
      threshold: (values.threshold as number) ?? 0.8,
      delayMs: 0,
      retryCount: 0,
      retryIntervalMs: 0,
      scaleRange: (values.scaleRange as [number, number]) ?? [0.5, 2.0],
    };
  }
  if (values.type === 'CLICK') {
    return {
      source: values.source as 'fixed' | 'from_step',
      stepId: values.stepId as string | undefined,
      fixedCoords: values.fixedCoords as { x: number; y: number } | undefined,
      clickCount: 1,
      intervalMs: 0,
      delayMs: 0,
      button: 'left' as const,
    };
  }
  return {
    templates: [],
    logic: 'ANY' as const,
    delayMs: 0,
    retryCount: 0,
    retryIntervalMs: 0,
    scaleRange: [0.5, 2.0] as [number, number],
  };
}
