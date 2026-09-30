import {
  formatDollars,
  formatPrisonDuration,
  type InfractionTotals,
} from "@/lib/supabase/code-penal-types";

// Totaux (lecture seule) d'une liste d'infractions : formulaire Rapport
// après « Valider », et fiche du rapport.
export function InfractionTotalsView({ totals }: { totals: InfractionTotals }) {
  const items = [
    { label: "Amende minimum totale", value: formatDollars(totals.amendeMin) },
    { label: "Amende maximum totale", value: formatDollars(totals.amendeMax) },
    {
      label: "Temps de prison total",
      value: `${totals.prisonUp} UP`,
      sub: formatPrisonDuration(totals.prisonUp),
    },
  ];

  return (
    <dl className="grid gap-3 rounded border border-gtf-border bg-gtf-panel-alt p-3 sm:grid-cols-3">
      {items.map((item) => (
        <div key={item.label}>
          <dt className="font-mono text-[11px] uppercase tracking-wider text-gtf-text-muted">
            {item.label}
          </dt>
          <dd className="mt-1 font-mono text-lg text-gtf-text">
            {item.value}
            {item.sub && (
              <span className="ml-2 text-sm text-gtf-text-muted">
                ({item.sub})
              </span>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}
