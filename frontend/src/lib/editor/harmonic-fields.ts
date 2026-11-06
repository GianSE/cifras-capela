/**
 * Campo harmônico por tom: os 7 acordes diatônicos (I ao vii°), na ordem dos
 * graus. Ajuda a saber quais acordes cabem na música pelo tom em que ela está.
 * Maiores primeiro, depois menores (relativas).
 */
export const HARMONIC_FIELDS: Record<string, readonly string[]> = {
  // Maiores: I ii iii IV V vi vii°
  C: ['C', 'Dm', 'Em', 'F', 'G', 'Am', 'B°'],
  D: ['D', 'Em', 'F#m', 'G', 'A', 'Bm', 'C#°'],
  E: ['E', 'F#m', 'G#m', 'A', 'B', 'C#m', 'D#°'],
  G: ['G', 'Am', 'Bm', 'C', 'D', 'Em', 'F#°'],
  A: ['A', 'Bm', 'C#m', 'D', 'E', 'F#m', 'G#°'],
  B: ['B', 'C#m', 'D#m', 'E', 'F#', 'G#m', 'A#°'],
  // Menores: i ii° III iv v VI VII
  Cm: ['Cm', 'D°', 'Eb', 'Fm', 'Gm', 'Ab', 'Bb'],
  Dm: ['Dm', 'E°', 'F', 'Gm', 'Am', 'Bb', 'C'],
  Em: ['Em', 'F#°', 'G', 'Am', 'Bm', 'C', 'D'],
  Fm: ['Fm', 'G°', 'Ab', 'Bbm', 'Cm', 'Db', 'Eb'],
  Gm: ['Gm', 'A°', 'Bb', 'Cm', 'Dm', 'Eb', 'F'],
  Am: ['Am', 'B°', 'C', 'Dm', 'Em', 'F', 'G'],
  Bm: ['Bm', 'C#°', 'D', 'Em', 'F#m', 'G', 'A'],
};

export const HARMONIC_KEYS = Object.keys(HARMONIC_FIELDS);
