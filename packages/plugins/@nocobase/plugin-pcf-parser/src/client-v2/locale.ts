import { tExpr as _tExpr } from '@nocobase/flow-engine';
import { useTranslation } from 'react-i18next';

export const NAMESPACE = 'pcf-parser';

export function tExpr(key: string) {
  return _tExpr(key, { ns: [NAMESPACE, 'client'] });
}

export function useT() {
  return useTranslation([NAMESPACE, 'client'], { nsMode: 'fallback' })[0];
}
