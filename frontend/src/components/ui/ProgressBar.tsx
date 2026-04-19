// Animated progress bar with optional label and percentage display.

interface ProgressBarProps {
  /** 0–100 */
  value: number;
  /** Tailwind color key: 'blue' | 'emerald' | 'amber' | 'red' */
  color?: string;
  label?: string;
  showPercentage?: boolean;
  className?: string;
}

const colorMap: Record<string, string> = {
  blue:    'bg-blue-500',
  emerald: 'bg-emerald-500',
  amber:   'bg-amber-400',
  red:     'bg-red-500',
};

export default function ProgressBar({
  value,
  color = 'blue',
  label,
  showPercentage = false,
  className = '',
}: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, value));
  const barColor = colorMap[color] ?? colorMap.blue;

  return (
    <div className={`space-y-1.5 ${className}`}>
      {(label || showPercentage) && (
        <div className="flex items-center justify-between">
          {label && (
            <span className="text-[13px] font-medium text-[#525252]">{label}</span>
          )}
          {showPercentage && (
            <span className="text-[13px] font-semibold tabular-nums text-[#a3a3a3]">
              {Math.round(clamped)}%
            </span>
          )}
        </div>
      )}
      <div className="w-full h-2 rounded-full overflow-hidden bg-[#1a1a1a]">
        <div
          className={`h-full rounded-full transition-all duration-500 ease-out ${barColor}`}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}
