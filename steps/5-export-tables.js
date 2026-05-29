import path from 'path';
import fs from 'fs';
import chalk from 'chalk';
import { log } from '../utils/logger.js';

export async function exportTables() {
  log.step(5, 'Instruções: exportar tabelas (CSV)');

  const csvPath = process.env.CSV_EXPORT_PATH || './csv-exports';
  fs.mkdirSync(csvPath, { recursive: true });

  const existingFiles = fs.readdirSync(csvPath)
    .filter(f => f.endsWith('.csv') && f !== 'auth_users.csv');

  if (existingFiles.length > 0) {
    log.success(`${existingFiles.length} arquivo(s) CSV encontrado(s):`);
    for (const f of existingFiles) log.dim(f);
    return { csvPath, files: existingFiles };
  }

  log.blank();
  console.log(chalk.bold.yellow('  ┌─────────────────────────────────────────────┐'));
  console.log(chalk.bold.yellow('  │  Ação manual necessária: exportar tabelas   │'));
  console.log(chalk.bold.yellow('  └─────────────────────────────────────────────┘'));
  log.blank();
  console.log(chalk.bold('  Siga os passos abaixo no painel do Lovable:'));
  log.blank();
  console.log(chalk.cyan('  1.') + ' Acesse seu projeto no Lovable');
  console.log(chalk.cyan('  2.') + ' Vá em: ' + chalk.bold('Cloud → Database → Table Editor'));
  console.log(chalk.cyan('  3.') + ' Para cada tabela:');
  console.log('       a. Clique na tabela');
  console.log('       b. Clique em ' + chalk.bold('"Export"') + ' → ' + chalk.bold('"CSV"'));
  console.log('       c. Renomeie o arquivo para ' + chalk.bold('nome_tabela.csv'));
  console.log(chalk.cyan('  4.') + ' Coloque todos os CSVs em: ' + chalk.bold(csvPath + '/'));
  log.blank();
  console.log(chalk.bold('  Estrutura esperada:'));
  console.log(chalk.dim(`
    ${csvPath}/
    ├── auth_users.csv       (passo 3)
    ├── profiles.csv
    ├── categories.csv
    ├── transactions.csv
    └── ...demais tabelas
  `));

  const hintSql = `-- Liste todas as tabelas públicas
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- Para exportar dados de uma tabela específica:
-- SELECT * FROM public.nome_tabela;
`;

  const hintFile = path.join(csvPath, 'export-tables-hint.sql');
  fs.writeFileSync(hintFile, hintSql, 'utf8');
  log.dim(`Queries de ajuda salvas em: ${hintFile}`);

  return { csvPath, files: [] };
}
