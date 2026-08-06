/**
 * @module lib/supabase/client
 * @description Cliente do Supabase, criado **apenas se** as credenciais
 * estiverem configuradas.
 *
 * O app funciona sem Supabase: nesse caso a biblioteca cai no modo estático
 * (lê os `.cho` versionados no Git, somente leitura). Configurar as variáveis
 * abaixo liga o CRUD e a sincronização entre dispositivos.
 *
 * Defina em `frontend/.env.local` (veja `.env.example`):
 *   VITE_SUPABASE_URL=...
 *   VITE_SUPABASE_ANON_KEY=...
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './types';

/**
 * Fallback público (URL + anon key não são segredo — a escrita é protegida
 * pelo RLS, não pelo sigilo destes valores). Existe porque as variáveis de
 * build configuradas no painel do Cloudflare nem sempre chegam ao `vite
 * build` (ex.: quando marcadas como "Secret", só viram binding do Worker em
 * runtime, não env do build); manter isso aqui garante que o app funcione
 * mesmo sem depender dessa configuração externa.
 */
const FALLBACK_URL = 'https://rsfnikttfhmilszdddch.supabase.co';
const FALLBACK_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJzZm5pa3R0ZmhtaWxzemRkZGNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQxNjE1OTksImV4cCI6MjA5OTczNzU5OX0.MESFX3jl-3xIaSqzu661IFx_DTL4U5CCKoUvGr2zIW4';

const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined) || FALLBACK_URL;
const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) || FALLBACK_ANON_KEY;

/** `true` quando o Supabase está configurado (habilita o CRUD). */
export const isSupabaseEnabled = Boolean(url && anonKey);

/**
 * Instância única do cliente, ou `null` se não configurado.
 * A anon key é pública por design — quem protege a escrita é o RLS
 * (veja `supabase/schema.sql`).
 */
export const supabase: SupabaseClient<Database> | null = isSupabaseEnabled
  ? createClient<Database>(url!, anonKey!, {
      auth: { persistSession: true, autoRefreshToken: true },
    })
  : null;
