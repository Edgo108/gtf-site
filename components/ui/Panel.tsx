import type { ReactNode } from "react";

export function Panel({
  title,
  children,
  className = "",
}: {
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-md border border-gtf-border bg-gtf-panel p-4 ${className}`}
    >
      {title && (
        <h2 className="mb-3 font-display text-sm font-semibold uppercase tracking-wider text-gtf-text-muted">
          {title}
        </h2>
      )}
      {children}
    </div>
  );
}
