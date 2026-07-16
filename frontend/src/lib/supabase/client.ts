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

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

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
