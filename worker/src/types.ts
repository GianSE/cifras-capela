/** Tipos compartilhados do Worker. */

export interface Env {
  /** Binding para os assets estáticos (configurado em wrangler.toml). */
  ASSETS: Fetcher;
  /** Banco D1 com músicas, administradores e playlists. */
  DB: D1Database;
  /** URL pública do site, usada no sitemap. */
  SITE_URL?: string;
  /** Chave da API do Gemini (secret: `wrangler secret put GEMINI_API_KEY`). */
  GEMINI_API_KEY?: string;
  /** Assina o cookie de sessão (secret: `wrangler secret put JWT_SECRET`). */
  JWT_SECRET?: string;
  /** `development` afrouxa o `Secure` do cookie, para o dev em http. */
  APP_ENV?: string;
}

/** Linha da tabela `songs`. Arrays vêm como JSON em TEXT (D1 é SQLite). */
export interface SongRow {
  id: string;
  title: string;
  artist: string | null;
  song_key: string | null;
  tempo: number | null;
  capo: number | null;
  categories: string;
  tags: string;
  language: string | null;
  lyrics: string | null;
  source: string;
  created_at: string;
  updated_at: string;
}
