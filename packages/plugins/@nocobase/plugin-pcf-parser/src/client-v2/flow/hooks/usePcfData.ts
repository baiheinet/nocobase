import { useEffect, useState } from 'react';
import { useApp } from '@nocobase/client-v2';

interface PcfSession {
  id: number;
  sessionId: string;
  unitsCoOrds: string | null;
  unitsWeight: string | null;
  fileName: string | null;
  parsedAt: string;
}

interface PcfComponent {
  id: number;
  sessionId: string;
  pipelineReference: string;
  componentType: string;
  componentIdentifier: string | null;
  posNumber: string | null;
  startPoint: { x: number; y: number; z: number; bore?: number } | null;
  endPoint: { x: number; y: number; z: number; bore?: number } | null;
  centrePoint: { x: number; y: number; z: number } | null;
  skey: string | null;
  itemCode: string | null;
  materialIdentifier: string | null;
  category: string | null;
  itemDescription: string | null;
  weight: number | null;
  pipingSpec: string | null;
  weldNumber: string | null;
  extraAttributes: Record<string, string[]> | null;
}

interface UsePcfDataResult {
  session: PcfSession | null;
  components: PcfComponent[];
  loading: boolean;
  error: string | null;
}

export function usePcfData(sessionId: string): UsePcfDataResult {
  const app = useApp();
  const [session, setSession] = useState<PcfSession | null>(null);
  const [components, setComponents] = useState<PcfComponent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) {
      setSession(null);
      setComponents([]);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const api = app.apiClient;
        const [sessionRes, compRes] = await Promise.all([
          api.request({
            url: 'pcfParseSessions:list',
            params: { filter: { sessionId }, limit: 1 },
          }),
          api.request({
            url: 'pcfComponents:list',
            params: { filter: { sessionId }, pageSize: 99999 },
          }),
        ]);
        const sessionData = sessionRes?.data?.data;
        setSession(Array.isArray(sessionData) ? sessionData[0] || null : null);
        const compData = compRes?.data?.data;
        setComponents(Array.isArray(compData) ? compData : []);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [sessionId, app.apiClient]);

  return { session, components, loading, error };
}
