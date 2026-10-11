export interface MigrationConfig {
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  supabaseAnonKey: string;
  supabaseDbConnection: string;
  githubRepo: string;
  githubToken: string;
  vercelToken: string;
}

export type StepStatus = 'idle' | 'running' | 'done' | 'error' | 'skipped';

export interface StepState {
  id: number;
  title: string;
  description: string;
  status: StepStatus;
  logs: LogLine[];
}

export interface LogLine {
  type: 'info' | 'success' | 'warn' | 'error' | 'dim' | 'step';
  text: string;
}
