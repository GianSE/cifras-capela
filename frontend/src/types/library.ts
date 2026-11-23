/**
 * @module types/library
 * @description Tipos do índice da biblioteca de músicas.
 *
 * Formato em que o Worker devolve a biblioteca e que serviços e hooks consomem.
 */

/**
 * Entrada do índice de busca, derivada dos metadados (frontmatter YAML ou
 * diretivas ChordPro) de cada música ao salvá-la.
 */
export interface SongIndexEntry {
  /** Caminho/ID da música, ex: `harpa-crista/porque-ele-vive`. */
  readonly id: string;
  /** Título da música. */
  readonly title: string;
  /** Artista/intérprete. */
  readonly artist?: string;
  /** Tonalidade original (ex: `G`, `Am`). */
  readonly key?: string;
  /** Categorias (ex: `culto`, `santa ceia`). */
  readonly categories?: readonly string[];
  /** Tags livres. */
  readonly tags?: readonly string[];
  /** Idioma (ex: `pt`, `en`). */
  readonly language?: string;
  /** Andamento em BPM. */
  readonly tempo?: number;
  /** Id do vídeo no YouTube — mostra o play nos cards sem abrir a cifra. */
  readonly youtube?: string;
  /** Folha guardada (foto ou PDF) ligada a esta música. */
  readonly scan?: string;
  /** Nome do arquivo de origem. */
  readonly filename: string;
  /**
   * Se a música tem letra transcrita — o sim ou não, não o texto.
   *
   * A letra saiu do índice: com a biblioteca perto de 15 mil cifras eram 12MB
   * por abertura do app. Quem procura por um trecho é o servidor
   * (`/api/songs/busca`); quem precisa comparar o texto pede as letras dos
   * poucos candidatos (`/api/songs/letras`). Aqui fica só o que a lista usa:
   * saber se a música é só foto, sem cifra digitada.
   */
  readonly hasLyrics?: boolean;
}

/**
 * Entrada do índice **com** a letra junto.
 *
 * O índice da biblioteca não traz mais a letra, então quem compara texto — a
 * auditoria e o aviso de "pode já estar na biblioteca" — busca as letras à
 * parte e trabalha com este tipo. Também é o que sai do `.cho` ao salvar: a
 * coluna `lyrics` no banco é o que alimenta o índice FTS5 do servidor.
 */
export interface SongWithLyrics extends SongIndexEntry {
  /** Letra em texto puro, sem acordes nem diretivas. */
  readonly lyrics?: string;
}
