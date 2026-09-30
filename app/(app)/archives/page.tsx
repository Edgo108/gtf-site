import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

// Point d'entrée « Archives » : regroupe Enquêtes, Rapports et Plaintes.
export default async function ArchivesPage() {
  const supabase = await createClient();

  const [investigations, rapports, plaintes] = await Promise.all([
    supabase.from("investigations").select("id", { count: "exact", head: true }),
    supabase.from("rapports").select("id", { count: "exact", head: true }),
    supabase.from("plaintes").select("id", { count: "exact", head: true }),
  ]);

  const sections = [
    {
      href: "/enquetes",
      code: "ENQ",
      titre: "Enquêtes",
      description:
        "Dossiers d'enquête en cours et clôturés : suspects, preuves, casier.",
      count: investigations.count,
    },
    {
      href: "/archives/rapports",
      code: "RAP",
      titre: "Rapport",
      description:
        "Rapports d'intervention : agents engagés, suspect, droits Miranda, déroulé.",
      count: rapports.count,
    },
    {
      href: "/archives/plaintes",
      code: "PLT",
      titre: "Plainte",
      description:
        "Dépôts de plainte : victime, faits, signatures de la victime et de l'agent.",
      count: plaintes.count,
    },
  ];

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="font-display text-2xl font-bold uppercase tracking-wide">
        Archives
      </h1>
      <p className="mt-1 font-mono text-sm text-gtf-text-muted">
        Sélectionnez une section.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        {sections.map((section) => (
          <Link
            key={section.href}
            href={section.href}
            className="group flex flex-col rounded-md border border-gtf-border bg-gtf-panel p-5 transition-colors hover:border-gtf-blue"
          >
            <div className="flex items-start justify-between gap-2">
              <span className="rounded border border-gtf-border bg-gtf-panel-alt px-2 py-0.5 font-mono text-xs tracking-widest text-gtf-text-muted">
                {section.code}
              </span>
              <span className="font-mono text-xs text-gtf-text-muted">
                {section.count ?? "—"} fiche{(section.count ?? 0) > 1 ? "s" : ""}
              </span>
            </div>
            <h2 className="mt-4 font-display text-xl font-semibold uppercase tracking-wide text-gtf-text">
              {section.titre}
            </h2>
            <p className="mt-2 flex-1 text-sm text-gtf-text-muted">
              {section.description}
            </p>
            <span className="mt-4 font-mono text-xs uppercase tracking-wider text-gtf-blue-hover group-hover:underline">
              Ouvrir →
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
