import React from 'react';

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  icon: Icon,
  loading = false,
  disabled = false,
  className = '',
  ...props
}) {
  const baseStyles = 'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-red-600/50 disabled:opacity-50 disabled:cursor-not-allowed';

  const variants = {
    primary: 'bg-[#e50914] hover:bg-[#f40612] text-white shadow-lg shadow-red-900/30 active:scale-[0.98]',
    secondary: 'bg-zinc-800/90 hover:bg-zinc-700 text-zinc-200 border border-zinc-700/60 active:scale-[0.98]',
    outline: 'border border-zinc-700 text-zinc-300 hover:border-red-600 hover:text-white hover:bg-red-950/20 active:scale-[0.98]',
    danger: 'bg-red-950 hover:bg-red-900 text-red-200 border border-red-800/60 shadow-lg active:scale-[0.98]',
    ghost: 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
  };

  const sizes = {
    sm: 'text-xs px-3 py-1.5 gap-1.5',
    md: 'text-sm px-4 py-2 gap-2',
    lg: 'text-base px-6 py-3 gap-2.5 font-semibold'
  };

  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <span className="inline-block animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full" />
      ) : Icon ? (
        <Icon className="w-4 h-4 shrink-0" />
      ) : null}
      <span>{children}</span>
    </button>
  );
}
