// Column/schema metadata editor — uses shared Button, API via lib/api.ts.

import { ChevronRight, Table as TableIcon } from 'lucide-react';
import api from '../../lib/api';
import Button from '../../components/ui/Button';

const DATA_TYPES = [
  'TEXT', 'VARCHAR', 'INTEGER', 'BIGINT', 'DECIMAL',
  'BOOLEAN', 'DATE', 'TIMESTAMP', 'JSONB', 'UUID',
];

interface ColumnReview {
  name: string;
  data_type: string;
  description: string;
}

interface TableReview {
  table_name: string;
  columns: ColumnReview[];
}

interface SchemaEditorProps {
  darkMode: boolean;
  sessionId: string;
  tables: TableReview[];
  dialect: string;
  onChange: (tables: TableReview[]) => void;
  onStartAnalysis: () => void;
}

export default function SchemaEditor({
  darkMode,
  sessionId: _sessionId,
  tables,
  dialect,
  onChange,
  onStartAnalysis,
}: SchemaEditorProps) {

  const updateTableName = (tIdx: number, value: string) => {
    const next = [...tables];
    next[tIdx] = { ...next[tIdx], table_name: value };
    onChange(next);
  };

  const updateColumn = (
    tIdx: number,
    cIdx: number,
    field: keyof ColumnReview,
    value: string
  ) => {
    const next = tables.map((t, ti) =>
      ti !== tIdx
        ? t
        : {
            ...t,
            columns: t.columns.map((c, ci) =>
              ci !== cIdx ? c : { ...c, [field]: value }
            ),
          }
    );
    onChange(next);
  };

  const handleStartAnalysis = async () => {
    await api.post('/agents/data/finalize-metadata', { tables, dialect });
    onStartAnalysis();
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header bar */}
      <div
        className={`p-8 rounded-[2rem] border flex justify-between items-center shadow-sm ${
          darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
        }`}
      >
        <div>
          <h2 className="text-xl font-black">Verify Schema Mapping</h2>
          <p className="text-slate-400 text-xs font-medium uppercase tracking-widest mt-1">
            Reviewing {tables.length} Table{tables.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Button
          variant="primary"
          size="md"
          icon={<ChevronRight size={16} />}
          onClick={handleStartAnalysis}
          className="!bg-purple-600 hover:!bg-purple-700 !shadow-purple-600/20"
        >
          Start Analysis
        </Button>
      </div>

      {/* Table cards */}
      <div className="grid grid-cols-1 gap-6">
        {tables.map((table, tIdx) => (
          <div
            key={tIdx}
            className={`p-10 rounded-[3.5rem] border shadow-sm ${
              darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
            }`}
          >
            {/* Table name row */}
            <div
              className={`flex items-center gap-3 mb-8 border-b pb-4 ${
                darkMode ? 'border-slate-700' : 'border-slate-100'
              }`}
            >
              <TableIcon className="text-purple-600" size={20} />
              <input
                className="text-lg font-black bg-transparent outline-none w-full"
                value={table.table_name}
                onChange={(e) => updateTableName(tIdx, e.target.value)}
              />
            </div>

            {/* Column rows */}
            <div className="space-y-3">
              {table.columns.map((col, cIdx) => (
                <div
                  key={cIdx}
                  className={`flex gap-4 items-center p-3 rounded-2xl border transition-all ${
                    darkMode
                      ? 'bg-slate-900/50 border-transparent hover:border-slate-600'
                      : 'bg-slate-50 border-transparent hover:border-slate-200'
                  }`}
                >
                  <input
                    className="flex-1 font-bold text-sm bg-transparent outline-none px-2"
                    value={col.name}
                    onChange={(e) => updateColumn(tIdx, cIdx, 'name', e.target.value)}
                  />
                  <select
                    className={`px-4 py-2 rounded-xl text-[11px] font-black outline-none ${
                      darkMode
                        ? 'bg-slate-800 border-slate-700 text-slate-300'
                        : 'bg-white border border-slate-200 text-slate-600'
                    }`}
                    value={col.data_type}
                    onChange={(e) => updateColumn(tIdx, cIdx, 'data_type', e.target.value)}
                  >
                    {DATA_TYPES.map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                  <input
                    className={`flex-1 text-xs italic text-slate-400 bg-transparent outline-none border-l pl-4 ${
                      darkMode ? 'border-slate-700' : 'border-slate-200'
                    }`}
                    placeholder="Description…"
                    value={col.description}
                    onChange={(e) => updateColumn(tIdx, cIdx, 'description', e.target.value)}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
