import React, { useEffect, useState } from 'react';
import { Select, Spin } from 'antd';
import { useApp } from '@nocobase/client-v2';

interface SessionOption {
  label: string;
  value: string;
}

interface SessionSelectProps {
  value?: string;
  onChange?: (value: string) => void;
}

export const SessionSelect: React.FC<SessionSelectProps> = ({ value, onChange }) => {
  const app = useApp();
  const [options, setOptions] = useState<SessionOption[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchSessions = async () => {
      setLoading(true);
      try {
        const res = await app.apiClient.request({
          url: 'pcfParseSessions:list',
          params: { sort: '-parsedAt', pageSize: 200 },
        });
        const data = res?.data?.data;
        if (Array.isArray(data)) {
          setOptions(
            data.map((s: { sessionId: string; fileName: string | null; parsedAt: string; unitsCoOrds: string | null }) => ({
              value: s.sessionId,
              label: `${s.fileName || s.sessionId} (${s.unitsCoOrds || 'MM'}) - ${new Date(s.parsedAt).toLocaleDateString()}`,
            })),
          );
        }
      } catch {
        setOptions([]);
      } finally {
        setLoading(false);
      }
    };
    fetchSessions();
  }, [app.apiClient]);

  return (
    <Select
      value={value}
      onChange={onChange}
      options={options}
      loading={loading}
      placeholder="Select a parse session"
      notFoundContent={loading ? <Spin size="small" /> : 'No sessions found'}
      showSearch
      optionFilterProp="label"
      allowClear
      style={{ width: '100%' }}
    />
  );
};
