import path from 'path';
import fs from 'fs';
import ora from 'ora';
import { log } from '../utils/logger.js';
import { getPgClient } from '../utils/supabase.js';

export async function pushSchema() {
  log.step(2, 'Aplicar schema no Supabase destino');

  const repoPath = process.env.LOCAL_REPO_PATH || './repo-clonado';
  const migrationsPath = path.join(repoPath, 'supabase', 'migrations');

  if (!fs.existsSync(migrationsPath)) {
    log.warn('Pasta de migrations não encontrada. Execute o Passo 1 primeiro.');
    return;
  }

  const files = fs.readdirSync(migrationsPath)
    .filter(f => f.endsWith('.sql'))
    .sort();

  if (files.length === 0) {
    log.warn('Nenhum arquivo .sql encontrado na pasta de migrations');
    return;
  }

  const client = getPgClient();
  const spinner = ora('Conectando ao banco de dados...').start();

  try {
    await client.connect();
    spinner.succeed('Conectado ao banco de dados');

    await client.query(`
      CREATE SCHEMA IF NOT EXISTS supabase_migrations;
      CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations (
        version text NOT NULL PRIMARY KEY,
        statements text[],
        name text
      );
    `);
  } catch (err) {
    spinner.fail('Falha ao conectar');
    log.error(`Verifique SUPABASE_DB_CONNECTION: ${err.message}`);
    return;
  }

  let applied = 0, skipped = 0, errors = 0;

  for (const file of files) {
    const version = file.split('_')[0];
    try {
      const { rows } = await client.query(
        'SELECT version FROM supabase_migrations.schema_migrations WHERE version = $1',
        [version]
      );
      if (rows.length > 0) {
        log.dim(`Já aplicada: ${file}`);
        skipped++;
        continue;
      }

      const sql = fs.readFileSync(path.join(migrationsPath, file), 'utf8');
      await client.query('BEGIN');
      await client.query(sql);
      await client.query(
        'INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES ($1, $2)',
        [version, file]
      );
      await client.query('COMMIT');
      log.success(`Aplicada: ${file}`);
      applied++;
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      log.error(`Erro em ${file}: ${err.message}`);
      errors++;
    }
  }

  try { await client.end(); } catch {}

  log.blank();
  log.info(`Resumo: ${applied} aplicadas, ${skipped} já existiam, ${errors} erros`);
}
