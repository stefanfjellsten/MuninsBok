import type { ReactNode } from "react";

interface ReportPageTemplateProps {
  /** Report title shown in header and empty state */
  title: string;
  isLoading: boolean;
  error: unknown;
  isEmpty: boolean;
  loadingText: string;
  emptyText?: string;
  /** Extra CSS class on the card wrapper */
  className?: string;
  /** Content below the title (e.g. subtitle) */
  titleExtra?: ReactNode;
  /** Buttons in the header (CSV, PDF, Print) */
  actions?: ReactNode;
  /** Filters below the header (DateFilter etc.) */
  filters?: ReactNode;
  children: ReactNode;
}

export function ReportPageTemplate({
  title,
  isLoading,
  error,
  isEmpty,
  loadingText,
  emptyText = "Inga bokförda transaktioner ännu.",
  className,
  titleExtra,
  actions,
  filters,
  children,
}: ReportPageTemplateProps) {
  if (isLoading) {
    return <div className="loading">{loadingText}</div>;
  }

  if (error) {
    return <div className="error">Fel vid hämtning: {(error as Error).message}</div>;
  }

  if (isEmpty) {
    return (
      <div className="card">
        <h2>{title}</h2>
        <div className="empty">{emptyText}</div>
      </div>
    );
  }

  return (
    <div className={className ? `card ${className}` : "card"}>
      <div className="flex justify-between items-center mb-2">
        <div>
          <h2>{title}</h2>
          {titleExtra}
        </div>
        {actions && (
          <div className="flex" style={{ gap: "0.5rem" }}>
            {actions}
          </div>
        )}
      </div>
      {filters && <div className="mb-2">{filters}</div>}
      {children}
    </div>
  );
}
