import path from 'path';
import fs from 'fs';
import chalk from 'chalk';
import { log } from '../utils/logger.js';

export async function exportUsers() {
  log.step(3, 'Instruções: exportar usuários (auth)');

  const csvPath = process.env.CSV_EXPORT_PATH || './csv-exports';
  const filePath = path.join(csvPath, 'auth_users.csv');

  if (fs.existsSync(filePath)) {
    log.success(`Arquivo já encontrado: ${filePath}`);
    return { csvPath: filePath };
  }

  fs.mkdirSync(csvPath, { recursive: true });

  const query = `SELECT id, email, encrypted_password, raw_user_meta_data, created_at\nFROM auth.users;`;

  log.blank();
  console.log(chalk.bold.yellow('  ┌─────────────────────────────────────────────┐'));
  console.log(chalk.bold.yellow('  │  Ação manual necessária: exportar usuários  │'));
  console.log(chalk.bold.yellow('  └─────────────────────────────────────────────┘'));
  log.blank();
  console.log(chalk.bold('  Siga os passos abaixo no painel do Lovable:'));
  log.blank();
  console.log(chalk.cyan('  1.') + ' Acesse seu projeto no Lovable');
  console.log(chalk.cyan('  2.') + ' Vá em: ' + chalk.bold('Cloud → Database → SQL Editor'));
  console.log(chalk.cyan('  3.') + ' Execute a query abaixo:');
  log.blank();
  console.log(chalk.bgBlack.white('  ┌─────────────────────────────────────────────┐'));
  console.log(chalk.bgBlack.white('  │ SELECT id, email, encrypted_password,       │'));
  console.log(chalk.bgBlack.white('  │        raw_user_meta_data, created_at        │'));
  console.log(chalk.bgBlack.white('  │ FROM auth.users;                             │'));
  console.log(chalk.bgBlack.white('  └─────────────────────────────────────────────┘'));
  log.blank();
  console.log(chalk.cyan('  4.') + ' Clique em ' + chalk.bold('"Export CSV"'));
  console.log(chalk.cyan('  5.') + ' Renomeie o arquivo para ' + chalk.bold('auth_users.csv'));
  console.log(chalk.cyan('  6.') + ' Coloque em: ' + chalk.bold(csvPath + '/'));
  log.blank();

  const sqlFile = path.join(csvPath, 'export-auth-users.sql');
  fs.writeFileSync(sqlFile, query, 'utf8');
  log.dim(`Query salva em: ${sqlFile}`);

  return { csvPath: null, pending: true };
}
