// Badge component: audit status variants + criticality variants + generic tag badges.

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
    'bg-slate-400/10 border-slate-400/30 text-slate-400',
  active:
    'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-700 dark:text-emerald-400',
  'coming-soon':
    'bg-slate-100 border-slate-200 text-slate-500 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400',
  default:
    'bg-slate-100 border-slate-200 text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400',
};

export default function Badge({ variant = 'default', children, className = '' }: BadgeProps) {
  return (
    <span
      className={[
        'inline-flex items-center px-2 py-0.5 rounded-full border',
        'text-[9px] font-black uppercase tracking-widest',
        variantClasses[variant],
        className,
      ].join(' ')}
    >
      {children}
    </span>
  );
}
