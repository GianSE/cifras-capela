/**
 * Configuração da IA: system prompts (carregados dos `.md`) e schemas de saída
 * estruturada (formato `responseSchema` do Gemini — tipos em MAIÚSCULO).
 *
 * Os prompts vivem em `src/prompts/*.md` para serem fáceis de editar sem mexer
 * em código.
 */

import FORMAT_SYSTEM from './prompts/format.md';
import GENERATE_SYSTEM from './prompts/generate.md';

export { FORMAT_SYSTEM, GENERATE_SYSTEM };

/** Schema da formatação: texto bruto → .cho. */
export const FORMAT_SCHEMA = {
  type: 'OBJECT',
  properties: {
    source: {
      type: 'STRING',
      description: 'O arquivo .cho completo (frontmatter + corpo ChordPro).',
    },
    warnings: {
      type: 'ARRAY',
      items: { type: 'STRING' },
      description: 'Avisos sobre o que ficou incerto na conversão.',
    },
  },
  required: ['source', 'warnings'],
} as const;

/** Schema da geração: nome da música → .cho, com nível de confiança. */
export const GENERATE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    source: {
      type: 'STRING',
      description: 'O arquivo .cho gerado (vazio se não conhecer a música).',
    },
    confidence: {
      type: 'STRING',
      enum: ['alta', 'media', 'baixa'],
      description: 'Confiança na letra/acordes gerados.',
    },
    warnings: {
      type: 'ARRAY',
      items: { type: 'STRING' },
      description: 'O que o usuário deve conferir.',
    },
  },
  required: ['source', 'confidence', 'warnings'],
} as const;

export interface FormatResult {
  source: string;
  warnings: string[];
}

export interface GenerateResult {
  source: string;
  confidence: 'alta' | 'media' | 'baixa';
  warnings: string[];
}
