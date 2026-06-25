import React, { useState } from 'react';
import { useAPIClient } from '@nocobase/client';

export function PCFParserPage() {
  const api = useAPIClient();
  const [fileContent, setFileContent] = useState('');
  const [fileName, setFileName] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      setFileContent((evt.target?.result as string) || '');
    };
    reader.readAsText(file);
  };

  const handleSubmit = async () => {
    if (!fileContent) {
      setError('Please select a PCF file first');
      return;
    }
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const res = await api.request({
        url: '/api/pcf-parser:parse',
        method: 'POST',
        data: { fileName, rawContent: fileContent },
      });
      setResult(res?.data?.data);
    } catch (err: any) {
      setError(err?.response?.data?.errors?.[0]?.message || err.message || 'Parse failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 24, maxWidth: 800, margin: '0 auto' }}>
      <h1>PCF File Parser</h1>
      <p>Upload a Piping Component File to parse pipeline data into NocoBase.</p>

      <div style={{ margin: '16px 0' }}>
        <input type="file" accept=".pcf,.txt" onChange={handleFile} />
      </div>

      {fileContent && (
        <div style={{ margin: '16px 0' }}>
          <p><strong>File:</strong> {fileName}</p>
          <p><strong>Size:</strong> {(fileContent.length / 1024).toFixed(1)} KB</p>
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={loading || !fileContent}
        style={{
          padding: '8px 24px',
          fontSize: 16,
          cursor: loading ? 'wait' : 'pointer',
          background: loading ? '#ccc' : '#1890ff',
          color: '#fff',
          border: 'none',
          borderRadius: 4,
        }}
      >
        {loading ? 'Parsing...' : 'Parse PCF'}
      </button>

      {error && (
        <div style={{ marginTop: 16, padding: 12, background: '#fff2f0', border: '1px solid #ffccc7', borderRadius: 4, color: '#cf1322' }}>
          {error}
        </div>
      )}

      {result && (
        <div style={{ marginTop: 16, padding: 16, background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 4 }}>
          <h3>Parse Result</h3>
          <ul>
            <li>Session: {result.sessionId}</li>
            <li>Pipelines: {result.pipelines}</li>
            <li>Components: {result.components}</li>
            <li>Materials: {result.materials}</li>
            <li>BOM Items: {result.bom}</li>
          </ul>
          {result.pipelinesRef?.length > 0 && (
            <div>
              <h4>Pipelines</h4>
              <ul>
                {result.pipelinesRef.map((pr: any, i: number) => (
                  <li key={i}>
                    <code>{pr.reference}</code> — {pr.componentCount} components
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
