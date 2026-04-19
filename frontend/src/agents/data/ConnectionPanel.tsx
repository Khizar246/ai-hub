// DB config form and table selection — ported from Talk_To_Data_Engine.

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
  db_type: 'postgresql' | 'mysql' | 'mssql';
  host: string;
  port: string;
  database: string;
  username: string;
  password: string;
  ssl_required: boolean;
}

interface ConnectionPanelProps {
  sessionId: string;
  onComplete: (tables: TableReview[], dialect: string, pgConfig: PostgresConfig) => void;
}

type PanelStep = 'landing' | 'postgres-login' | 'table-selection';

export default function ConnectionPanel({ sessionId: _sessionId, onComplete }: ConnectionPanelProps) {
  const [panelStep, setPanelStep] = useState<PanelStep>('landing');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showDbSelector, setShowDbSelector] = useState(false);

  const handleDbSelect = (dbType: PostgresConfig['db_type'], defaultPort: string) => {
    setPgConfig(prev => ({ ...prev, db_type: dbType, port: defaultPort }));
    setShowDbSelector(false);
    setPanelStep('postgres-login');
  };

  const [pgConfig, setPgConfig] = useState<PostgresConfig>({
    db_type: 'postgresql',
    host: 'localhost',
    port: '5432',
    database: '',
    username: 'postgres',
    password: '',
    ssl_required: false,
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

  const handlePostgresConnect = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.post('/agents/data/list-postgres-tables', pgConfig);
      setPgTableList(res.data.tables);
      setPanelStep('table-selection');
    } catch {
      setError('Connection failed. Please check your credentials.');
    }
    setLoading(false);
  };

  const handleImportMetadata = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.post('/agents/data/fetch-postgres-metadata', {
        config: pgConfig,
        selected_tables: selectedPgTables,
      });
      onComplete(res.data.tables, pgConfig.db_type, pgConfig);
    } catch {
      setError('Metadata fetch failed.');
    }
    setLoading(false);
  };

  // ── Landing ───────────────────────────────────────────────────────────────────
  if (panelStep === 'landing') {
    return (
      <>
      <div className="max-w-4xl mx-auto mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Excel / CSV card */}
        <label className="p-10 rounded-[10px] border border-[#1e1e1e] bg-[#111111] cursor-pointer transition-all group relative overflow-hidden hover:border-amber-400/40 hover:bg-[#131313]">
          <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:scale-110 transition-transform">
            <FileSpreadsheet size={80} />
          </div>
          <FileSpreadsheet size={32} className="text-[#a3a3a3] group-hover:text-amber-400 transition-colors mb-5" />
          <h2 className="text-[18px] font-semibold text-[#fafafa] mb-1.5">Excel / CSV</h2>
          <p className="text-[14px] text-[#525252] leading-relaxed">
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
            <p className="mt-4 text-[13px] text-amber-400 animate-pulse">Parsing…</p>
          )}
          <div
            className="mt-5 flex flex-col gap-2 text-left"
            onClick={(e) => e.preventDefault()}
          >
            <p className="text-[12px] text-[#525252]">
              💡 No file? Download our sample finance dataset to explore the agent.
            </p>
            <a
              href="/samples/sample_finance_data.xlsx"
              download="sample_finance_data.xlsx"
              className="inline-flex w-fit px-3 py-1 rounded-[6px] text-[12px] font-medium border border-[#262626] text-[#a3a3a3] hover:border-amber-400/40 hover:text-amber-400 transition-colors"
            >
              Download Sample Dataset
            </a>
          </div>
        </label>

        {/* Live Database card */}
        <div
          onClick={() => setShowDbSelector(true)}
          className="p-10 rounded-[10px] border border-[#1e1e1e] bg-[#111111] cursor-pointer transition-all group relative overflow-hidden hover:border-amber-400/40 hover:bg-[#131313]"
        >
          <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:scale-110 transition-transform">
            <Server size={80} />
          </div>
          <Server size={32} className="text-[#a3a3a3] group-hover:text-amber-400 transition-colors mb-5" />
          <h2 className="text-[18px] font-semibold text-[#fafafa] mb-1.5">Live Database</h2>
          <p className="text-[14px] text-[#525252] leading-relaxed">
            Connect to a production database for live analysis.
          </p>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-[11px] text-[#525252]">Supports:</span>
            <span className="text-[11px] text-[#404040] font-mono">PostgreSQL · MySQL · SQL Server</span>
          </div>
        </div>
      </div>

      {showDbSelector && (
        <div
          className="fixed inset-0 bg-black/70 z-50 flex flex-col md:items-center md:justify-center"
          onClick={() => setShowDbSelector(false)}
        >
          <div
            className="bg-[#111111] border-0 md:border border-[#262626] md:rounded-[14px] p-6 md:p-8 w-full md:max-w-[600px] md:mx-4 h-full md:h-auto overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="mb-8">
              <h2 className="text-[20px] font-semibold text-[#fafafa] mb-1">
                Choose your database
              </h2>
              <p className="text-[13px] text-[#525252]">
                Select the database you want to connect to. All connections are secure and session-scoped.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <button
                onClick={() => handleDbSelect('postgresql', '5432')}
                className="flex flex-col items-center gap-4 p-6 bg-[#0f0f0f] border border-[#1e1e1e] rounded-[10px] hover:border-amber-400/40 hover:bg-[#131313] transition-all duration-150 group text-left"
              >
                <div className="w-14 h-14 rounded-[12px] bg-[#336791]/10 border border-[#336791]/20 flex items-center justify-center text-[28px] group-hover:border-[#336791]/40 transition-colors duration-150">
                  🐘
                </div>
                <div>
                  <p className="text-[14px] font-semibold text-[#fafafa] mb-1">PostgreSQL</p>
                  <p className="text-[11px] text-[#525252] leading-relaxed">
                    Open-source relational database. Default port 5432.
                  </p>
                </div>
              </button>

              <button
                onClick={() => handleDbSelect('mysql', '3306')}
                className="flex flex-col items-center gap-4 p-6 bg-[#0f0f0f] border border-[#1e1e1e] rounded-[10px] hover:border-amber-400/40 hover:bg-[#131313] transition-all duration-150 group text-left"
              >
                <div className="w-14 h-14 rounded-[12px] bg-[#f59e0b]/10 border border-[#f59e0b]/20 flex items-center justify-center text-[28px] group-hover:border-[#f59e0b]/40 transition-colors duration-150">
                  🐬
                </div>
                <div>
                  <p className="text-[14px] font-semibold text-[#fafafa] mb-1">MySQL</p>
                  <p className="text-[11px] text-[#525252] leading-relaxed">
                    World's most popular open-source database. Default port 3306.
                  </p>
                </div>
              </button>

              <button
                onClick={() => handleDbSelect('mssql', '1433')}
                className="flex flex-col items-center gap-4 p-6 bg-[#0f0f0f] border border-[#1e1e1e] rounded-[10px] hover:border-amber-400/40 hover:bg-[#131313] transition-all duration-150 group text-left"
              >
                <div className="w-14 h-14 rounded-[12px] bg-[#CC2927]/10 border border-[#CC2927]/20 flex items-center justify-center text-[28px] group-hover:border-[#CC2927]/40 transition-colors duration-150">
                  🗄️
                </div>
                <div>
                  <p className="text-[14px] font-semibold text-[#fafafa] mb-1">SQL Server</p>
                  <p className="text-[11px] text-[#525252] leading-relaxed">
                    Microsoft's enterprise database platform. Default port 1433.
                  </p>
                </div>
              </button>
            </div>

            <p className="text-[11px] text-[#525252] text-center mt-6">
              Need help? Check the Instructions section above for connection guidance.
            </p>
          </div>
        </div>
      )}
      </>
    );
  }

  // ── Postgres login form ────────────────────────────────────────────────────────
  if (panelStep === 'postgres-login') {
    return (
      <div className="p-5 md:p-8 rounded-[10px] border border-[#1e1e1e] bg-[#111111] max-w-md mx-auto space-y-4">
        <h2 className="text-[18px] font-semibold text-[#fafafa] mb-6 flex items-center gap-2">
          <Server className="text-[#525252]" size={18} /> Database Login
        </h2>

        <div className="flex items-center gap-2 mb-4 px-3 py-2 bg-[#0f0f0f] border border-[#1e1e1e] rounded-[6px]">
          <span className="text-[11px] text-[#525252]">Connecting to:</span>
          <span className="text-[12px] font-medium text-amber-400">
            {pgConfig.db_type === 'postgresql' ? 'PostgreSQL' : pgConfig.db_type === 'mysql' ? 'MySQL' : 'SQL Server'}
          </span>
          <button
            onClick={() => setShowDbSelector(true)}
            className="ml-auto text-[11px] text-[#525252] hover:text-[#a3a3a3] transition-colors"
          >
            Change
          </button>
        </div>

        {(['host', 'database', 'username'] as const).map((field) => (
          <div key={field} className="space-y-1">
            <label className="text-[11px] font-semibold uppercase text-[#525252] ml-1">{field}</label>
            <input
              className="w-full p-3 rounded-[6px] text-[14px] outline-none font-medium transition-all bg-[#0f0f0f] text-[#fafafa] border border-[#262626] focus:border-amber-400/50 focus:ring-1 focus:ring-amber-400/20 placeholder-[#525252]"
              placeholder={`Enter ${field}…`}
              value={pgConfig[field]}
              onChange={(e) => setPgConfig({ ...pgConfig, [field]: e.target.value })}
            />
          </div>
        ))}

        <div className="space-y-1">
          <label className="text-[11px] font-semibold uppercase text-[#525252] ml-1">port</label>
          <input
            className="w-full p-3 rounded-[6px] text-[14px] outline-none font-medium transition-all bg-[#0f0f0f] text-[#fafafa] border border-[#262626] focus:border-amber-400/50 focus:ring-1 focus:ring-amber-400/20"
            value={pgConfig.port}
            onChange={(e) => setPgConfig({ ...pgConfig, port: e.target.value })}
          />
        </div>

        <div className="space-y-1">
          <label className="text-[11px] font-semibold uppercase text-[#525252] ml-1">password</label>
          <input
            type="password"
            className="w-full p-3 rounded-[6px] text-[14px] outline-none font-medium transition-all bg-[#0f0f0f] text-[#fafafa] border border-[#262626] focus:border-amber-400/50 focus:ring-1 focus:ring-amber-400/20 placeholder-[#525252]"
            placeholder="••••••••"
            value={pgConfig.password}
            onChange={(e) => setPgConfig({ ...pgConfig, password: e.target.value })}
          />
        </div>

        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="ssl_required"
            checked={pgConfig.ssl_required}
            onChange={e => setPgConfig(prev => ({ ...prev, ssl_required: e.target.checked }))}
            className="w-4 h-4 accent-amber-400"
          />
          <label htmlFor="ssl_required" className="text-[13px] text-[#a3a3a3] cursor-pointer">
            Require SSL (recommended for cloud databases)
          </label>
        </div>

        {error && <p className="text-[13px] text-red-400 font-medium px-1">{error}</p>}

        <Button
          variant="primary"
          size="lg"
          loading={loading}
          onClick={handlePostgresConnect}
          className="w-full mt-2"
        >
          {loading ? 'Connecting…' : 'Connect Server'}
        </Button>
      </div>
    );
  }

  // ── Table selection ────────────────────────────────────────────────────────────
  return (
    <div className="p-8 rounded-[10px] border border-[#1e1e1e] bg-[#111111] max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-[18px] font-semibold text-[#fafafa]">Select Tables</h2>
        <button
          onClick={toggleSelectAll}
          className="flex items-center gap-2 text-[12px] font-medium text-[#a3a3a3] border border-[#262626] bg-[#0f0f0f] px-3 py-1.5 rounded-[6px] hover:border-amber-400/40 hover:text-amber-400 transition-colors"
        >
          {selectedPgTables.length === pgTableList.length ? (
            <CheckSquare size={14} />
          ) : (
            <Square size={14} />
          )}
          All Tables
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-8">
        {pgTableList.map((t) => (
          <div
            key={t}
            onClick={() => toggleTable(t)}
            className={`p-4 rounded-[8px] border-2 cursor-pointer transition-all font-medium text-[14px] flex justify-between items-center ${
              selectedPgTables.includes(t)
                ? 'border-amber-400 bg-amber-400/5 text-amber-400'
                : 'border-[#1e1e1e] bg-[#0f0f0f] text-[#525252] hover:border-[#262626]'
            }`}
          >
            {t}
            {selectedPgTables.includes(t) && <CheckCircle size={16} className="shrink-0" />}
          </div>
        ))}
      </div>

      {error && <p className="text-[13px] text-red-400 font-medium px-1 mb-4">{error}</p>}

      <Button
        variant="primary"
        size="lg"
        loading={loading}
        disabled={selectedPgTables.length === 0}
        onClick={handleImportMetadata}
        className="w-full"
      >
        {loading ? 'Fetching…' : 'Import Metadata'}
      </Button>
    </div>
  );
}
