import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  formatBytes,
  getFileCategory,
  getFileIcon,
  extractFilenameFromUrlAdvanced,
  isScriptExtension
} from '../../services/fileManager/fileManagerUtils';
import { fileManagerApi } from '../../services/fileManager/fileManagerApi';
import { urlUploadManager, UPLOAD_STATUS } from '../../services/fileManager/urlUploadManager';

export default function UploadUrlModal({
  isOpen,
  currentPrefix = '',
  onClose,
  onSuccess,
  onViewFile
}) {
  // Mode: 'single' | 'batch'
  const [modalMode, setModalMode] = useState('single');

  // Background queue subscription state
  const [bgState, setBgState] = useState(() => urlUploadManager.getState());

  useEffect(() => {
    const unsub = urlUploadManager.subscribe((st) => setBgState(st));
    return unsub;
  }, []);

  // ==========================================
  // SINGLE URL STATE
  // ==========================================
  const [fileUrl, setFileUrl] = useState('');
  const [customFilename, setCustomFilename] = useState('');
  const [selectedFormat, setSelectedFormat] = useState('auto');
  const [duplicatePolicy, setDuplicatePolicy] = useState('replace');
  const [uploadMode, setUploadMode] = useState('cloud');
  const [singleStatus, setSingleStatus] = useState('idle'); // 'idle' | 'uploading' | 'success' | 'error'
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [uploadedResult, setUploadedResult] = useState(null);

  // Probing
  const [probeLoading, setProbeLoading] = useState(false);
  const [probedData, setProbedData] = useState(null);

  // Live telemetry for single modal upload
  const [percent, setPercent] = useState(0);
  const [loadedBytes, setLoadedBytes] = useState(0);
  const [totalBytes, setTotalBytes] = useState(0);
  const [transferSpeed, setTransferSpeed] = useState('');
  const [speedBps, setSpeedBps] = useState(0);
  const [peakSpeedBps, setPeakSpeedBps] = useState(0);
  const [etaSeconds, setEtaSeconds] = useState(null);
  const [uploadStage, setUploadStage] = useState('idle');
  const [elapsedMs, setElapsedMs] = useState(0);
  const startTimeRef = useRef(null);
  const singleAbortRef = useRef(null);

  // ==========================================
  // BATCH MULTI-URL STATE
  // ==========================================
  const [batchRawText, setBatchRawText] = useState('');
  const [batchItems, setBatchItems] = useState([]);
  const [batchConcurrency, setBatchConcurrency] = useState(2);
  const [batchDuplicatePolicy, setBatchDuplicatePolicy] = useState('replace');
  const [batchDefaultFormat, setBatchDefaultFormat] = useState('auto');

  // Ultra-precise stopwatch for single upload
  useEffect(() => {
    let interval = null;
    if (singleStatus === 'uploading') {
      startTimeRef.current = performance.now();
      setElapsedMs(0);
      interval = setInterval(() => {
        if (startTimeRef.current) {
          const now = performance.now();
          setElapsedMs(Math.round(now - startTimeRef.current));
        }
      }, 33);
    } else {
      if (interval) clearInterval(interval);
      startTimeRef.current = null;
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [singleStatus]);

  const formatPreciseStopwatch = (ms) => {
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    const mill = Math.floor(ms % 1000);
    return {
      mStr: String(m).padStart(2, '0'),
      sStr: String(s).padStart(2, '0'),
      msStr: String(mill).padStart(3, '0')
    };
  };

  const calculatedEta = useMemo(() => {
    if (typeof etaSeconds === 'number' && etaSeconds > 0) return etaSeconds;
    if (totalBytes > 0 && loadedBytes > 0 && speedBps > 0) {
      const remainingBytes = totalBytes - loadedBytes;
      return Math.max(0, Math.round(remainingBytes / speedBps));
    }
    return null;
  }, [etaSeconds, totalBytes, loadedBytes, speedBps]);

  const formatEta = (sec) => {
    if (sec === null || sec === undefined) return 'Calculating...';
    if (sec <= 0) return 'Finalizing...';
    if (sec < 60) return `~${sec}s left`;
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `~${m}m ${s < 10 ? '0' : ''}${s}s left`;
  };

  // Reset when modal opens
  useEffect(() => {
    if (isOpen) {
      setFileUrl('');
      setCustomFilename('');
      setSelectedFormat('auto');
      setDuplicatePolicy('replace');
      setUploadMode('cloud');
      setSingleStatus('idle');
      setStatusMessage('');
      setErrorMessage('');
      setUploadedResult(null);
      setPercent(0);
      setLoadedBytes(0);
      setTotalBytes(0);
      setTransferSpeed('');
      setSpeedBps(0);
      setPeakSpeedBps(0);
      setEtaSeconds(null);
      setUploadStage('idle');
      setProbeLoading(false);
      setProbedData(null);
      setBatchRawText('');
      setBatchItems([]);
    }
  }, [isOpen]);

  // Auto-extract filename from single URL
  const extractedFilename = useMemo(() => {
    return extractFilenameFromUrlAdvanced(fileUrl);
  }, [fileUrl]);

  // Remote link probe for single URL
  useEffect(() => {
    if (!fileUrl || !fileUrl.trim()) {
      setProbedData(null);
      setProbeLoading(false);
      return;
    }

    try {
      const u = new URL(fileUrl.trim());
      if (u.protocol !== 'http:' && u.protocol !== 'https:') return;
    } catch {
      return;
    }

    let isMounted = true;
    const timer = setTimeout(async () => {
      setProbeLoading(true);
      try {
        const res = await fileManagerApi.probeUrl(fileUrl.trim());
        if (isMounted && res && res.success) {
          setProbedData(res);
          if (res.filename && !customFilename) {
            setCustomFilename(res.filename);
          }
        }
      } catch (err) {
        console.warn('[PROBE_NOTICE]', err);
      } finally {
        if (isMounted) setProbeLoading(false);
      }
    }, 500);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [fileUrl]);

  useEffect(() => {
    if (extractedFilename && (!customFilename || customFilename === 'https:' || customFilename === 'http:')) {
      setCustomFilename(extractedFilename);
    }
  }, [extractedFilename]);

  const effectiveFilename = useMemo(() => {
    let name = (customFilename.trim() || extractedFilename || 'download_media.mp4').trim();

    if (selectedFormat !== 'auto') {
      name = name.replace(/\.[a-zA-Z0-9]+$/i, '') + selectedFormat;
    } else if (isScriptExtension(name)) {
      name = name.replace(/\.[a-zA-Z0-9]+$/i, '.mp4');
    }

    if (!/\.[a-zA-Z0-9]{2,5}$/.test(name)) {
      name = `${name}.mp4`;
    }

    return name.replace(/[\/\\]/g, '_');
  }, [customFilename, extractedFilename, selectedFormat]);

  // Single URL Paste
  const handlePasteClipboardSingle = async () => {
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

  // ==========================================
  // BATCH PARSING LOGIC
  // ==========================================
  const parseBatchText = (text) => {
    if (!text || typeof text !== 'string') return [];
    const lines = text
      .split(/[\r\n,]+/)
      .map((l) => l.trim())
      .filter((l) => l.startsWith('http://') || l.startsWith('https://'));

    const items = lines.map((url, index) => {
      let cand = extractFilenameFromUrlAdvanced(url);
      if (!cand || isScriptExtension(cand)) {
        cand = `movie_${index + 1}.mp4`;
      }
      if (!/\.[a-zA-Z0-9]{2,5}$/.test(cand)) {
        cand = `${cand}.mp4`;
      }

      return {
        id: `batch_${Date.now()}_${index}_${Math.random().toString(36).substring(2, 6)}`,
        url,
        filename: cand,
        format: batchDefaultFormat || 'auto',
        prefix: currentPrefix || '',
        duplicatePolicy: batchDuplicatePolicy || 'replace'
      };
    });

    return items;
  };

  const handleBatchTextChange = (e) => {
    const val = e.target.value;
    setBatchRawText(val);
    const parsed = parseBatchText(val);
    setBatchItems(parsed);
  };

  const handlePasteClipboardBatch = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && text.trim()) {
        const appended = batchRawText ? `${batchRawText}\n${text.trim()}` : text.trim();
        setBatchRawText(appended);
        setBatchItems(parseBatchText(appended));
        setErrorMessage('');
      }
    } catch {
      setErrorMessage('Clipboard access denied.');
    }
  };

  const handleUpdateBatchItemFilename = (id, newName) => {
    setBatchItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, filename: newName } : item))
    );
  };

  const handleRemoveBatchItem = (id) => {
    setBatchItems((prev) => {
      const updated = prev.filter((item) => item.id !== id);
      setBatchRawText(updated.map((i) => i.url).join('\n'));
      return updated;
    });
  };

  // ==========================================
  // SUBMIT HANDLERS
  // ==========================================

  // Start single upload in background directly
  const handleSingleUploadBackground = () => {
    if (!fileUrl.trim()) {
      setErrorMessage('Please enter a valid file download URL.');
      return;
    }

    urlUploadManager.addUrls([
      {
        url: fileUrl.trim(),
        prefix: currentPrefix || '',
        filename: effectiveFilename,
        duplicatePolicy
      }
    ]);

    if (onClose) onClose();
  };

  // Start single upload in foreground modal
  const handleSingleSubmit = async (e) => {
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

    setSingleStatus('uploading');
    setUploadStage('handshake');
    setErrorMessage('');
    setPercent(0);
    setLoadedBytes(0);
    setTotalBytes(0);
    setTransferSpeed('');
    setSpeedBps(0);
    setPeakSpeedBps(0);
    setEtaSeconds(null);
    setStatusMessage('Initiating remote origin handshake & establishing stream pipeline...');

    singleAbortRef.current = new AbortController();

    try {
      let result;
      if (uploadMode === 'cloud') {
        result = await fileManagerApi.uploadFromUrlWithProgress({
          url: fileUrl.trim(),
          prefix: currentPrefix || '',
          filename: effectiveFilename,
          duplicatePolicy,
          signal: singleAbortRef.current.signal,
          onProgress: (event) => {
            if (event.type === 'start') {
              if (event.total) setTotalBytes(event.total);
              setStatusMessage('Remote stream connected. High-speed zero-buffer direct R2 pipeline active...');
              setUploadStage('streaming');
            } else if (event.type === 'progress') {
              if (typeof event.percent === 'number') {
                setPercent(event.percent);
              }
              if (event.loaded) setLoadedBytes(event.loaded);
              if (event.total) setTotalBytes(event.total);
              if (event.speed) setTransferSpeed(event.speed);
              if (event.speedBps) {
                setSpeedBps(event.speedBps);
                setPeakSpeedBps((prev) => Math.max(prev, event.speedBps));
              }
              if (typeof event.etaSeconds === 'number') {
                setEtaSeconds(event.etaSeconds);
              }
              if (event.percent >= 98) {
                setUploadStage('finalizing');
                setStatusMessage('Writing final chunks & indexing Cloudflare R2 storage...');
              } else {
                setUploadStage('streaming');
                setStatusMessage('High-speed data streaming directly into Cloudflare R2...');
              }
            } else if (event.type === 'complete') {
              setPercent(100);
              if (event.size) setLoadedBytes(event.size);
              setUploadStage('complete');
            }
          }
        });
      } else {
        // Browser fallback
        setStatusMessage('Streaming downloaded file into R2 Storage...');
        result = await fileManagerApi.uploadFromUrl({
          url: fileUrl.trim(),
          prefix: currentPrefix || '',
          filename: effectiveFilename,
          duplicatePolicy
        });
      }

      setSingleStatus('success');
      setPercent(100);
      setUploadStage('complete');
      setStatusMessage('File imported and stored in Cloudflare R2 successfully!');
      setUploadedResult(result);

      if (onSuccess) {
        onSuccess(result);
      }
    } catch (err) {
      if (singleAbortRef.current?.signal?.aborted) {
        setSingleStatus('idle');
        setStatusMessage('');
      } else {
        console.error('URL Upload error:', err);
        setSingleStatus('error');
        setUploadStage('idle');
        setErrorMessage(err.message || 'Failed to upload from URL.');
      }
    } finally {
      singleAbortRef.current = null;
    }
  };

  // Send currently uploading single item to background manager
  const handleMinimizeSingleToBackground = () => {
    if (singleStatus === 'uploading') {
      if (singleAbortRef.current) {
        singleAbortRef.current.abort();
      }
      urlUploadManager.addUrls([
        {
          url: fileUrl.trim(),
          prefix: currentPrefix || '',
          filename: effectiveFilename,
          duplicatePolicy
        }
      ]);
    }
    if (onClose) onClose();
  };

  // Start Batch Upload
  const handleStartBatchUpload = () => {
    if (batchItems.length === 0) {
      setErrorMessage('Please enter at least one valid web URL.');
      return;
    }

    urlUploadManager.setConcurrency(batchConcurrency);

    const queueEntries = batchItems.map((item) => {
      let finalName = item.filename.trim();
      if (item.format !== 'auto') {
        finalName = finalName.replace(/\.[a-zA-Z0-9]+$/i, '') + item.format;
      }
      return {
        url: item.url,
        prefix: item.prefix || currentPrefix || '',
        filename: finalName,
        duplicatePolicy: item.duplicatePolicy || batchDuplicatePolicy
      };
    });

    urlUploadManager.addUrls(queueEntries);

    // Close modal so user can enjoy full background multitasking
    if (onClose) onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="admin-modal-overlay" onClick={onClose}>
      <div
        className="admin-modal-box lg"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: modalMode === 'batch' ? '820px' : '640px' }}
      >
        {/* Header */}
        <div className="admin-modal-header" style={{ paddingBottom: '12px' }}>
          <div className="admin-modal-title">
            <i className="fa-solid fa-cloud-arrow-down" style={{ color: 'var(--admin-blue)' }}></i>
            <span>Upload from URL</span>
          </div>
          <button type="button" className="admin-modal-close" onClick={onClose}>
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        {/* Mode Switcher Tabs */}
        {singleStatus !== 'uploading' && singleStatus !== 'success' && (
          <div className="fm-modal-mode-tabs">
            <button
              type="button"
              className={`fm-modal-tab-btn ${modalMode === 'single' ? 'active' : ''}`}
              onClick={() => setModalMode('single')}
            >
              <i className="fa-solid fa-link"></i>
              <span>Single File URL</span>
            </button>
            <button
              type="button"
              className={`fm-modal-tab-btn ${modalMode === 'batch' ? 'active' : ''}`}
              onClick={() => setModalMode('batch')}
            >
              <i className="fa-solid fa-layer-group" style={{ color: 'var(--admin-gold)' }}></i>
              <span>Batch Multi-URL Upload ({batchItems.length > 0 ? `${batchItems.length} Files` : 'Multiple Files at Once'})</span>
            </button>
          </div>
        )}

        {/* Active background tasks alert banner */}
        {bgState.hasActive && (
          <div className="fm-bg-active-banner">
            <i className="fa-solid fa-cloud-arrow-up fa-fade" style={{ color: 'var(--admin-blue)' }}></i>
            <span style={{ flex: 1 }}>
              <strong>{bgState.activeCount} upload(s) running in background</strong>
              {bgState.totalSpeedBps > 0 && ` • ${formatBytes(bgState.totalSpeedBps)}/s`}
              {bgState.queuedCount > 0 && ` • ${bgState.queuedCount} queued`}
            </span>
            <span style={{ fontSize: '11px', color: 'var(--admin-text-muted)' }}>
              (New files will queue automatically)
            </span>
          </div>
        )}

        <div className="admin-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '72vh', overflowY: 'auto' }}>
          {/* Target Folder Location Display */}
          <div className="admin-form-group" style={{ margin: 0 }}>
            <div
              style={{
                fontSize: '12.5px',
                color: '#93c5fd',
                background: 'rgba(59, 130, 246, 0.08)',
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid rgba(59, 130, 246, 0.25)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <i className="fa-solid fa-folder-open" style={{ color: 'var(--admin-gold)' }}></i>
              <span style={{ color: 'var(--admin-text-muted)' }}>Target Directory:</span>
              <strong style={{ color: '#fff', wordBreak: 'break-all' }}>
                /{currentPrefix || 'root (Bucket Root)'}
              </strong>
            </div>
          </div>

          {/* ============================================================ */}
          {/* 1. SINGLE URL MODE                                            */}
          {/* ============================================================ */}
          {modalMode === 'single' && (
            <>
              {/* Telemetry live card when uploading */}
              {singleStatus === 'uploading' && (
                <div className="fm-upload-live-card">
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '9px 12px',
                    background: 'rgba(59, 130, 246, 0.1)',
                    borderRadius: '8px',
                    border: '1px solid rgba(59, 130, 246, 0.25)',
                    fontSize: '12px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                      <i className="fa-solid fa-cloud-arrow-up" style={{ color: '#38bdf8' }}></i>
                      <span style={{ color: 'var(--admin-text-muted)' }}>Saving to:</span>
                      <strong style={{ color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        /{currentPrefix || ''}{effectiveFilename}
                      </strong>
                    </div>
                    <button
                      type="button"
                      className="admin-btn secondary sm"
                      onClick={handleMinimizeSingleToBackground}
                      title="Continue uploading in background so you can browse files"
                      style={{ padding: '3px 10px', fontSize: '11px', borderColor: 'var(--admin-blue)', color: '#93c5fd' }}
                    >
                      <i className="fa-solid fa-window-minimize"></i> Send to Background
                    </button>
                  </div>

                  {/* 4-Step Pipeline Status Tracker */}
                  <div className="fm-pipeline-tracker">
                    <div className={`fm-pipeline-step ${uploadStage === 'handshake' ? 'active' : 'completed'}`}>
                      <div className="fm-pipeline-dot">
                        {uploadStage === 'handshake' ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-check"></i>}
                      </div>
                      <span>Handshake</span>
                    </div>

                    <div className={`fm-pipeline-step ${uploadStage === 'handshake' ? '' : 'completed'}`}>
                      <div className="fm-pipeline-dot">
                        {uploadStage === 'handshake' ? '2' : <i className="fa-solid fa-check"></i>}
                      </div>
                      <span>Inspect</span>
                    </div>

                    <div className={`fm-pipeline-step ${uploadStage === 'streaming' ? 'active' : (uploadStage === 'finalizing' || uploadStage === 'complete' ? 'completed' : '')}`}>
                      <div className="fm-pipeline-dot">
                        {uploadStage === 'streaming' ? <i className="fa-solid fa-bolt fa-fade"></i> : (uploadStage === 'finalizing' || uploadStage === 'complete' ? <i className="fa-solid fa-check"></i> : '3')}
                      </div>
                      <span>R2 Stream</span>
                    </div>

                    <div className={`fm-pipeline-step ${uploadStage === 'finalizing' ? 'active' : (uploadStage === 'complete' ? 'completed' : '')}`}>
                      <div className="fm-pipeline-dot">
                        {uploadStage === 'finalizing' ? <i className="fa-solid fa-circle-notch fa-spin"></i> : (uploadStage === 'complete' ? <i className="fa-solid fa-check"></i> : '4')}
                      </div>
                      <span>Finalize</span>
                    </div>
                  </div>

                  {/* Hero Telemetry Row */}
                  <div className="fm-hero-telemetry-row">
                    <div className="fm-hero-percent-wrap">
                      <div className="fm-hero-percent">
                        {typeof percent === 'number' && percent > 0 ? percent.toFixed(percent % 1 === 0 ? 0 : 2) : '0.0'}
                        <span className="fm-hero-percent-symbol">%</span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span style={{ fontSize: '11px', color: '#93c5fd', fontWeight: 700, textTransform: 'uppercase' }}>
                          Live Stream
                        </span>
                        <span style={{ fontSize: '12px', color: '#cbd5e1' }}>
                          {totalBytes > 0 ? (
                            <span><strong style={{ color: '#fff' }}>{formatBytes(loadedBytes)}</strong> / {formatBytes(totalBytes)}</span>
                          ) : loadedBytes > 0 ? (
                            <span><strong style={{ color: '#fff' }}>{formatBytes(loadedBytes)}</strong> transferred</span>
                          ) : (
                            <span style={{ color: 'var(--admin-text-muted)' }}>Connecting pipeline...</span>
                          )}
                        </span>
                      </div>
                    </div>

                    <div className="fm-stopwatch-badge">
                      <i className="fa-solid fa-stopwatch fm-stopwatch-icon"></i>
                      <span className="fm-stopwatch-digits">
                        {formatPreciseStopwatch(elapsedMs).mStr}:{formatPreciseStopwatch(elapsedMs).sStr}
                      </span>
                      <span className="fm-stopwatch-ms">
                        .{formatPreciseStopwatch(elapsedMs).msStr}
                      </span>
                    </div>
                  </div>

                  {/* Progress Bar Track */}
                  <div className="fm-progress-track-wrapper">
                    <div className="fm-progress-track">
                      <div
                        className="fm-progress-fill"
                        style={{ width: `${percent > 0 ? Math.min(100, percent) : 2}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* 4-Metric Grid */}
                  <div className="fm-telemetry-metrics-grid">
                    <div className="fm-telemetry-chip highlight">
                      <span className="fm-telemetry-label">
                        <i className="fa-solid fa-gauge-high" style={{ color: '#34d399' }}></i> Speed
                      </span>
                      <span className="fm-telemetry-val speed">
                        {transferSpeed || (speedBps > 0 ? `${formatBytes(speedBps)}/s` : 'Buffering...')}
                      </span>
                    </div>
                    <div className="fm-telemetry-chip">
                      <span className="fm-telemetry-label">
                        <i className="fa-solid fa-chart-line" style={{ color: '#60a5fa' }}></i> Peak Speed
                      </span>
                      <span className="fm-telemetry-val" style={{ color: '#93c5fd' }}>
                        {peakSpeedBps > 0 ? `${formatBytes(peakSpeedBps)}/s` : '---'}
                      </span>
                    </div>
                    <div className="fm-telemetry-chip">
                      <span className="fm-telemetry-label">
                        <i className="fa-solid fa-hourglass-half" style={{ color: '#fbbf24' }}></i> ETA
                      </span>
                      <span className="fm-telemetry-val eta">{formatEta(calculatedEta)}</span>
                    </div>
                    <div className="fm-telemetry-chip">
                      <span className="fm-telemetry-label">
                        <i className="fa-solid fa-arrows-spin" style={{ color: '#a78bfa' }}></i> Remaining
                      </span>
                      <span className="fm-telemetry-val" style={{ color: '#e2e8f0', fontSize: '12.5px' }}>
                        {totalBytes > 0 ? formatBytes(Math.max(0, totalBytes - loadedBytes)) : 'Streaming'}
                      </span>
                    </div>
                  </div>

                  <div className="fm-upload-live-footer">
                    <span style={{ color: '#60a5fa', fontWeight: 600 }}>{statusMessage}</span>
                    <button
                      type="button"
                      className="admin-btn text sm danger"
                      onClick={() => {
                        if (singleAbortRef.current) singleAbortRef.current.abort();
                        setSingleStatus('idle');
                      }}
                      style={{ padding: '2px 8px', fontSize: '11px' }}
                    >
                      Cancel Transfer
                    </button>
                  </div>
                </div>
              )}

              {/* Single Form Inputs */}
              {singleStatus !== 'uploading' && singleStatus !== 'success' && (
                <form onSubmit={handleSingleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div className="admin-form-group">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <label className="admin-label" style={{ margin: 0 }}>
                        Remote File URL <span style={{ color: 'var(--admin-danger)' }}>*</span>
                      </label>
                      <button
                        type="button"
                        className="admin-btn text sm"
                        style={{ padding: '2px 8px', fontSize: '11.5px', color: 'var(--admin-blue)' }}
                        onClick={handlePasteClipboardSingle}
                      >
                        <i className="fa-regular fa-paste"></i> Paste Link
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
                        placeholder="https://domain.com/movie.mp4 or direct download URL"
                        autoFocus
                        required
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

                    {probeLoading && (
                      <div style={{ fontSize: '11.5px', color: 'var(--admin-text-muted)', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px' }}>
                        <i className="fa-solid fa-circle-notch fa-spin" style={{ color: 'var(--admin-blue)' }}></i>
                        <span>Inspecting remote link & format headers...</span>
                      </div>
                    )}
                    {probedData && !probeLoading && (
                      <div style={{ fontSize: '11.5px', color: '#10b981', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px' }}>
                        <i className="fa-solid fa-circle-check"></i>
                        <span>Detected: <strong>{probedData.format || 'Media'}</strong> {probedData.sizeFormatted ? `(${probedData.sizeFormatted})` : ''}</span>
                      </div>
                    )}
                  </div>

                  <div className="admin-form-group">
                    <label className="admin-label">Save As (Target Filename & Format)</label>
                    <input
                      type="text"
                      className="admin-input"
                      value={customFilename}
                      onChange={(e) => setCustomFilename(e.target.value)}
                      placeholder={extractedFilename || 'e.g. movie.mp4'}
                    />
                  </div>

                  {/* Format chips */}
                  <div className="admin-form-group">
                    <label className="admin-label" style={{ fontSize: '12px' }}>Format Override</label>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {['auto', '.mp4', '.mkv', '.webm', '.avi', '.mov'].map((fmt) => (
                        <button
                          key={fmt}
                          type="button"
                          className={`fm-format-chip ${selectedFormat === fmt ? 'active' : ''}`}
                          onClick={() => setSelectedFormat(fmt)}
                        >
                          {fmt.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Duplicate Policy */}
                  <div className="admin-form-group">
                    <label className="admin-label">If File Already Exists in Folder</label>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <label className={`fm-dup-option ${duplicatePolicy === 'replace' ? 'active' : ''}`}>
                        <input
                          type="radio"
                          name="singleDup"
                          value="replace"
                          checked={duplicatePolicy === 'replace'}
                          onChange={() => setDuplicatePolicy('replace')}
                        />
                        <span>Replace Existing</span>
                      </label>
                      <label className={`fm-dup-option ${duplicatePolicy === 'reject' ? 'active' : ''}`}>
                        <input
                          type="radio"
                          name="singleDup"
                          value="reject"
                          checked={duplicatePolicy === 'reject'}
                          onChange={() => setDuplicatePolicy('reject')}
                        />
                        <span>Skip / Reject</span>
                      </label>
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '8px' }}>
                    <button
                      type="button"
                      className="admin-btn text"
                      onClick={onClose}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="admin-btn secondary"
                      onClick={handleSingleUploadBackground}
                      disabled={!fileUrl.trim()}
                      title="Run upload in background and return to File Manager immediately"
                      style={{ borderColor: 'rgba(59, 130, 246, 0.45)', color: '#93c5fd' }}
                    >
                      <i className="fa-solid fa-cloud-arrow-up"></i>
                      <span>Upload in Background</span>
                    </button>
                    <button
                      type="submit"
                      className="admin-btn primary"
                      disabled={!fileUrl.trim()}
                    >
                      <i className="fa-solid fa-bolt"></i>
                      <span>Upload (Keep Modal Open)</span>
                    </button>
                  </div>
                </form>
              )}

              {/* Single Success Display */}
              {singleStatus === 'success' && (
                <div style={{
                  background: 'rgba(16, 185, 129, 0.15)',
                  border: '1px solid #10b981',
                  borderRadius: '10px',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#34d399', fontWeight: 700, fontSize: '15px' }}>
                    <i className="fa-solid fa-circle-check fa-lg"></i>
                    <span>Upload Completed Successfully!</span>
                  </div>
                  <div style={{ fontSize: '13px', color: '#e2e8f0' }}>
                    Saved as: <code>{uploadedResult?.key || `${currentPrefix}${effectiveFilename}`}</code>
                  </div>
                  {uploadedResult?.sizeFormatted && (
                    <div style={{ fontSize: '12.5px', color: '#94a3b8' }}>
                      Size: <strong style={{ color: '#38bdf8' }}>{uploadedResult.sizeFormatted}</strong>
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '6px' }}>
                    <button type="button" className="admin-btn secondary" onClick={onClose}>
                      Done
                    </button>
                    {onViewFile && uploadedResult && (
                      <button
                        type="button"
                        className="admin-btn primary"
                        onClick={() => onViewFile(uploadedResult)}
                      >
                        <i className="fa-solid fa-play"></i> View File
                      </button>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          {/* ============================================================ */}
          {/* 2. BATCH MULTI-URL MODE (Multiple files at the same time)      */}
          {/* ============================================================ */}
          {modalMode === 'batch' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="admin-form-group" style={{ margin: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label className="admin-label" style={{ margin: 0 }}>
                    Paste Multiple URLs (One URL per line) <span style={{ color: 'var(--admin-danger)' }}>*</span>
                  </label>
                  <button
                    type="button"
                    className="admin-btn text sm"
                    style={{ padding: '2px 8px', fontSize: '11.5px', color: 'var(--admin-blue)' }}
                    onClick={handlePasteClipboardBatch}
                  >
                    <i className="fa-regular fa-paste"></i> Paste Multiple from Clipboard
                  </button>
                </div>
                <textarea
                  className="admin-input"
                  rows={4}
                  value={batchRawText}
                  onChange={handleBatchTextChange}
                  placeholder="https://example.com/movie1.mp4&#10;https://example.com/movie2.mkv&#10;https://example.com/movie3.mp4"
                  style={{ fontFamily: 'monospace', fontSize: '12.5px', lineHeight: '1.5' }}
                />
                <div style={{ fontSize: '11.5px', color: 'var(--admin-text-muted)', marginTop: '4px' }}>
                  Paste 1 to 50+ video URLs. Each will upload simultaneously in the background!
                </div>
              </div>

              {/* Batch Queue Preview List */}
              {batchItems.length > 0 && (
                <div className="fm-batch-preview-box">
                  <div className="fm-batch-preview-header">
                    <span style={{ fontWeight: 700, color: '#fff', fontSize: '13px' }}>
                      <i className="fa-solid fa-list-check" style={{ color: 'var(--admin-blue)', marginRight: '6px' }}></i>
                      {batchItems.length} File{batchItems.length !== 1 ? 's' : ''} Ready to Queue
                    </span>
                    <button
                      type="button"
                      className="admin-btn text sm"
                      onClick={() => {
                        setBatchRawText('');
                        setBatchItems([]);
                      }}
                      style={{ fontSize: '11px', color: 'var(--admin-danger)' }}
                    >
                      Clear List
                    </button>
                  </div>

                  <div className="fm-batch-items-scroll">
                    {batchItems.map((item, idx) => (
                      <div key={item.id} className="fm-batch-item-card">
                        <div className="fm-batch-item-index">{idx + 1}</div>
                        <div className="fm-batch-item-inputs">
                          <input
                            type="text"
                            className="admin-input sm"
                            value={item.filename}
                            onChange={(e) => handleUpdateBatchItemFilename(item.id, e.target.value)}
                            placeholder="Target Filename"
                            title="Edit filename"
                          />
                          <div className="fm-batch-item-url" title={item.url}>
                            {item.url}
                          </div>
                        </div>
                        <button
                          type="button"
                          className="fm-batch-remove-btn"
                          onClick={() => handleRemoveBatchItem(item.id)}
                          title="Remove from batch"
                        >
                          <i className="fa-solid fa-xmark"></i>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Concurrency & Duplicate Settings */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                gap: '12px',
                background: 'rgba(255, 255, 255, 0.03)',
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid var(--admin-border)'
              }}>
                <div>
                  <label className="admin-label" style={{ fontSize: '12px', marginBottom: '6px' }}>
                    Simultaneous Uploads (Same Time)
                  </label>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {[1, 2, 3, 4].map((num) => (
                      <button
                        key={num}
                        type="button"
                        className={`fm-format-chip ${batchConcurrency === num ? 'active' : ''}`}
                        onClick={() => setBatchConcurrency(num)}
                        style={{ flex: 1, padding: '5px' }}
                      >
                        {num} at once {num === 2 ? '(Best)' : ''}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="admin-label" style={{ fontSize: '12px', marginBottom: '6px' }}>
                    Duplicate Policy
                  </label>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      type="button"
                      className={`fm-format-chip ${batchDuplicatePolicy === 'replace' ? 'active' : ''}`}
                      onClick={() => setBatchDuplicatePolicy('replace')}
                      style={{ flex: 1, padding: '5px' }}
                    >
                      Replace Existing
                    </button>
                    <button
                      type="button"
                      className={`fm-format-chip ${batchDuplicatePolicy === 'reject' ? 'active' : ''}`}
                      onClick={() => setBatchDuplicatePolicy('reject')}
                      style={{ flex: 1, padding: '5px' }}
                    >
                      Skip / Reject
                    </button>
                  </div>
                </div>
              </div>

              {/* Batch Actions */}
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '4px' }}>
                <button
                  type="button"
                  className="admin-btn text"
                  onClick={onClose}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="admin-btn primary"
                  disabled={batchItems.length === 0}
                  onClick={handleStartBatchUpload}
                  style={{
                    background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                    boxShadow: '0 4px 14px rgba(37, 99, 235, 0.4)',
                    padding: '9px 18px'
                  }}
                >
                  <i className="fa-solid fa-cloud-arrow-up"></i>
                  <span>Start Batch Upload in Background ({batchItems.length} Files)</span>
                </button>
              </div>
            </div>
          )}

          {/* Error Message */}
          {errorMessage && (
            <div style={{
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid var(--admin-danger)',
              color: '#fca5a5',
              padding: '10px 14px',
              borderRadius: '8px',
              fontSize: '12.5px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <i className="fa-solid fa-circle-exclamation"></i>
              <span>{errorMessage}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
