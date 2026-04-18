// Axios instance with base URL /api and automatic X-Session-ID header injection.

import axios from 'axios';
import type {
  ArticleSummary,
  AuditResponse,
  ChatMessage,
  QueryResult,
  TableMeta,
} from './types';

// ─── Base client ──────────────────────────────────────────────────────────────

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
});

api.interceptors.request.use((config) => {
  const sessionId = localStorage.getItem('ai_hub_session_id');
  if (sessionId) {
    config.headers['X-Session-ID'] = sessionId;
  }
  return config;
});

export default api;

// ─── Audit Agent endpoints ────────────────────────────────────────────────────

export const auditApi = {
  uploadDocuments: (files: File[], sessionId: string) => {
    const form = new FormData();
    files.forEach((f) => form.append('files', f));
    return api.post<{ session_id: string; files: { filename: string; type: string }[] }>(
      '/agents/audit/upload-documents',
      form,
      { headers: { 'Content-Type': 'multipart/form-data', 'X-Session-ID': sessionId } }
    );
  },

  uploadQuestions: (file: File, sessionId: string) => {
    const form = new FormData();
    form.append('file', file);
    return api.post<{ valid: boolean; question_count: number; preview: string[]; error: string | null }>(
      '/agents/audit/upload-questions',
      form,
      { headers: { 'Content-Type': 'multipart/form-data', 'X-Session-ID': sessionId } }
    );
  },

  processDynamic: (sessionId: string) =>
    api.post('/agents/audit/process-dynamic', null, {
      headers: { 'X-Session-ID': sessionId },
    }),

  runAuditDynamic: (sessionId: string) =>
    api.post<AuditResponse>('/agents/audit/audit-dynamic', null, {
      headers: { 'X-Session-ID': sessionId },
    }),

  getResults: (sessionId: string, category: string) =>
    api.get<AuditResponse>(`/agents/audit/results/${sessionId}/${category}`),

  export: (sessionId: string, category: string) =>
    api.post('/agents/audit/export', { session_id: sessionId, category }, { responseType: 'blob' }),

  clear: (sessionId: string) => api.delete(`/agents/audit/clear/${sessionId}`),
};

// ─── News Agent endpoints ─────────────────────────────────────────────────────

export const newsApi = {
  ingest: (urls: string[]) =>
    api.post<{ articles: ArticleSummary[] }>('/agents/news/ingest', { urls }),

  ask: (question: string) =>
    api.post<{ answer: string; sources: { url: string; title: string; excerpt: string }[]; confidence: string }>(
      '/agents/news/ask',
      { question }
    ),

  getHistory: (sessionId: string) =>
    api.get<{ messages: ChatMessage[] }>(`/agents/news/history/${sessionId}`),

  clear: (sessionId: string) => api.delete(`/agents/news/clear/${sessionId}`),
};

// ─── Data Agent endpoints ─────────────────────────────────────────────────────

export const dataApi = {
  parseExcel: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.post<{ tables: string[]; session_id: string }>(
      '/agents/data/parse-excel',
      form,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
  },

  listPostgresTables: (config: {
    host: string;
    port: number;
    database: string;
    username: string;
    password: string;
  }) => api.post<{ tables: string[] }>('/agents/data/list-postgres-tables', config),

  fetchPostgresMetadata: (config: {
    host: string;
    port: number;
    database: string;
    username: string;
    password: string;
    tables: string[];
  }) => api.post<{ metadata: TableMeta[] }>('/agents/data/fetch-postgres-metadata', config),

  finalizeMetadata: (tables: TableMeta[]) =>
    api.post<{ status: string }>('/agents/data/finalize-metadata', { tables }),

  ask: (question: string) =>
    api.post<QueryResult>('/agents/data/ask', { question }),

  execute: (sql: string) =>
    api.post<QueryResult>('/agents/data/execute', { sql }),
};
