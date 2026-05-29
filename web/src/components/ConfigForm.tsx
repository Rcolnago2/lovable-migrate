'use client';

import { useState } from 'react';
import { MigrationConfig } from '@/lib/types';

interface Props {
  initial: MigrationConfig;
  onSave: (cfg: MigrationConfig) => void;
}

const fields: Array<{ key: keyof MigrationConfig; label: string; placeholder: string; secret?: boolean; hint: string }> = [
  { key: 'supabaseUrl', label: 'Supabase URL', placeholder: 'https://xxxx.supabase.co', hint: 'Supabase → Settings → API' },
  { key: 'supabaseServiceRoleKey', label: 'Service Role Key', placeholder: 'eyJhbGci...', secret: true, hint: 'Supabase → Settings → API → service_role' },
  { key: 'supabaseDbConnection', label: 'DB Connection String', placeholder: 'postgresql://postgres:SENHA@db.xxxx.supabase.co:5432/postgres', secret: true, hint: 'Supabase → Settings → Database → Connection string' },
  { key: 'githubRepo', label: 'GitHub Repo', placeholder: 'usuario/repositorio', hint: 'Ex: joao/meu-app-lovable' },
  { key: 'githubToken', label: 'GitHub Token', placeholder: 'ghp_xxxx', secret: true, hint: 'GitHub → Settings → Developer settings → PAT (read:repo)' },
];

export default function ConfigForm({ initial, onSave }: Props) {
  const [cfg, setCfg] = useState<MigrationConfig>(initial);
  const [saved, setSaved] = useState(false);

  function handleChange(key: keyof MigrationConfig, value: string) {
    setCfg(prev => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSave(cfg);
    setSaved(true);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {fields.map(f => (
        <div key={f.key}>
          <label className="block text-sm font-medium text-slate-300 mb-1">
            {f.label}
          </label>
          <input
            type={f.secret ? 'password' : 'text'}
            value={cfg[f.key]}
            onChange={e => handleChange(f.key, e.target.value)}
            placeholder={f.placeholder}
            className="w-full rounded-lg bg-slate-800 border border-slate-600 text-slate-100 placeholder-slate-500 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 font-mono"
            autoComplete="off"
          />
          <p className="text-xs text-slate-500 mt-1">{f.hint}</p>
        </div>
      ))}

      <div className="pt-2 flex items-center gap-3">
        <button
          type="submit"
          className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold transition-colors"
        >
          Salvar configuração
        </button>
        {saved && (
          <span className="text-green-400 text-sm flex items-center gap-1">
            <span>✓</span> Salvo (apenas neste navegador)
          </span>
        )}
      </div>

      <p className="text-xs text-slate-500 pt-1">
        🔒 Credenciais ficam apenas neste navegador (localStorage). Nunca são enviadas para servidores externos.
      </p>
    </form>
  );
}
