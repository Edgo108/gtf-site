import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminPage } from "@/lib/auth/require-page";
import { TrashTable } from "@/components/ui/TrashTable";
import {
  permanentlyDeleteInvestigation,
  restoreInvestigation,
} from "./actions";
import type { Investigation } from "@/lib/supabase/investigations-types";

export default async function CorbeilleEnquetesPage() {
  await requireAdminPage();

  const admin = createAdminClient();
  const { data: investigations } = await admin
    .from("investigations")
    .select("id, titre, agent_responsable, deleted_at")
    .not("deleted_at", "is", null)
    .order("deleted_at", { ascending: false })
    .returns<Pick<Investigation, "id" | "titre" | "agent_responsable" | "deleted_at">[]>();

  const rows = investigations ?? [];

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="font-display text-2xl font-bold uppercase tracking-wide">
        Corbeille — Enquêtes
      </h1>
      <p className="mt-1 font-mono text-sm text-gtf-text-muted">
        {rows.length} enquête(s) supprimée(s)
      </p>

      <div className="mt-6">
        <TrashTable
          columns={["Titre", "Agent responsable"]}
          deletedLabel="Supprimée le"
          rows={rows.map((i) => ({
            id: i.id,
            name: i.titre,
            deletedAt: i.deleted_at,
            cells: [i.titre, i.agent_responsable || "—"],
          }))}
          restore={restoreInvestigation}
          destroy={permanentlyDeleteInvestigation}
          restoreSuccess="Enquête restaurée"
          destroySuccess="Enquête supprimée définitivement"
          destroyConfirm="Supprimer définitivement l'enquête"
        />
      </div>
    </div>
  );
}
