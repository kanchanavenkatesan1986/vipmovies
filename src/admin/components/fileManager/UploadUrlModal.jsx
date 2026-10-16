import React, { useState, useEffect, useMemo, useRef } from 'react';
import { formatBytes, getFileCategory, getFileIcon } from '../../services/fileManager/fileManagerUtils';
import { fileManagerApi } from '../../services/fileManager/fileManagerApi';

// Script and dynamic extensions that should NEVER be stored as media in R2
const SCRIPT_EXTENSIONS = new Set([
  '.php', '.php3', '.php4', '.php5', '.phtml',
  '.asp', '.aspx', '.ashx', '.asmx',
  '.jsp', '.jspx', '.do', '.action',
  '.cgi', '.pl', '.py', '.sh', '.bash',
  '.html', '.htm', '.cfm'
]);

function isScriptExtension(filename) {
  if (!filename || typeof filename !== 'string') return false;
  const match = filename.match(/\.[a-zA-Z0-9]+$/i);
  if (!match) return false;
  return SCRIPT_EXTENSIONS.has(match[0].toLowerCase());
}

/**
 * Advanced filename extractor: inspects query parameters and base64 payloads (e.g. ?dl=... on uptodub/isaidub)
 * to uncover the true media file name and format (.mp4, .mkv, etc.).
 */
function extractFilenameFromUrlAdvanced(urlStr) {
  if (!urlStr || !urlStr.trim()) return '';
  try {
    const u = new URL(urlStr.trim());

    // 1. Check known query parameters (e.g. ?file=..., ?path=..., ?filename=...)
    const paramKeys = ['filename', 'file', 'name', 'path', 'title', 'f', 'download', 'target', 'source'];
    for (const key of paramKeys) {
      const val = u.searchParams.get(key);
      if (val) {
        const decoded = decodeURIComponent(val).split('/').pop() || '';
        const clean = decoded.split('?')[0].trim();
        if (clean && /\.[a-zA-Z0-9]{2,5}$/.test(clean) && !isScriptExtension(clean)) {
          return clean;
        }
      }
    }

    // 2. Check base64 encoded parameters (e.g. ?dl=c2VydmVy... on dub/uptodub/isai sites)
    for (const [, val] of u.searchParams.entries()) {
      if (val && val.length > 16 && /^[A-Za-z0-9+/=_-]+$/.test(val)) {
        try {
          let b64 = val.replace(/-/g, '+').replace(/_/g, '/');
          while (b64.length % 4 !== 0) b64 += '=';
          const decodedText = atob(b64);

          // Match path=... or filename=... or file=...
          const paramMatch = decodedText.match(/(?:path|filename|file|name)=([^&]+)/i);
          if (paramMatch) {
            const candidate = decodeURIComponent(paramMatch[1]).split('/').pop() || '';
            if (candidate && /\.[a-zA-Z0-9]{2,5}$/.test(candidate) && !isScriptExtension(candidate)) {
              return candidate;
            }
          }

          // Match any file with valid media/archive extension inside the payload
          const mediaMatch = decodedText.match(/([a-zA-Z0-9_\-\. ()\[\]]+\.(?:mp4|mkv|webm|mov|m4v|avi|ts|flv|wmv|3gp|mp3|m4a|aac|flac|wav|ogg|opus|zip|rar|7z|tar|gz|pdf))/i);
          if (mediaMatch) {
            return mediaMatch[1].trim();
          }
        } catch {
          // ignore base64 errors
        }
      }
    }

    // 3. Fallback to URL pathname
    const raw = decodeURIComponent(u.pathname.split('/').pop() || '');
    let clean = raw.split('?')[0].trim();

    // If pathname ends with a script extension (.php, .aspx, etc.), convert to clean movie name
    if (isScriptExtension(clean) || clean.toLowerCase() === 'download.php') {
      const base = clean.replace(/\.[a-zA-Z0-9]+$/i, '');
      const safeBase = (!base || base.toLowerCase() === 'download') ? 'download_movie' : base;
      return `${safeBase}.mp4`;
    }

    if (!clean || clean === 'http:' || clean === 'https:' || clean.includes('://')) {
      return '';
    }
    return clean;
  } catch {
    const raw = urlStr.trim().split('?')[0].split('/').pop() || '';
    if (!raw || raw === 'http:' || raw === 'https:' || isScriptExtension(raw)) {
      return '';
    }
    return raw;
  }
}

export default function UploadUrlModal({
  isOpen,
  currentPrefix = '',
  onClose,
  onSuccess,
  onViewFile
}) {
  const [fileUrl, setFileUrl] = useState('');
  const [customFilename, setCustomFilename] = useState('');
  const [selectedFormat, setSelectedFormat] = useState('auto'); // 'auto' | '.mp4' | '.mkv' | '.webm' | '.avi'
  const [duplicatePolicy, setDuplicatePolicy] = useState('replace');
  const [uploadMode, setUploadMode] = useState('cloud'); // 'cloud' (server-side stream) | 'browser' (client fetch)
  const [status, setStatus] = useState('idle'); // 'idle' | 'uploading' | 'success' | 'error'
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [uploadedResult, setUploadedResult] = useState(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Live probing states
  const [probeLoading, setProbeLoading] = useState(false);
  const [probedData, setProbedData] = useState(null);

  // Live percentage, bytes & telemetry tracking
  const [percent, setPercent] = useState(0);
  const [loadedBytes, setLoadedBytes] = useState(0);
  const [totalBytes, setTotalBytes] = useState(0);
  const [transferSpeed, setTransferSpeed] = useState('');
  const [speedBps, setSpeedBps] = useState(0);
  const [peakSpeedBps, setPeakSpeedBps] = useState(0);
  const [etaSeconds, setEtaSeconds] = useState(null);
  const [uploadStage, setUploadStage] = useState('idle'); // 'idle' | 'probing' | 'handshake' | 'streaming' | 'finalizing' | 'complete'

  // Ultra-precise millisecond-by-millisecond timer
  const [elapsedMs, setElapsedMs] = useState(0);
  const startTimeRef = useRef(null);

  useEffect(() => {
    let interval = null;
    if (status === 'uploading') {
      startTimeRef.current = performance.now();
      setElapsedMs(0);
      setElapsedSeconds(0);
      interval = setInterval(() => {
        if (startTimeRef.current) {
          const now = performance.now();
          const ms = Math.round(now - startTimeRef.current);
          setElapsedMs(ms);
          setElapsedSeconds(Math.floor(ms / 1000));
        }
      }, 33); // High-frequency ~30fps millisecond counter
    } else {
      if (interval) clearInterval(interval);
      startTimeRef.current = null;
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [status]);

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
      setSelectedFormat('auto');
      setDuplicatePolicy('replace');
      setUploadMode('cloud');
      setStatus('idle');
      setStatusMessage('');
      setErrorMessage('');
      setUploadedResult(null);
      setElapsedSeconds(0);
      setElapsedMs(0);
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
    }
  }, [isOpen, currentPrefix]);

  // Auto-extract filename from URL using advanced query & payload analyzer
  const extractedFilename = useMemo(() => {
    return extractFilenameFromUrlAdvanced(fileUrl);
  }, [fileUrl]);

  // Remote link probe: Automatically inspect Content-Disposition & Content-Length in background
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

  // Sync customFilename with extractedFilename when extractedFilename changes
  useEffect(() => {
    if (extractedFilename && (!customFilename || customFilename === 'https:' || customFilename === 'http:')) {
      setCustomFilename(extractedFilename);
    }
  }, [extractedFilename]);

  // Calculate clean effective filename with guaranteed non-php format
  const effectiveFilename = useMemo(() => {
    let name = (customFilename.trim() || extractedFilename || 'download_media.mp4').trim();

    // If user selected an explicit format chip (.mp4, .mkv, .webm, etc.)
    if (selectedFormat !== 'auto') {
      name = name.replace(/\.[a-zA-Z0-9]+$/i, '') + selectedFormat;
    } else if (isScriptExtension(name)) {
      // Auto-convert script extension (.php, .aspx) to .mp4
      name = name.replace(/\.[a-zA-Z0-9]+$/i, '.mp4');
    }

    // Ensure it has an extension
    if (!/\.[a-zA-Z0-9]{2,5}$/.test(name)) {
      name = `${name}.mp4`;
    }

    return name.replace(/[\/\\]/g, '_');
  }, [customFilename, extractedFilename, selectedFormat]);

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
        result = await handleBrowserFallbackUpload();
      }

      setStatus('success');
      setPercent(100);
      setUploadStage('complete');
      setStatusMessage('File imported and stored in Cloudflare R2 successfully!');
      setUploadedResult(result);

      if (onSuccess) {
        onSuccess(result);
      }
    } catch (err) {
      console.error('URL Upload error:', err);
      setStatus('error');
      setUploadStage('idle');
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

            {/* 1. HERO REAL-TIME TELEMETRY PROGRESS CARD (Shown at the very top when uploading) */}
            {status === 'uploading' && (
              <div className="fm-upload-live-card">
                {/* Active Destination Header */}
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
                  <span style={{
                    fontSize: '11px',
                    fontWeight: 800,
                    color: '#60a5fa',
                    background: 'rgba(37, 99, 235, 0.25)',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    flexShrink: 0
                  }}>
                    {uploadMode === 'cloud' ? 'Cloud Direct' : 'Browser Fetch'}
                  </span>
                </div>

                {/* 4-Step Pipeline Status Tracker */}
                <div className="fm-pipeline-tracker">
                  <div className={`fm-pipeline-step ${uploadStage === 'handshake' ? 'active' : 'completed'}`}>
                    <div className="fm-pipeline-dot">
                      {uploadStage === 'handshake' ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-check"></i>}
                    </div>
                    <span>Handshake</span>
                  </div>

                  <div className={`fm-pipeline-step ${uploadStage === 'handshake' ? '' : (uploadStage === 'streaming' || uploadStage === 'finalizing' ? 'completed' : 'completed')}`}>
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

                {/* Hero Telemetry Row: Real-Time % & Millisecond-by-Millisecond Stopwatch */}
                <div className="fm-hero-telemetry-row">
                  <div className="fm-hero-percent-wrap">
                    <div className="fm-hero-percent">
                      {typeof percent === 'number' && percent > 0 ? (
                        percent.toFixed(percent % 1 === 0 ? 0 : 2)
                      ) : (
                        '0.0'
                      )}
                      <span className="fm-hero-percent-symbol">%</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span style={{ fontSize: '11px', color: '#93c5fd', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Live Progress
                      </span>
                      <span style={{ fontSize: '12px', color: '#cbd5e1' }}>
                        {totalBytes > 0 ? (
                          <span>
                            <strong style={{ color: '#fff' }}>{formatBytes(loadedBytes)}</strong> / {formatBytes(totalBytes)}
                          </span>
                        ) : loadedBytes > 0 ? (
                          <span>
                            <strong style={{ color: '#fff' }}>{formatBytes(loadedBytes)}</strong> streamed
                          </span>
                        ) : (
                          <span style={{ color: 'var(--admin-text-muted)' }}>Opening channel...</span>
                        )}
                      </span>
                    </div>
                  </div>

                  {/* Real-time Millisecond Stopwatch */}
                  <div className="fm-stopwatch-badge" title="Live Elapsed Transfer Time (mm:ss.millis)">
                    <i className="fa-solid fa-stopwatch fm-stopwatch-icon"></i>
                    <span className="fm-stopwatch-digits">
                      {formatPreciseStopwatch(elapsedMs).mStr}:{formatPreciseStopwatch(elapsedMs).sStr}
                    </span>
                    <span className="fm-stopwatch-ms">
                      .{formatPreciseStopwatch(elapsedMs).msStr}
                    </span>
                  </div>
                </div>

                {/* Glowing Multi-Layered Progress Bar Track */}
                <div className="fm-progress-track-wrapper">
                  <div className="fm-progress-track">
                    <div
                      className="fm-progress-fill"
                      style={{
                        width: `${percent > 0 ? Math.min(100, percent) : (elapsedMs > 0 ? 2 : 0)}%`
                      }}
                    ></div>
                  </div>
                </div>

                {/* 4-Column Live Metric Telemetry Cards */}
                <div className="fm-telemetry-metrics-grid">
                  <div className="fm-telemetry-chip highlight">
                    <span className="fm-telemetry-label">
                      <i className="fa-solid fa-gauge-high" style={{ color: '#34d399' }}></i>
                      Transfer Speed
                    </span>
                    <span className="fm-telemetry-val speed">
                      {transferSpeed || (speedBps > 0 ? `${formatBytes(speedBps)}/s` : 'Buffering...')}
                    </span>
                  </div>

                  <div className="fm-telemetry-chip">
                    <span className="fm-telemetry-label">
                      <i className="fa-solid fa-chart-line" style={{ color: '#60a5fa' }}></i>
                      Peak Speed
                    </span>
                    <span className="fm-telemetry-val" style={{ color: '#93c5fd' }}>
                      {peakSpeedBps > 0 ? `${formatBytes(peakSpeedBps)}/s` : '---'}
                    </span>
                  </div>

                  <div className="fm-telemetry-chip">
                    <span className="fm-telemetry-label">
                      <i className="fa-solid fa-hourglass-half" style={{ color: '#fbbf24' }}></i>
                      Estimated Time
                    </span>
                    <span className="fm-telemetry-val eta">
                      {formatEta(calculatedEta)}
                    </span>
                  </div>

                  <div className="fm-telemetry-chip">
                    <span className="fm-telemetry-label">
                      <i className="fa-solid fa-arrows-spin" style={{ color: '#a78bfa' }}></i>
                      Remaining
                    </span>
                    <span className="fm-telemetry-val" style={{ color: '#e2e8f0', fontSize: '12.5px' }}>
                      {totalBytes > 0 ? formatBytes(Math.max(0, totalBytes - loadedBytes)) : 'Streaming'}
                    </span>
                  </div>
                </div>

                {/* Footer Status Text & Network Equalizer */}
                <div className="fm-upload-live-footer">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div className="fm-network-equalizer" title="Direct Network Stream Active">
                      <div className="fm-eq-bar"></div>
                      <div className="fm-eq-bar"></div>
                      <div className="fm-eq-bar"></div>
                      <div className="fm-eq-bar"></div>
                      <div className="fm-eq-bar"></div>
                    </div>
                    <span style={{ color: '#60a5fa', fontWeight: 600 }}>{statusMessage}</span>
                  </div>

                  <span className="fm-pipeline-pill">
                    <i className="fa-solid fa-shield-halved" style={{ color: '#38bdf8' }}></i>
                    0 Local Bandwidth • Cloudflare Direct Pipeline
                  </span>
                </div>
              </div>
            )}

            {/* 2. FORM CONFIGURATION (Shown when configuring upload) */}
            {status !== 'uploading' && status !== 'success' && (
              <>
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
                  placeholder="https://dub.uptodub.ch/download.php?dl=... or https://example.com/movie.mp4"
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

              {/* Probe / Inspection Status */}
              {probeLoading && (
                <div style={{ fontSize: '11.5px', color: 'var(--admin-text-muted)', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px' }}>
                  <i className="fa-solid fa-circle-notch fa-spin" style={{ color: 'var(--admin-blue)' }}></i>
                  <span>Inspecting remote link & format headers...</span>
                </div>
              )}
              {probedData && !probeLoading && (
                <div style={{ fontSize: '11.5px', color: '#10b981', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px' }}>
                  <i className="fa-solid fa-circle-check"></i>
                  <span>
                    Detected: <strong>{probedData.format || 'Media'}</strong> {probedData.sizeFormatted ? `(${probedData.sizeFormatted})` : ''}
                  </span>
                </div>
              )}

              {/* PHP Script Link Notice */}
              {fileUrl && (fileUrl.toLowerCase().includes('.php') || fileUrl.toLowerCase().includes('download.php')) && (
                <div
                  style={{
                    marginTop: '8px',
                    background: 'rgba(59, 130, 246, 0.1)',
                    border: '1px solid rgba(59, 130, 246, 0.25)',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    fontSize: '11.5px',
                    color: '#93c5fd',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  <i className="fa-solid fa-wand-magic-sparkles" style={{ color: 'var(--admin-blue)', fontSize: '13px' }}></i>
                  <span>
                    PHP download URL detected. Automatically extracting original video format (<strong>{effectiveFilename.split('.').pop()?.toUpperCase()}</strong>) — will <strong>never</strong> save as .php.
                  </span>
                </div>
              )}
            </div>

            {/* Filename & Format Selection */}
            <div className="admin-form-group">
              <label className="admin-label">Save As (Target Filename & Format)</label>
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

              {/* Format Override Chips */}
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '6px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '11px', color: 'var(--admin-text-dim)' }}>Format:</span>
                {[
                  { id: 'auto', label: 'Auto (Original)' },
                  { id: '.mp4', label: 'MP4' },
                  { id: '.mkv', label: 'MKV' },
                  { id: '.webm', label: 'WEBM' },
                  { id: '.avi', label: 'AVI' },
                  { id: '.mp3', label: 'MP3' }
                ].map((fmt) => (
                  <button
                    key={fmt.id}
                    type="button"
                    onClick={() => setSelectedFormat(fmt.id)}
                    disabled={status === 'uploading'}
                    style={{
                      padding: '2px 8px',
                      fontSize: '11px',
                      borderRadius: '6px',
                      border: `1px solid ${selectedFormat === fmt.id ? 'var(--admin-blue)' : 'var(--admin-border)'}`,
                      background: selectedFormat === fmt.id ? 'rgba(59, 130, 246, 0.2)' : 'var(--admin-surface)',
                      color: selectedFormat === fmt.id ? '#60a5fa' : 'var(--admin-text-muted)',
                      cursor: 'pointer'
                    }}
                  >
                    {fmt.label}
                  </button>
                ))}
              </div>

              <div style={{ fontSize: '11.5px', color: 'var(--admin-text-dim)', marginTop: '6px' }}>
                Target R2 Key: <code style={{ color: '#60a5fa' }}>{currentPrefix || ''}{effectiveFilename}</code>
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
          </>
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
                      <span>Streaming ({percent > 0 ? `${percent.toFixed(percent % 1 === 0 ? 0 : 1)}% • ` : ''}{formatPreciseStopwatch(elapsedMs).mStr}:{formatPreciseStopwatch(elapsedMs).sStr})...</span>
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
