import { Context, Next } from '@nocobase/actions';
import { PCFParser } from '../parser';

export async function parsePCF(context: Context, next: Next) {
  const { values } = context.action.params;

  if (!values || !values.rawContent) {
    context.throw(400, 'rawContent is required');
  }

  const rawContent: string = values.rawContent;
  const fileName: string = values.fileName || 'unnamed.pcf';

  const parser = new PCFParser();
  const parseResult = parser.parse(rawContent);

  if (parseResult.errors.length > 0 && parseResult.pipelines.length === 0) {
    context.throw(422, `PCF parse failed: ${parseResult.errors.join('; ')}`);
  }

  const sessionId = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const db = context.db;
  const { pipelineRecords, componentRecords, materialRecords, bomRecords } =
    parser.toCollectionData(parseResult, sessionId);

  for (const record of pipelineRecords) {
    await db.getRepository('pcfPipelines').create({ values: record });
  }

  for (const record of componentRecords) {
    await db.getRepository('pcfComponents').create({ values: record });
  }

  for (const record of materialRecords) {
    await db.getRepository('pcfMaterials').create({ values: record });
  }

  for (const record of bomRecords) {
    await db.getRepository('pcfBom').create({ values: record });
  }

  await db.getRepository('pcfParseSessions').create({
    values: {
      sessionId,
      unitsCoOrds: parseResult.header['unitsCoOrds'] || null,
      unitsWeight: parseResult.header['unitsWeight'] || null,
      fileName,
    },
  });

  context.body = {
    sessionId,
    fileName,
    pipelines: pipelineRecords.length,
    components: componentRecords.length,
    materials: materialRecords.length,
    bom: bomRecords.length,
    errors: parseResult.errors,
    pipelinesRef: pipelineRecords.map(p => ({
      reference: p.pipelineReference,
      componentCount: componentRecords.filter(c => c.pipelineReference === p.pipelineReference).length,
    })),
  };

  await next();
}
