import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import { createServer as createViteServer } from 'vite';
import axios from 'axios';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { db } from './src/db';
import * as schema from './src/db/schema';
import { eq, inArray, sql } from 'drizzle-orm';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));
  app.use(cors());

  // Logging middleware
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      if (res.statusCode >= 400) {
        console.log(`[API] ${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
      }
    });
    next();
  });

  // Database API Routes
  const tables = {
    users: schema.users,
    companies: schema.companies,
    projects: schema.projects,
    employees: schema.employees,
    jobfunctions: schema.jobFunctions,
    fvs: schema.fvs,
    timelogs: schema.timeLogs,
    executions: schema.serviceExecutions,
    weatherlogs: schema.weatherLogs,
    labortracking: schema.laborTracking,
    suppliers: schema.suppliers,
    contracts: schema.contracts,
    contractmeasurements: schema.contractMeasurements,
    measurements: schema.dailyMeasurements,
  };

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  app.get('/api/debug/db', async (req, res) => {
    try {
      console.log('[DEBUG] Testing DB connection...');
      const result = await db.execute(sql`SELECT current_database(), current_user, now()`);
      console.log('[DEBUG] DB Check Success:', result[0]);
      
      const tablesCheck = await db.execute(sql`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
      `);

      const usersInfo = await db.execute(sql`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'users'
      `).catch(() => []);
      
      res.json({ 
        success: true, 
        connection: result[0],
        tables: tablesCheck.map((t: any) => t.table_name),
        usersTableSchema: usersInfo
      });
    } catch (error: any) {
      console.error('[DEBUG] DB Check Failed:', error.message);
      res.status(500).json({ 
        success: false, 
        error: error.message,
        stack: error.stack,
        hint: 'Verifique se DATABASE_URL está correta.'
      });
    }
  });

  app.get('/api/data/:table', async (req, res) => {
    const { table } = req.params;
    const tableObj = (tables as any)[table.toLowerCase()];
    if (!tableObj) return res.status(404).json({ error: 'Tabela não encontrada' });

    try {
      const rawData = await db.select().from(tableObj);
      const data = rawData.map((item: any) => {
        const newItem = { ...item };
        for (const key in newItem) {
          if (newItem[key] instanceof Date) {
            newItem[key] = newItem[key].getTime();
          }
        }
        return newItem;
      });
      res.json(data);
    } catch (error: any) {
      const isConnectionError = error.message.includes('timeout') || error.message.includes('CONNECT');
      console.error(`Erro ao buscar dados de ${table}:`, error.message);
      if (isConnectionError) {
        console.error("HINT: Database connection timed out. Check your DATABASE_URL and ensure port 6543 is used if connecting to Supabase Pooler.");
      }
      res.status(500).json({ 
        error: isConnectionError ? 'Falha na conexão com o banco de dados (Timeout)' : error.message,
        hint: isConnectionError ? 'Verifique a DATABASE_URL e a porta (6543 para Pooler).' : undefined
      });
    }
  });

  app.post('/api/data/:table', async (req, res) => {
    const { table } = req.params;
    const items = Array.isArray(req.body) ? req.body : [req.body];
    const tableObj = (tables as any)[table.toLowerCase()];
    if (!tableObj) return res.status(404).json({ error: 'Tabela não encontrada' });

    try {
      for (const rawItem of items) {
        const item = { ...rawItem };
        for (const key in item) {
          if (key.toLowerCase().includes('at') || key === 'timestamp') {
            if (typeof item[key] === 'number') {
              item[key] = new Date(item[key]);
            }
          }
        }
        await db.insert(tableObj).values(item).onConflictDoUpdate({
          target: tableObj.id,
          set: item,
        });
      }
      res.json({ success: true });
    } catch (error: any) {
      const isConnectionError = error.message.includes('timeout') || error.message.includes('CONNECT');
      console.error(`Erro ao salvar dados em ${table}:`, error.message);
      res.status(500).json({ 
        error: isConnectionError ? 'Falha na conexão com o banco de dados (Timeout)' : error.message 
      });
    }
  });

  app.delete('/api/data/:table', async (req, res) => {
    const { table } = req.params;
    const { ids } = req.body;
    const tableObj = (tables as any)[table.toLowerCase()];
    if (!tableObj) return res.status(404).json({ error: 'Tabela não encontrada' });

    try {
      const idList = Array.isArray(ids) ? ids : [ids];
      await db.delete(tableObj).where(inArray(tableObj.id, idList));
      res.json({ success: true });
    } catch (error: any) {
      const isConnectionError = error.message.includes('timeout') || error.message.includes('CONNECT');
      console.error(`Erro ao excluir dados de ${table}:`, error.message);
      res.status(500).json({ 
        error: isConnectionError ? 'Falha na conexão com o banco de dados (Timeout)' : error.message 
      });
    }
  });

  app.get('/api/data/:table/:id', async (req, res) => {
    const { table, id } = req.params;
    const tableObj = (tables as any)[table.toLowerCase()];
    if (!tableObj) return res.status(404).json({ error: 'Tabela não encontrada' });

    try {
      const data = await db.select().from(tableObj).where(eq(tableObj.id, id)).limit(1);
      if (data[0]) {
        const item = { ...data[0] };
        for (const key in item) {
          if ((item as any)[key] instanceof Date) {
            (item as any)[key] = (item as any)[key].getTime();
          }
        }
        res.json(item);
      } else {
        res.json(null);
      }
    } catch (error: any) {
      const isConnectionError = error.message.includes('timeout') || error.message.includes('CONNECT');
      console.error(`Erro ao buscar registro em ${table}:`, error.message);
      res.status(500).json({ 
        error: isConnectionError ? 'Falha na conexão com o banco de dados (Timeout)' : error.message 
      });
    }
  });

  // Secullum API - Test Authentication and Claims
  app.get('/api/secullum/test-auth', async (req, res) => {
    let step = 'init';
    try {
      const username = process.env.SECULLUM_USERNAME?.trim();
      const password = process.env.SECULLUM_PASSWORD?.trim();

      if (!username || !password) {
        return res.status(400).json({ error: 'Credenciais não configuradas no menu Secrets.' });
      }

      // 1. Get Token
      step = 'auth';
      console.log('Step: Auth');
      const params = new URLSearchParams();
      params.append('grant_type', 'password');
      params.append('username', username);
      params.append('password', password);
      params.append('client_id', '3');
      params.append('client_id', '3');

      const authResponse = await axios.post(
        'https://autenticador.secullum.com.br/Token', // Trying uppercase Token first
        params,
        { 
          headers: { 
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'FacePoint/1.0'
          },
          timeout: 15000
        }
      );

      const token = authResponse.data.access_token;

      // 2. Get Claims
      step = 'claims';
      console.log('Step: Claims');
      // Using exact spelling provided by user
      const claimsUrl = 'https://autenticador.secullum.com.br/ReinvidicacoesToken'; 
      
      let claimsData = null;
      try {
        const claimsResponse = await axios.get(
          claimsUrl,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        claimsData = claimsResponse.data;
      } catch (claimsError: any) {
        console.warn('Claims call failed, but auth was successful:', claimsError.message);
        claimsData = { error: 'O caminho de reivindicações retornou 404. Verifique a URL exata na documentação.', details: claimsError.message };
      }

      res.json({
        success: true,
        message: 'Autenticação realizada com sucesso!',
        auth: authResponse.data,
        claims: claimsData
      });
    } catch (error: any) {
      console.error(`Secullum Test Error at step [${step}]:`, error?.response?.data || error.message);
      res.status(error?.response?.status || 500).json({
        error: `Erro no teste de autenticação (Etapa: ${step})`,
        details: error?.response?.data || error.message,
        step: step
      });
    }
  });

  // Secullum API Integration
  app.get('/api/secullum/import', async (req, res) => {
    try {
      const username = process.env.SECULLUM_USERNAME?.trim();
      const password = process.env.SECULLUM_PASSWORD?.trim();

      if (!username || !password) {
        return res.status(400).json({ 
          error: 'Credenciais da API Secullum não configuradas.',
          details: 'Por favor, configure SECULLUM_USERNAME e SECULLUM_PASSWORD nas configurações de Secrets.'
        });
      }

      // 1. Authenticate
      console.log('Authenticating with Secullum for user:', username);
      let authResponse;
      try {
        const params = new URLSearchParams();
        params.append('grant_type', 'password');
        params.append('username', username);
        params.append('password', password);
        params.append('client_id', '3');
        params.append('client_id', '3');

        authResponse = await axios.post(
          'https://autenticador.secullum.com.br/Token', // Sync with successful test-auth
          params,
          {
            headers: { 
              'Content-Type': 'application/x-www-form-urlencoded',
              'User-Agent': 'FacePoint/1.0'
            },
            timeout: 15000
          }
        );
      } catch (authError: any) {
        const errorData = authError?.response?.data;
        if (errorData?.error === 'invalid_grant') {
          return res.status(401).json({
            error: 'Credenciais inválidas no Secullum.',
            details: 'O e-mail ou senha informados nas configurações estão incorretos. Verifique os valores em Settings > Secrets.'
          });
        }
        throw authError; // Re-throw to be caught by outer catch
      }

      const token = authResponse.data.access_token;

      // 2. List Banks to get the bank ID
      console.log('Listing Secullum banks...');
      const banksResponse = await axios.get(
        'https://autenticador.secullum.com.br/ContasSecullumExterno/ListarBancos',
        {
          headers: { 
            Authorization: `Bearer ${token}`,
            'User-Agent': 'FacePoint/1.0'
          },
          timeout: 20000
        }
      );

      const banks = banksResponse.data;
      if (!banks || banks.length === 0) {
        return res.status(404).json({ error: 'Nenhum banco de dados encontrado no Secullum.' });
      }

      // Take the first bank, handle both id and Id casing
      const bankId = banks[0].id || banks[0].Id;
      
      if (!bankId) {
        return res.status(500).json({ 
          error: 'Formato de banco de dados inesperado.', 
          details: 'Não foi possível encontrar o ID do banco na resposta da API.',
          debug: banks[0]
        });
      }

      // 3. Import Employees
      console.log(`Importing employees from bank ID ${bankId}...`);
      const employeesResponse = await axios.get(
        'https://pontowebintegracaoexterna.secullum.com.br/IntegracaoExterna/Funcionarios',
        {
          headers: {
            Authorization: `Bearer ${token}`,
            secullumidbancoselecionado: bankId.toString(),
            'User-Agent': 'FacePoint/1.0'
          },
          timeout: 30000
        }
      );

      res.json(employeesResponse.data);
    } catch (error: any) {
      const step = error.config?.url?.includes('Token') ? 'Autenticação' : 
                   error.config?.url?.includes('ListarBancos') ? 'Listagem de Bancos' : 
                   'Busca de Funcionários';
      
      const url = error.config?.url || 'URL desconhecida';
      const statusCode = error.response?.status;
      const errorDetail = error.response?.data ? JSON.stringify(error.response.data) : error.message;

      console.error(`Secullum Import Error (${step}) at ${url}:`, errorDetail);
      
      res.status(statusCode || 500).json({ 
        error: `Erro 404 ou falha na API Secullum (${step}).`,
        details: `URL: ${url} | Status: ${statusCode} | Erro: ${errorDetail}`,
        step: step
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Final Error Handler
  app.use((err: any, req: any, res: any, next: any) => {
    console.error('[FATAL ERROR]', err);
    res.status(500).json({ error: err.message || 'Erro interno do servidor' });
  });

  app.listen(PORT, '0.0.0.0', async () => {
    console.log(`Server running on http://localhost:${PORT}`);
    
    // Auto-Migration: Garante que as tabelas básicas existam
    const runMigrations = async () => {
      try {
        console.log("[DB] Iniciando verificação de esquema...");
        
        // Helper para executar sql com log
        const exec = async (name: string, query: any) => {
          try {
            await db.execute(query);
            console.log(`[DB] OK: ${name}`);
          } catch (err: any) {
            if (err.message.includes('already exists') || err.message.includes('duplicada') || err.message.includes('já existe')) {
              console.log(`[DB] INFO: ${name} já existe.`);
            } else {
              console.error(`[DB] ERRO em ${name}:`, err.message);
            }
          }
        };

        // Enums
        await exec('Enum user_role', sql`CREATE TYPE user_role AS ENUM ('Administrador', 'Gestor', 'Usuário')`);
        await exec('Enum project_status', sql`CREATE TYPE project_status AS ENUM ('Ativa', 'Inativa')`);
        await exec('Enum employee_status', sql`CREATE TYPE employee_status AS ENUM ('Ativo', 'Inativo')`);
        await exec('Enum time_log_type', sql`CREATE TYPE time_log_type AS ENUM ('ENTRADA', 'SAÍDA')`);
        await exec('Enum se_status', sql`CREATE TYPE se_status AS ENUM ('Nao Iniciado', 'Iniciado', 'Concluido')`);
        
        // Tabelas
        await exec('Tabela users', sql`CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT NOT NULL, cpf TEXT, phone TEXT, email TEXT UNIQUE NOT NULL, password TEXT, role user_role NOT NULL DEFAULT 'Usuário', companies JSONB DEFAULT '[]', projects JSONB DEFAULT '[]', created_at TIMESTAMP DEFAULT NOW())`);
        await exec('Tabela companies', sql`CREATE TABLE IF NOT EXISTS companies (id TEXT PRIMARY KEY, name TEXT NOT NULL, cnpj TEXT NOT NULL, created_at TIMESTAMP DEFAULT NOW())`);
        await exec('Tabela projects', sql`CREATE TABLE IF NOT EXISTS projects (id TEXT PRIMARY KEY, code TEXT, name TEXT NOT NULL, status project_status NOT NULL DEFAULT 'Ativa', construction_units JSONB DEFAULT '[]', cost_structure JSONB DEFAULT '[]', fvs_mapping JSONB DEFAULT '{}', teams JSONB DEFAULT '[]', latitude TEXT, longitude TEXT, city TEXT, created_at TIMESTAMP DEFAULT NOW())`);
        await exec('Tabela employees', sql`CREATE TABLE IF NOT EXISTS employees (id TEXT PRIMARY KEY, name TEXT NOT NULL, role TEXT, job_function TEXT, department TEXT, company TEXT, projects JSONB DEFAULT '[]', admission_date TEXT, cpf TEXT NOT NULL, status employee_status NOT NULL DEFAULT 'Ativo', photo_base64 TEXT, phone TEXT, email TEXT, address TEXT, neighborhood TEXT, city TEXT, state TEXT, zip_code TEXT, salary INTEGER, entry_time TEXT, exit_time TEXT, created_at TIMESTAMP DEFAULT NOW())`);
        await exec('Tabela job_functions', sql`CREATE TABLE IF NOT EXISTS job_functions (id TEXT PRIMARY KEY, name TEXT NOT NULL, created_at TIMESTAMP DEFAULT NOW())`);
        await exec('Tabela fvs', sql`CREATE TABLE IF NOT EXISTS fvs (id TEXT PRIMARY KEY, code TEXT, name TEXT NOT NULL, is_controlled BOOLEAN DEFAULT false, revision TEXT NOT NULL, items JSONB DEFAULT '[]', instruction_file JSONB, created_at TIMESTAMP DEFAULT NOW())`);
        await exec('Tabela time_logs', sql`CREATE TABLE IF NOT EXISTS time_logs (id TEXT PRIMARY KEY, employee_id TEXT NOT NULL, employee_name TEXT, type time_log_type NOT NULL, timestamp TIMESTAMP NOT NULL, location JSONB, captured_photo TEXT, verified BOOLEAN DEFAULT false, confidence INTEGER)`);
        await exec('Tabela service_executions', sql`CREATE TABLE IF NOT EXISTS service_executions (id TEXT PRIMARY KEY, project_id TEXT NOT NULL, service_path TEXT NOT NULL, component_path TEXT, status se_status DEFAULT 'Nao Iniciado', start_date_planned TEXT, end_date_planned TEXT, start_date_real TEXT, end_date_real TEXT, fvs_results JSONB DEFAULT '{}')`);
        await exec('Tabela weather_logs', sql`CREATE TABLE IF NOT EXISTS weather_logs (id TEXT PRIMARY KEY, project_id TEXT NOT NULL, date TEXT NOT NULL, morning JSONB, afternoon JSONB, night JSONB, precipitation INTEGER, created_at TIMESTAMP DEFAULT NOW())`);
        await exec('Tabela labor_tracking', sql`CREATE TABLE IF NOT EXISTS labor_tracking (id TEXT PRIMARY KEY, employee_id TEXT NOT NULL, executor_type TEXT, project_id TEXT NOT NULL, date TEXT NOT NULL, presence TEXT, team TEXT, selections JSONB DEFAULT '[]', cost_structure_selections JSONB DEFAULT '[]', created_at TIMESTAMP DEFAULT NOW())`);
        await exec('Tabela suppliers', sql`CREATE TABLE IF NOT EXISTS suppliers (id TEXT PRIMARY KEY, name TEXT NOT NULL, type TEXT, document TEXT, email TEXT, phone TEXT, contract_date TEXT, bank_info JSONB, projects JSONB DEFAULT '[]', created_at TIMESTAMP DEFAULT NOW())`);
        await exec('Tabela contracts', sql`CREATE TABLE IF NOT EXISTS contracts (id TEXT PRIMARY KEY, number TEXT, company_id TEXT NOT NULL, project_id TEXT NOT NULL, supplier_name TEXT, description TEXT, items JSONB DEFAULT '[]', created_at TIMESTAMP DEFAULT NOW())`);
        await exec('Tabela contract_measurements', sql`CREATE TABLE IF NOT EXISTS contract_measurements (id TEXT PRIMARY KEY, contract_id TEXT NOT NULL, measurement_number INTEGER, date TEXT, start_date TEXT, end_date TEXT, status TEXT, items JSONB DEFAULT '[]', created_at TIMESTAMP DEFAULT NOW())`);
        await exec('Tabela daily_measurements', sql`CREATE TABLE IF NOT EXISTS daily_measurements (id TEXT PRIMARY KEY, company_name TEXT, project_name TEXT, start_date TEXT, end_date TEXT, status TEXT, entries JSONB DEFAULT '[]', created_at TIMESTAMP DEFAULT NOW())`);
        
        console.log("[DB] Verificação de tabelas concluída.");
      } catch (err: any) {
        console.error("[DB] Falha crítica nas migrações:", err.message);
      }
    };

    // Seed: Garantir o usuário administrador conforme solicitado
    const runSeed = async () => {
      // Delay de 2 segundos para garantir que o ambiente carregou as variáveis e tabelas
      await runMigrations();
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      try {
        const adminEmail = 'guille@hmtower.com.br';
        const adminId = '60c86c6d-266b-41dd-81e4-faebfb8ade07'; // ID real do Supabase Auth fornecido
        
        console.log(`[SEED] Verificando administrador: ${adminEmail}...`);
        
        try {
          const existingUsers = await db.select().from(schema.users).where(eq(schema.users.email, adminEmail)).limit(1);
          
          if (existingUsers.length === 0) {
            console.log(`[SEED] Criando entrada do administrador ${adminEmail} na tabela users`);
            await db.insert(schema.users).values({
              id: adminId, 
              name: 'Administrador Tower',
              email: adminEmail,
              password: 'admin123',
              role: 'Administrador',
              companies: [],
              projects: [],
            });
            console.log(`[SEED] Administração criada com sucesso.`);
          } else {
            console.log(`[SEED] Sincronizando dados do administrador existente...`);
            await db.update(schema.users)
              .set({ 
                id: adminId, // Atualiza para o ID real do Supabase Auth
                role: 'Administrador',
                password: 'admin123'
              })
              .where(eq(schema.users.email, adminEmail));
            console.log(`[SEED] Sincronizado.`);
          }
        } catch (dbError: any) {
          if (dbError.message.includes('not exist')) {
            console.error("[SEED] CRITICAL: A tabela 'users' não existe no banco de dados. Você precisa executar 'npx drizzle-kit push' ou garantir as migrações.");
          }
          throw dbError;
        }
      } catch (error: any) {
        console.error("[SEED] Erro detalhado na execução do seed inicial:");
        console.error(error);
        if (error.message.includes('timeout') || error.message.includes('CONNECT')) {
           console.error("[HINT] Verifique se DATABASE_URL usa a string do POOLER (porta 6543) e se o banco está ativo.");
        }
      }
    };

    runSeed();
  });
}

startServer();
