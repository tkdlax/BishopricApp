import type { ReactNode } from 'react';

interface SectionProps {
  heading: string;
  children: ReactNode;
}

export function Section({ heading, children }: SectionProps) {
  return (
    <section className="mb-6">
      {heading ? <h3 className="text-sm font-semibold text-muted uppercase tracking-wide mb-2">{heading}</h3> : null}
      {children}
    </section>
  );
}
