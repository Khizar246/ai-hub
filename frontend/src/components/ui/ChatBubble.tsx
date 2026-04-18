// User and assistant chat message bubbles with timestamp and loading skeleton.

import { User, Bot } from 'lucide-react';
import { useUIStore } from '../../lib/store';

interface ChatBubbleProps {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: Date;
  /** If true, shows an animated skeleton instead of content. */
  loading?: boolean;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

const cleanText = (text: string) =>
  text
    .replace(/\*\*(.*?)\*\*/g, '$1')  // remove **bold**
    .replace(/\*(.*?)\*/g, '$1')       // remove *italic*
    .replace(/^#{1,3}\s/gm, '')        // remove ## headers
    .replace(/^-\s/gm, '• ');          // convert - lists to bullet

export default function ChatBubble({
  role,
  content,
  timestamp,
  loading = false,
}: ChatBubbleProps) {
  const { darkMode } = useUIStore();
  const isUser = role === 'user';

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Avatar */}
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1 ${
          isUser ? 'bg-blue-600 text-white' : 'bg-emerald-500 text-white'
        }`}
      >
        {isUser ? <User size={14} /> : <Bot size={14} />}
      </div>

      {/* Bubble */}
      <div
        className={`max-w-[75%] space-y-1 flex flex-col ${
          isUser ? 'items-end' : 'items-start'
        }`}
      >
        {loading ? (
          /* Skeleton */
          <div
            className={`px-5 py-4 rounded-[1.5rem] rounded-tl-sm space-y-2 w-48 ${
              darkMode ? 'bg-slate-800 border border-slate-700' : 'bg-slate-100'
            }`}
          >
            <div
              className={`h-2.5 w-full rounded-full animate-pulse ${
                darkMode ? 'bg-slate-700' : 'bg-slate-300'
              }`}
            />
            <div
              className={`h-2.5 w-3/4 rounded-full animate-pulse ${
                darkMode ? 'bg-slate-700' : 'bg-slate-300'
              }`}
            />
            <div
              className={`h-2.5 w-1/2 rounded-full animate-pulse ${
                darkMode ? 'bg-slate-700' : 'bg-slate-300'
              }`}
            />
          </div>
        ) : (
          <div
            className={`px-5 py-4 rounded-[1.5rem] text-sm leading-relaxed font-medium ${
              isUser
                ? 'bg-blue-600 text-white rounded-tr-sm whitespace-pre-wrap'
                : darkMode
                ? 'bg-slate-800 text-slate-200 rounded-tl-sm border border-slate-700'
                : 'bg-slate-50 text-slate-800 rounded-tl-sm border border-slate-100'
            }`}
          >
            <p className="whitespace-pre-wrap">{isUser ? content : cleanText(content)}</p>
          </div>
        )}

        {/* Timestamp */}
        {timestamp && !loading && (
          <p
            className={`text-[10px] px-1 ${
              darkMode ? 'text-slate-600' : 'text-slate-400'
            }`}
          >
            {formatTime(timestamp)}
          </p>
        )}
      </div>
    </div>
  );
}
