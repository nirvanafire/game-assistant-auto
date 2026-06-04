import React from 'react';
import { Form, Input, InputNumber, Select, Switch, Card, Space, Button, Radio } from 'antd';
import { PlusOutlined, MinusCircleOutlined } from '@ant-design/icons';
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
  { label: '图像组匹配', value: 'IMAGE_GROUP' },
  { label: '点击', value: 'CLICK' },
];

const TRANSITION_ACTIONS = [
  { label: '（无）', value: undefined },
  { label: '下一个步骤', value: 'NEXT_STEP' },
  { label: '结束任务', value: 'END_TASK' },
  { label: '结束步骤组', value: 'END_STEP_GROUP' },
];

/** Collect all templatePath field values from the form, returning path strings with their field paths. */
function collectTemplatePaths(values: Record<string, unknown>, type: StepType): string[] {
  if (type === 'IMAGE_MATCH') {
    return values.templatePath ? [values.templatePath as string] : [];
  }
  if (type === 'IMAGE_GROUP') {
    const templates = (values as any).templates as Array<{ templatePath?: string }> | undefined;
    return (templates ?? []).map((t) => t.templatePath).filter(Boolean) as string[];
  }
  return [];
}

/** Normalize all template paths via IPC. Returns map of original -> saved path, or throws on failure. */
async function normalizeTemplatePaths(
  paths: string[],
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  for (const p of paths) {
    if (!p) continue;
    const resp = (await (window as any).electronAPI.invoke('image:normalize', {
      sourcePath: p,
    })) as { savedPath: string } | null;
    if (!resp?.savedPath) {
      throw new Error(`归一化失败: ${p}`);
    }
    result.set(p, resp.savedPath);
  }
  return result;
}

export const StepEditor: React.FC<StepEditorProps> = ({
  step,
  taskId,
  order = 0,
  onSave,
  onCancel,
}) => {
  const [form] = Form.useForm();

  const handleSubmit = async (values: any) => {
    const type = values.type as StepType;

    // Normalize template paths before saving
    const templatePaths = collectTemplatePaths(values, type);
    if (templatePaths.length > 0) {
      const normalized = await normalizeTemplatePaths(templatePaths);
      if (type === 'IMAGE_MATCH' && values.templatePath) {
        values = { ...values, templatePath: normalized.get(values.templatePath) ?? values.templatePath };
      }
      if (type === 'IMAGE_GROUP' && values.templates) {
        values = {
          ...values,
          templates: values.templates.map((t: any) => ({
            ...t,
            templatePath: normalized.get(t.templatePath) ?? t.templatePath,
          })),
        };
      }
    }

    onSave({
      ...values,
      taskId,
      order: step?.order ?? order,
      config: buildConfig(values),
      onMatch:
        type === 'CLICK'
          ? undefined
          : { action: values.onMatchAction, nextStepId: values.onMatchNextStepId },
      onMiss:
        type === 'CLICK'
          ? undefined
          : { action: values.onMissAction, nextStepId: values.onMissNextStepId },
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
                cacheCoordinates: true,
                onMatchAction: 'NEXT_STEP',
              }
        }
      >
        <Form.Item name="type" label="类型" rules={[{ required: true }]}>
          <Select options={STEP_TYPES} />
        </Form.Item>

        {/* --- Toggles: horizontal row, hidden for CLICK --- */}
        <Form.Item noStyle shouldUpdate={(prev, cur) => prev.type !== cur.type}>
          {({ getFieldValue }) => {
            const type = getFieldValue('type') as StepType;
            if (type === 'CLICK') return null;
            return (
              <Space style={{ width: '100%' }} align="start">
                <Form.Item
                  name="screenshotBeforeMatch"
                  label="全新截图"
                  valuePropName="checked"
                  style={{ flex: 1 }}
                >
                  <Switch />
                </Form.Item>
                <Form.Item
                  name="realtimeMatch"
                  label="实时比对"
                  valuePropName="checked"
                  style={{ flex: 1 }}
                >
                  <Switch />
                </Form.Item>
                <Form.Item
                  name="cacheCoordinates"
                  label="缓存坐标"
                  valuePropName="checked"
                  style={{ flex: 1 }}
                >
                  <Switch />
                </Form.Item>
              </Space>
            );
          }}
        </Form.Item>

        {/* --- Type-specific fields --- */}
        <Form.Item noStyle shouldUpdate={(prev, cur) => prev.type !== cur.type}>
          {({ getFieldValue }) => {
            const type = getFieldValue('type') as StepType;
            if (type === 'IMAGE_MATCH') return <ImageMatchFields />;
            if (type === 'IMAGE_GROUP') return <ImageGroupFields form={form} />;
            if (type === 'CLICK') return <ClickFields />;
            return null;
          }}
        </Form.Item>

        {/* --- Transition cards: hidden for CLICK --- */}
        <Form.Item noStyle shouldUpdate={(prev, cur) => prev.type !== cur.type}>
          {({ getFieldValue }) => {
            const type = getFieldValue('type') as StepType;
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

/* ------------------------------------------------------------------ */
/*  Image picker helper                                                */
/* ------------------------------------------------------------------ */

/** Open image picker, normalize selected image, return saved path or null. */
async function pickAndNormalizeImage(): Promise<string | null> {
  const pickResult = (await (window as any).electronAPI.invoke('image:pick')) as {
    sourcePath: string | null;
  } | null;
  if (!pickResult?.sourcePath) return null;
  const normResult = (await (window as any).electronAPI.invoke('image:normalize', {
    sourcePath: pickResult.sourcePath,
  })) as { savedPath: string } | null;
  return normResult?.savedPath ?? null;
}

/* ------------------------------------------------------------------ */
/*  Field sub-components                                               */
/* ------------------------------------------------------------------ */

const ImageMatchFields: React.FC = () => {
  const form = Form.useFormInstance();

  const handlePick = async () => {
    const savedPath = await pickAndNormalizeImage();
    if (!savedPath) return;
    form.setFieldsValue({ templatePath: savedPath });
  };

  return (
    <>
      <Form.Item label="模板路径" required style={{ marginBottom: 0 }}>
        <Space.Compact style={{ width: '100%' }}>
          <Form.Item
            name="templatePath"
            noStyle
            rules={[{ required: true, message: '请选择或输入模板路径' }]}
          >
            <Input placeholder="/path/to/template.png" />
          </Form.Item>
          <Button onClick={handlePick}>选择图片</Button>
        </Space.Compact>
      </Form.Item>
      <Form.Item name="threshold" label="阈值">
        <InputNumber min={0} max={1} step={0.05} style={{ width: '100%' }} />
      </Form.Item>
    </>
  );
};

interface ImageGroupFieldsProps {
  form: ReturnType<typeof Form.useForm>[0];
}

const ImageGroupFields: React.FC<ImageGroupFieldsProps> = ({ form }) => (
  <>
    <Form.Item name="logic" label="匹配逻辑" initialValue="ANY">
      <Radio.Group>
        <Radio value="ANY">满足其一（任一匹配）</Radio>
        <Radio value="ALL">同时满足（全部匹配）</Radio>
      </Radio.Group>
    </Form.Item>

    <Form.List name="templates" initialValue={[{ label: '', templatePath: '', threshold: 0.8 }]}>
      {(fields, { add, remove }) => (
        <>
          {fields.map((field, index) => (
            <Card
              key={field.key}
              size="small"
              type="inner"
              title={`模板 ${index + 1}`}
              style={{ marginBottom: 8 }}
              extra={
                fields.length > 1 ? (
                  <MinusCircleOutlined onClick={() => remove(field.name)} />
                ) : null
              }
            >
              <Form.Item
                {...field}
                name={[field.name, 'label']}
                label="标签"
                rules={[{ required: true, message: '请输入标签' }]}
              >
                <Input placeholder="模板标签" />
              </Form.Item>
              <Form.Item label="模板路径" required style={{ marginBottom: 0 }}>
                <Space.Compact style={{ width: '100%' }}>
                  <Form.Item
                    {...field}
                    name={[field.name, 'templatePath']}
                    noStyle
                    rules={[{ required: true, message: '请选择或输入模板路径' }]}
                  >
                    <Input placeholder="/path/to/template.png" />
                  </Form.Item>
                  <Button
                    onClick={async () => {
                      const savedPath = await pickAndNormalizeImage();
                      if (!savedPath) return;
                      const templates = form.getFieldValue('templates') ?? [];
                      templates[index] = { ...templates[index], templatePath: savedPath };
                      form.setFieldsValue({ templates });
                    }}
                  >
                    选择图片
                  </Button>
                </Space.Compact>
              </Form.Item>
              <Form.Item
                {...field}
                name={[field.name, 'threshold']}
                label="阈值"
              >
                <InputNumber min={0} max={1} step={0.05} style={{ width: '100%' }} />
              </Form.Item>
            </Card>
          ))}
          <Button
            type="dashed"
            onClick={() => add({ label: '', templatePath: '', threshold: 0.8 })}
            block
            icon={<PlusOutlined />}
          >
            + 添加模板
          </Button>
        </>
      )}
    </Form.List>

    <Form.Item name="delayMs" label="延迟 (ms)" initialValue={0}>
      <InputNumber min={0} style={{ width: '100%' }} />
    </Form.Item>
    <Form.Item name="retryCount" label="重试次数" initialValue={0}>
      <InputNumber min={0} style={{ width: '100%' }} />
    </Form.Item>
    <Form.Item name="retryIntervalMs" label="重试间隔 (ms)" initialValue={0}>
      <InputNumber min={0} style={{ width: '100%' }} />
    </Form.Item>
    <Form.Item name="scaleRange" label="缩放范围" initialValue={[0.5, 2.0]}>
      <InputNumber min={0} max={10} step={0.1} style={{ width: '100%' }} />
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

/* ------------------------------------------------------------------ */
/*  buildConfig                                                        */
/* ------------------------------------------------------------------ */

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
  if (values.type === 'IMAGE_GROUP') {
    const templates = (values.templates as Array<{
      label: string;
      templatePath: string;
      threshold: number;
    }>) ?? [{ label: '', templatePath: '', threshold: 0.8 }];
    return {
      templates,
      logic: (values.logic as 'ALL' | 'ANY') ?? 'ANY',
      delayMs: (values.delayMs as number) ?? 0,
      retryCount: (values.retryCount as number) ?? 0,
      retryIntervalMs: (values.retryIntervalMs as number) ?? 0,
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
