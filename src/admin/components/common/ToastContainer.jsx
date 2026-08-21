import React, { useState, useEffect } from 'react';

let toastListener = null;

export const showToast = (message, type = 'success') => {
  if (toastListener) {
    toastListener({ id: Date.now(), message, type });
  }
};

export default function ToastContainer() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    toastListener = (newToast) => {
      setToasts((prev) => [...prev, newToast]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== newToast.id));
      }, 4000);
    };

    return () => {
      toastListener = null;
    };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: '24px',
      right: '24px',
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
      pointerEvents: 'none'
    }}>
      {toasts.map((toast) => {
        const isError = toast.type === 'error';
        const isWarning = toast.type === 'warning';
        const bgColor = isError ? 'rgba(239, 68, 68, 0.92)' : isWarning ? 'rgba(245, 158, 11, 0.92)' : 'rgba(16, 185, 129, 0.92)';
        const icon = isError ? 'fa-circle-xmark' : isWarning ? 'fa-triangle-exclamation' : 'fa-circle-check';

        return (
          <div
            key={toast.id}
            style={{
              background: bgColor,
              color: '#fff',
              padding: '12px 18px',
              borderRadius: '12px',
              backdropFilter: 'blur(12px)',
              boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
              fontSize: '13.5px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              pointerEvents: 'auto',
              animation: 'adminFadeIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
          >
            <i className={`fa-solid ${icon}`} style={{ fontSize: '16px' }}></i>
            <span>{toast.message}</span>
          </div>
        );
      })}
    </div>
  );
}
