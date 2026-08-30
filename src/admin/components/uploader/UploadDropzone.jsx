import React, { useRef, useState } from 'react';
import { DEFAULT_UPLOAD_CONFIG } from '../../services/uploader/uploadConfig';
import { isAllowedExtension } from '../../services/uploader/uploadUtils';
import { showToast } from '../common/ToastContainer';

export default function UploadDropzone({ onFilesSelected, categories, years }) {
  const fileInputRef = useRef(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [batchCategory, setBatchCategory] = useState('tamil');
  const [batchYear, setBatchYear] = useState('2026');

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const processFiles = (fileList) => {
    const rawFiles = Array.from(fileList || []);
    if (rawFiles.length === 0) return;

    const validFiles = [];
    const invalidFiles = [];

    for (const f of rawFiles) {
      if (isAllowedExtension(f.name)) {
        validFiles.push(f);
      } else {
        invalidFiles.push(f.name);
      }
    }

    if (invalidFiles.length > 0) {
      showToast(`Skipped ${invalidFiles.length} unsupported files (allowed: .mp4, .mkv, .webm, .mov)`, 'warning');
    }

    if (validFiles.length > 0) {
      onFilesSelected(validFiles, batchCategory, batchYear);
      showToast(`Added ${validFiles.length} movie(s) to upload queue`, 'success');
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  };

  const handleFileInputChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
      e.target.value = ''; // Reset input
    }
  };

  return (
    <div
      className={`upload-dropzone-box ${isDragOver ? 'drag-over' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".mp4,.mkv,.webm,.mov,.m4v,.avi,video/*"
        style={{ display: 'none' }}
        onChange={handleFileInputChange}
      />

      <div className="upload-dropzone-content">
        <div className="upload-dropzone-icon">
          <i className="fa-solid fa-film"></i>
        </div>

        <h3 className="upload-dropzone-title">
          Drag & Drop Movie Files Here (50+ Batch Supported)
        </h3>
        <p className="upload-dropzone-desc">
          Upload 5GB+ movie files directly to Cloudflare R2 via secure multipart stream
        </p>

        {/* Quick Batch Target Category & Year */}
        <div className="upload-batch-presets">
          <div className="preset-group">
            <label><i className="fa-solid fa-folder-open"></i> Default Category:</label>
            <select
              value={batchCategory}
              onChange={(e) => setBatchCategory(e.target.value)}
              className="admin-select"
            >
              {(categories || DEFAULT_UPLOAD_CONFIG.allowedCategories).map(cat => (
                <option key={cat.id || cat} value={cat.id || cat}>
                  {cat.label || cat}
                </option>
              ))}
            </select>
          </div>

          <div className="preset-group">
            <label><i className="fa-solid fa-calendar-days"></i> Default Year:</label>
            <select
              value={batchYear}
              onChange={(e) => setBatchYear(e.target.value)}
              className="admin-select"
            >
              {(years || DEFAULT_UPLOAD_CONFIG.years).map(yr => (
                <option key={yr} value={yr}>{yr}</option>
              ))}
            </select>
          </div>
        </div>

        <button
          type="button"
          className="admin-btn primary"
          style={{ padding: '12px 28px', fontSize: '15px', marginTop: '14px' }}
          onClick={() => fileInputRef.current?.click()}
        >
          <i className="fa-solid fa-folder-plus"></i>
          <span>Browse Movie Files</span>
        </button>

        <div className="upload-supported-badges">
          <span>Supported:</span>
          {DEFAULT_UPLOAD_CONFIG.allowedExtensions.map(ext => (
            <span key={ext} className="ext-badge">{ext}</span>
          ))}
          <span className="ext-badge max-size">Max 50 GB / file</span>
        </div>
      </div>
    </div>
  );
}
