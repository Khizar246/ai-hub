// TalkToData orchestrator: connection → schema → workspace.

import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import ConnectionPanel from './ConnectionPanel';
import SchemaEditor from './SchemaEditor';
import QueryWorkspace from './QueryWorkspace';
import { useSession } from '../../lib/useSession';

interface ColumnReview {
  name: string;
  data_type: string;
  description: string;
}

interface TableReview {
  table_name: string;
  columns: ColumnReview[];
}

interface PostgresConfig {
  db_type: 'postgresql' | 'mysql' | 'mssql';
  host: string;
  port: string;
  database: string;
  username: string;
  password: string;
  ssl_required: boolean;
}

type AppStep = 'connection' | 'schema' | 'workspace';

const STEPS: AppStep[] = ['connection', 'schema', 'workspace'];

export default function DataAgent() {
  const sessionId = useSession();

  const [appStep, setAppStep] = useState<AppStep>('connection');
  const [status, setStatus] = useState('AI Ready');
  const [loading, setLoading] = useState(false);
  const [tables, setTables] = useState<TableReview[]>([]);
  const [dialect, setDialect] = useState('sqlite');
  const [pgConfig, setPgConfig] = useState<PostgresConfig>({
    db_type: 'postgresql',
    host: 'localhost',
    port: '5432',
    database: '',
    username: 'postgres',
    password: '',
    ssl_required: false,
  });

  const handleConnectionComplete = (
    newTables: TableReview[],
    newDialect: string,
    newPgConfig: PostgresConfig
  ) => {
    setTables(newTables);
    setDialect(newDialect);
    setPgConfig(newPgConfig);
    setAppStep('schema');
  };

  const stepIdx = STEPS.indexOf(appStep);

  return (
    <div className="space-y-6">
      {/* Step bar */}
      <div className="rounded-[8px] border border-[#1e1e1e] bg-[#111111] px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          {appStep !== 'connection' && (
            <button
              onClick={() => setAppStep(appStep === 'workspace' ? 'schema' : 'connection')}
              className="p-2 rounded-md hover:bg-[#1a1a1a] text-[#525252] hover:text-[#a3a3a3] transition-all"
            >
              <ArrowLeft size={16} />
            </button>
          )}
          <div className="flex items-center gap-2">
            {STEPS.map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-[12px] font-bold transition-all ${
                    i <= stepIdx
                      ? 'bg-amber-400 text-[#0a0a0a]'
                      : 'bg-[#1a1a1a] text-[#525252]'
                  }${i === stepIdx ? ' ring-4 ring-amber-400/20' : ''}`}
                >
                  {i + 1}
                </div>
                <span
                  className={`text-[12px] font-semibold uppercase tracking-widest hidden sm:inline ${
                    i === stepIdx ? 'text-[#fafafa]' : 'text-[#525252]'
                  }`}
                >
                  {s}
                </span>
                {i < STEPS.length - 1 && (
                  <div
                    className={`h-px w-6 ${i < stepIdx ? 'bg-amber-400' : 'bg-[#262626]'}`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Status pill */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#262626] bg-[#0f0f0f] text-[11px] font-semibold text-[#a3a3a3] uppercase tracking-widest">
          <div
            className={`w-1.5 h-1.5 rounded-full ${
              loading
                ? 'bg-amber-400 animate-pulse'
                : status.toLowerCase().includes('error')
                  ? 'bg-red-500'
                  : 'bg-emerald-500'
            }`}
          />
          {status}
        </div>
      </div>

      {/* Active step content */}
      {appStep === 'connection' && (
        <ConnectionPanel
          sessionId={sessionId}
          onComplete={handleConnectionComplete}
        />
      )}

      {appStep === 'schema' && (
        <SchemaEditor
          sessionId={sessionId}
          tables={tables}
          dialect={dialect}
          onChange={setTables}
          onStartAnalysis={() => setAppStep('workspace')}
        />
      )}

      {appStep === 'workspace' && (
        <QueryWorkspace
          sessionId={sessionId}
          dialect={dialect}
          pgConfig={pgConfig}
          onStatusChange={(s) => {
            setStatus(s);
            setLoading(s === 'Thinking…' || s === 'Executing…');
          }}
        />
      )}
    </div>
  );
}
