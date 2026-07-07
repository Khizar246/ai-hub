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
  sessionId: string;
  tables: TableReview[];
  dialect: string;
  onChange: (tables: TableReview[]) => void;
  onStartAnalysis: () => void;
}

export default function SchemaEditor({
  sessionId: _sessionId,
  tables,
  dialect,
  onChange,
  onStartAnalysis,
}: SchemaEditorProps) {

  // Table and column names are intentionally locked: they must match the real
  // database objects or every generated query would fail. Types and
  // descriptions are the editable parts that guide the AI.
  const updateColumn = (
    tIdx: number,
    cIdx: number,
    field: 'data_type' | 'description',
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
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header bar */}
      <div className="p-6 rounded-[8px] border border-[#1e1e1e] bg-[#111111] flex justify-between items-center">
        <div>
          <h2 className="text-[18px] font-semibold text-[#fafafa]">Verify Schema Mapping</h2>
          <p className="text-[#525252] text-[12px] font-medium uppercase tracking-widest mt-1">
            Reviewing {tables.length} Table{tables.length !== 1 ? 's' : ''}
          </p>
          <p className="text-[#525252] text-[12px] mt-2 normal-case tracking-normal">
            Add column descriptions to help the AI understand your data — names are locked to match the source.
          </p>
        </div>
        <Button
          variant="primary"
          size="md"
          icon={<ChevronRight size={16} />}
          onClick={handleStartAnalysis}
        >
          Start Analysis
        </Button>
      </div>

      {/* Table cards */}
      <div className="grid grid-cols-1 gap-4">
        {tables.map((table, tIdx) => (
          <div
            key={tIdx}
            className="p-6 rounded-[8px] border border-[#1e1e1e] bg-[#111111]"
          >
            {/* Table name row */}
            <div className="flex items-center gap-3 mb-6 border-b border-[#1e1e1e] pb-3">
              <TableIcon className="text-amber-400 shrink-0" size={16} />
              <span className="text-[16px] font-semibold text-[#fafafa]">
                {table.table_name}
              </span>
            </div>

            {/* Column rows */}
            <div className="space-y-2">
              {table.columns.map((col, cIdx) => (
                <div
                  key={cIdx}
                  className="flex gap-4 items-center p-3 rounded-[6px] border border-transparent bg-[#0f0f0f] transition-all hover:border-[#262626]"
                >
                  <span className="flex-1 font-medium text-[14px] px-2 text-[#a3a3a3] truncate" title={col.name}>
                    {col.name}
                  </span>
                  <select
                    className="px-3 py-1.5 rounded-[6px] text-[12px] font-medium outline-none bg-[#111111] border border-[#262626] text-[#a3a3a3]"
                    value={col.data_type}
                    onChange={(e) => updateColumn(tIdx, cIdx, 'data_type', e.target.value)}
                  >
                    {/* Live-DB types (e.g. CHARACTER VARYING) may not be in the preset list */}
                    {!DATA_TYPES.includes(col.data_type) && (
                      <option value={col.data_type}>{col.data_type}</option>
                    )}
                    {DATA_TYPES.map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                  <input
                    className="flex-1 text-[13px] italic text-[#525252] bg-transparent outline-none border-l border-[#262626] pl-3"
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
