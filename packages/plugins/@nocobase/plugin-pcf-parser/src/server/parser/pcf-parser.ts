import type { PCFParseResult, PCFPipeline, PCFComponent, PCFMaterial } from './index';

const HEADER_KEYWORDS = new Set([
  'ISOGEN-FILES', 'UNITS-BORE', 'UNITS-CO-ORDS',
  'UNITS-BOLT-LENGTH', 'UNITS-BOLT-DIA', 'UNITS-WEIGHT',
  'UNITS-ROTATION', 'UNITS-STIFFNESS', 'UNITS-WEIGHT-LENGTH',
]);

const COMPONENT_TYPES = new Set([
  'PIPE', 'ELBOW', 'VALVE', 'FLANGE', 'GASKET', 'BOLT',
  'WELD', 'REDUCER', 'TEE', 'CAP', 'PLUG', 'UNION',
  'COUPLING', 'STRAINER', 'FLEX', 'EXPANSION-JOINT',
  'HOSE', 'INSTRUMENT', 'RESTRICTION', 'FABRICATION-ITEM',
  'ERECTION-ITEM', 'ADDITIONAL-ITEM',
  'END-CONNECTION-PIPELINE', 'END-CONNECTION-EQUIPMENT',
  'CONNECTION-REFERENCE', 'BRANCH',
  'BEND', 'OLET', 'SWAGE', 'NIPPLE', 'SPACER',
  'BLANK', 'FILTER', 'SEPARATOR', 'VENT', 'DRAIN',
  'THERMOWELL', 'SIGHT-FLOW', 'METERRUN',
]);

function isComponentType(line: string): boolean {
  const word = line.split(/\s+/)[0];
  if (!word) return false;
  const upper = word.toUpperCase();
  return COMPONENT_TYPES.has(upper) || (word === upper && upper.length >= 2);
}

export class PCFParser {
  parse(raw: string): PCFParseResult {
    const result: PCFParseResult = {
      header: {},
      pipelines: [],
      materials: [],
      errors: [],
    };

    const lines = raw.split('\n')
      .map(l => l.replace(/\r$/, ''))
      .filter(l => l.trim().length > 0);

    if (lines.length === 0) {
      result.errors.push('Empty PCF file');
      return result;
    }

    this.parseHeader(lines, result);
    this.parseBody(lines, result);
    this.parseMaterials(lines, result);

    return result;
  }

  private parseHeader(lines: string[], result: PCFParseResult): void {
    for (const line of lines) {
      const kw = line.split(/\s+/)[0].toUpperCase();
      if (!HEADER_KEYWORDS.has(kw)) break;
      const parts = line.split(/\s+/);
      const value = parts.slice(1).join(' ');
      const key = kw.toLowerCase().replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      (result.header as any)[key] = value;
    }
  }

  private parseBody(lines: string[], result: PCFParseResult): void {
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      const fw = line.split(/\s+/)[0].toUpperCase();

      if (fw === 'MATERIALS') break;
      if (HEADER_KEYWORDS.has(fw)) { i++; continue; }

      if (fw === 'PIPELINE-REFERENCE') {
        const pipeline = this.parsePipeline(lines, i);
        result.pipelines.push(pipeline);
        i += pipeline.compositeLines.length;
        continue;
      }

      if (isComponentType(line)) {
        if (result.pipelines.length === 0) {
          result.pipelines.push({
            pipelineReference: '(implicit)',
            attributes: {},
            components: [],
            connections: [],
            compositeLines: [],
          });
        }
        const comp = this.parseComponent(lines, i, fw);
        const last = result.pipelines[result.pipelines.length - 1];
        if (fw.startsWith('END-CONNECTION-') || fw === 'CONNECTION-REFERENCE') {
          last.connections.push(comp);
        } else {
          last.components.push(comp);
        }
        i += comp.compositeLines.length;
        continue;
      }

      i++;
    }
  }

  private parsePipeline(lines: string[], startIndex: number): PCFPipeline {
    const pipeline: PCFPipeline = {
      pipelineReference: lines[startIndex].split(/\s+/).slice(1).join(' '),
      attributes: {},
      components: [],
      connections: [],
      compositeLines: [],
    };

    pipeline.compositeLines.push(lines[startIndex]);
    let i = startIndex + 1;

    while (i < lines.length) {
      const line = lines[i];
      const fw = line.split(/\s+/)[0].toUpperCase();

      if (fw === 'MATERIALS') break;
      if (fw === 'PIPELINE-REFERENCE') break;
      if (HEADER_KEYWORDS.has(fw)) { i++; continue; }
      if (isComponentType(line)) break;

      const trimmed = line.trim();
      const spaceIdx = trimmed.indexOf(' ');
      if (spaceIdx > 0) {
        const attrKey = trimmed.substring(0, spaceIdx).toUpperCase();
        const attrVal = trimmed.substring(spaceIdx + 1).trim();
        if (!pipeline.attributes[attrKey]) {
          pipeline.attributes[attrKey] = [];
        }
        pipeline.attributes[attrKey].push(attrVal);
      }
      pipeline.compositeLines.push(line);
      i++;
    }

    return pipeline;
  }

  private parseComponent(lines: string[], startIndex: number, compType: string): PCFComponent {
    const comp: PCFComponent = {
      type: compType,
      attributes: {},
      compositeLines: [],
    };

    comp.compositeLines.push(lines[startIndex]);
    const trimmed = lines[startIndex].trim();
    const spaceIdx = trimmed.indexOf(' ');
    const typeData = spaceIdx > 0 ? trimmed.substring(spaceIdx + 1).trim() : '';
    if (typeData) {
      comp.attributes['_TYPE_DATA'] = [typeData];
    }

    let i = startIndex + 1;
    while (i < lines.length) {
      const line = lines[i];
      const tr = line.trim();
      if (!tr) { i++; continue; }

      const fw = tr.split(/\s+/)[0].toUpperCase();

      if (fw === 'MATERIALS') break;
      if (fw === 'PIPELINE-REFERENCE') break;
      if (HEADER_KEYWORDS.has(fw)) { i++; continue; }

      if (isComponentType(line) && line[0] !== ' ') break;

      const attrSpaceIdx = tr.indexOf(' ');
      if (attrSpaceIdx > 0) {
        const attrKey = tr.substring(0, attrSpaceIdx).toUpperCase();
        const attrVal = tr.substring(attrSpaceIdx + 1).trim();
        if (!comp.attributes[attrKey]) {
          comp.attributes[attrKey] = [];
        }
        comp.attributes[attrKey].push(attrVal);
      }
      comp.compositeLines.push(line);
      i++;
    }

    return comp;
  }

  private parseMaterials(lines: string[], result: PCFParseResult): void {
    let inMaterials = false;

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].split(/\s+/)[0].toUpperCase() === 'MATERIALS') {
        inMaterials = true;
        continue;
      }
      if (!inMaterials) continue;

      const fw = lines[i].trim().split(/\s+/)[0].toUpperCase();
      if (fw === 'MATERIAL-IDENTIFIER') {
        const val = lines[i].trim().split(/\s+/).slice(1).join(' ');
        const material: PCFMaterial = {
          materialIdentifier: val,
          itemCode: '',
          description: '',
        };

        let j = i + 1;
        while (j < lines.length) {
          const next = lines[j];
          const nf = next.trim().split(/\s+/)[0].toUpperCase();
          if (nf === 'MATERIAL-IDENTIFIER' || nf === 'MATERIALS') break;
          if (nf === 'ITEM-CODE') {
            material.itemCode = next.trim().split(/\s+/).slice(1).join(' ');
          } else if (nf === 'DESCRIPTION') {
            material.description = next.trim().split(/\s+/).slice(1).join(' ');
          }
          j++;
        }

        result.materials.push(material);
      }
    }
  }

  toCollectionData(parseResult: PCFParseResult, sessionId: string) {
    const pipelineRecords = parseResult.pipelines.map(p => {
      const knownPipelineKeys = new Set([
        'PIPELINE-REFERENCE', 'PROJECT-IDENTIFIER', 'AREA',
        'PIPING-SPEC', 'FLUID-CODE', 'FLUID-PHASE',
        'LINE-ID', 'REVISION', 'DATE-DMY', 'PAINTING-SPEC',
        'PIPELINE-TEMP', 'PIPELINE-TYPE', 'START-CO-ORDS',
      ]);

      const extraAttrs: Record<string, string[]> = {};
      for (const [k, v] of Object.entries(p.attributes)) {
        if (!knownPipelineKeys.has(k)) {
          extraAttrs[k] = v;
        }
      }

      return {
        sessionId,
        pipelineReference: p.pipelineReference,
        projectIdentifier: p.attributes['PROJECT-IDENTIFIER']?.[0] || null,
        area: p.attributes['AREA']?.[0] || null,
        pipingSpec: p.attributes['PIPING-SPEC']?.[0] || null,
        fluidCode: p.attributes['FLUID-CODE']?.[0] || null,
        fluidPhase: p.attributes['FLUID-PHASE']?.[0] || null,
        lineId: p.attributes['LINE-ID']?.[0] || null,
        revision: p.attributes['REVISION']?.[0] || null,
        extraAttributes: Object.keys(extraAttrs).length > 0 ? extraAttrs : null,
      };
    });

    const componentRecords: any[] = [];
    for (const p of parseResult.pipelines) {
      for (const c of p.components) {
        const endpoints = (c.attributes['END-POINT'] || []).map(ep => {
          const tokens = ep.split(/\s+/);
          return parseCoords(tokens);
        });

        componentRecords.push({
          sessionId,
          pipelineReference: p.pipelineReference,
          componentType: c.type,
          componentIdentifier: c.attributes['COMPONENT-IDENTIFIER']?.[0] || null,
          startPoint: endpoints[0] || null,
          endPoint: endpoints[1] || null,
          centrePoint: parseAttrCoords(c.attributes['CENTRE-POINT']?.[0]),
          skey: c.attributes['SKEY']?.[0] || null,
          itemCode: c.attributes['ITEM-CODE']?.[0] || null,
          materialIdentifier: c.attributes['MATERIAL-IDENTIFIER']?.[0] || null,
          category: c.attributes['CATEGORY']?.[0]
            || c.attributes['CATEGORY-ERECTION']?.[0]
            || c.attributes['CATEGORY-FABRICATION']?.[0]
            || null,
          itemDescription: c.attributes['ITEM-DESCRIPTION']?.[0] || null,
          weight: c.attributes['WEIGHT']?.[0] ? parseFloat(c.attributes['WEIGHT'][0]) : null,
          pipingSpec: c.attributes['PIPING-SPEC']?.[0] || null,
          extraAttributes: getExtraComponentAttrs(c.attributes),
        });
      }
    }

    const materialRecords = parseResult.materials.map(m => ({
      sessionId,
      materialIdentifier: m.materialIdentifier,
      itemCode: m.itemCode,
      description: m.description,
    }));

    const bomRecords = buildBOM(componentRecords, materialRecords, sessionId);

    return { pipelineRecords, componentRecords, materialRecords, bomRecords };
  }
}

function parseCoords(tokens: string[]): { x: number; y: number; z: number; bore?: number } | null {
  if (tokens.length < 3) return null;
  const x = parseFloat(tokens[0]);
  const y = parseFloat(tokens[1]);
  const z = parseFloat(tokens[2]);
  if (isNaN(x) || isNaN(y) || isNaN(z)) return null;
  const result: any = { x, y, z };
  if (tokens.length >= 4) {
    const bore = parseFloat(tokens[3]);
    if (!isNaN(bore)) result.bore = bore;
  }
  return result;
}

function parseAttrCoords(val: string | undefined): { x: number; y: number; z: number } | null {
  if (!val) return null;
  const tokens = val.split(/\s+/);
  return parseCoords(tokens) as any;
}

const KNOWN_COMPONENT_ATTRS = new Set([
  'END-POINT', 'CENTRE-POINT', 'SKEY', 'ITEM-CODE',
  'MATERIAL-IDENTIFIER', 'CATEGORY', 'CATEGORY-ERECTION',
  'CATEGORY-FABRICATION', 'ITEM-DESCRIPTION', 'WEIGHT',
  'PIPING-SPEC', 'COMPONENT-IDENTIFIER',
  'MASTER-COMPONENT-IDENTIFIER', 'UCI',
  'BOLT-DIA', 'BOLT-LENGTH', 'BOLT-QUANTITY',
  'SPINDLE-DIRECTION', 'ANGLE', 'FLANGE-LEFT-LOOSE',
  'REPEAT-WELD-IDENTIFIER', 'WELD-ATTRIBUTE1',
  'WELD-ATTRIBUTE2', 'WELD-ATTRIBUTE3',
  'ITEM-GROUP', 'LENGTH', 'QUANTITY', 'SIZE',
  'INSULATION-TYPE', 'INSULATION-THICKNESS',
  'CO-ORDS', 'CONNECTION-REFERENCE',
]);

function getExtraComponentAttrs(attrs: Record<string, string[]>): Record<string, string[]> | null {
  const extra: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(attrs)) {
    if (!KNOWN_COMPONENT_ATTRS.has(k) && !k.startsWith('_')) {
      extra[k] = v;
    }
  }
  return Object.keys(extra).length > 0 ? extra : null;
}

function buildBOM(components: any[], materials: any[], sessionId: string): any[] {
  const bomMap = new Map<string, { itemCode: string; description: string; count: number }>();
  for (const c of components) {
    const key = c.itemCode || c.componentType;
    if (!key) continue;
    if (!bomMap.has(key)) {
      const mat = materials.find(m => m.itemCode === key);
      bomMap.set(key, {
        itemCode: key,
        description: mat?.description || c.itemDescription || '',
        count: 0,
      });
    }
    bomMap.get(key)!.count++;
  }
  return Array.from(bomMap.values()).map(b => ({
    sessionId,
    ...b,
  }));
}
