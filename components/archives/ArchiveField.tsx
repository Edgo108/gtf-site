import type { ReactNode } from "react";

// Libellé + valeur d'un champ dans la vue détaillée d'un Rapport/Plainte.
export function ArchiveField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div>
      <span className="font-mono text-xs uppercase tracking-wider text-gtf-text-muted">
        {label}
      </span>
      <div className="mt-1 text-sm">{children}</div>
    </div>
  );
}

export function EmptyValue() {
  return <span className="text-gtf-text-muted">Non renseigné</span>;
}
