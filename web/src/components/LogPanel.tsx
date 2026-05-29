'use client';

import { useEffect, useRef } from 'react';
import { LogLine } from '@/lib/types';

interface Props {
  logs: LogLine[];
  running: boolean;
}

const typeStyles: Record<LogLine['type'], string> = {
  info: 'text-cyan-400',
  success: 'text-green-400',
  warn: 'text-yellow-400',
  error: 'text-red-400',
  dim: 'text-slate-500',
  step: 'text-white font-bold',
};

const typePrefix: Record<LogLine['type'], string> = {
  info: 'ℹ ',
  success: '✓ ',
  warn: '⚠ ',
  error: '✗ ',
  dim: '  ',
  step: '▶ ',
};

export default function LogPanel({ logs, running }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  return (
    <div className="bg-slate-900 rounded-lg border border-slate-700 p-3 h-48 overflow-y-auto font-mono text-xs">
      {logs.length === 0 && !running && (
        <p className="text-slate-600 italic">Aguardando execução...</p>
      )}
      {logs.map((line, i) => (
        <div key={i} className={`leading-5 ${typeStyles[line.type]}`}>
          <span className="select-none">{typePrefix[line.type]}</span>
          {line.text}
        </div>
      ))}
      {running && (
        <div className="text-violet-400 animate-pulse">● executando...</div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}
