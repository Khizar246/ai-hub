// Audit result status pill: Present / Partially Present / Inadequate / Not Present / Unclear.

import { CheckCircle2, XCircle, AlertTriangle, MinusCircle, HelpCircle } from 'lucide-react';

interface StatusPillProps {
  status: string;
  className?: string;
}

const statusConfig: Record<
  string,
  { icon: React.ReactNode; classes: string }
> = {
  Present: {
    icon: <CheckCircle2 size={12} />,
    classes:
      'text-emerald-600 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-900/20 dark:border-emerald-700',
  },
  'Partially Present': {
    icon: <AlertTriangle size={12} />,
    classes:
      'text-amber-600 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-900/20 dark:border-amber-700',
  },
  Inadequate: {
    icon: <MinusCircle size={12} />,
    classes:
      'text-orange-600 bg-orange-50 border-orange-200 dark:text-orange-400 dark:bg-orange-900/20 dark:border-orange-800',
  },
  'Not Present': {
    icon: <XCircle size={12} />,
    classes:
      'text-red-600 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-900/20 dark:border-red-800',
  },
  Error: {
    icon: <XCircle size={12} />,
    classes:
      'text-red-600 bg-red-50 border-red-300 dark:text-red-400 dark:bg-red-900/20 dark:border-red-700',
  },
  Unclear: {
    icon: <HelpCircle size={12} />,
    classes:
      'text-slate-500 bg-slate-100 border-slate-200 dark:text-slate-400 dark:bg-slate-800 dark:border-slate-700',
  },
};

export default function StatusPill({ status, className = '' }: StatusPillProps) {
  const config = statusConfig[status] ?? statusConfig.Unclear;

  return (
    <span
      className={[
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border',
        'text-[10px] font-black uppercase tracking-widest',
        config.classes,
        className,
      ].join(' ')}
    >
      {config.icon}
      {status}
    </span>
  );
}
