// Animated progress bar with optional label and percentage display.

import { useUIStore } from '../../lib/store';

interface ProgressBarProps {
  /** 0–100 */
  value: number;
  /** Tailwind color key: 'blue' | 'emerald' | 'purple' | 'amber' | 'red' */
  color?: string;
  label?: string;
  showPercentage?: boolean;
  className?: string;
}

const colorMap: Record<string, string> = {
  blue:    'bg-blue-500',
  emerald: 'bg-emerald-500',
  purple:  'bg-purple-500',
  amber:   'bg-amber-500',
  red:     'bg-red-500',
};

export default function ProgressBar({
  value,
  color = 'blue',
  label,
  showPercentage = false,
  className = '',
}: ProgressBarProps) {
  const { darkMode } = useUIStore();
  const clamped = Math.min(100, Math.max(0, value));
  const barColor = colorMap[color] ?? colorMap.blue;

  return (
    <div className={`space-y-1.5 ${className}`}>
      {(label || showPercentage) && (
        <div className="flex items-center justify-between">
          {label && (
            <span
              className={`text-xs font-bold ${
                darkMode ? 'text-slate-400' : 'text-slate-600'
              }`}
            >
              {label}
            </span>
          )}
          {showPercentage && (
            <span
              className={`text-xs font-black tabular-nums ${
                darkMode ? 'text-slate-300' : 'text-slate-700'
              }`}
            >
              {Math.round(clamped)}%
            </span>
          )}
        </div>
      )}
      <div
        className={`w-full h-2 rounded-full overflow-hidden ${
          darkMode ? 'bg-slate-700' : 'bg-slate-200'
        }`}
      >
        <div
          className={`h-full rounded-full transition-all duration-500 ease-out ${barColor}`}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}
