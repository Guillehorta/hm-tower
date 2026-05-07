import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

let connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is missing');
}

// Configuração robusta para Supabase (Pooler ou Direto)
// Trata o caso onde o usuário coloca a URL sem encodar caracteres especiais na senha (#, /, @, $)
let clientOptions: any = {
  ssl: 'require', 
  connect_timeout: 45,
  max_lifetime: 60 * 5,
  idle_timeout: 20,
  max: 3,
  prepare: false,
  onnotice: (notice: any) => {
    if (!notice.message.includes('already exists')) {
      console.log('[DB Notice]', notice.message);
    }
  },
};

// Se a URL estiver "crua" com caracteres como # ou @ na senha, o construtor URL falhará ou cortará a string
// Tentamos encodar a parte da senha se detectarmos que ela não está encodada
try {
  if (connectionString.includes('@') && connectionString.includes(':')) {
    // Padrão: postgresql://user:password@host:port/db
    const protocolPart = 'postgresql://';
    if (connectionString.startsWith(protocolPart)) {
      const rest = connectionString.slice(protocolPart.length);
      // A última ocorrência de @ separa a parte de auth do host
      const lastAtIndex = rest.lastIndexOf('@');
      if (lastAtIndex !== -1) {
        const authPart = rest.slice(0, lastAtIndex);
        const hostPart = rest.slice(lastAtIndex + 1);
        
        const firstColonIndex = authPart.indexOf(':');
        if (firstColonIndex !== -1) {
          const user = authPart.slice(0, firstColonIndex);
          const password = authPart.slice(firstColonIndex + 1);
          
          // Se a senha contém caracteres especiais e não parece estar encodada (%xx)
          if ((password.includes('#') || password.includes('@') || password.includes('/') || password.includes('$')) && !password.includes('%')) {
            console.log('[DB] INFO: Auto-encodando caracteres especiais na senha para conexão.');
            const encodedPassword = encodeURIComponent(password);
            connectionString = `${protocolPart}${user}:${encodedPassword}@${hostPart}`;
          }
        }
      }
    }
  }
} catch (e) {
  console.warn('[DB] Erro ao tentar sanear DATABASE_URL:', e);
}

const client = postgres(connectionString, clientOptions);

export const db = drizzle(client, { schema });
