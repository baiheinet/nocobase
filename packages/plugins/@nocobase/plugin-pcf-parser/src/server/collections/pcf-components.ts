import type { CollectionOptions } from '@nocobase/database';

export default {
  name: 'pcfComponents',
  title: 'PCF Components',
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
      name: 'componentType',
      title: 'Component Type',
    },
    {
      type: 'string',
      name: 'componentIdentifier',
      title: 'Component Identifier',
    },
    {
      type: 'string',
      name: 'posNumber',
      title: 'POS Number',
    },
    {
      type: 'jsonb',
      name: 'startPoint',
      title: 'Start Point',
    },
    {
      type: 'jsonb',
      name: 'endPoint',
      title: 'End Point',
    },
    {
      type: 'jsonb',
      name: 'centrePoint',
      title: 'Centre Point',
    },
    {
      type: 'string',
      name: 'skey',
      title: 'Shape Key',
    },
    {
      type: 'string',
      name: 'itemCode',
      title: 'Item Code',
    },
    {
      type: 'string',
      name: 'materialIdentifier',
      title: 'Material Identifier',
    },
    {
      type: 'string',
      name: 'category',
      title: 'Category',
    },
    {
      type: 'text',
      name: 'itemDescription',
      title: 'Item Description',
    },
    {
      type: 'float',
      name: 'weight',
      title: 'Weight',
    },
    {
      type: 'string',
      name: 'pipingSpec',
      title: 'Piping Spec',
    },
    {
      type: 'jsonb',
      name: 'extraAttributes',
      title: 'Extra Attributes',
    },
  ],
} as CollectionOptions;
