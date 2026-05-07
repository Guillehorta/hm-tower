import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is missing');
}

// Configuração robusta para Supabase (Pooler ou Direto)
if (process.env.NODE_ENV !== 'production') {
  try {
    const url = new URL(connectionString);
    console.log(`[DB] Tentando conexão: ${url.hostname}:${url.port || '5432'}`);
    if (url.port === '6543') {
      console.log('[DB] Detectado Supabase Pooler (Porta 6543). Prepare: false é obrigatório.');
    }
  } catch (e) {
    console.log('[DB] Conectando ao banco de dados...');
  }
}

const client = postgres(connectionString, {
  ssl: 'require', // Supabase geralmente exige 'require'
  connect_timeout: 40,
  max_lifetime: 60 * 10, // Reduzido para reciclar conexões mais rápido no pooler
  idle_timeout: 30,
  max: 5, // Reduzido para evitar estourar o limite de conexões do Supabase (Tier Free)
  prepare: false, // Obrigatório para Supabase Pooler (Transaction Mode)
  onnotice: (notice) => console.log('[DB Notice]', notice.message),
});

export const db = drizzle(client, { schema });
