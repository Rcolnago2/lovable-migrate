#!/usr/bin/env node
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { log } from './utils/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

if (existsSync('.env.migration')) {
  dotenv.config({ path: '.env.migration' });
} else {
  dotenv.config();
}

function getBanner() {
  return chalk.cyan(`
  ╔══════════════════════════════════════════════════╗
  ║   🚀 Lovable → Supabase Migration Tool  v1.0.0  ║
  ╚══════════════════════════════════════════════════╝
`);
}

function showStatus() {
  const checks = [
    ['Supabase URL',     process.env.SUPABASE_URL,               process.env.SUPABASE_URL || ''],
    ['Service Role Key', process.env.SUPABASE_SERVICE_ROLE_KEY,  process.env.SUPABASE_SERVICE_ROLE_KEY ? '****' + process.env.SUPABASE_SERVICE_ROLE_KEY.slice(-4) : ''],
    ['GitHub Repo',      process.env.LOVABLE_GITHUB_REPO,        process.env.LOVABLE_GITHUB_REPO || ''],
    ['CSV Path',         true,                                   process.env.CSV_EXPORT_PATH || './csv-exports'],
    ['DB Connection',    process.env.SUPABASE_DB_CONNECTION,     process.env.SUPABASE_DB_CONNECTION ? 'configurado' : ''],
  ];

  console.log(chalk.bold('\n  Status das configurações:'));
  for (const [label, defined, display] of checks) {
    const icon = defined ? chalk.green('✓') : chalk.red('✗');
    const val = defined ? chalk.dim(display) : chalk.red('não configurado');
    console.log(`    ${icon}  ${label.padEnd(18)} ${val}`);
  }
  console.log();
}

async function runFullMigration() {
  console.log(chalk.bold.yellow('\n  ⚠  Aviso importante antes de prosseguir:'));
  console.log(chalk.dim('  • Certifique-se de que o banco de destino está vazio'));
  console.log(chalk.dim('  • Despublique o app do Lovable antes de migrar\n'));

  const { confirm } = await inquirer.prompt([{
    type: 'confirm',
    name: 'confirm',
    message: 'Confirma que o banco de destino está preparado e deseja prosseguir?',
    default: false,
  }]);

  if (!confirm) {
    log.info('Migração cancelada.');
    return;
  }

  const steps = [
    [1, () => import('./steps/1-export-schema.js').then(m => m.exportSchema())],
    [2, () => import('./steps/2-push-schema.js').then(m => m.pushSchema())],
    [3, () => import('./steps/3-export-users.js').then(m => m.exportUsers())],
    [4, () => import('./steps/4-import-users.js').then(m => m.importUsers())],
    [5, () => import('./steps/5-export-tables.js').then(m => m.exportTables())],
    [6, () => import('./steps/6-import-tables.js').then(m => m.importTables())],
    [7, () => import('./steps/7-update-env.js').then(m => m.updateEnv())],
  ];

  const results = [];

  for (const [n, fn] of steps) {
    try {
      await fn();
      results.push({ n, ok: true });
    } catch (err) {
      results.push({ n, ok: false, err: err.message });
      const { cont } = await inquirer.prompt([{
        type: 'confirm',
        name: 'cont',
        message: `Passo ${n} falhou. Continuar para o próximo?`,
        default: true,
      }]);
      if (!cont) break;
    }
  }

  log.blank();
  console.log(chalk.bold('\n  Resumo da migração:'));
  for (const r of results) {
    const icon = r.ok ? chalk.green('✓') : chalk.red('✗');
    const msg = r.ok ? chalk.green('OK') : chalk.red(r.err);
    console.log(`    ${icon}  Passo ${r.n}: ${msg}`);
  }
  log.blank();
}

async function checkConfig() {
  showStatus();
  const envVars = [
    'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_DB_CONNECTION',
    'LOVABLE_GITHUB_REPO', 'LOVABLE_GITHUB_TOKEN', 'LOCAL_REPO_PATH', 'CSV_EXPORT_PATH',
  ];
  console.log(chalk.bold('  Variáveis de ambiente:'));
  for (const v of envVars) {
    const val = process.env[v];
    if (val) {
      const safe = (v.includes('KEY') || v.includes('TOKEN'))
        ? '****' + val.slice(-4)
        : val;
      console.log(`    ${chalk.green('✓')}  ${v} = ${chalk.dim(safe)}`);
    } else {
      console.log(`    ${chalk.red('✗')}  ${v} ${chalk.dim('(não definida)')}`);
    }
  }
  console.log();
}

async function main() {
  console.log(getBanner());
  showStatus();

  let running = true;
  while (running) {
    const { choice } = await inquirer.prompt([{
      type: 'list',
      name: 'choice',
      message: 'O que deseja fazer?',
      pageSize: 15,
      choices: [
        { name: '🚀  Migração completa (todos os passos)', value: 'full' },
        new inquirer.Separator('── Passos individuais ──────────────────────────'),
        { name: '1.  Exportar schema (clonar repo GitHub)', value: '1' },
        { name: '2.  Aplicar schema no Supabase destino', value: '2' },
        { name: '3.  Instruções: exportar usuários (auth)', value: '3' },
        { name: '4.  Importar usuários', value: '4' },
        { name: '5.  Instruções: exportar tabelas (CSV)', value: '5' },
        { name: '6.  Importar tabelas no Supabase', value: '6' },
        { name: '7.  Atualizar .env do projeto', value: '7' },
        new inquirer.Separator('────────────────────────────────────────────────'),
        { name: '⚙   Verificar configuração', value: 'config' },
        { name: '🚪  Sair', value: 'exit' },
      ],
    }]);

    if (choice === 'exit') {
      running = false;
      break;
    }

    if (choice === 'config') {
      await checkConfig();
    } else if (choice === 'full') {
      await runFullMigration();
    } else {
      const stepMap = {
        '1': () => import('./steps/1-export-schema.js').then(m => m.exportSchema()),
        '2': () => import('./steps/2-push-schema.js').then(m => m.pushSchema()),
        '3': () => import('./steps/3-export-users.js').then(m => m.exportUsers()),
        '4': () => import('./steps/4-import-users.js').then(m => m.importUsers()),
        '5': () => import('./steps/5-export-tables.js').then(m => m.exportTables()),
        '6': () => import('./steps/6-import-tables.js').then(m => m.importTables()),
        '7': () => import('./steps/7-update-env.js').then(m => m.updateEnv()),
      };
      try {
        await stepMap[choice]();
      } catch (err) {
        log.error(err.message);
      }
    }

    if (running) {
      const { back } = await inquirer.prompt([{
        type: 'confirm',
        name: 'back',
        message: 'Voltar ao menu?',
        default: true,
      }]);
      if (!back) running = false;
    }
  }

  console.log(chalk.dim('\n  Até logo!\n'));
  process.exit(0);
}

main().catch(err => {
  console.error(chalk.red('Erro fatal:'), err.message);
  process.exit(1);
});
