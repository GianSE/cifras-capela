import type { Section } from '@/types/song';
import { SongLine } from './SongLine';

interface SongSectionProps {
  section: Section;
  /** Âncora para o salto de seção do leitor. */
  id?: string;
}

export function SongSection({ section, id }: SongSectionProps) {
  // Determine the styling class based on the section type
  let sectionClass = 'my-4';
  if (section.type === 'chorus') {
    sectionClass = 'my-6 py-2 section-chorus';
  } else if (section.type === 'bridge') {
    sectionClass = 'my-6 py-2 section-bridge';
  }

  return (
    <div id={id} className={sectionClass}>
      {/* O ouro é dos acordes: o rótulo da seção fica no azul do manto e, no
          tema escuro (onde o dourado é a cor de ação), num azul claro — senão
          ele competiria com os acordes logo abaixo. */}
      {section.label && section.type !== 'none' && (
        <div className="section-label mb-2 text-xs font-bold uppercase tracking-[0.14em] text-primary dark:text-navy-300">
          {section.label}
        </div>
      )}

      <div className="flex flex-col">
        {section.lines.map((line, index) => (
          <SongLine key={index} line={line} />
        ))}
      </div>
    </div>
  );
}
