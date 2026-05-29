import path from 'path';
import fs from 'fs';
import { createReadStream } from 'fs';
import csvParser from 'csv-parser';
import { log } from '../utils/logger.js';
import { getPgClient } from '../utils/supabase.js';
import { getFKDependencies, sortTablesByFKDependency } from '../utils/fk-sorter.js';

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

async function readCsvAutoDetect(filePath) {
  let rows = await readCsv(filePath, ';');
  if (rows.length === 0 || (rows[0] && Object.keys(rows[0]).length === 1)) {
    rows = await readCsv(filePath, ',');
  }
  return rows;
}

export async function importTables() {
  log.step(6, 'Importar tabelas no Supabase');

  const csvPath = process.env.CSV_EXPORT_PATH || './csv-exports';

  if (!fs.existsSync(csvPath)) {
    log.warn(`Pasta não encontrada: ${csvPath}`);
    log.warn('Execute o Passo 5 para obter instruções de exportação');
    return { skipped: true };
  }

  const csvFiles = fs.readdirSync(csvPath)
    .filter(f => f.endsWith('.csv') && f !== 'auth_users.csv');

  if (csvFiles.length === 0) {
    log.warn('Nenhum CSV de tabela encontrado. Execute o Passo 5 primeiro.');
    return { skipped: true };
  }

  let client;
  try {
    client = getPgClient();
  } catch (err) {
    log.error(err.message);
    return;
  }

  try {
    await client.connect();
    log.success('Conectado ao banco de dados');
  } catch (err) {
    log.error(`Verifique SUPABASE_DB_CONNECTION: ${err.message}`);
    return;
  }

  let fkMap = {};
  try {
    fkMap = await getFKDependencies(client);
  } catch {}

  const tableNames = csvFiles.map(f => f.replace('.csv', ''));
  const ordered = sortTablesByFKDependency(tableNames, fkMap);

  log.info('Ordem de importação:');
  ordered.forEach((t, i) => log.dim(`${i + 1}. ${t}`));
  log.blank();

  let totalInserted = 0, totalErrors = 0;

  for (const tableName of ordered) {
    const filePath = path.join(csvPath, `${tableName}.csv`);
    let rows;
    try {
      rows = await readCsvAutoDetect(filePath);
    } catch (err) {
      log.error(`Erro ao ler ${tableName}.csv: ${err.message}`);
      continue;
    }

    if (rows.length === 0) {
      log.dim(`${tableName}: vazio, pulando`);
      continue;
    }

    const columns = Object.keys(rows[0]);
    const quotedTable = `"${tableName}"`;
    const quotedCols = columns.map(c => `"${c}"`).join(', ');
    const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
    const insertSql = `INSERT INTO public.${quotedTable} (${quotedCols}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`;

    let inserted = 0, errors = 0;
    for (const row of rows) {
      const values = columns.map(c => {
        const v = row[c];
        return (v === '' || v === undefined) ? null : v;
      });
      try {
        await client.query(insertSql, values);
        inserted++;
      } catch {
        errors++;
      }
    }

    if (errors > 0) {
      log.warn(`${tableName}: ${inserted} ok, ${errors} erros`);
    } else {
      log.success(`${tableName}: ${inserted} linhas importadas`);
    }
    totalInserted += inserted;
    totalErrors += errors;
  }

  try { await client.end(); } catch {}

  log.blank();
  log.info(`Total: ${totalInserted} linhas inseridas, ${totalErrors} erros`);
}
