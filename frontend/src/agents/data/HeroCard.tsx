// Single-row result stat tiles — shown above the table when a query returns exactly one row.

interface HeroCardProps {
  heroData: Record<string, string | number | null>;
}

function formatValue(val: string | number | null): string {
  if (typeof val === 'number') {
    return val.toLocaleString('en-IN', { maximumFractionDigits: 2 });
  }
  const str = String(val ?? '');
  return str === '' ? '—' : str;
}

export default function HeroCard({ heroData }: HeroCardProps) {
  const entries = Object.entries(heroData);
  if (entries.length === 0) return null;

  return (
    <div className="bg-[#111111] border border-[#1e1e1e] rounded-[10px] p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[#525252]">
          Result
        </span>
      </div>
      <div className="flex flex-wrap gap-x-10 gap-y-4">
        {entries.map(([key, val]) => (
          <div key={key} className="min-w-0 max-w-full">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#525252] mb-1">
              {key}
            </p>
            <p
              className="text-[22px] font-semibold text-[#fafafa] leading-tight truncate"
              title={formatValue(val)}
            >
              {formatValue(val)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
