// Reusable Button: primary / secondary / ghost / danger variants, sm / md / lg sizes.

import { type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
  children: ReactNode;
}

const variantClasses: Record<Variant, string> = {
  primary:
    'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/20 border-transparent',
  secondary:
    'bg-transparent border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800',
  ghost:
    'bg-transparent border-transparent text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800',
  danger:
    'bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-600/20 border-transparent',
};

const sizeClasses: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-xs rounded-xl gap-1.5',
  md: 'px-5 py-2.5 text-sm rounded-2xl gap-2',
  lg: 'px-7 py-3.5 text-sm rounded-2xl gap-2',
};

export default function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  children,
  disabled,
  className = '',
  ...rest
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <button
      {...rest}
      disabled={isDisabled}
      className={[
        'inline-flex items-center justify-center font-black border transition-all',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        variantClasses[variant],
        sizeClasses[size],
        className,
      ].join(' ')}
    >
      {loading ? (
        <Loader2 size={size === 'sm' ? 12 : 14} className="animate-spin shrink-0" />
      ) : icon ? (
        <span className="shrink-0">{icon}</span>
      ) : null}
      {children}
    </button>
  );
}
