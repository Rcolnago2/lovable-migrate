'use client';

import { useState } from 'react';
import { MigrationConfig } from '@/lib/types';

interface Props {
  initial: MigrationConfig;
  onSave: (cfg: MigrationConfig) => void;
}

function isSupabaseConnected(cfg: MigrationConfig) {
  return !!(cfg.supabaseUrl && cfg.supabaseServiceRoleKey && cfg.supabaseAnonKey && cfg.supabaseDbConnection);
}
function isGithubConnected(cfg: MigrationConfig) {
  return !!(cfg.githubRepo && cfg.githubToken);
}
function isVercelConnected(cfg: MigrationConfig) {
  return !!cfg.vercelToken;
}

interface ServiceCardProps {
  icon: string;
  name: string;
  connected: boolean;
  dashboardUrl?: string;
  dashboardLabel?: string;
  children: React.ReactNode;
}

function ServiceCard({ icon, name, connected, dashboardUrl, dashboardLabel, children }: ServiceCardProps) {
  return (
    <div className={`rounded-xl border p-5 transition-colors ${
      connected ? 'border-green-700/60 bg-slate-800/40' : 'border-slate-700 bg-slate-800/40'
    }`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-xl">{icon}</span>
          <span className="font-semibold text-slate-100">{name}</span>
          {connected ? (
            <span className="ml-1 px-2 py-0.5 rounded-full bg-green-900/50 border border-green-700/50 text-green-400 text-xs font-medium">
              ✓ Conectado
            </span>
          ) : (
            <span className="ml-1 px-2 py-0.5 rounded-full bg-slate-700/50 border border-slate-600/50 text-slate-400 text-xs font-medium">
              Não conectado
            </span>
          )}
        </div>
        {dashboardUrl && (
          <a
            href={dashboardUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-medium transition-colors"
          >
            <span>↗</span>
            {dashboardLabel || 'Abrir Dashboard'}
          </a>
        )}
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

interface FieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  hint: string;
  secret?: boolean;
  mono?: boolean;
}

function Field({ label, value, onChange, placeholder, hint, secret, mono }: FieldProps) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label className="block text-xs font-medium text-slate-400 mb-1">{label}</label>
      <div className="relative">
        <input
          type={secret && !show ? 'password' : 'text'}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete="off"
          className={`w-full rounded-lg bg-slate-900 border border-slate-600 text-slate-100 placeholder-slate-600 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 ${mono ? 'font-mono' : ''} ${secret ? 'pr-10' : ''}`}
        />
        {secret && (
          <button
            type="button"
            onClick={() => setShow(s => !s)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs px-1"
          >
            {show ? 'ocultar' : 'ver'}
          </button>
        )}
      </div>
      <p className="text-xs text-slate-600 mt-1">{hint}</p>
    </div>
  );
}

export default function ConfigForm({ initial, onSave }: Props) {
  const [cfg, setCfg] = useState<MigrationConfig>(initial);
  const [saved, setSaved] = useState(false);

  function set(key: keyof MigrationConfig, value: string) {
    setCfg(prev => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSave(cfg);
    setSaved(true);
  }

  const supabaseSettingsUrl = cfg.supabaseUrl
    ? `${cfg.supabaseUrl.replace(/\/$/, '')}/project/default/settings/api`
    : 'https://supabase.com/dashboard';

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Supabase */}
      <ServiceCard
        icon="⚡"
        name="Supabase"
        connected={isSupabaseConnected(cfg)}
        dashboardUrl={supabaseSettingsUrl}
        dashboardLabel="Abrir Settings → API"
      >
        <Field
          label="Project URL"
          value={cfg.supabaseUrl}
          onChange={v => set('supabaseUrl', v)}
          placeholder="https://xxxxxxxxxxxx.supabase.co"
          hint="Supabase Dashboard → Settings → API → Project URL"
          mono
        />
        <Field
          label="Service Role Key"
          value={cfg.supabaseServiceRoleKey}
          onChange={v => set('supabaseServiceRoleKey', v)}
          placeholder="eyJhbGci..."
          hint="Settings → API → Project API keys → service_role (usado para migração)"
          secret
          mono
        />
        <Field
          label="Anon Key"
          value={cfg.supabaseAnonKey}
          onChange={v => set('supabaseAnonKey', v)}
          placeholder="eyJhbGci..."
          hint="Settings → API → Project API keys → anon (vai para o .env do app)"
          secret
          mono
        />
        <Field
          label="Database Connection String"
          value={cfg.supabaseDbConnection}
          onChange={v => set('supabaseDbConnection', v)}
          placeholder="postgresql://postgres:SENHA@db.xxxx.supabase.co:5432/postgres"
          hint="Settings → Database → Connection string → URI"
          secret
          mono
        />
      </ServiceCard>

      {/* GitHub */}
      <ServiceCard
        icon="🐙"
        name="GitHub"
        connected={isGithubConnected(cfg)}
        dashboardUrl="https://github.com/settings/tokens/new?scopes=repo&description=lovable-migrate"
        dashboardLabel="Criar Token (PAT)"
      >
        <Field
          label="Repositório"
          value={cfg.githubRepo}
          onChange={v => set('githubRepo', v)}
          placeholder="usuario/repositorio"
          hint="Ex: joao/meu-app-lovable — o repo que contém as migrations SQL"
          mono
        />
        <Field
          label="Personal Access Token"
          value={cfg.githubToken}
          onChange={v => set('githubToken', v)}
          placeholder="ghp_xxxx"
          hint="GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic) com escopo repo"
          secret
          mono
        />
      </ServiceCard>

      {/* Vercel */}
      <ServiceCard
        icon="▲"
        name="Vercel"
        connected={isVercelConnected(cfg)}
        dashboardUrl="https://vercel.com/account/tokens"
        dashboardLabel="Criar Token"
      >
        <Field
          label="Access Token"
          value={cfg.vercelToken}
          onChange={v => set('vercelToken', v)}
          placeholder="xxxxxxxxxxxxxxxxxxxxxxxx"
          hint="Vercel → Settings → Tokens → Create Token (Full Account scope)"
          secret
          mono
        />
      </ServiceCard>

      <div className="pt-1 flex items-center gap-3">
        <button
          type="submit"
          className="px-5 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold transition-colors"
        >
          Salvar e continuar →
        </button>
        {saved && (
          <span className="text-green-400 text-sm flex items-center gap-1">
            ✓ Salvo
          </span>
        )}
      </div>

      <p className="text-xs text-slate-600">
        🔒 Credenciais ficam apenas neste navegador (localStorage). Nunca são enviadas a servidores externos.
      </p>
    </form>
  );
}
