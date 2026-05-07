import { createClient } from '@supabase/supabase-js';

let rawUrl = (import.meta.env.VITE_SUPABASE_URL || '').replace(/['"]/g, '').trim();
if (rawUrl && !rawUrl.startsWith('http')) rawUrl = `https://${rawUrl}`;

let supabaseUrl = '';
try {
  if (rawUrl) {
    const url = new URL(rawUrl);
    // Ensure we have only the origin, no trailing slashes or subpaths
    supabaseUrl = `${url.protocol}//${url.hostname}${url.port ? ':' + url.port : ''}`;
  }
} catch (e) {
  console.error('Invalid Supabase URL:', rawUrl);
}

const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.replace(/['"]/g, '').trim();

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials missing. Client not initialized.');
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder'
);
