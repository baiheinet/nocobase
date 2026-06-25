import type { CollectionOptions } from '@nocobase/database';

export default {
  name: 'pcfBom',
  title: 'PCF Bill of Materials',
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
      name: 'itemCode',
      title: 'Item Code',
    },
    {
      type: 'text',
      name: 'description',
      title: 'Description',
    },
    {
      type: 'integer',
      name: 'count',
      title: 'Count',
    },
  ],
} as CollectionOptions;
