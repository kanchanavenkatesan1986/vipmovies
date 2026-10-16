import React, { useEffect } from 'react';

const SHORTCUTS = [
  { group: 'Navigation', items: [
    { keys: ['Alt', '←'], desc: 'Go up one folder level' },
    { keys: ['Enter'], desc: 'Open selected folder / file' },
    { keys: ['Backspace'], desc: 'Go up one folder level' },
  ]},
  { group: 'Selection', items: [
    { keys: ['Ctrl', 'A'], desc: 'Select all items in current view' },
    { keys: ['Escape'], desc: 'Deselect all / close modals' },
    { keys: ['Click'], desc: 'Open file or folder' },
    { keys: ['Ctrl', 'Click'], desc: 'Toggle item selection' },
  ]},
  { group: 'File Actions', items: [
    { keys: ['Delete'], desc: 'Delete selected item(s)' },
    { keys: ['F2'], desc: 'Rename selected item' },
    { keys: ['Ctrl', 'C'], desc: 'Copy selected item key to clipboard' },
    { keys: ['Ctrl', 'U'], desc: 'Open Upload from URL dialog' },
    { keys: ['Ctrl', 'F'], desc: 'Focus search bar' },
  ]},
  { group: 'Help', items: [
    { keys: ['?'], desc: 'Show this keyboard shortcuts panel' },
    { keys: ['R'], desc: 'Refresh current folder (when not in input)' },
  ]},
];

export default function KeyboardShortcutsModal({ isOpen, onClose }) {
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="admin-modal-overlay" onClick={onClose}>
      <div
        className="admin-modal-box md"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '560px' }}
      >
        <div className="admin-modal-header">
          <div className="admin-modal-title">
            <i className="fa-solid fa-keyboard" style={{ color: 'var(--admin-blue)' }}></i>
            Keyboard Shortcuts
          </div>
          <button type="button" className="admin-modal-close" onClick={onClose}>
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div className="admin-modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
          {SHORTCUTS.map((group) => (
            <div key={group.group} style={{ marginBottom: '20px' }}>
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: 'var(--admin-text-muted)',
                  marginBottom: '10px',
                  padding: '0 2px'
                }}
              >
                {group.group}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {group.items.map((item, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      background: 'rgba(255,255,255,0.03)',
                      borderRadius: '8px',
                      border: '1px solid rgba(255,255,255,0.06)'
                    }}
                  >
                    <span style={{ fontSize: '13px', color: 'var(--admin-text-muted)' }}>{item.desc}</span>
                    <div style={{ display: 'flex', gap: '4px', flexShrink: 0, marginLeft: '12px' }}>
                      {item.keys.map((key, ki) => (
                        <React.Fragment key={ki}>
                          <kbd
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              padding: '2px 8px',
                              background: 'rgba(255,255,255,0.08)',
                              border: '1px solid rgba(255,255,255,0.18)',
                              borderBottom: '2px solid rgba(255,255,255,0.26)',
                              borderRadius: '5px',
                              fontSize: '11px',
                              fontFamily: 'monospace',
                              color: '#fff',
                              fontWeight: 600,
                              minWidth: '26px'
                            }}
                          >
                            {key}
                          </kbd>
                          {ki < item.keys.length - 1 && (
                            <span style={{ fontSize: '11px', color: 'var(--admin-text-muted)', alignSelf: 'center' }}>+</span>
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="admin-modal-footer">
          <button type="button" className="admin-btn secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
