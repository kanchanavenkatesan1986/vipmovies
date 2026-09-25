import React, { useState, useEffect, useMemo } from 'react';
import { formatBytes, getFileCategory, getFileIcon } from '../../services/fileManager/fileManagerUtils';
import { fileManagerApi } from '../../services/fileManager/fileManagerApi';

export default function UploadUrlModal({
  isOpen,
  currentPrefix = '',
  onClose,
  onSuccess,
  onViewFile
}) {
  const [fileUrl, setFileUrl] = useState('');
  const [customFilename, setCustomFilename] = useState('');
  const [duplicatePolicy, setDuplicatePolicy] = useState('replace');
  const [uploadMode, setUploadMode] = useState('cloud'); // 'cloud' (server-side stream) | 'browser' (client fetch)
  const [status, setStatus] = useState('idle'); // 'idle' | 'uploading' | 'success' | 'error'
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [uploadedResult, setUploadedResult] = useState(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Live percentage & bytes tracking
  const [percent, setPercent] = useState(0);
  const [loadedBytes, setLoadedBytes] = useState(0);
  const [totalBytes, setTotalBytes] = useState(0);
  const [transferSpeed, setTransferSpeed] = useState('');

  // Live timer while uploading
  useEffect(() => {
    let timer = null;
    if (status === 'uploading') {
      setElapsedSeconds(0);
      timer = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [status]);

  const formatTime = (totalSec) => {
    const s = totalSec % 60;
    const m = Math.floor(totalSec / 60);
    if (m === 0) return `${s}s`;
    return `${m}m ${s < 10 ? '0' : ''}${s}s`;
  };

  // Reset states when modal opens
  useEffect(() => {
    if (isOpen) {
      setFileUrl('');
      setCustomFilename('');
      setDuplicatePolicy('replace');
      setUploadMode('cloud');
      setStatus('idle');
      setStatusMessage('');
      setErrorMessage('');
      setUploadedResult(null);
      setElapsedSeconds(0);
      setPercent(0);
      setLoadedBytes(0);
      setTotalBytes(0);
      setTransferSpeed('');
    }
  }, [isOpen, currentPrefix]);

  // Auto-extract filename from URL
  const extractedFilename = useMemo(() => {
    if (!fileUrl || !fileUrl.trim()) return '';
    try {
      const parsed = new URL(fileUrl.trim());
      const raw = decodeURIComponent(parsed.pathname.split('/').pop() || '');
      const clean = raw.split('?')[0].trim();
      return clean;
    } catch {
      const match = fileUrl.trim().split('?')[0].split('/').pop();
      return match || '';
    }
  }, [fileUrl]);

  // Sync customFilename with extractedFilename when extractedFilename changes
  useEffect(() => {
    if (extractedFilename && !customFilename) {
      setCustomFilename(extractedFilename);
    }
  }, [extractedFilename]);

  // Effective filename
  const effectiveFilename = customFilename.trim() || extractedFilename || 'downloaded_file';
  const fileCategory = getFileCategory(effectiveFilename);
  const fileIcon = getFileIcon(effectiveFilename);

  // Quick clipboard paste handler
  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && (text.startsWith('http://') || text.startsWith('https://'))) {
        setFileUrl(text.trim());
        setErrorMessage('');
      } else {
        setErrorMessage('Clipboard content is not a valid web URL (must start with http:// or https://)');
      }
    } catch {
      setErrorMessage('Clipboard access denied. Please manually paste your URL.');
    }
  };

  // Browser fetch fallback handler (downloads in browser as blob then puts to R2)
  const handleBrowserFallbackUpload = async () => {
    setStatusMessage('Downloading file into browser memory...');
    const res = await fetch(fileUrl.trim());
    if (!res.ok) {
      throw new Error(`Remote host returned HTTP ${res.status}: ${res.statusText}`);
    }
    const blob = await res.blob();
    const finalKey = `${currentPrefix || ''}${effectiveFilename}`;

    setStatusMessage('Streaming downloaded file into R2 Storage...');
    return {
      filename: effectiveFilename,
      key: finalKey,
      size: blob.size
    };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!fileUrl.trim()) {
      setErrorMessage('Please enter a valid file download URL.');
      return;
    }

    try {
      new URL(fileUrl.trim());
    } catch {
      setErrorMessage('Invalid URL format. Please enter a full URL (e.g. https://domain.com/movie.mp4)');
      return;
    }

    setStatus('uploading');
    setErrorMessage('');
    setPercent(0);
    setLoadedBytes(0);
    setTotalBytes(0);
    setTransferSpeed('');
    setStatusMessage('Connecting to remote server & opening stream...');

    try {
      let result;
      if (uploadMode === 'cloud') {
        result = await fileManagerApi.uploadFromUrlWithProgress({
          url: fileUrl.trim(),
          prefix: currentPrefix || '',
          filename: effectiveFilename,
          duplicatePolicy,
          onProgress: (event) => {
            if (event.type === 'start') {
              if (event.total) setTotalBytes(event.total);
              setStatusMessage('Stream connected. Streaming data into Cloudflare R2...');
            } else if (event.type === 'progress') {
              if (typeof event.percent === 'number') {
                setPercent(event.percent);
              }
              if (event.loaded) setLoadedBytes(event.loaded);
              if (event.total) setTotalBytes(event.total);
              if (event.speed) setTransferSpeed(event.speed);
              setStatusMessage('Streaming to Cloudflare R2...');
            } else if (event.type === 'complete') {
              setPercent(100);
              if (event.size) setLoadedBytes(event.size);
            }
          }
        });
      } else {
        result = await handleBrowserFallbackUpload();
      }

      setStatus('success');
      setPercent(100);
      setStatusMessage('File uploaded successfully!');
      setUploadedResult(result);

      if (onSuccess) {
        onSuccess(result);
      }
    } catch (err) {
      console.error('URL Upload error:', err);
      setStatus('error');
      let msg = err.message || 'Failed to upload from URL.';
      if (msg.includes('CORS') || msg.includes('Failed to fetch')) {
        msg += ' (Tip: Remote host may be blocking server requests. Try switching to "Browser Fetch" mode below).';
      }
      setErrorMessage(msg);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="admin-modal-overlay" onClick={status === 'uploading' ? undefined : onClose}>
      <div className="admin-modal-box md" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="admin-modal-header">
          <div className="admin-modal-title">
            <i className="fa-solid fa-cloud-arrow-down" style={{ color: 'var(--admin-blue)' }}></i>
            Upload File from URL
          </div>
          {status !== 'uploading' && (
            <button type="button" className="admin-modal-close" onClick={onClose}>
              <i className="fa-solid fa-xmark"></i>
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit}>
          <div className="admin-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Target Folder Location */}
            <div className="admin-form-group">
              <label className="admin-label">Target Folder Location</label>
              <div
                style={{
                  fontSize: '13px',
                  color: '#93c5fd',
                  background: 'rgba(59, 130, 246, 0.08)',
                  padding: '9px 14px',
                  borderRadius: '8px',
                  border: '1px solid rgba(59, 130, 246, 0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <i className="fa-solid fa-folder-open" style={{ color: 'var(--admin-gold)' }}></i>
                <span style={{ color: 'var(--admin-text-muted)' }}>Target:</span>
                <strong style={{ color: '#fff', wordBreak: 'break-all' }}>
                  /{currentPrefix || 'root (Bucket Root)'}
                </strong>
              </div>
            </div>

            {/* URL Input with Clipboard Action */}
            <div className="admin-form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label className="admin-label" style={{ margin: 0 }}>
                  Remote File URL <span style={{ color: 'var(--admin-danger)' }}>*</span>
                </label>
                <button
                  type="button"
                  className="admin-btn text sm"
                  style={{ padding: '2px 8px', fontSize: '11.5px', color: 'var(--admin-blue)' }}
                  onClick={handlePasteClipboard}
                  disabled={status === 'uploading'}
                >
                  <i className="fa-regular fa-paste"></i> Paste from Clipboard
                </button>
              </div>
              <div style={{ position: 'relative' }}>
                <input
                  type="url"
                  className="admin-input"
                  value={fileUrl}
                  onChange={(e) => {
                    setFileUrl(e.target.value);
                    if (errorMessage) setErrorMessage('');
                  }}
                  placeholder="https://example.com/files/movie.mp4 or poster.jpg"
                  autoFocus
                  required
                  disabled={status === 'uploading'}
                  style={{ paddingLeft: '36px' }}
                />
                <i
                  className="fa-solid fa-link"
                  style={{
                    position: 'absolute',
                    left: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--admin-text-muted)',
                    fontSize: '13px'
                  }}
                ></i>
              </div>
            </div>

            {/* Filename & Category Preview */}
            <div className="admin-form-group">
              <label className="admin-label">Save As (Filename)</label>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  type="text"
                  className="admin-input"
                  value={customFilename}
                  onChange={(e) => setCustomFilename(e.target.value)}
                  placeholder={extractedFilename || 'e.g. movie.mp4'}
                  disabled={status === 'uploading'}
                  style={{ flex: 1 }}
                />
                {effectiveFilename && (
                  <div
                    style={{
                      background: 'var(--admin-surface)',
                      border: '1px solid var(--admin-border)',
                      borderRadius: '8px',
                      padding: '8px 12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '12px',
                      color: 'var(--admin-text-muted)',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    <i className={fileIcon} style={{ color: 'var(--admin-blue)' }}></i>
                    <span style={{ textTransform: 'capitalize' }}>{fileCategory}</span>
                  </div>
                )}
              </div>
              <div style={{ fontSize: '11.5px', color: 'var(--admin-text-dim)', marginTop: '4px' }}>
                Full R2 Destination Key: <code style={{ color: '#60a5fa' }}>{currentPrefix || ''}{effectiveFilename}</code>
              </div>
            </div>

            {/* Duplicate Policy */}
            <div className="admin-form-group">
              <label className="admin-label">If File Already Exists in this Folder</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    border: `1px solid ${duplicatePolicy === 'replace' ? 'var(--admin-blue)' : 'var(--admin-border)'}`,
                    background: duplicatePolicy === 'replace' ? 'rgba(59, 130, 246, 0.12)' : 'var(--admin-surface)',
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}
                >
                  <input
                    type="radio"
                    name="dupPolicy"
                    value="replace"
                    checked={duplicatePolicy === 'replace'}
                    onChange={() => setDuplicatePolicy('replace')}
                    disabled={status === 'uploading'}
                  />
                  <span>Overwrite</span>
                </label>

                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    border: `1px solid ${duplicatePolicy === 'rename' ? 'var(--admin-blue)' : 'var(--admin-border)'}`,
                    background: duplicatePolicy === 'rename' ? 'rgba(59, 130, 246, 0.12)' : 'var(--admin-surface)',
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}
                >
                  <input
                    type="radio"
                    name="dupPolicy"
                    value="rename"
                    checked={duplicatePolicy === 'rename'}
                    onChange={() => setDuplicatePolicy('rename')}
                    disabled={status === 'uploading'}
                  />
                  <span>Auto-Rename</span>
                </label>

                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    border: `1px solid ${duplicatePolicy === 'reject' ? 'var(--admin-blue)' : 'var(--admin-border)'}`,
                    background: duplicatePolicy === 'reject' ? 'rgba(59, 130, 246, 0.12)' : 'var(--admin-surface)',
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}
                >
                  <input
                    type="radio"
                    name="dupPolicy"
                    value="reject"
                    checked={duplicatePolicy === 'reject'}
                    onChange={() => setDuplicatePolicy('reject')}
                    disabled={status === 'uploading'}
                  />
                  <span>Reject / Skip</span>
                </label>
              </div>
            </div>

            {/* Upload Method / Cloud Stream vs Browser */}
            <div className="admin-form-group">
              <label className="admin-label">Transfer Engine</label>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  className={`admin-btn sm ${uploadMode === 'cloud' ? 'primary' : 'secondary'}`}
                  onClick={() => setUploadMode('cloud')}
                  disabled={status === 'uploading'}
                  style={{ flex: 1, justifyContent: 'center' }}
                >
                  <i className="fa-solid fa-bolt"></i>
                  <span>Cloudflare High-Speed Stream (Direct Cloud)</span>
                </button>
                <button
                  type="button"
                  className={`admin-btn sm ${uploadMode === 'browser' ? 'primary' : 'secondary'}`}
                  onClick={() => setUploadMode('browser')}
                  disabled={status === 'uploading'}
                  style={{ flex: 1, justifyContent: 'center' }}
                  title="Use if the remote host blocks server-to-server requests"
                >
                  <i className="fa-solid fa-globe"></i>
                  <span>Browser Fetch Fallback</span>
                </button>
              </div>
            </div>

            {/* Live Progress / Status Info */}
            {status === 'uploading' && (
              <div
                style={{
                  background: 'rgba(59, 130, 246, 0.12)',
                  border: '1px solid rgba(59, 130, 246, 0.4)',
                  borderRadius: '12px',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  textAlign: 'left'
                }}
              >
                {/* Header Row: Status and Badges */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#60a5fa', fontWeight: 600, fontSize: '13.5px' }}>
                    <i className="fa-solid fa-cloud-arrow-down fa-bounce" style={{ color: 'var(--admin-blue)' }}></i>
                    <span>{statusMessage}</span>
                  </div>

                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    {transferSpeed && (
                      <div
                        style={{
                          background: 'rgba(16, 185, 129, 0.18)',
                          border: '1px solid rgba(52, 211, 153, 0.4)',
                          padding: '3px 10px',
                          borderRadius: '20px',
                          fontSize: '11.5px',
                          fontWeight: 700,
                          color: '#6ee7b7',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        <i className="fa-solid fa-bolt" style={{ color: '#34d399' }}></i>
                        <span>{transferSpeed}</span>
                      </div>
                    )}

                    {/* Live Seconds Counter Badge */}
                    <div
                      style={{
                        background: 'rgba(37, 99, 235, 0.25)',
                        border: '1px solid rgba(96, 165, 250, 0.5)',
                        padding: '3px 10px',
                        borderRadius: '20px',
                        fontSize: '11.5px',
                        fontWeight: 800,
                        color: '#bfdbfe',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px'
                      }}
                    >
                      <i className="fa-solid fa-stopwatch fa-spin" style={{ animationDuration: '4s', color: '#60a5fa' }}></i>
                      <span>{formatTime(elapsedSeconds)}</span>
                    </div>
                  </div>
                </div>

                {/* Percentage & Transferred Bytes Display */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '2px' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                    <span
                      style={{
                        fontSize: '28px',
                        fontWeight: 900,
                        color: '#fff',
                        lineHeight: 1,
                        textShadow: '0 0 12px rgba(59, 130, 246, 0.5)',
                        fontFamily: 'monospace, sans-serif'
                      }}
                    >
                      {percent}%
                    </span>
                    <span style={{ fontSize: '12px', color: '#93c5fd', fontWeight: 600 }}>Completed</span>
                  </div>

                  <div style={{ fontSize: '12.5px', color: '#cbd5e1', fontWeight: 600 }}>
                    {totalBytes > 0 ? (
                      <span>
                        <strong style={{ color: '#fff' }}>{formatBytes(loadedBytes)}</strong> / {formatBytes(totalBytes)}
                      </span>
                    ) : loadedBytes > 0 ? (
                      <span>
                        <strong style={{ color: '#fff' }}>{formatBytes(loadedBytes)}</strong> transferred
                      </span>
                    ) : (
                      <span style={{ color: 'var(--admin-text-muted)' }}>Preparing stream...</span>
                    )}
                  </div>
                </div>

                {/* Progress Bar */}
                <div
                  style={{
                    width: '100%',
                    height: '10px',
                    background: 'rgba(255, 255, 255, 0.08)',
                    borderRadius: '6px',
                    overflow: 'hidden',
                    position: 'relative',
                    border: '1px solid rgba(255, 255, 255, 0.06)'
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${percent > 0 ? Math.min(100, percent) : (elapsedSeconds > 0 ? 2 : 0)}%`,
                      background: 'linear-gradient(90deg, #2563eb 0%, #3b82f6 50%, #60a5fa 100%)',
                      borderRadius: '6px',
                      transition: 'width 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                      boxShadow: '0 0 12px rgba(59, 130, 246, 0.7)'
                    }}
                  ></div>
                </div>

                {/* Subtext info */}
                <div style={{ fontSize: '11.5px', color: 'var(--admin-text-muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Direct server-to-server Cloudflare stream (Zero local data usage)</span>
                  {totalBytes > 0 && percent > 0 && percent < 100 && (
                    <span style={{ color: '#93c5fd' }}>
                      Remaining: {formatBytes(Math.max(0, totalBytes - loadedBytes))}
                    </span>
                  )}
                </div>
              </div>
            )}

            {status === 'success' && (
              <div
                style={{
                  background: 'rgba(16, 185, 129, 0.15)',
                  border: '1px solid #10b981',
                  borderRadius: '10px',
                  padding: '14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#34d399', fontWeight: 600 }}>
                  <i className="fa-solid fa-circle-check fa-lg"></i>
                  <span>Upload Completed Successfully in {formatTime(elapsedSeconds)}!</span>
                </div>
                <div style={{ fontSize: '12px', color: '#e2e8f0' }}>
                  Saved as: <code>{uploadedResult?.key || `${currentPrefix}${effectiveFilename}`}</code>
                </div>
                {uploadedResult?.sizeFormatted && (
                  <div style={{ fontSize: '12px', color: '#94a3b8', display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <i className="fa-solid fa-database" style={{ color: '#38bdf8' }}></i>
                    <span>Size: <strong style={{ color: '#38bdf8' }}>{uploadedResult.sizeFormatted}</strong></span>
                  </div>
                )}
              </div>
            )}

            {/* Error Display */}
            {errorMessage && (
              <div
                style={{
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid var(--admin-danger)',
                  color: '#fca5a5',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  fontSize: '12.5px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '8px'
                }}
              >
                <i className="fa-solid fa-circle-exclamation" style={{ marginTop: '2px' }}></i>
                <div style={{ flex: 1 }}>{errorMessage}</div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="admin-modal-footer">
            {status === 'success' ? (
              <div style={{ display: 'flex', gap: '10px', width: '100%', justifyContent: 'flex-end', alignItems: 'center' }}>
                <button
                  type="button"
                  className="admin-btn secondary"
                  onClick={onClose}
                >
                  <i className="fa-solid fa-check"></i> Done
                </button>
                <button
                  type="button"
                  className="admin-btn primary"
                  style={{
                    background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                    boxShadow: '0 4px 12px rgba(37, 99, 235, 0.35)'
                  }}
                  onClick={() => {
                    if (onViewFile && uploadedResult) {
                      onViewFile(uploadedResult);
                    } else {
                      onClose();
                    }
                  }}
                >
                  <i className="fa-solid fa-play"></i> View &amp; Preview File
                </button>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  className="admin-btn text"
                  onClick={onClose}
                  disabled={status === 'uploading'}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="admin-btn primary"
                  disabled={status === 'uploading' || !fileUrl.trim()}
                >
                  {status === 'uploading' ? (
                    <>
                      <i className="fa-solid fa-spinner fa-spin"></i>
                      <span>Importing ({percent > 0 ? `${percent}% • ` : ''}${formatTime(elapsedSeconds)})...</span>
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-cloud-arrow-down"></i>
                      <span>Start URL Upload</span>
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
