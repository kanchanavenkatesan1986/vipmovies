import React from 'react';

export function Badge({ children, variant = 'default', size = 'md', className = '' }) {
  const variantStyles = {
    default: 'bg-zinc-800 text-zinc-300 border-zinc-700',
    active: 'bg-emerald-950/70 text-emerald-400 border-emerald-800/50',
    comingSoon: 'bg-amber-950/70 text-amber-400 border-amber-800/50',
    hidden: 'bg-zinc-900 text-zinc-500 border-zinc-800',
    red: 'bg-red-950/80 text-red-400 border-red-800/60',
    blue: 'bg-sky-950/70 text-sky-400 border-sky-800/50',
    purple: 'bg-purple-950/70 text-purple-400 border-purple-800/50'
  };

  const sizeStyles = {
    sm: 'text-[10px] px-2 py-0.5 font-semibold',
    md: 'text-xs px-2.5 py-1 font-semibold',
    lg: 'text-sm px-3 py-1.5 font-bold'
  };

  const selectedVariant = variantStyles[variant] || variantStyles.default;

  return (
    <span className={`inline-flex items-center gap-1 rounded-full border ${selectedVariant} ${sizeStyles[size]} ${className}`}>
      {children}
    </span>
  );
}
