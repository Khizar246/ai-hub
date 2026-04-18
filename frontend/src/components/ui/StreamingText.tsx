// Renders text that grows token-by-token; shows blinking cursor while streaming.

interface StreamingTextProps {
  /** The accumulated text so far. Grows as tokens arrive. */
  text: string;
  /** Whether more tokens are still incoming. Shows cursor when true. */
  streaming: boolean;
  className?: string;
}

export default function StreamingText({
  text,
  streaming,
  className = '',
}: StreamingTextProps) {
  return (
    <span
      className={[
        'whitespace-pre-wrap text-sm leading-relaxed font-medium',
        streaming ? 'streaming-cursor' : '',
        className,
      ].join(' ')}
    >
      {text}
    </span>
  );
}
