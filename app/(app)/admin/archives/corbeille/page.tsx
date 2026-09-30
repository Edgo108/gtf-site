import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPseudoMap } from "@/lib/archives/agents";
import { formatParisDateTime } from "@/lib/archives/datetime";
import { ArchiveTrashTable } from "@/components/archives/ArchiveTrashTable";
import type { Plainte, Rapport } from "@/lib/supabase/archives-types";

export default async function CorbeilleArchivesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  // Défense en profondeur : le proxy bloque déjà les non-admins sur /admin/*.
  if (profile?.role !== "admin") {
    redirect("/dashboard");
  }

  const admin = createAdminClient();
  const [{ data: rapports }, { data: plaintes }] = await Promise.all([
    admin
      .from("rapports")
      .select("id, numero, agent_redacteur_id, nom_suspect, deleted_at")
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false })
      .returns<
        Pick<
          Rapport,
          "id" | "numero" | "agent_redacteur_id" | "nom_suspect" | "deleted_at"
        >[]
      >(),
    admin
      .from("plaintes")
      .select("id, numero, agent_redacteur_id, nom_victime, deleted_at")
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false })
      .returns<
        Pick<
          Plainte,
          "id" | "numero" | "agent_redacteur_id" | "nom_victime" | "deleted_at"
        >[]
      >(),
  ]);

  const pseudoById = await getPseudoMap([
    ...(rapports ?? []).map((r) => r.agent_redacteur_id),
    ...(plaintes ?? []).map((p) => p.agent_redacteur_id),
  ]);
  const pseudo = (agentId: string) =>
    pseudoById.get(agentId) ?? "Agent inconnu";

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="font-display text-2xl font-bold uppercase tracking-wide">
        Corbeille — Archives
      </h1>

      <h2 className="mt-6 font-display text-sm font-semibold uppercase tracking-wider text-gtf-text-muted">
        Rapports — {rapports?.length ?? 0} supprimé(s)
      </h2>
      <div className="mt-3">
        <ArchiveTrashTable
          kind="rapport"
          rows={(rapports ?? []).map((r) => ({
            id: r.id,
            numero: r.numero,
            agentPseudo: pseudo(r.agent_redacteur_id),
            personne: r.nom_suspect,
            deletedAt: formatParisDateTime(r.deleted_at),
          }))}
        />
      </div>

      <h2 className="mt-8 font-display text-sm font-semibold uppercase tracking-wider text-gtf-text-muted">
        Plaintes — {plaintes?.length ?? 0} supprimée(s)
      </h2>
      <div className="mt-3">
        <ArchiveTrashTable
          kind="plainte"
          rows={(plaintes ?? []).map((p) => ({
            id: p.id,
            numero: p.numero,
            agentPseudo: pseudo(p.agent_redacteur_id),
            personne: p.nom_victime,
            deletedAt: formatParisDateTime(p.deleted_at),
          }))}
        />
      </div>
    </div>
  );
}
