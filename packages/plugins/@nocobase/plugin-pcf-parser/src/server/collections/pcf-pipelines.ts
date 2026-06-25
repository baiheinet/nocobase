import type { CollectionOptions } from '@nocobase/database';

export default {
  name: 'pcfPipelines',
  title: 'PCF Pipelines',
  fields: [
    {
      type: 'bigInt',
      name: 'id',
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
      interface: 'id',
    },
    {
      type: 'string',
      name: 'sessionId',
      title: 'Session ID',
    },
    {
      type: 'string',
      name: 'pipelineReference',
      title: 'Pipeline Reference',
    },
    {
      type: 'string',
      name: 'projectIdentifier',
      title: 'Project',
    },
    {
      type: 'string',
      name: 'area',
      title: 'Area',
    },
    {
      type: 'string',
      name: 'pipingSpec',
      title: 'Piping Spec',
    },
    {
      type: 'string',
      name: 'fluidCode',
      title: 'Fluid Code',
    },
    {
      type: 'string',
      name: 'fluidPhase',
      title: 'Fluid Phase',
    },
    {
      type: 'string',
      name: 'lineId',
      title: 'Line ID',
    },
    {
      type: 'string',
      name: 'revision',
      title: 'Revision',
    },
    {
      type: 'jsonb',
      name: 'extraAttributes',
      title: 'Extra Attributes',
    },
  ],
} as CollectionOptions;
