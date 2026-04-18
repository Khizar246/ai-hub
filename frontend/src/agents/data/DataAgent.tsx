// TalkToData orchestrator: connection → schema → workspace.
// Uses useUIStore for dark mode and useSession for session ID (no own nav bar — Shell handles that).

import { useState } from 'react';
import { ArrowLeft, Database } from 'lucide-react';
import ConnectionPanel from './ConnectionPanel';
import SchemaEditor from './SchemaEditor';
import QueryWorkspace from './QueryWorkspace';
import { useUIStore } from '../../lib/store';
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
  host: string;
  port: string;
  database: string;
  username: string;
  password: string;
}

type AppStep = 'connection' | 'schema' | 'workspace';

const STEPS: AppStep[] = ['connection', 'schema', 'workspace'];

export default function DataAgent() {
  const { darkMode } = useUIStore();
  const sessionId = useSession();

  const [appStep, setAppStep] = useState<AppStep>('connection');
  const [status, setStatus] = useState('AI Ready');
  const [loading, setLoading] = useState(false);
  const [tables, setTables] = useState<TableReview[]>([]);
  const [dialect, setDialect] = useState('sqlite');
  const [pgConfig, setPgConfig] = useState<PostgresConfig>({
    host: 'localhost',
    port: '5432',
    database: '',
    username: 'postgres',
    password: '',
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
      <div
        className={`rounded-2xl border px-6 py-4 flex items-center justify-between ${
          darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
        }`}
      >
        <div className="flex items-center gap-4">
          {appStep !== 'connection' && (
            <button
              onClick={() => setAppStep(appStep === 'workspace' ? 'schema' : 'connection')}
              className={`p-2 rounded-xl transition-all ${
                darkMode ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-slate-100 text-slate-500'
              }`}
            >
              <ArrowLeft size={16} />
            </button>
          )}
          <div className="flex items-center gap-2">
            {STEPS.map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black ${
                    i < stepIdx
                      ? 'bg-purple-600 text-white'
                      : i === stepIdx
                      ? 'bg-purple-600 text-white ring-4 ring-purple-600/20'
                      : darkMode
                      ? 'bg-slate-700 text-slate-500'
                      : 'bg-slate-200 text-slate-400'
                  }`}
                >
                  {i + 1}
                </div>
                <span
                  className={`text-xs font-black uppercase tracking-widest hidden sm:inline ${
                    i === stepIdx
                      ? darkMode ? 'text-white' : 'text-slate-800'
                      : darkMode ? 'text-slate-600' : 'text-slate-400'
                  }`}
                >
                  {s}
                </span>
                {i < STEPS.length - 1 && (
                  <div
                    className={`h-px w-6 ${
                      i < stepIdx ? 'bg-purple-600' : darkMode ? 'bg-slate-700' : 'bg-slate-200'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Status pill */}
        <div
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-[10px] font-black uppercase tracking-widest ${
            darkMode
              ? 'bg-slate-900 border-slate-700 text-emerald-400'
              : 'bg-emerald-50 border-emerald-100 text-emerald-600'
          }`}
        >
          <div
            className={`w-1.5 h-1.5 rounded-full ${
              loading ? 'bg-purple-500 animate-pulse' : 'bg-emerald-500'
            }`}
          />
          {status}
        </div>
      </div>

      {/* Active step content */}
      {appStep === 'connection' && (
        <ConnectionPanel
          darkMode={darkMode}
          sessionId={sessionId}
          onComplete={handleConnectionComplete}
        />
      )}

      {appStep === 'schema' && (
        <SchemaEditor
          darkMode={darkMode}
          sessionId={sessionId}
          tables={tables}
          dialect={dialect}
          onChange={setTables}
          onStartAnalysis={() => setAppStep('workspace')}
        />
      )}

      {appStep === 'workspace' && (
        <QueryWorkspace
          darkMode={darkMode}
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
