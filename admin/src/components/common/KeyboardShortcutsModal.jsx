import React from 'react';
import { Modal } from './Modal';
import { Keyboard } from 'lucide-react';

export function KeyboardShortcutsModal({ isOpen, onClose }) {
  const shortcuts = [
    { key: 'Ctrl + N', action: 'Create New Movie' },
    { key: 'Ctrl + S', action: 'Save Current Form / Movie' },
    { key: 'Ctrl + F', action: 'Focus Instant Search Bar' },
    { key: 'Delete', action: 'Move Selected Movies to Trash' },
    { key: 'Esc', action: 'Close Modal / Cancel Action' },
    { key: '?', action: 'Toggle Hotkey Helper Modal' },
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Keyboard Shortcuts" maxWidth="max-w-lg">
      <div className="space-y-4">
        <div className="flex items-center gap-3 text-red-500 font-semibold text-sm mb-2">
          <Keyboard className="w-5 h-5" />
          <span>Speed up your workflow with hotkeys</span>
        </div>
        <div className="divide-y divide-zinc-800 border border-zinc-800 rounded-xl overflow-hidden bg-zinc-950/40">
          {shortcuts.map((item, index) => (
            <div key={index} className="flex items-center justify-between p-3 text-sm">
              <span className="text-zinc-300 font-medium">{item.action}</span>
              <kbd className="px-2.5 py-1 bg-zinc-800 text-red-400 font-mono text-xs font-bold rounded-lg border border-zinc-700 shadow-sm">
                {item.key}
              </kbd>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}
