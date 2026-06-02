import React, { useState } from 'react';
import { Card, Upload, Button, Space, Typography, Image, message } from 'antd';
import { UploadOutlined } from '@ant-design/icons';

const { Text } = Typography;

interface MatchResult {
  matched: boolean;
  x?: number;
  y?: number;
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

  const handleMatch = async () => {
    if (!screenshot || !template) {
      message.warning('Please upload both images first.');
      return;
    }
    setLoading(true);
    try {
      const api = (window as any).electronAPI;
      const res = await api.invoke('capture:match', {
        screenshot,
        template,
        threshold: 0.8,
      });
      setResult(res);
    } catch (err) {
      message.error('Match failed.');
    } finally {
      setLoading(false);
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
          <Button icon={<UploadOutlined />}>Screenshot</Button>
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
          <Button icon={<UploadOutlined />}>Template</Button>
        </Upload>
        <Button type="primary" onClick={handleMatch} loading={loading} disabled={!screenshot || !template}>
          Match
        </Button>
      </Space>

      <Space>
        {screenshot && <Image src={screenshot} width={200} />}
        {template && <Image src={template} width={100} />}
      </Space>

      {result && (
        <Card size="small">
          <Text>Matched: {result.matched ? 'YES' : 'NO'}</Text>
          {result.matched && (
            <Space direction="vertical">
              <Text>X: {result.x}, Y: {result.y}</Text>
              <Text>Confidence: {result.confidence?.toFixed(3)}</Text>
              <Text>Scale: {result.scale?.toFixed(2)}</Text>
            </Space>
          )}
        </Card>
      )}
    </Space>
  );
};
