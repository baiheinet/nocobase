import { tExpr as _tExpr } from '@nocobase/flow-engine';
import { useTranslation } from 'react-i18next';

export const NAMESPACE = '@nocobase/plugin-pcf-parser';

export function tExpr(key: string, options?: Record<string, unknown>) {
  return _tExpr(key, { ns: [NAMESPACE, 'client'], ...(options || {}) });
}

export function useT() {
  return useTranslation([NAMESPACE, 'client'], { nsMode: 'fallback' })[0];
}
