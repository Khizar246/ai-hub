// Full conversation UI — uses shared ChatBubble and StreamingText; API via lib/api.ts.

import { useState, useRef, useEffect } from 'react';
import { Send, Loader2, ChevronDown, ChevronUp, BookOpen } from 'lucide-react';
import SourceCard from './SourceCard';
import ChatBubble from '../../components/ui/ChatBubble';
import StreamingText from '../../components/ui/StreamingText';
import api from '../../lib/api';

interface Source {
  url: string;
  title: string;
  excerpt: string;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  sources: Source[];
  confidence?: string;
}

interface ChatInterfaceProps {
  darkMode: boolean;
  sessionId: string;
  articleCount: number;
}

const cleanText = (text: string) =>
  text.replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1').replace(/^#{1,3}\s/gm, '');

const confidenceColors: Record<string, string> = {
  high:   'text-emerald-500 border-emerald-500/30 bg-emerald-500/10',
  medium: 'text-yellow-500 border-yellow-500/30 bg-yellow-500/10',
  low:    'text-red-400 border-red-400/30 bg-red-400/10',
};

function ConfidencePill({ level }: { level: string }) {
  return (
    <span
      className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${
        confidenceColors[level] ?? confidenceColors.medium
      }`}
    >
      {level} confidence
    </span>
  );
}

export default function ChatInterface({ darkMode, sessionId: _sessionId, articleCount }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [expandedSources, setExpandedSources] = useState<Set<number>>(new Set());
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const toggleSources = (idx: number) => {
    setExpandedSources((prev) => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  };

  const sendMessage = async () => {
    const question = input.trim();
    if (!question || loading) return;

    const userMessage: Message = { role: 'user', content: question, sources: [] };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const res = await api.post('/agents/news/ask', { question });
      const assistantMessage: Message = {
        role: 'assistant',
        content: res.data.answer,
        sources: res.data.sources ?? [],
        confidence: res.data.confidence,
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err: unknown) {
      const detail =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
          : undefined;
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: detail || 'Something went wrong. Please try again.',
          sources: [],
          confidence: 'low',
        },
      ]);
    }
    setLoading(false);
    inputRef.current?.focus();
  };

  return (
    <div
      className={`rounded-[2.5rem] border flex flex-col shadow-sm overflow-hidden ${
        darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
      }`}
      style={{ minHeight: '520px' }}
    >
      {/* Header */}
      <div
        className={`px-10 py-6 border-b flex items-center justify-between ${
          darkMode ? 'border-slate-700 bg-slate-900/40' : 'border-slate-100 bg-slate-50'
        }`}
      >
        <div className="flex items-center gap-3">
          <BookOpen size={18} className="text-emerald-500" />
          <span className="text-sm font-black uppercase tracking-widest">News Research</span>
        </div>
        <span
          className={`text-[10px] font-bold px-3 py-1 rounded-full border ${
            darkMode ? 'border-slate-700 text-slate-400' : 'border-slate-200 text-slate-500'
          }`}
        >
          {articleCount} article{articleCount !== 1 ? 's' : ''} indexed
        </span>
      </div>

      {/* Message list */}
      <div className="flex-1 overflow-y-auto px-10 py-8 space-y-8">
        {messages.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center h-full min-h-[200px] gap-3 opacity-40">
            <BookOpen size={36} />
            <p className="text-sm font-bold">Ask anything about your articles…</p>
          </div>
        )}

        {messages.map((msg, idx) => {
          const isUser = msg.role === 'user';
          const hasSources = !isUser && msg.sources.length > 0;
          const sourcesOpen = expandedSources.has(idx);

          if (isUser) {
            // Use shared ChatBubble for user messages
            return (
              <ChatBubble
                key={idx}
                role="user"
                content={msg.content}
              />
            );
          }

          // Assistant messages: custom layout with confidence + source toggle
          return (
            <div key={idx} className="flex gap-3 flex-row">
              {/* Avatar */}
              <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1 bg-emerald-500 text-white">
                <BookOpen size={14} />
              </div>

              <div className="max-w-[75%] space-y-2 items-start flex flex-col">
                {/* Bubble — uses StreamingText for content rendering */}
                <div
                  className={`px-6 py-4 rounded-[1.5rem] rounded-tl-sm text-sm leading-relaxed font-medium ${
                    darkMode
                      ? 'bg-slate-900/60 text-slate-200 border border-slate-700'
                      : 'bg-slate-50 text-slate-800 border border-slate-100'
                  }`}
                >
                  <StreamingText text={cleanText(msg.content)} streaming={false} />
                </div>

                {/* Confidence + source toggle */}
                <div className="flex items-center gap-3 px-1">
                  {msg.confidence && <ConfidencePill level={msg.confidence} />}
                  {hasSources && (
                    <button
                      onClick={() => toggleSources(idx)}
                      className={`flex items-center gap-1 text-[10px] font-black uppercase tracking-widest transition-colors ${
                        darkMode
                          ? 'text-slate-500 hover:text-emerald-400'
                          : 'text-slate-400 hover:text-emerald-600'
                      }`}
                    >
                      {sourcesOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      {msg.sources.length} source{msg.sources.length !== 1 ? 's' : ''}
                    </button>
                  )}
                </div>

                {/* Collapsible source cards */}
                {hasSources && sourcesOpen && (
                  <div className="space-y-2 w-full max-w-md">
                    {msg.sources.map((src, si) => (
                      <SourceCard
                        key={si}
                        title={src.title}
                        url={src.url}
                        excerpt={src.excerpt}
                        darkMode={darkMode}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Loading indicator — shared ChatBubble skeleton */}
        {loading && <ChatBubble role="assistant" content="" loading />}

        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div className={`px-8 py-6 border-t ${darkMode ? 'border-slate-700' : 'border-slate-100'}`}>
        <div className="flex gap-3">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
            placeholder="Ask a question about your articles…"
            disabled={loading}
            className={`flex-1 px-6 py-4 rounded-2xl text-sm font-medium outline-none transition-all disabled:opacity-50 ${
              darkMode
                ? 'bg-slate-900 text-white placeholder-slate-600 focus:ring-1 focus:ring-emerald-500'
                : 'bg-slate-50 text-slate-800 placeholder-slate-400 border border-transparent focus:border-emerald-400'
            }`}
          />
          <button
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            className="bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white px-6 py-4 rounded-2xl transition-all shadow-lg shadow-emerald-500/20 flex items-center gap-2 font-bold text-sm"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </div>
      </div>
    </div>
  );
}
