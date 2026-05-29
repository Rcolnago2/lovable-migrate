'use client';

import { useState } from 'react';
import { StepStatus, LogLine, MigrationConfig } from '@/lib/types';
import LogPanel from './LogPanel';
import CsvUpload from './CsvUpload';

interface Props {
  id: number;
  title: string;
  description: string;
  status: StepStatus;
  logs: LogLine[];
  config: MigrationConfig;
  onStatusChange: (id: number, status: StepStatus) => void;
  onLogsChange: (id: number, logs: LogLine[]) => void;
  // Step 7 result callback
  onEnvResult?: (content: string) => void;
}

async function runStep(
  id: number,
  cfg: MigrationConfig,
  extra: { csvContent?: string; csvFiles?: Array<{ name: string; content: string }> },
  onLine: (line: LogLine) => void,
  onDone: (result: unknown) => void,
  onError: (msg: string) => void
) {
  const res = await fetch(`/api/step/${id}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ config: cfg, ...extra }),
  });

  if (!res.body) { onError('Sem resposta do servidor'); return; }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split('\n\n');
    buffer = parts.pop() || '';
    for (const part of parts) {
      const line = part.replace(/^data: /, '').trim();
      if (!line) continue;
      try {
        const parsed = JSON.parse(line);
        if (parsed.type === 'done') { onDone(parsed.result); }
        else if (parsed.type === 'error') { onError(parsed.text); }
        else { onLine(parsed as LogLine); }
      } catch {}
    }
  }
}

export default function StepCard({
  id, title, description, status, logs, config,
  onStatusChange, onLogsChange, onEnvResult,
}: Props) {
  const [csvContent, setCsvContent] = useState<string>('');
  const [csvFiles, setCsvFiles] = useState<Array<{ name: string; content: string }>>([]);
  const [csvLoaded, setCsvLoaded] = useState<Array<{ name: string; content: string }>>([]);
  const [envContent, setEnvContent] = useState<string>('');

  const isRunning = status === 'running';

  const statusIcon: Record<StepStatus, string> = {
    idle: '○',
    running: '◌',
    done: '✓',
    error: '✗',
    skipped: '⊘',
  };

  const statusColor: Record<StepStatus, string> = {
    idle: 'text-slate-500',
    running: 'text-violet-400 animate-pulse',
    done: 'text-green-400',
    error: 'text-red-400',
    skipped: 'text-slate-500',
  };

  async function handleRun() {
    onStatusChange(id, 'running');
    onLogsChange(id, []);

    const lines: LogLine[] = [];
    function addLine(line: LogLine) {
      lines.push(line);
      onLogsChange(id, [...lines]);
    }

    await runStep(
      id, config,
      { csvContent: id === 4 ? csvContent : undefined, csvFiles: id === 6 ? csvFiles : undefined },
      addLine,
      (result) => {
        onStatusChange(id, 'done');
        if (id === 7 && typeof result === 'string') {
          setEnvContent(result);
          onEnvResult?.(result);
        }
      },
      (msg) => {
        addLine({ type: 'error', text: msg });
        onStatusChange(id, 'error');
      }
    );
  }

  return (
    <div className={`rounded-xl border p-4 transition-colors ${
      status === 'running' ? 'border-violet-500 bg-slate-800/60' :
      status === 'done' ? 'border-green-700/60 bg-slate-800/40' :
      status === 'error' ? 'border-red-700/60 bg-slate-800/40' :
      'border-slate-700 bg-slate-800/40'
    }`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <span className={`text-xl font-bold mt-0.5 ${statusColor[status]}`}>
            {statusIcon[status]}
          </span>
          <div>
            <h3 className="text-sm font-semibold text-slate-100">
              <span className="text-slate-500 mr-1">{id}.</span>{title}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">{description}</p>
          </div>
        </div>
        <button
          onClick={handleRun}
          disabled={isRunning}
          className="shrink-0 px-3 py-1.5 rounded-lg bg-violet-700 hover:bg-violet-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold transition-colors"
        >
          {isRunning ? 'Executando...' : status === 'done' ? 'Re-executar' : 'Executar'}
        </button>
      </div>

      {id === 4 && (
        <CsvUpload
          label="Faça upload do auth_users.csv"
          onLoad={files => { setCsvContent(files[0]?.content || ''); setCsvLoaded(files); }}
          loaded={csvLoaded}
        />
      )}

      {id === 6 && (
        <CsvUpload
          label="Faça upload dos CSVs das tabelas (vários arquivos)"
          multiple
          onLoad={files => { setCsvFiles(files); setCsvLoaded(files); }}
          loaded={csvLoaded}
        />
      )}

      {logs.length > 0 && (
        <div className="mt-3">
          <LogPanel logs={logs} running={isRunning} />
        </div>
      )}

      {id === 7 && envContent && (
        <div className="mt-3 space-y-2">
          <p className="text-xs text-slate-400 font-semibold">Conteúdo do .env gerado:</p>
          <pre className="bg-slate-900 rounded p-3 text-xs text-green-300 font-mono overflow-x-auto whitespace-pre-wrap">
            {envContent}
          </pre>
          <button
            onClick={() => {
              const blob = new Blob([envContent], { type: 'text/plain' });
              const a = document.createElement('a');
              a.href = URL.createObjectURL(blob);
              a.download = '.env.migrated';
              a.click();
            }}
            className="px-3 py-1.5 rounded-lg bg-green-700 hover:bg-green-600 text-white text-xs font-semibold transition-colors"
          >
            ⬇ Download .env.migrated
          </button>
        </div>
      )}
    </div>
  );
}
