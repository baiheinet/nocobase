import type { CollectionOptions } from '@nocobase/database';

export default {
  name: 'pcfMaterials',
  title: 'PCF Materials',
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
      name: 'materialIdentifier',
      title: 'Material Identifier',
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
  ],
} as CollectionOptions;
