import { CloudOff } from 'lucide-react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

/** "há 2 dias", "hoje" — o suficiente para saber se a cópia envelheceu. */
function agoLabel(iso: string): string | null {
  const saved = new Date(iso);
  if (Number.isNaN(saved.getTime())) return null;

  const days = Math.floor((Date.now() - saved.getTime()) / 86_400_000);
  if (days <= 0) return 'de hoje';
  if (days === 1) return 'de ontem';
  return `de ${days} dias atrás`;
}

interface OfflineNoticeProps {
  /** Data da cópia em cache em uso, ou null quando os dados estão frescos. */
  staleSince?: string | null;
}

/**
 * Faixa discreta avisando que o app está sem rede.
 *
 * Aparece quando o aparelho está offline **ou** quando a biblioteca veio da
 * cópia local — os dois casos em que o que está na tela pode não ser o que
 * está no servidor. Nada de bloquear a tela: as músicas continuam abrindo, e
 * quem está tocando não pode ser interrompido por um aviso.
 */
export function OfflineNotice({ staleSince }: OfflineNoticeProps) {
  const online = useOnlineStatus();
  const usingCache = staleSince != null;

  if (online && !usingCache) return null;

  const age = staleSince ? agoLabel(staleSince) : null;

  return (
    <div
      role="status"
      className="mb-4 flex items-center gap-2.5 rounded-2xl border border-gold-500/35 bg-[color-mix(in_srgb,var(--color-gold-400)_10%,transparent)] px-4 py-2.5 text-sm text-foreground"
    >
      <CloudOff className="size-4 shrink-0 text-gold-600 dark:text-gold-400" />
      <p>
        {usingCache ? (
          <>
            <strong className="font-semibold">Sem conexão.</strong> Mostrando a lista salva
            {age ? ` ${age}` : ''} — as músicas já baixadas continuam abrindo.
          </>
        ) : (
          <>
            <strong className="font-semibold">Sem conexão.</strong> Você pode ler e transpor
            normalmente; salvar e importar voltam quando a rede voltar.
          </>
        )}
      </p>
    </div>
  );
}
