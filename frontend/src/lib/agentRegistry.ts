// Source of truth: all agent metadata driving Dashboard and AgentPage.

import type { AgentMeta } from './types';

export type { AgentMeta };

export const agentRegistry: AgentMeta[] = [
  {
    id: 'audit',
    name: 'AI Audit Agent',
    tagline: 'Automated compliance analysis for project documents',
    description:
      'Upload your documents and a CSV file of audit questions. ' +
      'The agent analyzes your documents against your questions and generates a detailed compliance report — ' +
      'no predefined categories or fixed logic.',
    instructions:
      'Step 1: Upload one or more documents for analysis (PDF, PPTX, DOCX, XLSX, or CSV). ' +
      'Step 2: Upload a CSV file containing your audit questions — the file must have a column named exactly \'Questions\'. ' +
      'Step 3: Click Process to extract and index the document content. ' +
      'Step 4: Click Run Audit to analyze your documents against your questions. ' +
      'Step 5: Review results and export the Excel report.',
    howItWorks:
      'Your documents are processed through a dual-layer extraction pipeline — digital text is extracted directly, ' +
      'while image-based pages and tables are read using Claude vision. ' +
      'Your audit questions are parsed from the CSV file and used as the evaluation criteria. ' +
      'For each question, a hypothetical compliant passage is generated (HyDE technique) and used to semantically search ' +
      'the most relevant document sections. Claude then evaluates each question against the retrieved content and returns ' +
      'a structured result with status, confidence score, observations, recommendations, and risk assessment.',
    icon: 'FileSearch',
    route: '/agent/audit',
    status: 'active',
    tags: ['compliance', 'PDF', 'documents', 'audit'],
    color: 'blue',
  },
  {
    id: 'news',
    name: 'News Research Agent',
    tagline: 'Deep Q&A on any news article via URL',
    description:
      'Paste one or more news article URLs and ask any question about their content. ' +
      'The agent scrapes articles with Crawl4AI, indexes them in a session-scoped FAISS store, ' +
      'and maintains a full multi-turn conversation so you can ask follow-up questions naturally. ' +
      'Previously indexed URLs are cached so re-visits are instant.',
    instructions:
      'Step 1: Enter one or more article URLs (up to 5). ' +
      'Step 2: Click "Ingest Articles" and wait for processing. ' +
      'Step 3: Type your question in the chat box and press Enter. ' +
      'Step 4: View the answer along with source excerpts. Add more URLs at any time.',
    howItWorks:
      'Articles are scraped using Crawl4AI which returns clean markdown. ' +
      'Text is chunked and embedded via VoyageAI into a FAISS vector store scoped to your session. ' +
      'A LangGraph state graph retrieves the top relevant chunks for each question, ' +
      'then generates an answer that cites its sources. Full chat history is preserved across turns.',
    icon: 'Newspaper',
    route: '/agent/news',
    status: 'active',
    tags: ['news', 'research', 'Q&A', 'articles'],
    color: 'emerald',
  },
  {
    id: 'data',
    name: 'TalkToData Engine',
    tagline: 'Plain English to SQL — no coding required',
    description:
      'Connect to a PostgreSQL database or upload an Excel/SQLite file, then ask questions in plain English. ' +
      'The agent generates safe, validated SQL, explains what it does, executes it, ' +
      'and presents results in a clean table. Single-value results get a hero card treatment.',
    instructions:
      'Step 1: Connect your PostgreSQL database or upload an Excel/SQLite file. ' +
      'Step 2: Review and annotate the detected table and column metadata. ' +
      'Step 3: Type a plain-English question about your data. ' +
      'Step 4: Review the generated SQL, explanation, and query results.',
    howItWorks:
      'Your question is combined with the database schema metadata and sent to Claude with a ' +
      'strict SQL generation prompt that enforces safety rules (no destructive statements, ' +
      'explicit column lists, CTE preference for complex queries). ' +
      'The SQL is validated with SQLGlot before execution. Results are returned as structured data.',
    icon: 'Database',
    route: '/agent/data',
    status: 'active',
    tags: ['SQL', 'database', 'PostgreSQL', 'analytics'],
    color: 'purple',
  },
];

export function getAgent(id: string): AgentMeta | undefined {
  return agentRegistry.find((a) => a.id === id);
}
