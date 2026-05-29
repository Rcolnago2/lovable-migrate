import path from 'path';
import fs from 'fs';
import chalk from 'chalk';
import { log } from '../utils/logger.js';

export async function updateEnv() {
  log.step(7, 'Atualizar .env do projeto');

  const repoPath = process.env.LOCAL_REPO_PATH || './repo-clonado';
  const supabaseUrl = process.env.SUPABASE_URL;

  if (!supabaseUrl) {
    log.warn('SUPABASE_URL não definida — não é possível atualizar o .env');
    return;
  }

  const envPath = path.join(repoPath, '.env');
  const envExamplePath = path.join(repoPath, '.env.example');

  let sourceFile = null;
  if (fs.existsSync(envPath)) sourceFile = envPath;
  else if (fs.existsSync(envExamplePath)) sourceFile = envExamplePath;

  if (!sourceFile) {
    log.warn(`Nenhum .env ou .env.example encontrado em ${repoPath}`);
    return;
  }

  let content = fs.readFileSync(sourceFile, 'utf8');
  const projectIdMatch = supabaseUrl.match(/https:\/\/([a-z0-9]+)\.supabase\.co/);
  const projectId = projectIdMatch ? projectIdMatch[1] : '';

  const updates = {
    VITE_SUPABASE_URL: supabaseUrl,
    VITE_SUPABASE_PROJECT_ID: projectId,
  };

  for (const [key, value] of Object.entries(updates)) {
    const regex = new RegExp(`^${key}=.*$`, 'm');
    if (regex.test(content)) {
      content = content.replace(regex, `${key}=${value}`);
      log.success(`Atualizado: ${key}`);
    } else {
      content += `\n${key}=${value}`;
      log.success(`Adicionado: ${key}`);
    }
  }

  const outputPath = fs.existsSync(envPath)
    ? path.join(repoPath, '.env.migrated')
    : envPath;

  fs.writeFileSync(outputPath, content, 'utf8');
  log.success(`Arquivo salvo em: ${outputPath}`);

  log.blank();
  console.log(chalk.bold.yellow('  ┌────────────────────────────────────────────────────────┐'));
  console.log(chalk.bold.yellow('  │  ⚠  Ação manual necessária                             │'));
  console.log(chalk.bold.yellow('  │                                                        │'));
  console.log(chalk.bold.yellow('  │  Atualize manualmente VITE_SUPABASE_PUBLISHABLE_KEY    │'));
  console.log(chalk.bold.yellow('  │  com a anon key do seu novo projeto Supabase.          │'));
  console.log(chalk.bold.yellow('  │                                                        │'));
  console.log(chalk.bold.yellow('  │  NÃO use a service_role key no frontend!               │'));
  console.log(chalk.bold.yellow('  └────────────────────────────────────────────────────────┘'));
}
