// Reusable Button: primary (amber) / secondary / ghost / danger variants.

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
    'bg-amber-400 text-[#0a0a0a] hover:bg-amber-300',
  secondary:
    'border border-[#262626] bg-transparent text-[#fafafa] hover:bg-[#1a1a1a] hover:border-[#404040]',
  ghost:
    'text-[#525252] hover:text-[#fafafa] hover:bg-[#111111]',
  danger:
    'border border-[#7f1d1d] text-[#ef4444] hover:bg-[#ef4444]/10',
};

const sizeClasses: Record<Size, string> = {
  sm: 'h-7 px-3 text-[12px]',
  md: 'h-9 px-4 text-[13px]',
  lg: 'h-10 px-5 text-[14px]',
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
        'inline-flex items-center justify-center gap-2 font-medium',
        'transition-all duration-150 rounded-[6px]',
        'disabled:opacity-40 disabled:cursor-not-allowed',
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
