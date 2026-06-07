import React, { useState } from 'react';
import { Card, Upload, Button, Space, Typography, Image, message } from 'antd';
import { UploadOutlined, CameraOutlined, AimOutlined } from '@ant-design/icons';
import { IPC_CHANNELS } from '@shared/constants';

const { Text } = Typography;

interface MatchResult {
  matched: boolean;
  x?: number;
  y?: number;
  screenX?: number;
  screenY?: number;
  confidence?: number;
  scale?: number;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export const ImageCompare: React.FC = () => {
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [template, setTemplate] = useState<string | null>(null);
  const [result, setResult] = useState<MatchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [screenshotLoading, setScreenshotLoading] = useState(false);
  const [moveLoading, setMoveLoading] = useState(false);

  const handleMatch = async () => {
    if (!screenshot || !template) {
      message.warning('请先上传两张图片。');
      return;
    }
    setLoading(true);
    try {
      const api = (window as any).electronAPI;
      if (!api) {
        message.error('系统接口不可用。');
        return;
      }
      const res = await api.invoke('capture:match', {
        screenshot,
        template,
        threshold: 0.8,
      });
      setResult(res);
    } catch (err) {
      message.error('匹配失败。');
    } finally {
      setLoading(false);
    }
  };

  const handleScreenshot = async () => {
    setScreenshotLoading(true);
    try {
      const api = (window as any).electronAPI;
      if (!api) {
        throw new Error('electronAPI not available');
      }
      const base64 = await api.invoke(IPC_CHANNELS.BROWSER_CAPTURE_SCREENSHOT);
      setScreenshot(base64);
      message.success('截图已保存并设置为当前截图');
    } catch (err: any) {
      message.error(err?.message || '截图失败');
    } finally {
      setScreenshotLoading(false);
    }
  };

  const handleMove = async () => {
    if (!result?.screenX || !result?.screenY) return;
    setMoveLoading(true);
    try {
      const api = (window as any).electronAPI;
      await api.invoke(IPC_CHANNELS.PYTHON_MOVE, { x: result.screenX, y: result.screenY });
      message.success(`鼠标已移动到 (${result.screenX}, ${result.screenY})`);
    } catch (err) {
      message.error('移动失败');
    } finally {
      setMoveLoading(false);
    }
  };

  return (
    <Space direction="vertical" style={{ width: '100%' }}>
      <Space>
        <Upload
          accept="image/*"
          showUploadList={false}
          beforeUpload={async (file) => {
            const b64 = await fileToBase64(file);
            setScreenshot(b64);
            return false;
          }}
        >
          <Button icon={<UploadOutlined />}>上传截图</Button>
        </Upload>
        <Upload
          accept="image/*"
          showUploadList={false}
          beforeUpload={async (file) => {
            const b64 = await fileToBase64(file);
            setTemplate(b64);
            return false;
          }}
        >
          <Button icon={<UploadOutlined />}>上传模板</Button>
        </Upload>
        <Button type="primary" onClick={handleMatch} loading={loading} disabled={!screenshot || !template}>
          对比
        </Button>
        <Button icon={<AimOutlined />} onClick={handleMove} loading={moveLoading} disabled={!result?.screenX || !result?.screenY}>
          移动鼠标
        </Button>
      </Space>
      <Button
        icon={<CameraOutlined />}
        loading={screenshotLoading}
        onClick={handleScreenshot}
      >
        截图
      </Button>

      <Space>
        {screenshot && <Image src={screenshot} width={200} />}
        {template && <Image src={template} width={100} />}
      </Space>

      {result && (
        <Card size="small">
          <Text>匹配结果: {result.matched ? '是' : '否'}</Text>
          {result.matched && (
            <Space direction="vertical">
              <Text>相对坐标: X: {result.x}, Y: {result.y}</Text>
              {result.screenX != null && result.screenY != null && (
                <Text>屏幕坐标: X: {result.screenX}, Y: {result.screenY}</Text>
              )}
              <Text>置信度: {result.confidence?.toFixed(3)}</Text>
              <Text>缩放比: {result.scale?.toFixed(2)}</Text>
            </Space>
          )}
        </Card>
      )}
    </Space>
  );
};
