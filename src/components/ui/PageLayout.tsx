import { Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import type { ReactNode } from 'react';

interface PageLayoutProps {
  /** Optional back link: { to, label } */
  back?: { to: string; label: string };
  /** Optional page title (e.g. h2) */
  title?: string;
  children: ReactNode;
  /** If true, no max-width container (e.g. for DayView) */
  fullWidth?: boolean;
}

export function PageLayout({ back, title, children, fullWidth }: PageLayoutProps) {
  return (
    <div className={fullWidth ? '' : 'max-w-[640px] mx-auto'}>
      {back && (
        <Link
          to={back.to}
          className="inline-flex items-center gap-1 text-primary font-semibold min-h-tap mb-3 -ml-0.5 rounded-lg py-1 pr-2 hover:bg-primary/5 active:bg-primary/10 transition-colors"
        >
          <ChevronLeft size={22} strokeWidth={2.5} />
          {back.label}
        </Link>
      )}
      {title && <h2 className="text-xl font-bold text-slate-900 mt-0 mb-1 tracking-tight">{title}</h2>}
      {children}
    </div>
  );
}
