// Single-row result hero card — ported from Talk_To_Data_Engine/frontend/src/App.jsx results section

import { Trophy } from 'lucide-react';

interface HeroCardProps {
  heroData: Record<string, string | number | null>;
}

function formatValue(val: string | number | null): string {
  if (typeof val === 'number') {
    return val.toLocaleString('en-IN', { maximumFractionDigits: 2 });
  }
  return String(val ?? '');
}

export default function HeroCard({ heroData }: HeroCardProps) {
  const entries = Object.entries(heroData);
  const [primaryKey, primaryVal] = entries[0] ?? ['Result', null];
  const [, valueVal] = entries[1] ?? entries[0] ?? ['', null];

  return (
    <div className="xl:col-span-1 bg-gradient-to-br from-blue-600 to-indigo-900 rounded-[3.5rem] p-10 text-white shadow-2xl flex flex-col justify-between">
      <div>
        <div className="bg-white/20 w-12 h-12 rounded-2xl flex items-center justify-center mb-8">
          <Trophy size={24} />
        </div>
        <h4 className="text-[10px] font-black uppercase tracking-widest opacity-50 mb-2">
          Primary Result
        </h4>
        <p className="text-2xl font-bold leading-tight truncate">
          {String(primaryVal ?? primaryKey)}
        </p>
      </div>
      <div className="mt-12">
        <h4 className="text-[10px] font-black uppercase tracking-widest opacity-50 mb-2">
          Value
        </h4>
        <p className="text-4xl font-black">{formatValue(valueVal)}</p>
      </div>
    </div>
  );
}
