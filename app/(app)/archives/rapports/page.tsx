import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getPseudoMap } from "@/lib/archives/agents";
import { ArchiveListTable } from "@/components/archives/ArchiveListTable";
import type { Rapport } from "@/lib/supabase/archives-types";
import { btn } from "@/lib/ui/styles";

export default async function RapportsPage() {
  const supabase = await createClient();
  const user = await getCurrentUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user!.id)
    .single();

  const { data: rapports, error } = await supabase
    .from("rapports")
    .select("id, numero, date_redaction, agent_redacteur_id, nom_suspect")
    .order("numero", { ascending: false })
    .returns<
      Pick<
        Rapport,
        "id" | "numero" | "date_redaction" | "agent_redacteur_id" | "nom_suspect"
      >[]
    >();
  if (error) {
    throw new Error("Chargement des rapports impossible.");
  }

  const pseudoById = await getPseudoMap(
    rapports.map((r) => r.agent_redacteur_id),
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
          Rapports
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
          <Link href="/archives/rapports/nouveau" className={btn("primary", "md")}>
            Nouveau rapport
          </Link>
        </div>
      </div>
      <p className="mt-1 font-mono text-sm text-gtf-text-muted">
        {rapports.length} rapport{rapports.length > 1 ? "s" : ""}
      </p>

      <div className="mt-6">
        <ArchiveListTable
          basePath="/archives/rapports"
          personneLabel="Suspect"
          emptyLabel="Aucun rapport pour l'instant."
          rows={rapports.map((r) => ({
            id: r.id,
            numero: r.numero,
            date_redaction: r.date_redaction,
            agentPseudo: pseudoById.get(r.agent_redacteur_id) ?? "Agent inconnu",
            personne: r.nom_suspect,
          }))}
        />
      </div>
    </div>
  );
}
