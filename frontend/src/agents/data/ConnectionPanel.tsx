// DB config form and table selection — ported from Talk_To_Data_Engine.
// Uses shared Button component; API calls via lib/api.ts.

import { useState } from 'react';
import { FileSpreadsheet, Server, CheckCircle, CheckSquare, Square } from 'lucide-react';
import api from '../../lib/api';
import Button from '../../components/ui/Button';

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

interface ConnectionPanelProps {
  darkMode: boolean;
  sessionId: string;
  onComplete: (tables: TableReview[], dialect: string, pgConfig: PostgresConfig) => void;
}

type PanelStep = 'landing' | 'postgres-login' | 'table-selection';

export default function ConnectionPanel({ darkMode, sessionId: _sessionId, onComplete }: ConnectionPanelProps) {
  const [panelStep, setPanelStep] = useState<PanelStep>('landing');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [pgConfig, setPgConfig] = useState<PostgresConfig>({
    host: 'localhost',
    port: '5432',
    database: '',
    username: 'postgres',
    password: '',
  });
  const [pgTableList, setPgTableList] = useState<string[]>([]);
  const [selectedPgTables, setSelectedPgTables] = useState<string[]>([]);

  const toggleTable = (t: string) =>
    setSelectedPgTables((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]
    );

  const toggleSelectAll = () =>
    setSelectedPgTables(
      selectedPgTables.length === pgTableList.length ? [] : [...pgTableList]
    );

  // ── Excel upload ─────────────────────────────────────────────────────────────
  const handleExcelUpload = async (file: File) => {
    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post('/agents/data/parse-excel', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      onComplete(res.data.tables, 'sqlite', pgConfig);
    } catch {
      setError('Excel parsing failed. Please check the file format.');
    }
    setLoading(false);
  };

  // ── Postgres connect ──────────────────────────────────────────────────────────
  const handlePostgresConnect = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.post('/agents/data/list-postgres-tables', {
        host: pgConfig.host,
        port: pgConfig.port,
        database: pgConfig.database,
        username: pgConfig.username,
        password: pgConfig.password,
      });
      setPgTableList(res.data.tables);
      setPanelStep('table-selection');
    } catch {
      setError('Connection failed. Please check your credentials.');
    }
    setLoading(false);
  };

  // ── Import metadata ───────────────────────────────────────────────────────────
  const handleImportMetadata = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.post('/agents/data/fetch-postgres-metadata', {
        config: {
          host: pgConfig.host,
          port: pgConfig.port,
          database: pgConfig.database,
          username: pgConfig.username,
          password: pgConfig.password,
        },
        selected_tables: selectedPgTables,
      });
      onComplete(res.data.tables, 'postgres', pgConfig);
    } catch {
      setError('Metadata fetch failed.');
    }
    setLoading(false);
  };

  // ── Landing ───────────────────────────────────────────────────────────────────
  if (panelStep === 'landing') {
    return (
      <div className="max-w-4xl mx-auto mt-10 grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Excel / CSV card */}
        <label
          className={`p-12 rounded-[3rem] border-2 cursor-pointer transition-all shadow-xl shadow-slate-900/5 group relative overflow-hidden ${
            darkMode
              ? 'bg-slate-800 border-transparent hover:border-emerald-500'
              : 'bg-white border-transparent hover:border-emerald-500'
          }`}
        >
          <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
            <FileSpreadsheet size={80} />
          </div>
          <FileSpreadsheet size={40} className="text-emerald-500 mb-6" />
          <h2 className="text-2xl font-black mb-2">Excel / CSV</h2>
          <p className={`text-sm leading-relaxed ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            Upload local data and query via SQLite.
          </p>
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => { if (e.target.files?.[0]) handleExcelUpload(e.target.files[0]); }}
            disabled={loading}
          />
          {loading && (
            <p className="mt-4 text-xs text-emerald-500 font-bold animate-pulse">Parsing…</p>
          )}
        </label>

        {/* PostgreSQL card */}
        <div
          onClick={() => setPanelStep('postgres-login')}
          className={`p-12 rounded-[3rem] border-2 cursor-pointer transition-all shadow-xl shadow-slate-900/5 group relative overflow-hidden ${
            darkMode
              ? 'bg-slate-800 border-transparent hover:border-purple-600'
              : 'bg-white border-transparent hover:border-purple-600'
          }`}
        >
          <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
            <Server size={80} />
          </div>
          <Server size={40} className="text-purple-600 mb-6" />
          <h2 className="text-2xl font-black mb-2">PostgreSQL</h2>
          <p className={`text-sm leading-relaxed ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            Connect to production database for live analysis.
          </p>
        </div>
      </div>
    );
  }

  // ── Postgres login form ────────────────────────────────────────────────────────
  if (panelStep === 'postgres-login') {
    return (
      <div
        className={`p-12 rounded-[3rem] border shadow-2xl max-w-md mx-auto space-y-4 ${
          darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
        }`}
      >
        <h2 className="text-xl font-black mb-6 flex items-center gap-2">
          <Server className="text-purple-600" /> Database Login
        </h2>

        {(['host', 'database', 'username'] as const).map((field) => (
          <div key={field} className="space-y-1">
            <label className="text-[10px] font-black uppercase text-slate-400 ml-2">{field}</label>
            <input
              className={`w-full p-4 rounded-2xl text-sm outline-none font-bold transition-all ${
                darkMode
                  ? 'bg-slate-900 text-white focus:ring-1 focus:ring-purple-500'
                  : 'bg-slate-50 border border-transparent focus:border-purple-500'
              }`}
              placeholder={`Enter ${field}…`}
              value={pgConfig[field]}
              onChange={(e) => setPgConfig({ ...pgConfig, [field]: e.target.value })}
            />
          </div>
        ))}

        <div className="space-y-1">
          <label className="text-[10px] font-black uppercase text-slate-400 ml-2">port</label>
          <input
            className={`w-full p-4 rounded-2xl text-sm outline-none font-bold transition-all ${
              darkMode
                ? 'bg-slate-900 text-white focus:ring-1 focus:ring-purple-500'
                : 'bg-slate-50 border border-transparent focus:border-purple-500'
            }`}
            value={pgConfig.port}
            onChange={(e) => setPgConfig({ ...pgConfig, port: e.target.value })}
          />
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-black uppercase text-slate-400 ml-2">password</label>
          <input
            type="password"
            className={`w-full p-4 rounded-2xl text-sm outline-none font-bold transition-all ${
              darkMode
                ? 'bg-slate-900 text-white focus:ring-1 focus:ring-purple-500'
                : 'bg-slate-50 border border-transparent focus:border-purple-500'
            }`}
            placeholder="••••••••"
            value={pgConfig.password}
            onChange={(e) => setPgConfig({ ...pgConfig, password: e.target.value })}
          />
        </div>

        {error && <p className="text-xs text-red-400 font-bold px-1">{error}</p>}

        <Button
          variant="primary"
          size="lg"
          loading={loading}
          onClick={handlePostgresConnect}
          className="w-full mt-2 !bg-purple-600 hover:!bg-purple-700 !shadow-purple-600/20"
        >
          {loading ? 'Connecting…' : 'Connect Server'}
        </Button>
      </div>
    );
  }

  // ── Table selection ────────────────────────────────────────────────────────────
  return (
    <div
      className={`p-12 rounded-[3rem] border shadow-sm max-w-4xl mx-auto ${
        darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
      }`}
    >
      <div className="flex justify-between items-center mb-10">
        <h2 className="text-2xl font-black">Select Tables</h2>
        <button
          onClick={toggleSelectAll}
          className="flex items-center gap-2 text-xs font-black text-purple-600 bg-purple-50 dark:bg-purple-900/20 dark:text-purple-400 px-4 py-2 rounded-xl"
        >
          {selectedPgTables.length === pgTableList.length ? (
            <CheckSquare size={16} />
          ) : (
            <Square size={16} />
          )}
          All Tables
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-10">
        {pgTableList.map((t) => (
          <div
            key={t}
            onClick={() => toggleTable(t)}
            className={`p-5 rounded-[1.5rem] border-2 cursor-pointer transition-all font-bold text-sm flex justify-between items-center ${
              selectedPgTables.includes(t)
                ? 'border-purple-600 bg-purple-50 dark:bg-purple-900/20 text-purple-600'
                : darkMode
                ? 'border-slate-700 text-slate-500'
                : 'border-slate-100 text-slate-400'
            }`}
          >
            {t}
            {selectedPgTables.includes(t) && <CheckCircle size={18} />}
          </div>
        ))}
      </div>

      {error && <p className="text-xs text-red-400 font-bold px-1 mb-4">{error}</p>}

      <Button
        variant="primary"
        size="lg"
        loading={loading}
        disabled={selectedPgTables.length === 0}
        onClick={handleImportMetadata}
        className="w-full !bg-purple-600 hover:!bg-purple-700 !shadow-purple-600/20"
      >
        {loading ? 'Fetching…' : 'Import Metadata'}
      </Button>
    </div>
  );
}
