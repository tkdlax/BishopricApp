import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';

const rowClasses =
  'flex items-center gap-3 min-h-tap py-3 px-3 rounded-lg border border-border bg-white hover:bg-slate-50 transition-colors';

interface ListRowProps {
  to?: string;
  avatar?: ReactNode;
  primary: ReactNode;
  secondary?: ReactNode;
  trailing?: ReactNode;
  /** For use as div (e.g. when wrapping custom content) */
  asDiv?: boolean;
  className?: string;
}

export function ListRow({
  to,
  avatar,
  primary,
  secondary,
  trailing,
  asDiv,
  className = '',
}: ListRowProps) {
  const content = (
    <>
      {avatar && <span className="shrink-0 flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-primary font-semibold text-sm">{avatar}</span>}
      <span className="flex-1 min-w-0 flex flex-col gap-0.5">
        <span className="font-semibold truncate">{primary}</span>
        {secondary != null && <span className="text-sm text-muted truncate">{secondary}</span>}
      </span>
      {trailing != null && <span className="shrink-0 text-muted">{trailing}</span>}
    </>
  );

  if (asDiv) {
    return <div className={`${rowClasses} ${className}`}>{content}</div>;
  }
  if (to) {
    return (
      <Link to={to} className={`${rowClasses} no-underline text-inherit ${className}`}>
        {content}
      </Link>
    );
  }
  return <div className={`${rowClasses} ${className}`}>{content}</div>;
}
