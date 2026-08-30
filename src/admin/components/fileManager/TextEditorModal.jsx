import React, { useEffect, useRef, useState } from 'react';
import { fileManagerApi } from '../../services/fileManager/fileManagerApi';
import { showToast } from '../common/ToastContainer';

const EDITABLE_EXTENSIONS = ['.srt', '.vtt', '.txt', '.json', '.csv', '.xml', '.html', '.css', '.js', '.md'];

function isEditable(filename) {
  if (!filename) return false;
  const m = filename.match(/\.[0-9a-z]+$/i);
  return m ? EDITABLE_EXTENSIONS.includes(m[0].toLowerCase()) : false;
}

function getLanguage(filename) {
  const m = filename.match(/\.[0-9a-z]+$/i);
  const ext = m ? m[0].toLowerCase() : '';
  if (ext === '.json') return 'json';
  if (ext === '.html' || ext === '.xml') return 'markup';
  if (ext === '.css') return 'css';
  if (ext === '.js') return 'javascript';
  if (ext === '.srt' || ext === '.vtt') return 'subtitle';
  return 'text';
}

export default function TextEditorModal({ isOpen, fileItem, onClose, onSaved }) {
  const [content, setContent] = useState('');
  const [originalContent, setOriginalContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [wordWrap, setWordWrap] = useState(true);
  const textareaRef = useRef(null);

  useEffect(() => {
    if (isOpen && fileItem) {
      setLoading(true);
      setContent('');
      setOriginalContent('');
      fileManagerApi.fetchTextContent(fileItem.key)
        .then((text) => {
          setContent(text);
          setOriginalContent(text);
        })
        .catch((err) => {
          showToast(`Failed to load file: ${err.message}`, 'error');
          onClose();
        })
        .finally(() => setLoading(false));
    }
  }, [isOpen, fileItem]);

  if (!isOpen || !fileItem) return null;

  const isDirty = content !== originalContent;
  const lineCount = content.split('\n').length;
  const charCount = content.length;
  const language = getLanguage(fileItem.filename);

  const handleSave = async () => {
    setSaving(true);
    try {
      await fileManagerApi.putTextContent(fileItem.key, content);
      setOriginalContent(content);
      showToast(`✅ Saved: ${fileItem.filename}`, 'success');
      if (onSaved) onSaved();
    } catch (err) {
      showToast(`Save failed: ${err.message}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e) => {
    // Ctrl+S / Cmd+S to save
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      handleSave();
    }
    // Tab key → insert 2 spaces
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = e.target.selectionStart;
      const end = e.target.selectionEnd;
      const newContent = content.substring(0, start) + '  ' + content.substring(end);
      setContent(newContent);
      requestAnimationFrame(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = start + 2;
          textareaRef.current.selectionEnd = start + 2;
        }
      });
    }
  };

  const handleDiscard = () => {
    setContent(originalContent);
    showToast('Changes discarded', 'info');
  };

  return (
    <div className="admin-modal-overlay" onClick={!isDirty ? onClose : undefined}>
      <div className="admin-modal-box xl fm-editor-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="admin-modal-header">
          <div className="admin-modal-title">
            <i className="fa-solid fa-code" style={{ color: 'var(--admin-blue)' }}></i>
            <span style={{ maxWidth: '380px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {fileItem.filename}
            </span>
            {isDirty && (
              <span className="fm-editor-dirty-badge">
                <i className="fa-solid fa-circle" style={{ fontSize: '7px' }}></i>
                Unsaved
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              className={`admin-btn text sm ${wordWrap ? 'active' : ''}`}
              onClick={() => setWordWrap(!wordWrap)}
              title="Toggle Word Wrap"
            >
              <i className="fa-solid fa-align-left"></i>
              <span>Wrap</span>
            </button>
            <button type="button" className="admin-modal-close" onClick={onClose} title="Close (unsaved changes will be lost)">
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>
        </div>

        {/* Editor Path Bar */}
        <div className="fm-editor-pathbar">
          <div className="fm-editor-pathbar-left">
            <i className="fa-solid fa-key" style={{ color: 'var(--admin-text-dim)' }}></i>
            <code>{fileItem.key}</code>
          </div>
          <div className="fm-editor-pathbar-right">
            <span className="fm-editor-lang-badge">{language.toUpperCase()}</span>
            <span style={{ color: 'var(--admin-text-dim)', fontSize: '12px' }}>
              {lineCount.toLocaleString()} lines · {charCount.toLocaleString()} chars
            </span>
          </div>
        </div>

        {/* Editor Body */}
        <div className="fm-editor-body">
          {loading ? (
            <div className="fm-editor-loading">
              <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '28px', color: 'var(--admin-blue)' }}></i>
              <p>Loading file from R2...</p>
            </div>
          ) : (
            <textarea
              ref={textareaRef}
              className={`fm-editor-textarea ${wordWrap ? 'wrap' : 'nowrap'}`}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onKeyDown={handleKeyDown}
              spellCheck={false}
              autoCapitalize="off"
              autoCorrect="off"
              autoComplete="off"
              placeholder="File is empty. Start typing..."
            />
          )}
        </div>

        {/* Footer */}
        <div className="admin-modal-footer" style={{ justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {isDirty && (
              <button type="button" className="admin-btn text sm" onClick={handleDiscard} disabled={saving}>
                <i className="fa-solid fa-rotate-left"></i> Discard Changes
              </button>
            )}
            <span style={{ fontSize: '12px', color: 'var(--admin-text-dim)' }}>
              Ctrl+S to save · Tab inserts 2 spaces
            </span>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="button" className="admin-btn text sm" onClick={onClose} disabled={saving}>
              Close
            </button>
            <button
              type="button"
              className="admin-btn primary sm"
              onClick={handleSave}
              disabled={saving || loading || !isDirty}
            >
              {saving
                ? <><i className="fa-solid fa-spinner fa-spin"></i> Saving...</>
                : <><i className="fa-solid fa-floppy-disk"></i> Save to R2</>
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export { isEditable };
