import React, { useRef, useEffect } from 'react';

interface StreamingOutputProps {
  text: string;
}

export function StreamingOutput({ text }: StreamingOutputProps) {
  const containerRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [text]);

  return (
    <pre
      ref={containerRef}
      className="text-xs text-zinc-400 bg-zinc-800 rounded p-3 overflow-x-auto max-h-[200px] overflow-y-auto whitespace-pre-wrap font-mono"
    >
      {text}
      <span className="inline-block w-1.5 h-3.5 bg-indigo-500 animate-pulse ml-0.5" />
    </pre>
  );
}
