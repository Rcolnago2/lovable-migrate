import path from 'path';
import fs from 'fs';
import simpleGit from 'simple-git';
import ora from 'ora';
import { log } from '../utils/logger.js';

export async function exportSchema() {
  log.step(1, 'Exportar schema (clonar/atualizar repo GitHub)');

  const repoPath = process.env.LOCAL_REPO_PATH || './repo-clonado';
  const githubRepo = process.env.LOVABLE_GITHUB_REPO;
  const githubToken = process.env.LOVABLE_GITHUB_TOKEN;

  if (!githubRepo) {
    log.warn('LOVABLE_GITHUB_REPO não definida — pulando clone');
    return { migrationsPath: null, files: [] };
  }

  const gitDir = path.join(repoPath, '.git');
  const spinner = ora('Preparando repositório...').start();

  try {
    if (fs.existsSync(gitDir)) {
      spinner.text = 'Atualizando repositório (git pull)...';
      const git = simpleGit(repoPath);
      await git.pull();
      spinner.succeed('Repositório atualizado');
    } else {
      spinner.text = 'Clonando repositório...';
      let cloneUrl;
      if (githubToken) {
        cloneUrl = `https://${githubToken}@github.com/${githubRepo}.git`;
      } else {
        cloneUrl = `https://github.com/${githubRepo}.git`;
      }
      const git = simpleGit();
      await git.clone(cloneUrl, repoPath);
      spinner.succeed('Repositório clonado');
    }
  } catch (err) {
    spinner.fail('Falha ao acessar repositório');
    log.error(err.message);
    return { migrationsPath: null, files: [] };
  }

  const migrationsPath = path.join(repoPath, 'supabase', 'migrations');
  if (!fs.existsSync(migrationsPath)) {
    log.warn(`Pasta de migrations não encontrada: ${migrationsPath}`);
    return { migrationsPath: null, files: [] };
  }

  const files = fs.readdirSync(migrationsPath)
    .filter(f => f.endsWith('.sql'))
    .sort();

  log.success(`${files.length} arquivo(s) de migration encontrado(s):`);
  for (const f of files) log.dim(f);

  return { migrationsPath, files };
}
