import express from 'express';
import { createServer as createViteServer } from 'vite';
import axios from 'axios';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import admin from 'firebase-admin';
import fs from 'fs';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin SDK
try {
  const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    admin.initializeApp({
      projectId: firebaseConfig.projectId
    });
    console.log('Firebase Admin initialized successfully with Project ID:', firebaseConfig.projectId);
  } else {
    admin.initializeApp();
    console.log('Firebase Admin initialized successfully (default).');
  }
} catch (adminError) {
  console.error('Firebase Admin initialization failed:', adminError);
}

function formatFirebaseError(error: any) {
  const errMsg = String(error.message || '');
  const errCode = String(error.code || '');
  const errStack = String(error.stack || '');
  const errInfo = error.errorInfo ? JSON.stringify(error.errorInfo) : '';
  const errDetails = error.response?.data ? JSON.stringify(error.response.data) : String(error.details || '');
  const rawResponse = error.rawResponse ? String(error.rawResponse) : '';
  
  const combined = [errMsg, errCode, errStack, errInfo, errDetails, rawResponse].join(' ').toLowerCase();

  const looksLikeIdentityToolkitDisabled = 
    combined.includes('identitytoolkit') || 
    combined.includes('identity toolkit') || 
    combined.includes('service_disabled') || 
    combined.includes('service-disabled') ||
    combined.includes('permission_denied') ||
    combined.includes('permission-denied') ||
    combined.includes('accessnotconfigured') ||
    combined.includes('googleapis.com/overview?project=');

  if (looksLikeIdentityToolkitDisabled) {
    let projectId = '171527547079'; // Try current container project default
    const projectIdMatch = combined.match(/projects\/([a-zA-Z0-9-_]+)/) || combined.match(/project[\s=]+([a-zA-Z0-9-_]+)/);
    if (projectIdMatch && projectIdMatch[1]) {
      projectId = projectIdMatch[1];
    } else {
      try {
        const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
        if (fs.existsSync(configPath)) {
          const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
          if (config.projectId) projectId = config.projectId;
        }
      } catch (e) {}
    }

    const activationUrl = `https://console.developers.google.com/apis/api/identitytoolkit.googleapis.com/overview?project=${projectId}`;

    return {
      status: 403,
      body: {
        error: 'A API Identity Toolkit está desativada no seu Google Cloud.',
        code: 'IDENTITY_TOOLKIT_DISABLED',
        message: 'A API de Autenticação Avançada do Firebase (Identity Toolkit) não está ativa no seu projeto do Google Cloud. Ela é estritamente necessária para que o servidor possa verificar, listar ou remover contas de e-mail do Firebase Auth.',
        link: activationUrl,
        details: error.message || 'Identity Toolkit API is disabled.'
      }
    };
  }

  return {
    status: 500,
    body: {
      error: 'Erro no Firebase Auth',
      code: error.code || 'UNKNOWN_ERROR',
      message: error.message || 'Ocorreu um erro ao processar a requisição no Firebase.',
      details: error.message || null
    }
  };
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());
  app.use(cors());

  // API Routes
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  // Firebase Auth check user endpoint for diagnostics
  app.get('/api/auth/check-user', async (req, res) => {
    const { email } = req.query;
    if (!email) {
      return res.status(400).json({ error: 'E-mail é obrigatório para verificação.' });
    }
    try {
      try {
        const user = await admin.auth().getUserByEmail(email as string);
        return res.json({
          exists: true,
          uid: user.uid,
          email: user.email,
          displayName: user.displayName || null,
          providerId: user.providerData?.[0]?.providerId || 'password',
          disabled: user.disabled
        });
      } catch (authError: any) {
        if (authError.code === 'auth/user-not-found') {
          return res.json({ exists: false, message: 'Não encontrado no Firebase Auth.' });
        }
        throw authError;
      }
    } catch (error: any) {
      console.error('Erro ao verificar usuário no Auth:', error);
      const formatted = formatFirebaseError(error);
      res.status(formatted.status).json(formatted.body);
    }
  });

  // Firebase Auth purge user endpoint
  app.post('/api/auth/delete-user', async (req, res) => {
    const { uid, email } = req.body;
    console.log(`Backend delete-user request received. UID: ${uid || 'N/A'}, Email: ${email || 'N/A'}`);
    try {
      if (!uid && !email) {
        return res.status(400).json({ error: 'É necessário informar o UID ou e-mail.' });
      }

      if (uid) {
        await admin.auth().deleteUser(uid);
        console.log(`User with UID ${uid} successfully deleted from Firebase Auth.`);
      } else if (email) {
        try {
          const user = await admin.auth().getUserByEmail(email);
          await admin.auth().deleteUser(user.uid);
          console.log(`User with email ${email} successfully deleted from Firebase Auth (UID ${user.uid}).`);
        } catch (emailError: any) {
          if (emailError.code === 'auth/user-not-found') {
            console.log(`User with email ${email} not found in Firebase Auth, skipping delete.`);
            return res.json({ success: true, message: 'Usuário não existia na autenticação.' });
          }
          throw emailError;
        }
      }

      res.json({ success: true, message: 'Usuário removido da autenticação com sucesso.' });
    } catch (error: any) {
      console.error('Erro ao deletar usuário da autenticação:', error);
      const formatted = formatFirebaseError(error);
      res.status(formatted.status).json(formatted.body);
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
            'User-Agent': 'TowerUP/1.0'
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
              'User-Agent': 'TowerUP/1.0'
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
            'User-Agent': 'TowerUP/1.0'
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
            'User-Agent': 'TowerUP/1.0'
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
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
