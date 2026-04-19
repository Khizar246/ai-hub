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
      className={`text-[11px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full border ${
        confidenceColors[level] ?? confidenceColors.medium
      }`}
    >
      {level} confidence
    </span>
  );
}

export default function ChatInterface({ sessionId: _sessionId, articleCount }: ChatInterfaceProps) {
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
      className="rounded-[10px] border border-[#1e1e1e] bg-[#111111] flex flex-col overflow-hidden"
      style={{ minHeight: '520px' }}
    >
      {/* Header */}
      <div className="px-6 py-4 border-b border-[#1e1e1e] bg-[#0f0f0f] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BookOpen size={16} className="text-[#525252]" />
          <span className="text-[14px] font-semibold text-[#a3a3a3] uppercase tracking-widest">
            News Research
          </span>
        </div>
        <span className="text-[11px] font-medium px-3 py-1 rounded-full border border-[#262626] text-[#525252]">
          {articleCount} article{articleCount !== 1 ? 's' : ''} indexed
        </span>
      </div>

      {/* Message list */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
        {messages.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center h-full min-h-[200px] gap-3 opacity-30">
            <BookOpen size={32} />
            <p className="text-[14px] font-medium">Ask anything about your articles…</p>
          </div>
        )}

        {messages.map((msg, idx) => {
          const isUser = msg.role === 'user';
          const hasSources = !isUser && msg.sources.length > 0;
          const sourcesOpen = expandedSources.has(idx);

          if (isUser) {
            return (
              <div key={idx} className="flex items-baseline gap-2 px-4 py-3 bg-[#111111] border border-[#1e1e1e] rounded-[8px] w-full">
                <span className="text-amber-400 font-semibold text-[13px] flex-shrink-0">Q.</span>
                <span className="text-[14px] text-[#fafafa] leading-relaxed">{msg.content}</span>
              </div>
            );
          }

          return (
            <div key={idx} className="flex gap-3 flex-row">
              {/* Avatar */}
              <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-1 bg-amber-400 text-[#0a0a0a]">
                <BookOpen size={13} />
              </div>

              <div className="max-w-[75%] space-y-2 items-start flex flex-col">
                {/* Bubble */}
                <div className="px-5 py-3.5 rounded-[8px] rounded-tl-sm text-[14px] leading-relaxed text-[#a3a3a3] bg-[#0f0f0f] border border-[#1e1e1e]">
                  <StreamingText text={cleanText(msg.content)} streaming={false} />
                </div>

                {/* Confidence + source toggle */}
                <div className="flex items-center gap-3 px-1">
                  {msg.confidence && <ConfidencePill level={msg.confidence} />}
                  {hasSources && (
                    <button
                      onClick={() => toggleSources(idx)}
                      className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-widest transition-colors text-[#525252] hover:text-amber-400"
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
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {loading && <ChatBubble role="assistant" content="" loading />}

        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div className="px-6 py-4 border-t border-[#1e1e1e] bg-[#0f0f0f]">
        <div className="flex gap-3">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
            placeholder="Ask a question about your articles…"
            disabled={loading}
            className="flex-1 px-4 py-3 rounded-[6px] text-[14px] font-medium outline-none transition-all disabled:opacity-50 bg-[#0a0a0a] text-[#fafafa] placeholder-[#525252] border border-[#262626] focus:border-amber-400/50 focus:ring-1 focus:ring-amber-400/20"
          />
          <button
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            className="bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-[#0a0a0a] px-5 py-3 rounded-[6px] transition-all flex items-center gap-2 font-semibold text-[14px]"
          >
            {loading ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
          </button>
        </div>
      </div>
    </div>
  );
}
