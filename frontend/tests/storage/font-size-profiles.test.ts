import { describe, it, expect, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useFontSize } from '@/hooks/useFontSize';
import { preferencesStorage } from '@/lib/storage/preferences';

describe('useFontSize — leitor e modo apresentação', () => {
  beforeEach(() => {
    act(() => preferencesStorage.update({ fontSize: 18, stageFontSize: 24 }));
  });

  it('no modo apresentação desce abaixo de 18, até o mínimo de 10', () => {
    const { result } = renderHook(() => useFontSize('stage'));
    for (let i = 0; i < 20; i++) act(() => result.current.decrease());
    expect(result.current.fontSize).toBe(10);
    expect(result.current.canDecrease).toBe(false);
  });

  it('os tamanhos são independentes', () => {
    const reader = renderHook(() => useFontSize());
    const stage = renderHook(() => useFontSize('stage'));
    act(() => stage.result.current.decrease());
    expect(stage.result.current.fontSize).toBe(22);
    expect(reader.result.current.fontSize).toBe(18);
  });

  it('o leitor mantém o mínimo de 12', () => {
    const { result } = renderHook(() => useFontSize());
    for (let i = 0; i < 20; i++) act(() => result.current.decrease());
    expect(result.current.fontSize).toBe(12);
  });
});
