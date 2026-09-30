import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminPage } from "@/lib/auth/require-page";
import { getPseudoMap } from "@/lib/archives/agents";
import { TrashTable } from "@/components/ui/TrashTable";
import {
  permanentlyDeletePlainte,
  permanentlyDeleteRapport,
  restorePlainte,
  restoreRapport,
} from "./actions";
import {
  formatNumero,
  type Plainte,
  type Rapport,
} from "@/lib/supabase/archives-types";

export default async function CorbeilleArchivesPage() {
  await requireAdminPage();

  const admin = createAdminClient();
  const [{ data: rapports }, { data: plaintes }] = await Promise.all([
    admin
      .from("rapports")
      .select("id, numero, agent_redacteur_id, nom_suspect, deleted_at")
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false })
      .returns<
        Pick<Rapport, "id" | "numero" | "agent_redacteur_id" | "nom_suspect" | "deleted_at">[]
      >(),
    admin
      .from("plaintes")
      .select("id, numero, agent_redacteur_id, nom_victime, deleted_at")
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false })
      .returns<
        Pick<Plainte, "id" | "numero" | "agent_redacteur_id" | "nom_victime" | "deleted_at">[]
      >(),
  ]);

  const pseudoById = await getPseudoMap([
    ...(rapports ?? []).map((r) => r.agent_redacteur_id),
    ...(plaintes ?? []).map((p) => p.agent_redacteur_id),
  ]);
  const pseudo = (agentId: string) => pseudoById.get(agentId) ?? "Agent inconnu";
  const numero = (n: number) => (
    <span className="font-mono">#{formatNumero(n)}</span>
  );

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="font-display text-2xl font-bold uppercase tracking-wide">
        Corbeille — Archives
      </h1>

      <h2 className="mt-6 font-display text-sm font-semibold uppercase tracking-wider text-gtf-text-muted">
        Rapports — {rapports?.length ?? 0} supprimé(s)
      </h2>
      <div className="mt-3">
        <TrashTable
          columns={["N°", "Agent rédacteur", "Suspect"]}
          rows={(rapports ?? []).map((r) => ({
            id: r.id,
            name: `#${formatNumero(r.numero)}`,
            deletedAt: r.deleted_at,
            cells: [numero(r.numero), pseudo(r.agent_redacteur_id), r.nom_suspect || "—"],
          }))}
          restore={restoreRapport}
          destroy={permanentlyDeleteRapport}
          restoreSuccess="Rapport restauré"
          destroySuccess="Rapport supprimé définitivement"
          destroyConfirm="Supprimer définitivement le rapport"
        />
      </div>

      <h2 className="mt-8 font-display text-sm font-semibold uppercase tracking-wider text-gtf-text-muted">
        Plaintes — {plaintes?.length ?? 0} supprimée(s)
      </h2>
      <div className="mt-3">
        <TrashTable
          columns={["N°", "Agent rédacteur", "Victime"]}
          deletedLabel="Supprimée le"
          rows={(plaintes ?? []).map((p) => ({
            id: p.id,
            name: `#${formatNumero(p.numero)}`,
            deletedAt: p.deleted_at,
            cells: [numero(p.numero), pseudo(p.agent_redacteur_id), p.nom_victime || "—"],
          }))}
          restore={restorePlainte}
          destroy={permanentlyDeletePlainte}
          restoreSuccess="Plainte restaurée"
          destroySuccess="Plainte supprimée définitivement"
          destroyConfirm="Supprimer définitivement la plainte"
        />
      </div>
    </div>
  );
}
