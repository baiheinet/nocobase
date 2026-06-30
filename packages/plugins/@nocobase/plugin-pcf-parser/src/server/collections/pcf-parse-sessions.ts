import type { CollectionOptions } from '@nocobase/database';

export default {
  name: 'pcfParseSessions',
  title: 'PCF Parse Sessions',
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
      type: 'uid',
      name: 'sessionId',
      title: 'Session ID',
      unique: true,
      index: true,
    },
    {
      type: 'string',
      name: 'unitsCoOrds',
      title: 'Units Co-Ords',
    },
    {
      type: 'string',
      name: 'unitsWeight',
      title: 'Units Weight',
    },
    {
      type: 'string',
      name: 'fileName',
      title: 'File Name',
    },
    {
      type: 'date',
      name: 'parsedAt',
      title: 'Parsed At',
      defaultToCurrentTime: true,
    },
  ],
} as CollectionOptions;
