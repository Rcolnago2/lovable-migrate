import { createClient } from '@supabase/supabase-js';
import pg from 'pg';

export function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) throw new Error('SUPABASE_URL não definida no ambiente');
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY não definida no ambiente');
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function getPgClient() {
  const connectionString = process.env.SUPABASE_DB_CONNECTION;
  if (!connectionString) throw new Error('SUPABASE_DB_CONNECTION não definida no ambiente');
  return new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });
}
