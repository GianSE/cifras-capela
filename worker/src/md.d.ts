/**
 * Permite `import prompt from './prompts/x.md'` — o wrangler carrega o `.md`
 * como string (regra `type = "Text"` no wrangler.toml).
 */
declare module '*.md' {
  const content: string;
  export default content;
}
