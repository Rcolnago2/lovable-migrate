import { MigrationConfig, LogLine } from './types';

type Emit = (line: LogLine) => void;

function info(emit: Emit, text: string) { emit({ type: 'info', text }); }
function success(emit: Emit, text: string) { emit({ type: 'success', text }); }
function warn(emit: Emit, text: string) { emit({ type: 'warn', text }); }
function error(emit: Emit, text: string) { emit({ type: 'error', text }); }
function dim(emit: Emit, text: string) { emit({ type: 'dim', text }); }

// ── Step 1: Clone / pull repo ─────────────────────────────────────────────────

export async function runStep1(cfg: MigrationConfig, emit: Emit) {
  const simpleGit = (await import('simple-git')).default;
  const fs = await import('fs');
  const path = await import('path');

  const repoPath = '/tmp/lovable-repo';
  const { githubRepo, githubToken } = cfg;

  if (!githubRepo) { warn(emit, 'LOVABLE_GITHUB_REPO não configurado'); return null; }

  const gitDir = path.join(repoPath, '.git');
  if (fs.existsSync(gitDir)) {
    info(emit, 'Repositório já existe — executando git pull...');
    const git = simpleGit(repoPath);
    await git.pull();
    success(emit, 'Repositório atualizado');
  } else {
    const cloneUrl = githubToken
      ? `https://${githubToken}@github.com/${githubRepo}.git`
      : `https://github.com/${githubRepo}.git`;
    info(emit, `Clonando ${githubRepo}...`);
    fs.mkdirSync('/tmp', { recursive: true });
    const git = simpleGit();
    await git.clone(cloneUrl, repoPath);
    success(emit, 'Repositório clonado');
  }

  const migrationsPath = path.join(repoPath, 'supabase', 'migrations');
  if (!fs.existsSync(migrationsPath)) {
    warn(emit, 'Pasta supabase/migrations não encontrada');
    return null;
  }

  const files = fs.readdirSync(migrationsPath).filter((f: string) => f.endsWith('.sql')).sort();
  success(emit, `${files.length} migration(s) encontrada(s):`);
  for (const f of files) dim(emit, f);
  return { migrationsPath, files };
}

// ── Step 2: Push schema ───────────────────────────────────────────────────────

export async function runStep2(cfg: MigrationConfig, emit: Emit) {
  const pg = (await import('pg')).default;
  const fs = await import('fs');
  const path = await import('path');

  const migrationsPath = '/tmp/lovable-repo/supabase/migrations';
  if (!fs.existsSync(migrationsPath)) {
    warn(emit, 'Pasta de migrations não encontrada — execute o Passo 1 primeiro');
    return;
  }

  const files = fs.readdirSync(migrationsPath).filter((f: string) => f.endsWith('.sql')).sort();
  if (files.length === 0) { warn(emit, 'Nenhum .sql encontrado'); return; }

  const client = new pg.Client({ connectionString: cfg.supabaseDbConnection, ssl: { rejectUnauthorized: false } });
  info(emit, 'Conectando ao banco...');
  await client.connect();
  success(emit, 'Conectado');

  await client.query(`
    CREATE SCHEMA IF NOT EXISTS supabase_migrations;
    CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations (
      version text NOT NULL PRIMARY KEY,
      statements text[],
      name text
    );
  `);

  let applied = 0, skipped = 0, errors = 0;
  for (const file of files) {
    const version = file.split('_')[0];
    const { rows } = await client.query(
      'SELECT version FROM supabase_migrations.schema_migrations WHERE version = $1',
      [version]
    );
    if (rows.length > 0) { dim(emit, `Já aplicada: ${file}`); skipped++; continue; }

    const sql = fs.readFileSync(path.join(migrationsPath, file), 'utf8');
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES ($1, $2)', [version, file]);
      await client.query('COMMIT');
      success(emit, `Aplicada: ${file}`);
      applied++;
    } catch (err: unknown) {
      await client.query('ROLLBACK').catch(() => {});
      error(emit, `Erro em ${file}: ${(err as Error).message}`);
      errors++;
    }
  }
  await client.end();
  info(emit, `Resumo: ${applied} aplicadas, ${skipped} já existiam, ${errors} erros`);
}

// ── Step 3: Show export instructions ─────────────────────────────────────────

export async function runStep3(_cfg: MigrationConfig, emit: Emit) {
  info(emit, 'Siga as instruções na tela para exportar os usuários do Lovable:');
  dim(emit, '1. Acesse seu projeto Lovable → Cloud → Database → SQL Editor');
  dim(emit, '2. Execute: SELECT id, email, encrypted_password, raw_user_meta_data, created_at FROM auth.users;');
  dim(emit, '3. Clique em "Export CSV" e faça upload no campo abaixo (Passo 4)');
  success(emit, 'Instruções exibidas');
}

// ── Step 4: Import users ──────────────────────────────────────────────────────

export async function runStep4(cfg: MigrationConfig, emit: Emit, csvContent: string) {
  const { createClient } = await import('@supabase/supabase-js');
  const { parse } = await import('csv-parse/sync');

  if (!csvContent) { warn(emit, 'Nenhum CSV de usuários fornecido'); return; }

  let rows: Record<string, string>[];
  try {
    rows = parse(csvContent, { columns: true, delimiter: ';', skip_empty_lines: true }) as Record<string, string>[];
    if (rows.length === 0 || !rows[0]?.email) {
      rows = parse(csvContent, { columns: true, delimiter: ',', skip_empty_lines: true }) as Record<string, string>[];
    }
  } catch {
    rows = parse(csvContent, { columns: true, delimiter: ',', skip_empty_lines: true }) as Record<string, string>[];
  }

  info(emit, `${rows.length} usuário(s) no CSV`);

  const supabase = createClient(cfg.supabaseUrl, cfg.supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let imported = 0, skipped = 0, errors = 0;
  for (const row of rows) {
    if (!row.id || !row.email) continue;
    let metadata = {};
    try { if (row.raw_user_meta_data) metadata = JSON.parse(row.raw_user_meta_data); } catch {}

    const { error: err } = await supabase.auth.admin.createUser({
      id: row.id,
      email: row.email,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...(row.encrypted_password ? { password_hash: row.encrypted_password } as any : {}),
      user_metadata: metadata,
      email_confirm: true,
    });

    if (err) {
      const msg = err.message || '';
      if (msg.includes('already') || (err as { code?: string }).code === '23505') { skipped++; }
      else { error(emit, `${row.email}: ${msg}`); errors++; }
    } else { imported++; }
  }
  info(emit, `Resumo: ${imported} importados, ${skipped} já existiam, ${errors} erros`);
}

// ── Step 5: Show table export instructions ────────────────────────────────────

export async function runStep5(_cfg: MigrationConfig, emit: Emit) {
  info(emit, 'Siga as instruções para exportar as tabelas do Lovable:');
  dim(emit, '1. Acesse seu projeto Lovable → Cloud → Database → Table Editor');
  dim(emit, '2. Para cada tabela: clique → Export → CSV');
  dim(emit, '3. Renomeie cada arquivo como: nome_tabela.csv');
  dim(emit, '4. Faça upload de todos os CSVs no campo do Passo 6');
  success(emit, 'Instruções exibidas');
}

// ── Step 6: Import tables ─────────────────────────────────────────────────────

export async function runStep6(
  cfg: MigrationConfig,
  emit: Emit,
  csvFiles: Array<{ name: string; content: string }>
) {
  const pg = (await import('pg')).default;
  const { parse } = await import('csv-parse/sync');
  const { sortTablesByFKDependency, getFKDependencies } = await import('./fk-sorter');

  if (!csvFiles || csvFiles.length === 0) {
    warn(emit, 'Nenhum CSV de tabela fornecido');
    return;
  }

  const client = new pg.Client({ connectionString: cfg.supabaseDbConnection, ssl: { rejectUnauthorized: false } });
  info(emit, 'Conectando ao banco...');
  await client.connect();
  success(emit, 'Conectado');

  let fkMap = {};
  try { fkMap = await getFKDependencies(client); } catch {}

  const tableNames = csvFiles.map(f => f.name.replace(/\.csv$/i, ''));
  const ordered = sortTablesByFKDependency(tableNames, fkMap);
  info(emit, `Ordem: ${ordered.join(' → ')}`);

  let totalInserted = 0, totalErrors = 0;

  for (const tableName of ordered) {
    const csvFile = csvFiles.find(f => f.name.replace(/\.csv$/i, '') === tableName);
    if (!csvFile) continue;

    let rows: Record<string, string>[];
    try {
      rows = parse(csvFile.content, { columns: true, delimiter: ';', skip_empty_lines: true }) as Record<string, string>[];
      if (rows.length === 0 || Object.keys(rows[0] || {}).length <= 1) {
        rows = parse(csvFile.content, { columns: true, delimiter: ',', skip_empty_lines: true }) as Record<string, string>[];
      }
    } catch {
      rows = parse(csvFile.content, { columns: true, delimiter: ',', skip_empty_lines: true }) as Record<string, string>[];
    }

    if (rows.length === 0) { dim(emit, `${tableName}: vazio, pulando`); continue; }

    const columns = Object.keys(rows[0]);
    const quotedCols = columns.map((c: string) => `"${c}"`).join(', ');
    const placeholders = columns.map((_: string, i: number) => `$${i + 1}`).join(', ');
    const sql = `INSERT INTO public."${tableName}" (${quotedCols}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`;

    let inserted = 0, errors = 0;
    for (const row of rows) {
      const values = columns.map((c: string) => {
        const v = row[c];
        return v === '' || v === undefined ? null : v;
      });
      try { await client.query(sql, values); inserted++; }
      catch { errors++; }
    }

    if (errors > 0) warn(emit, `${tableName}: ${inserted} ok, ${errors} erros`);
    else success(emit, `${tableName}: ${inserted} linhas importadas`);
    totalInserted += inserted;
    totalErrors += errors;
  }

  await client.end();
  info(emit, `Total: ${totalInserted} linhas inseridas, ${totalErrors} erros`);
}

// ── Step 7: Deploy to Vercel ──────────────────────────────────────────────────

export async function runStep7(cfg: MigrationConfig, emit: Emit): Promise<string | null> {
  const { vercelToken, githubRepo, supabaseUrl, supabaseAnonKey } = cfg;

  if (!vercelToken) { warn(emit, 'Vercel Token não configurado'); return null; }
  if (!githubRepo) { warn(emit, 'GitHub Repo não configurado'); return null; }
  if (!supabaseUrl) { warn(emit, 'Supabase URL não configurada'); return null; }

  const [owner, repo] = githubRepo.split('/');
  if (!owner || !repo) { warn(emit, 'GitHub Repo deve estar no formato usuario/repositorio'); return null; }

  const headers = {
    'Authorization': `Bearer ${vercelToken}`,
    'Content-Type': 'application/json',
  };

  // Check if project already exists
  info(emit, `Verificando projeto Vercel "${repo}"...`);
  const checkRes = await fetch(`https://api.vercel.com/v9/projects/${repo}`, { headers });

  let projectId: string;
  let projectUrl: string;

  if (checkRes.ok) {
    const existing = await checkRes.json() as { id: string; name: string };
    projectId = existing.id;
    projectUrl = `https://${repo}.vercel.app`;
    info(emit, `Projeto existente encontrado: ${existing.name}`);
  } else {
    // Create project linked to GitHub
    info(emit, `Criando projeto Vercel "${repo}"...`);
    const createRes = await fetch('https://api.vercel.com/v10/projects', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: repo,
        framework: 'nextjs',
        gitRepository: {
          type: 'github',
          repo: githubRepo,
        },
      }),
    });

    if (!createRes.ok) {
      const err = await createRes.json() as { error?: { message?: string } };
      error(emit, `Erro ao criar projeto: ${err?.error?.message || createRes.statusText}`);
      return null;
    }

    const created = await createRes.json() as { id: string; name: string };
    projectId = created.id;
    projectUrl = `https://${repo}.vercel.app`;
    success(emit, `Projeto criado: ${created.name}`);
  }

  // Set environment variables
  info(emit, 'Configurando variáveis de ambiente...');
  const match = supabaseUrl.match(/https:\/\/([a-z0-9]+)\.supabase\.co/);
  const projectRef = match ? match[1] : '';

  const envVars = [
    { key: 'VITE_SUPABASE_URL', value: supabaseUrl },
    { key: 'VITE_SUPABASE_ANON_KEY', value: supabaseAnonKey || '' },
    { key: 'NEXT_PUBLIC_SUPABASE_URL', value: supabaseUrl },
    { key: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', value: supabaseAnonKey || '' },
    ...(projectRef ? [{ key: 'VITE_SUPABASE_PROJECT_ID', value: projectRef }] : []),
  ].filter(v => v.value);

  const envRes = await fetch(`https://api.vercel.com/v10/projects/${projectId}/env`, {
    method: 'POST',
    headers,
    body: JSON.stringify(envVars.map(v => ({
      key: v.key,
      value: v.value,
      type: 'plain',
      target: ['production', 'preview', 'development'],
    }))),
  });

  if (envRes.ok) {
    success(emit, `${envVars.length} variáveis configuradas`);
    for (const v of envVars) dim(emit, `  ${v.key}`);
  } else {
    warn(emit, 'Algumas variáveis podem já existir — continuando...');
  }

  // Trigger deployment
  info(emit, 'Disparando deployment...');
  const deployRes = await fetch('https://api.vercel.com/v13/deployments', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name: repo,
      gitSource: {
        type: 'github',
        repoId: githubRepo,
        ref: 'main',
      },
      projectId,
    }),
  });

  if (!deployRes.ok) {
    const err = await deployRes.json() as { error?: { message?: string } };
    warn(emit, `Deploy automático falhou: ${err?.error?.message || deployRes.statusText}`);
    warn(emit, 'Acesse o painel do Vercel para fazer deploy manualmente.');
  } else {
    const deploy = await deployRes.json() as { url?: string; id?: string };
    success(emit, `Deployment iniciado: https://${deploy.url || projectUrl}`);
  }

  success(emit, `Projeto disponível em: ${projectUrl}`);
  info(emit, 'Acesse o painel Vercel para acompanhar o status do deployment.');

  return projectUrl;
}
