import path from 'path';
import fs from 'fs';
import { createReadStream } from 'fs';
import csvParser from 'csv-parser';
import ora from 'ora';
import { log } from '../utils/logger.js';
import { getSupabaseAdmin } from '../utils/supabase.js';

function readCsv(filePath, separator) {
  return new Promise((resolve, reject) => {
    const rows = [];
    createReadStream(filePath)
      .pipe(csvParser({ separator }))
      .on('data', (row) => rows.push(row))
      .on('end', () => resolve(rows))
      .on('error', reject);
  });
}

export async function importUsers() {
  log.step(4, 'Importar usuários');

  const csvPath = process.env.CSV_EXPORT_PATH || './csv-exports';
  const filePath = path.join(csvPath, 'auth_users.csv');

  if (!fs.existsSync(filePath)) {
    log.warn(`Arquivo não encontrado: ${filePath}`);
    log.warn('Execute o Passo 3 para obter instruções de exportação');
    return { skipped: true };
  }

  let rows = await readCsv(filePath, ';');
  if (rows.length === 0 || !rows[0]?.email) {
    rows = await readCsv(filePath, ',');
  }

  log.info(`${rows.length} usuário(s) encontrado(s) no CSV`);

  let supabase;
  try {
    supabase = getSupabaseAdmin();
  } catch (err) {
    log.error(err.message);
    return;
  }

  let imported = 0, skipped = 0, errors = 0;
  const spinner = ora('Importando usuários...').start();

  for (const row of rows) {
    if (!row.id || !row.email) {
      log.dim(`Linha inválida, pulando: ${JSON.stringify(row)}`);
      continue;
    }

    let metadata = {};
    try {
      if (row.raw_user_meta_data) metadata = JSON.parse(row.raw_user_meta_data);
    } catch {}

    const { error } = await supabase.auth.admin.createUser({
      id: row.id,
      email: row.email,
      password_hash: row.encrypted_password,
      user_metadata: metadata,
      email_confirm: true,
    });

    if (error) {
      const msg = error.message || '';
      const code = error.code || '';
      if (
        msg.includes('already been registered') ||
        code === '23505' ||
        msg.includes('already exists')
      ) {
        skipped++;
      } else {
        log.error(`${row.email}: ${msg}`);
        errors++;
      }
    } else {
      imported++;
    }
  }

  spinner.stop();
  log.blank();
  log.info(`Resumo: ${imported} importados, ${skipped} já existiam, ${errors} erros`);
}
