import { useCallback, useEffect, useState } from 'react';
import { parseMissaDate } from '@/lib/missa';
import {
  daysForDate,
  loadCalendar,
  loadSuggestions,
  readChosenDay,
  saveChosenDay,
  type LiturgicalDay,
  type SuggestionGroup,
} from '@/lib/missa-suggestions';
import type { Playlist } from '@/types/playlist';

export interface MissaSuggestions {
  /** `unavailable`: o site não respondeu. `no-day`: a data não está no calendário dele. */
  readonly status: 'loading' | 'ready' | 'no-day' | 'unavailable';
  readonly day?: LiturgicalDay;
  /** As opções do calendário para a data (no sábado, são duas). */
  readonly options: readonly LiturgicalDay[];
  readonly groups: readonly SuggestionGroup[];
  readonly chooseDay: (day: LiturgicalDay) => void;
}

/**
 * Sugestões do dia para uma missa. Vem com `null` quando não se aplica (playlist
 * comum, ou conta que não pode importar): não busca nada.
 *
 * Não faz falta para montar a missa, então falhar aqui só esconde as sugestões.
 */
export function useMissaSuggestions(playlist: Playlist | null): MissaSuggestions {
  const id = playlist?.id;
  const date = playlist ? parseMissaDate(playlist.name) : undefined;

  const [options, setOptions] = useState<readonly LiturgicalDay[]>([]);
  const [day, setDay] = useState<LiturgicalDay>();
  const [groups, setGroups] = useState<readonly SuggestionGroup[]>([]);
  const [status, setStatus] = useState<MissaSuggestions['status']>('loading');

  // Da data ao dia litúrgico. A escolha feita à mão para esta data vale mais.
  useEffect(() => {
    setDay(undefined);
    setGroups([]);
    setOptions([]);
    if (!id) return;
    setStatus('loading');

    const chosen = readChosenDay(id, date);
    let active = true;
    void (async () => {
      let found: LiturgicalDay[] = [];
      let failed = false;
      if (date) {
        try {
          found = daysForDate(await loadCalendar(), date);
        } catch {
          failed = true;
        }
      }
      if (!active) return;
      setOptions(found);
      const initial = chosen ?? found[0];
      if (initial) setDay(initial);
      else setStatus(failed ? 'unavailable' : 'no-day');
    })();

    return () => {
      active = false;
    };
  }, [id, date]);

  // Do dia litúrgico às músicas.
  useEffect(() => {
    if (!day) return;
    let active = true;
    setStatus('loading');
    loadSuggestions(day.slug).then(
      (loaded) => {
        if (!active) return;
        setGroups(loaded);
        setStatus('ready');
      },
      () => {
        if (active) setStatus('unavailable');
      },
    );
    return () => {
      active = false;
    };
  }, [day]);

  const chooseDay = useCallback(
    (next: LiturgicalDay) => {
      if (id) saveChosenDay(id, date, next);
      setDay(next);
    },
    [id, date],
  );

  return { status, options, groups, chooseDay, ...(day && { day }) };
}
