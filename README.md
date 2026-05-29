# lovable-migrator

CLI tool to migrate a Lovable Cloud project to your own Supabase instance — schema, auth users, and table data.

## Prerequisites

- Node.js 20+
- An empty destination Supabase project
- Your Lovable project repository on GitHub

## Installation

```bash
npm install
```

## Configuration

Copy `.env.migration.example` to `.env.migration` and fill in the values:

| Variable | Description | Where to find |
|---|---|---|
| `LOVABLE_GITHUB_TOKEN` | GitHub personal access token | GitHub → Settings → Developer settings → PAT |
| `LOVABLE_GITHUB_REPO` | Repository in `user/repo` format | GitHub repository URL |
| `SUPABASE_URL` | Destination project URL | Supabase → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role secret key | Supabase → Settings → API |
| `SUPABASE_DB_CONNECTION` | Direct DB connection string | Supabase → Settings → Database → Connection string |
| `LOCAL_REPO_PATH` | Where to clone the repo locally | Any local path (default: `./repo-clonado`) |
| `CSV_EXPORT_PATH` | Where to store CSV exports | Any local path (default: `./csv-exports`) |

## Usage

```bash
node index.js
```

## Menu

```
  ╔══════════════════════════════════════════════════╗
  ║   🚀 Lovable → Supabase Migration Tool  v1.0.0  ║
  ╚══════════════════════════════════════════════════╝

? O que deseja fazer?
❯ 🚀  Migração completa (todos os passos)
  ── Passos individuais ──────────────────────────
  1.  Exportar schema (clonar repo GitHub)
  2.  Aplicar schema no Supabase destino
  3.  Instruções: exportar usuários (auth)
  4.  Importar usuários
  5.  Instruções: exportar tabelas (CSV)
  6.  Importar tabelas no Supabase
  7.  Atualizar .env do projeto
  ────────────────────────────────────────────────
  ⚙   Verificar configuração
  🚪  Sair
```

## Automatic vs Manual Steps

| Step | Type | Description |
|---|---|---|
| 1 | Automatic | Clone/pull repo from GitHub |
| 2 | Automatic | Apply SQL migrations to Supabase |
| 3 | **Manual** | Export auth users CSV from Lovable SQL Editor |
| 4 | Automatic | Import users via Supabase Admin API |
| 5 | **Manual** | Export table CSVs from Lovable Table Editor |
| 6 | Automatic | Import tables into Supabase |
| 7 | Automatic | Update project `.env` file |

Steps 3 and 5 require manual export from the Lovable dashboard because direct DB access to the source project is not available. The tool will display clear instructions and save helper SQL files.

## CSV Structure

Place exported CSVs in `CSV_EXPORT_PATH/`:

```
csv-exports/
├── auth_users.csv       ← from step 3 (SQL Editor export)
├── profiles.csv         ← from step 5 (Table Editor export)
├── categories.csv
└── ...other tables
```

## Security

- `SUPABASE_SERVICE_ROLE_KEY` is never written to project files
- GitHub tokens are masked in logs (last 4 characters only)
- All processing is 100% local — no data is sent to external servers
- Step 7 warns explicitly to use `anon key` in the frontend, not `service_role`

## Resuming After Failure

Each step is idempotent and safe to re-run:

- **Step 2**: Checks `supabase_migrations.schema_migrations` before applying each file
- **Step 4**: Skips users that already exist (detected via error code)
- **Step 6**: Uses `ON CONFLICT DO NOTHING` for all inserts
- **Step 7**: Never overwrites an existing `.env` (saves as `.env.migrated` instead)
