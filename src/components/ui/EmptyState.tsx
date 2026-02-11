import type { ReactNode } from 'react';

interface EmptyStateProps {
  message: string;
  action?: ReactNode;
}

export function EmptyState({ message, action }: EmptyStateProps) {
  return (
    <div className="text-muted text-center py-8">
      <p className="mb-3">{message}</p>
      {action != null && <div>{action}</div>}
    </div>
  );
}
