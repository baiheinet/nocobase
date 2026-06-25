export interface PCFAttributeValue {
  raw: string;
}

export interface PCFComponent {
  type: string;
  attributes: Record<string, string[]>;
  compositeLines: string[];
}

export interface PCFPipeline {
  pipelineReference: string;
  attributes: Record<string, string[]>;
  components: PCFComponent[];
  connections: PCFComponent[];
  compositeLines: string[];
}

export interface PCFMaterial {
  materialIdentifier: string;
  itemCode: string;
  description: string;
}

export interface PCFParseResult {
  header: Record<string, string>;
  pipelines: PCFPipeline[];
  materials: PCFMaterial[];
  errors: string[];
}

export { PCFParser } from './pcf-parser';
