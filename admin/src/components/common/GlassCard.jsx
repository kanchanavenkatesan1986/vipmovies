import React from 'react';

export function GlassCard({ children, className = '', hover = true, glow = false, ...props }) {
  return (
    <div
      className={`glass-panel ${hover ? 'glass-panel-hover' : ''} ${glow ? 'glow-red-sm' : ''} rounded-xl p-5 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
