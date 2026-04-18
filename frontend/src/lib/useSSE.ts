// EventSource wrapper hook for streaming Claude SSE responses.

import { useEffect, useRef, useState } from 'react';

interface UseSSEOptions {
  /** Called with each text chunk as it arrives. */
  onChunk?: (chunk: string) => void;
  /** Called when the stream ends (server sends [DONE]). */
  onDone?: (fullText: string) => void;
  /** Called when a connection or parse error occurs. */
  onError?: (error: Event) => void;
}

interface UseSSEResult {
  /** Accumulated text received so far. */
  content: string;
  /** True while the stream is open. */
  streaming: boolean;
  /** Start or restart streaming from the given URL. */
  start: (url: string) => void;
  /** Manually close the stream. */
  stop: () => void;
  /** Reset accumulated content to empty string. */
  reset: () => void;
}

/**
 * Custom hook that wraps the browser's EventSource API for server-sent events.
 *
 * Usage:
 *   const { content, streaming, start, stop } = useSSE({ onDone: (text) => save(text) });
 *   // then call start('/api/agents/news/stream?question=...')
 *
 * The backend must send:
 *   data: <text chunk>\n\n
 *   data: [DONE]\n\n  ← signals end of stream
 */
export function useSSE(options: UseSSEOptions = {}): UseSSEResult {
  const { onChunk, onDone, onError } = options;

  const [content, setContent] = useState('');
  const [streaming, setStreaming] = useState(false);
  const esRef = useRef<EventSource | null>(null);
  const accRef = useRef('');  // accumulated text, kept in sync with state

  const stop = () => {
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }
    setStreaming(false);
  };

  const reset = () => {
    accRef.current = '';
    setContent('');
  };

  const start = (url: string) => {
    stop();   // close any existing connection
    reset();
    setStreaming(true);

    const es = new EventSource(url);
    esRef.current = es;

    es.onmessage = (event: MessageEvent<string>) => {
      const data: string = event.data;

      if (data === '[DONE]') {
        stop();
        onDone?.(accRef.current);
        return;
      }

      accRef.current += data;
      setContent(accRef.current);
      onChunk?.(data);
    };

    es.onerror = (event) => {
      stop();
      onError?.(event);
    };
  };

  // Clean up on unmount
  useEffect(() => {
    return () => {
      esRef.current?.close();
    };
  }, []);

  return { content, streaming, start, stop, reset };
}
