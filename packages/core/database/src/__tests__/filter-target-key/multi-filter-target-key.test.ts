/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import Database, { mockDatabase } from '../../index';

describe('multi filter target key', () => {
  let db: Database;

  beforeEach(async () => {
    db = mockDatabase();
    await db.clean({ drop: true });
  });

  afterEach(async () => {
    await db.close();
  });

  it('should set multi filter target keys', async () => {
    const Student = db.collection({
      name: 'students',
      autoGenId: false,
      filterTargetKey: ['name', 'classId'],
      fields: [
        {
          name: 'name',
          type: 'string',
          primaryKey: true,
        },
        {
          name: 'classId',
          type: 'bigInt',
          primaryKey: true,
        },
      ],
    });

    await db.sync();

    const s1 = await Student.repository.create({
      values: {
        name: 's1',
        classId: 1,
      },
    });

    // it should find by name and classId
    const findRes = await Student.repository.find({
      filterByTk: {
        name: 's1',
        classId: 1,
      },
    });

    expect(findRes.length).toBe(0);
  });
});
