/**
 * @module lib/supabase/types
 * @description Tipagem da tabela `songs` (espelha `supabase/schema.sql`).
 *
 * Escrito à mão em vez de gerado pela CLI para manter o projeto sem
 * dependências extras de build — a tabela é pequena e estável.
 */

/**
 * Linha da tabela `public.songs`.
 *
 * Declarado como `type` (e não `interface`) de propósito: o `supabase-js`
 * exige `Row extends Record<string, unknown>`, e só type aliases ganham index
 * signature implícita — com `interface` a inferência falha e as consultas
 * passam a retornar `never`.
 */
export type SongRow = {
  /** Slug com pasta: `harpa-crista/porque-ele-vive`. */
  id: string;
  title: string;
  artist: string | null;
  /** `key` é reservado em SQL; a coluna é `song_key`. */
  song_key: string | null;
  tempo: number | null;
  capo: number | null;
  categories: string[];
  tags: string[];
  language: string | null;
  /** Letra em texto puro, só para busca. */
  lyrics: string | null;
  /** O arquivo `.cho` completo — a fonte da verdade. */
  source: string;
  created_at: string;
  updated_at: string;
};

/** Campos aceitos ao inserir/atualizar (o banco preenche os timestamps). */
export type SongInsert = Omit<SongRow, 'created_at' | 'updated_at'>;

/**
 * Linha da tabela `public.playlists` — uma por usuário (RLS por `user_id`).
 * O `id` é gerado no cliente (mesmo formato do localStorage), não pelo
 * banco, para o app poder devolver o id de forma síncrona ao criar.
 */
export type PlaylistRow = {
  id: string;
  user_id: string;
  name: string;
  song_ids: string[];
  created_at: string;
  updated_at: string;
};

export type PlaylistInsert = Omit<PlaylistRow, 'created_at' | 'updated_at'> & {
  created_at?: string;
  updated_at?: string;
};

/**
 * Formato esperado pelo `supabase-js`. O idioma `{ [_ in never]: never }` é o
 * que a CLI do Supabase gera para seções vazias — `Record<string, never>`
 * quebra a inferência e faz as consultas retornarem `never`.
 */
export type Database = {
  public: {
    Tables: {
      songs: {
        Row: SongRow;
        Insert: SongInsert;
        Update: Partial<SongInsert>;
        Relationships: [];
      };
      playlists: {
        Row: PlaylistRow;
        Insert: PlaylistInsert;
        Update: Partial<PlaylistInsert>;
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
