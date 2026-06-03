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
  { label: '图像匹配', value: 'IMAGE_MATCH' },
  { label: '图像组', value: 'IMAGE_GROUP' },
  { label: '点击', value: 'CLICK' },
];

const TRANSITION_ACTIONS = [
  { label: '(无)', value: undefined },
  { label: '结束任务', value: 'END_TASK' },
  { label: '结束步骤组', value: 'END_STEP_GROUP' },
];

export const StepEditor: React.FC<StepEditorProps> = ({ step, taskId, order = 0, onSave, onCancel }) => {
  const [form] = Form.useForm();

  const handleSubmit = (values: any) => {
    const type = values.type;
    onSave({
      ...values,
      taskId,
      order: step?.order ?? order,
      config: buildConfig(values),
      onMatch: type === 'CLICK' ? undefined : { action: values.onMatchAction, nextStepId: values.onMatchNextStepId },
      onMiss: type === 'CLICK' ? undefined : { action: values.onMissAction, nextStepId: values.onMissNextStepId },
      realtimeMatch: values.realtimeMatch ?? false,
      cacheCoordinates: values.cacheCoordinates ?? false,
    });
  };

  return (
    <Card title={step ? '编辑步骤' : '添加步骤'} size="small">
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        initialValues={
          step
            ? {
                type: step.type,
                screenshotBeforeMatch: step.screenshotBeforeMatch,
                realtimeMatch: step.realtimeMatch,
                cacheCoordinates: step.cacheCoordinates,
                ...(step.config as Record<string, unknown>),
                onMatchAction: step.onMatch?.action,
                onMatchNextStepId: step.onMatch?.nextStepId,
                onMissAction: step.onMiss?.action,
                onMissNextStepId: step.onMiss?.nextStepId,
              }
            : {
                type: 'IMAGE_MATCH',
                threshold: 0.8,
                scaleRange: [0.5, 2.0],
                screenshotBeforeMatch: false,
                realtimeMatch: false,
                cacheCoordinates: false,
              }
        }
      >
        <Form.Item name="type" label="类型" rules={[{ required: true }]}>
          <Select options={STEP_TYPES} />
        </Form.Item>
        <Form.Item name="screenshotBeforeMatch" label="全新截图" valuePropName="checked">
          <Switch />
        </Form.Item>
        <Form.Item name="realtimeMatch" label="实时比对" valuePropName="checked">
          <Switch />
        </Form.Item>

        <Form.Item noStyle shouldUpdate={(prev, cur) => prev.type !== cur.type}>
          {({ getFieldValue }) => {
            const type = getFieldValue('type');
            if (type === 'IMAGE_MATCH') {
              return (
                <Form.Item name="cacheCoordinates" label="缓存坐标" valuePropName="checked">
                  <Switch />
                </Form.Item>
              );
            }
            return null;
          }}
        </Form.Item>

        <Form.Item noStyle shouldUpdate={(prev, cur) => prev.type !== cur.type}>
          {({ getFieldValue }) => {
            const type = getFieldValue('type');
            if (type === 'IMAGE_MATCH') return <ImageMatchFields />;
            if (type === 'CLICK') return <ClickFields />;
            return null;
          }}
        </Form.Item>

        <Form.Item noStyle shouldUpdate={(prev, cur) => prev.type !== cur.type}>
          {({ getFieldValue }) => {
            const type = getFieldValue('type');
            if (type === 'CLICK') return null;
            return (
              <>
                <Card type="inner" title="匹配时" size="small" style={{ marginTop: 16 }}>
                  <Form.Item name="onMatchAction" label="动作">
                    <Select options={TRANSITION_ACTIONS} allowClear />
                  </Form.Item>
                  <Form.Item name="onMatchNextStepId" label="下一步骤 ID">
                    <Input placeholder="可选步骤 ID" />
                  </Form.Item>
                </Card>
                <Card type="inner" title="未匹配时" size="small" style={{ marginTop: 8 }}>
                  <Form.Item name="onMissAction" label="动作">
                    <Select options={TRANSITION_ACTIONS} allowClear />
                  </Form.Item>
                  <Form.Item name="onMissNextStepId" label="下一步骤 ID">
                    <Input placeholder="可选步骤 ID" />
                  </Form.Item>
                </Card>
              </>
            );
          }}
        </Form.Item>

        <Space style={{ width: '100%', justifyContent: 'flex-end', marginTop: 16 }}>
          <Button onClick={onCancel}>取消</Button>
          <Button type="primary" htmlType="submit">
            保存
          </Button>
        </Space>
      </Form>
    </Card>
  );
};

const ImageMatchFields: React.FC = () => (
  <>
    <Form.Item name="templatePath" label="模板路径" rules={[{ required: true }]}>
      <Input placeholder="/path/to/template.png" />
    </Form.Item>
    <Form.Item name="threshold" label="阈值">
      <InputNumber min={0} max={1} step={0.05} style={{ width: '100%' }} />
    </Form.Item>
  </>
);

const ClickFields: React.FC = () => (
  <>
    <Form.Item name="source" label="来源" rules={[{ required: true }]}>
      <Select
        options={[
          { label: '固定', value: 'fixed' },
          { label: '从步骤', value: 'from_step' },
        ]}
      />
    </Form.Item>
    <Form.Item name={['fixedCoords', 'x']} label="X">
      <InputNumber style={{ width: '100%' }} />
    </Form.Item>
    <Form.Item name={['fixedCoords', 'y']} label="Y">
      <InputNumber style={{ width: '100%' }} />
    </Form.Item>
    <Form.Item name="stepId" label="来源步骤 ID">
      <Input placeholder="当来源为'从步骤'时使用" />
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
