import React, { useState, useRef } from 'react';
import { GlassCard } from '../components/common/GlassCard';
import { Button } from '../components/common/Button';
import { moviesApi, getLocalMovies } from '../api/moviesApi';
import { useToast } from '../context/ToastContext';
import { Upload, Download, FileJson, AlertTriangle, CheckCircle2, X } from 'lucide-react';

export default function BulkImportPage() {
  const [importData, setImportData] = useState('');
  const [importErrors, setImportErrors] = useState([]);
  const [importing, setImporting] = useState(false);
  const [importSuccess, setImportSuccess] = useState(null);
  const fileRef = useRef(null);
  const { addToast } = useToast();

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setImportData(ev.target.result);
      setImportErrors([]);
      setImportSuccess(null);
    };
    reader.readAsText(file);
  };

  const validateMovies = (movies) => {
    const errors = [];
    if (!Array.isArray(movies)) {
      errors.push('Root must be a JSON array of movies');
      return errors;
    }
    const requiredFields = ['id', 'title', 'type', 'status'];
    movies.forEach((m, idx) => {
      requiredFields.forEach(field => {
        if (!m[field]) {
          errors.push(`Movie at index ${idx} is missing required field: "${field}"`);
        }
      });
    });
    return errors;
  };

  const handleImport = async () => {
    setImportErrors([]);
    setImportSuccess(null);

    let parsed;
    try {
      parsed = JSON.parse(importData);
    } catch (e) {
      setImportErrors(['Invalid JSON: ' + e.message]);
      return;
    }

    const errs = validateMovies(parsed);
    if (errs.length > 0) {
      setImportErrors(errs);
      return;
    }

    setImporting(true);
    try {
      await moviesApi.bulkImportMovies(parsed);
      setImportSuccess(`Successfully imported ${parsed.length} movies`);
      setImportData('');
      addToast(`Imported ${parsed.length} movies!`, 'success');
    } catch (err) {
      setImportErrors([err.message || 'Import failed']);
      addToast('Import failed', 'error');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl">
      <div>
        <h1 className="text-2xl font-extrabold text-white">Bulk Import</h1>
        <p className="text-sm text-zinc-500 mt-0.5">Import multiple movies at once via JSON file or paste</p>
      </div>

      {/* Upload Zone */}
      <GlassCard hover={false}>
        <h3 className="font-bold text-white mb-4 flex items-center gap-2">
          <Upload className="w-5 h-5 text-red-400" />
          Upload JSON File
        </h3>
        <div
          className="border-2 border-dashed border-zinc-700/60 rounded-xl p-10 text-center cursor-pointer hover:border-red-600/60 hover:bg-red-950/10 transition-all group"
          onClick={() => fileRef.current?.click()}
        >
          <FileJson className="w-12 h-12 mx-auto text-zinc-600 group-hover:text-red-400 mb-3 transition-colors" />
          <p className="text-sm font-semibold text-zinc-400 group-hover:text-zinc-200 transition-colors">
            Click to upload or drag &amp; drop a JSON file
          </p>
          <p className="text-xs text-zinc-600 mt-1">Must be an array of movie objects with exact schema</p>
          <input
            ref={fileRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleFileUpload}
          />
        </div>
      </GlassCard>

      {/* Paste Zone */}
      <GlassCard hover={false}>
        <h3 className="font-bold text-white mb-4 flex items-center gap-2">
          <FileJson className="w-5 h-5 text-sky-400" />
          Paste JSON
        </h3>
        <textarea
          value={importData}
          onChange={e => { setImportData(e.target.value); setImportErrors([]); setImportSuccess(null); }}
          rows={10}
          placeholder={'[\n  {\n    "id": "hollywood-2026-00001",\n    "title": "Movie Title (2026)",\n    ...\n  }\n]'}
          className="w-full bg-zinc-950/60 border border-zinc-800/60 rounded-xl p-4 text-sm font-mono text-zinc-300 placeholder-zinc-700 focus:outline-none focus:border-red-600/70 resize-none transition-all"
        />

        {/* Errors */}
        {importErrors.length > 0 && (
          <div className="mt-3 p-3 bg-red-950/40 border border-red-800/40 rounded-xl">
            <div className="flex items-center gap-2 text-red-400 font-bold text-sm mb-2">
              <AlertTriangle className="w-4 h-4" />
              Validation Errors ({importErrors.length})
            </div>
            <ul className="space-y-1">
              {importErrors.map((err, i) => (
                <li key={i} className="text-xs text-red-300 flex items-start gap-2">
                  <X className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  {err}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Success */}
        {importSuccess && (
          <div className="mt-3 p-3 bg-emerald-950/40 border border-emerald-800/40 rounded-xl flex items-center gap-2 text-emerald-400 font-semibold text-sm">
            <CheckCircle2 className="w-5 h-5" />
            {importSuccess}
          </div>
        )}

        <div className="flex justify-end mt-4">
          <Button
            variant="primary"
            icon={Upload}
            loading={importing}
            disabled={!importData.trim()}
            onClick={handleImport}
          >
            Import Movies
          </Button>
        </div>
      </GlassCard>

      {/* Schema Reference */}
      <GlassCard hover={false}>
        <h3 className="font-bold text-white mb-3 text-sm">Required JSON Schema</h3>
        <pre className="text-xs font-mono text-emerald-400 bg-zinc-950/60 rounded-xl p-4 overflow-x-auto border border-zinc-800/60">
{`{
  "id": "hollywood-2026-00001",       // Required
  "title": "Movie Title (2026)",      // Required
  "image": "Movie Title (2026).jpg",
  "release": "17 April 2026",
  "language": "Tamil",
  "year": "2026",
  "category": "Action, Drama",
  "duration": "01:34:42 min",
  "director": "Director Name",
  "starring": "Actor 1, Actor 2",
  "story": "Plot description...",
  "p360": "https://...",
  "p720": "https://...",
  "p1080": "https://...",
  "created_at": "2026-07-07",
  "type": "hollywood",                // Required
  "status": "Active"                  // Required
}`}
        </pre>
      </GlassCard>
    </div>
  );
}
