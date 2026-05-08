import express from 'express';
import { createServer as createViteServer } from 'vite';
import axios from 'axios';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());
  app.use(cors());

  // API Routes
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
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

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
