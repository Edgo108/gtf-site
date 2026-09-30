import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getPseudoMap } from "@/lib/archives/agents";
import { ArchiveListTable } from "@/components/archives/ArchiveListTable";
import type { Plainte } from "@/lib/supabase/archives-types";
import { btn } from "@/lib/ui/styles";

export default async function PlaintesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user!.id)
    .single();

  const { data: plaintes, error } = await supabase
    .from("plaintes")
    .select("id, numero, date_redaction, agent_redacteur_id, nom_victime")
    .order("numero", { ascending: false })
    .returns<
      Pick<
        Plainte,
        "id" | "numero" | "date_redaction" | "agent_redacteur_id" | "nom_victime"
      >[]
    >();
  if (error) {
    throw new Error("Chargement des plaintes impossible.");
  }

  const pseudoById = await getPseudoMap(
    plaintes.map((p) => p.agent_redacteur_id),
  );

  return (
    <div className="mx-auto max-w-6xl">
      <Link
        href="/archives"
        className="font-mono text-xs uppercase tracking-wider text-gtf-text-muted hover:text-gtf-text"
      >
        ← Archives
      </Link>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold uppercase tracking-wide">
          Plaintes
        </h1>
        <div className="flex flex-wrap gap-3">
          {profile?.role === "admin" && (
            <Link
              href="/admin/archives/corbeille"
              className={btn("secondary", "md")}
            >
              Corbeille
            </Link>
          )}
          <Link href="/archives/plaintes/nouvelle" className={btn("primary", "md")}>
            Nouvelle plainte
          </Link>
        </div>
      </div>
      <p className="mt-1 font-mono text-sm text-gtf-text-muted">
        {plaintes.length} plainte{plaintes.length > 1 ? "s" : ""}
      </p>

      <div className="mt-6">
        <ArchiveListTable
          basePath="/archives/plaintes"
          personneLabel="Victime"
          emptyLabel="Aucune plainte pour l'instant."
          rows={plaintes.map((p) => ({
            id: p.id,
            numero: p.numero,
            date_redaction: p.date_redaction,
            agentPseudo: pseudoById.get(p.agent_redacteur_id) ?? "Agent inconnu",
            personne: p.nom_victime,
          }))}
        />
      </div>
    </div>
  );
}
