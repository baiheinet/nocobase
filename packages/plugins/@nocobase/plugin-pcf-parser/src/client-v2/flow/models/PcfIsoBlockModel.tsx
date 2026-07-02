import { DataBlockModel } from '@nocobase/client-v2';
import React from 'react';
import { PcfIsoViewer } from '../components/PcfIsoViewer';
import { SessionSelect } from '../components/SessionSelect';
import { tExpr } from '../../locale';

export class PcfIsoBlockModel extends DataBlockModel {
  renderComponent() {
    const sessionId = this.props?.sessionId || '';
    const unitDisplay = this.props?.unitDisplay || 'original';
    const projection = this.props?.projection || 'dimetric';
    const showLabels = this.props?.showLabels !== false;
    const { heightMode, height } = (this as any).decoratorProps || {};
    return (
      <PcfIsoViewer
        sessionId={sessionId}
        unitDisplay={unitDisplay}
        projection={projection}
        showLabels={showLabels}
        heightMode={heightMode}
        height={height}
        model={this}
      />
    );
  }
}

PcfIsoBlockModel.define({
  label: tExpr('PCF ISO Viewer'),
});

PcfIsoBlockModel.registerFlow({
  key: 'pcfIsoSettings',
  title: tExpr('PCF ISO Settings'),
  steps: {
    selectSession: {
      title: tExpr('Select session'),
      uiSchema: {
        sessionId: {
          type: 'string',
          'x-component': SessionSelect,
          'x-decorator': 'FormItem',
          title: tExpr('Session'),
        },
        unitDisplay: {
          type: 'string',
          'x-component': 'Select',
          'x-decorator': 'FormItem',
          title: tExpr('Unit display'),
          enum: [
            { label: tExpr('Original'), value: 'original' },
            { label: tExpr('Meter'), value: 'meter' },
          ],
          default: 'original',
        },
        projection: {
          type: 'string',
          'x-component': 'Select',
          'x-decorator': 'FormItem',
          title: tExpr('Projection'),
          enum: [
            { label: tExpr('Plan (X-Z top-down)'), value: 'plan' },
            { label: tExpr('Dimetric (2:1)'), value: 'dimetric' },
            { label: tExpr('True isometric (30°)'), value: 'isometric' },
          ],
          default: 'dimetric',
        },
        showLabels: {
          type: 'boolean',
          'x-component': 'Switch',
          'x-decorator': 'FormItem',
          title: tExpr('Show component labels'),
          default: true,
        },
      },
      handler(ctx, params) {
        ctx.model.setProps({
          sessionId: params.sessionId || '',
          unitDisplay: params.unitDisplay || 'original',
          projection: params.projection || 'dimetric',
          showLabels: params.showLabels !== false,
        });
      },
    },
  },
});

export default PcfIsoBlockModel;
