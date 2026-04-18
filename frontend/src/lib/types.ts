// Shared TypeScript interfaces for all three agents.

// ─── Agent registry ─────────────────────────────────────────────────────────

export interface AgentMeta {
  id: string;
  name: string;
  tagline: string;
  description: string;
  instructions: string;
  howItWorks: string;
  icon: string;           // lucide-react icon name
  route: string;
  status: 'active' | 'coming-soon';
  tags: string[];
  color: string;          // tailwind color key e.g. 'blue' | 'emerald' | 'purple'
}

// ─── Audit Agent ─────────────────────────────────────────────────────────────

export interface AuditResultItem {
  rule: string;
  status: string;         // Present | Partially Present | Inadequate | Not Present | Error
  observation: string;
  recommendation: string;
  risk: string;
  page_numbers: string;
  confidence_score: number;
  criticality: string;    // High | Medium | Low
  requires_action: boolean;
  validation_note?: string;
}

export interface AuditSummary {
  total_rules: number;
  status_counts: Record<string, number>;
  action_items: number;
  high_priority_issues: number;
  average_confidence: number;
  compliance_rate: number;
}

export interface AuditResponse {
  session_id: string;
  category: string;
  results: AuditResultItem[];
  summary: AuditSummary;
}

// ─── News Agent ───────────────────────────────────────────────────────────────

export interface ArticleSummary {
  url: string;
  title: string;
  word_count: number;
  status: 'ok' | 'skipped' | 'error';
  error?: string;
}

export interface SourceChunk {
  url: string;
  title: string;
  excerpt: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  sources: SourceChunk[];
  confidence?: string;    // high | medium | low
}

// ─── Data Agent ───────────────────────────────────────────────────────────────

export interface DBConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
}

export interface ColumnMeta {
  column_name: string;
  data_type: string;
  description: string;
}

export interface TableMeta {
  table_name: string;
  description: string;
  columns: ColumnMeta[];
}

export interface QueryResult {
  sql: string;
  explanation: string;
  columns: string[];
  rows: (string | number | boolean | null)[][];
  row_count: number;
  is_hero: boolean;
}

export interface HeroCardData {
  label: string;
  value: string | number;
}

// ─── Session ──────────────────────────────────────────────────────────────────

export interface SessionState {
  sessionId: string;
}
