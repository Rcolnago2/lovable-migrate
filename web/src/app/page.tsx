'use client';

import { useState, useEffect, useCallback } from 'react';
import { MigrationConfig, StepState, StepStatus, LogLine } from '@/lib/types';
import ConfigForm from '@/components/ConfigForm';
import StepCard from '@/components/StepCard';

const STEPS: Array<{ id: number; title: string; description: string }> = [
  { id: 1, title: 'Exportar schema', description: 'Clona ou atualiza o repositório GitHub e lista as migrations SQL.' },
  { id: 2, title: 'Aplicar schema', description: 'Executa as migrations SQL no Supabase destino (idempotente).' },
  { id: 3, title: 'Instruções: exportar usuários', description: 'Exibe a query para exportar auth.users do Lovable.' },
  { id: 4, title: 'Importar usuários', description: 'Importa usuários via Supabase Admin API preservando hashes de senha.' },
  { id: 5, title: 'Instruções: exportar tabelas', description: 'Exibe como exportar tabelas do Lovable Table Editor.' },
  { id: 6, title: 'Importar tabelas', description: 'Importa CSVs das tabelas respeitando ordem de FK (ON CONFLICT DO NOTHING).' },
  { id: 7, title: 'Gerar .env atualizado', description: 'Gera o conteúdo do .env com as novas variáveis Supabase para download.' },
];

const EMPTY_CONFIG: MigrationConfig = {
  supabaseUrl: '',
  supabaseServiceRoleKey: '',
  supabaseDbConnection: '',
  githubRepo: '',
  githubToken: '',
};

const CONFIG_KEY = 'lovable_migrator_config';

function initSteps(): StepState[] {
  return STEPS.map(s => ({ ...s, status: 'idle' as StepStatus, logs: [] }));
}

async function fetchStep(
  id: number,
  config: MigrationConfig,
  extra: Record<string, unknown>,
  onLine: (line: LogLine) => void,
): Promise<{ ok: boolean; result?: unknown }> {
  const res = await fetch(`/api/step/${id}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ config, ...extra }),
  });

  if (!res.body) return { ok: false };

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let hadError = false;
  let result: unknown;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split('\n\n');
    buffer = parts.pop() || '';
    for (const part of parts) {
      const raw = part.replace(/^data: /, '').trim();
      if (!raw) continue;
      try {
        const parsed = JSON.parse(raw);
        if (parsed.type === 'done') { result = parsed.result; }
        else if (parsed.type === 'error') { onLine({ type: 'error', text: parsed.text }); hadError = true; }
        else { onLine(parsed as LogLine); }
      } catch {}
    }
  }

  return { ok: !hadError, result };
}

export default function Home() {
  const [config, setConfig] = useState<MigrationConfig>(EMPTY_CONFIG);
  const [steps, setSteps] = useState<StepState[]>(initSteps());
  const [tab, setTab] = useState<'config' | 'migrate'>('config');
  const [running, setRunning] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(CONFIG_KEY);
      if (saved) setConfig(JSON.parse(saved));
    } catch {}
  }, []);

  function saveConfig(cfg: MigrationConfig) {
    setConfig(cfg);
    try { localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg)); } catch {}
    setTab('migrate');
  }

  function updateStatus(id: number, status: StepStatus) {
    setSteps(prev => prev.map(s => s.id === id ? { ...s, status } : s));
  }

  function updateLogs(id: number, logs: LogLine[]) {
    setSteps(prev => prev.map(s => s.id === id ? { ...s, logs } : s));
  }

  const runAll = useCallback(async () => {
    if (running) return;
    setRunning(true);

    for (const step of STEPS) {
      if (step.id === 4 || step.id === 6) {
        updateStatus(step.id, 'skipped');
        updateLogs(step.id, [{ type: 'warn', text: 'Execute este passo individualmente após fazer upload do CSV.' }]);
        continue;
      }

      updateStatus(step.id, 'running');
      const lines: LogLine[] = [];
      updateLogs(step.id, lines);

      const { ok } = await fetchStep(step.id, config, {}, (line) => {
        lines.push(line);
        updateLogs(step.id, [...lines]);
      });

      updateStatus(step.id, ok ? 'done' : 'error');
      if (!ok) break;
    }

    setRunning(false);
  }, [config, running]);

  const configComplete = !!(config.supabaseUrl && config.supabaseServiceRoleKey);
  const doneCount = steps.filter(s => s.status === 'done').length;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      {/* Header */}
      <header className="border-b border-slate-700 bg-slate-900/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xl">🚀</span>
            <div>
              <h1 className="text-sm font-bold text-slate-100">Lovable → Supabase Migrator</h1>
              <p className="text-xs text-slate-500">v1.0.0</p>
            </div>
          </div>
          <nav className="flex gap-1">
            {(['config', 'migrate'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  tab === t
                    ? 'bg-violet-700 text-white'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                {t === 'config' ? '⚙ Configuração' : '▶ Migração'}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* Config tab */}
        {tab === 'config' && (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-bold text-slate-100">Configuração</h2>
              <p className="text-sm text-slate-400 mt-1">
                Informe as credenciais do projeto Lovable (origem) e do Supabase (destino).
              </p>
            </div>
            <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-5">
              <ConfigForm initial={config} onSave={saveConfig} />
            </div>
          </div>
        )}

        {/* Migrate tab */}
        {tab === 'migrate' && (
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-100">Migração</h2>
                <p className="text-sm text-slate-400 mt-1">
                  {doneCount}/{STEPS.length} passos concluídos
                </p>
              </div>
              <button
                onClick={runAll}
                disabled={running || !configComplete}
                className="shrink-0 px-4 py-2 rounded-lg bg-violet-700 hover:bg-violet-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors"
              >
                {running ? '⏳ Executando...' : '🚀 Migração completa'}
              </button>
            </div>

            {!configComplete && (
              <div className="bg-yellow-900/30 border border-yellow-700/50 rounded-lg px-4 py-3 text-sm text-yellow-400">
                ⚠ Configure as credenciais na aba{' '}
                <button onClick={() => setTab('config')} className="underline font-semibold">
                  Configuração
                </button>{' '}
                antes de prosseguir.
              </div>
            )}

            <div className="space-y-3">
              {steps.map(step => (
                <StepCard
                  key={step.id}
                  id={step.id}
                  title={step.title}
                  description={step.description}
                  status={step.status}
                  logs={step.logs}
                  config={config}
                  onStatusChange={updateStatus}
                  onLogsChange={updateLogs}
                />
              ))}
            </div>

            <div className="flex flex-wrap gap-4 text-xs text-slate-500 pt-2">
              <span><span className="text-green-400">✓</span> Concluído</span>
              <span><span className="text-red-400">✗</span> Erro</span>
              <span><span className="text-violet-400">◌</span> Executando</span>
              <span><span className="text-slate-400">⊘</span> Pulado (requer CSV)</span>
            </div>
          </div>
        )}
      </main>

      <footer className="border-t border-slate-800 mt-16 py-6">
        <p className="text-center text-xs text-slate-600">
          Dados processados localmente — nenhuma credencial é enviada a servidores externos.
        </p>
      </footer>
    </div>
  );
}
