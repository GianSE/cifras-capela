import type { Section } from '@/types/song';
import { SongLine } from './SongLine';

interface SongSectionProps {
  section: Section;
}

export function SongSection({ section }: SongSectionProps) {
  // Determine the styling class based on the section type
  let sectionClass = 'my-4';
  if (section.type === 'chorus') {
    sectionClass = 'my-6 py-2 section-chorus';
  } else if (section.type === 'bridge') {
    sectionClass = 'my-6 py-2 section-bridge';
  }

  return (
    <div className={sectionClass}>
      {section.label && section.type !== 'none' && (
        <div className="mb-2 text-xs font-bold uppercase tracking-wider text-[var(--color-accent)]">
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
