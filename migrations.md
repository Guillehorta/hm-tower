# Migração para Supabase

Este projeto foi configurado para utilizar o Supabase com **Drizzle ORM**.

## Passos para Finalizar a Migração

1. **Obtenha as credenciais do Supabase:**
   - Crie um projeto no [Supabase](https://supabase.com/).
   - Vá em **Project Settings > Database** e copie a **Connection String** (URI).
   - Vá em **Project Settings > API** e copie a **Project URL** e a **anon key**.

2. **Configure as Variáveis de Ambiente:**
   - No arquivo `.env`, adicione as seguintes variáveis:
     ```env
     DATABASE_URL=https://lqsiahzrscxckuwrezxy.supabase.co/rest/v1/
     VITE_SUPABASE_URL=https://lqsiahzrscxckuwrezxy.supabase.co
     VITE_SUPABASE_ANON_KEY=sb_publishable_UWcosNsGKJRZ-4grf-koQg_pGgTJz3P
     ```

3. **Aplique as Migrações:**
   - Execute o comando abaixo para criar as tabelas no seu banco de dados Supabase:
     ```bash
     npm run db:push
     ```

4. **Atualize o Código:**
   - A estrutura das tabelas foi baseada no arquivo `firebase-blueprint.json`.
   - Você deve agora substituir as chamadas do `storageService.ts` (que usa Firebase) pelas novas funções que utilizam o Supabase ou o Drizzle.

## Estrutura de Arquivos Gerada

- `src/db/schema.ts`: Definição das tabelas em TypeScript.
- `src/db/index.ts`: Conexão com o banco de dados via Drizzle.
- `src/services/supabase.ts`: Cliente Supabase para o front-end.
- `drizzle/`: Pasta contendo as migrações SQL geradas.
- `drizzle.config.ts`: Configuração do Drizzle Kit.
