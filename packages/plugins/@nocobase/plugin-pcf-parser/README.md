# @nocobase/plugin-pcf-parser

Parse PCF (Piping Component File) files and store pipeline data into NocoBase collections.

## Usage

1. Enable the plugin:
   ```
   yarn pm enable @nocobase/plugin-pcf-parser
   ```

2. Upload a PCF file via the admin UI at `/admin/pcf-parser`, or use the API:
   ```
   POST /api/pcf-parser:parse
   Body: { rawContent: "...PCF text content..." }
   ```

3. The parser creates records in 4 collections:
   - `pcfPipelines` — pipeline header data
   - `pcfComponents` — pipe components (PIPE, ELBOW, VALVE, FLANGE, etc.)
   - `pcfMaterials` — material definitions
   - `pcfBom` — bill of materials summary
