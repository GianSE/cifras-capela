/**
 * @module services/song-repository
 * @description Abstração de onde as músicas vivem.
 *
 * Duas implementações, escolhidas pela presença das credenciais do Supabase:
 *
 *  - **estática** (padrão): lê os `.cho` versionados em `public/songs/` via o
 *    índice gerado no build. Somente leitura, funciona 100% offline.
 *  - **Supabase**: CRUD real sincronizado entre dispositivos, com cache local
 *    para continuar lendo sem internet.
 *
 * O resto do app fala só com esta interface e não sabe de onde vêm os dados.
 */

import type { SongIndexEntry } from '@/types/library';

export interface SaveSongInput {
  /** Id no formato `categoria/slug`. Novo ou existente (upsert). */
  readonly id: string;
  /** Arquivo `.cho` completo — a fonte da verdade. */
  readonly source: string;
}

export interface SongRepository {
  /** `true` quando dá para criar/editar/excluir por aqui. */
  readonly canWrite: boolean;
  /** Todas as músicas da biblioteca (metadados para listagem/busca). */
  listSongs(): Promise<SongIndexEntry[]>;
  /** O `.cho` completo de uma música. */
  getSource(id: string): Promise<string>;
  /** Cria ou atualiza. Só quando `canWrite`. */
  saveSong(input: SaveSongInput): Promise<void>;
  /** Exclui. Só quando `canWrite`. */
  deleteSong(id: string): Promise<void>;
}

/** Erro de escrita numa biblioteca somente leitura. */
export class ReadOnlyLibraryError extends Error {
  constructor() {
    super(
      'Esta biblioteca é somente leitura. Configure o Supabase para criar e editar músicas pelo app.',
    );
    this.name = 'ReadOnlyLibraryError';
  }
}
