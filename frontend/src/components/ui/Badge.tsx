// Badge component: audit semantic status variants + platform status variants.

type BadgeVariant =
  | 'present'
  | 'partially-present'
  | 'not-present'
  | 'inadequate'
  | 'error'
  | 'high'
  | 'medium'
  | 'low'
  | 'active'
  | 'coming-soon'
  | 'default';

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
  // Semantic audit colors — do not change
  present:
    'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-700 dark:text-emerald-400',
  'partially-present':
    'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-900/20 dark:border-amber-700 dark:text-amber-400',
  'not-present':
    'bg-red-50 border-red-200 text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400',
  inadequate:
    'bg-orange-50 border-orange-200 text-orange-700 dark:bg-orange-900/20 dark:border-orange-800 dark:text-orange-400',
  error:
    'bg-red-50 border-red-300 text-red-600 dark:bg-red-900/20 dark:border-red-700 dark:text-red-400',
  high:
    'bg-red-500/10 border-red-500/30 text-red-500',
  medium:
    'bg-yellow-500/10 border-yellow-500/30 text-yellow-500',
  low:
    'bg-[#1a1a1a] border-[#262626] text-[#525252]',
  // Platform status variants
  active:
    'bg-[#1a1a1a] border border-[#262626] text-[#525252] text-[10px] font-medium tracking-wide px-2 py-0.5 rounded-full',
  'coming-soon':
    'bg-[#111111] border border-[#1e1e1e] text-[#525252] text-[10px] px-2 py-0.5 rounded-full',
  default:
    'bg-[#1a1a1a] border-[#262626] text-[#525252]',
};

export default function Badge({ variant = 'default', children, className = '' }: BadgeProps) {
  return (
    <span
      className={[
        'inline-flex items-center border',
        'text-[10px] font-medium tracking-wide px-2 py-0.5 rounded-full',
        variantClasses[variant],
        className,
      ].join(' ')}
    >
      {children}
    </span>
  );
}
