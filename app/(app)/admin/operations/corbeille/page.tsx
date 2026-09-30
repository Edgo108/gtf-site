import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminPage } from "@/lib/auth/require-page";
import { getPseudoMap } from "@/lib/archives/agents";
import { TrashTable } from "@/components/ui/TrashTable";
import { OperationStatutBadge } from "@/components/operations/OperationStatutBadge";
import {
  permanentlyDeleteOperation,
  restoreOperation,
} from "@/app/(app)/admin/corbeille/actions";
import type { Operation } from "@/lib/supabase/operations-types";

export default async function CorbeilleOperationsPage() {
  await requireAdminPage();

  const { data } = await createAdminClient()
    .from("operations")
    .select("id, titre, statut, lead_id, deleted_at")
    .not("deleted_at", "is", null)
    .order("deleted_at", { ascending: false })
    .returns<Pick<Operation, "id" | "titre" | "statut" | "lead_id" | "deleted_at">[]>();
  const rows = data ?? [];
  const pseudoById = await getPseudoMap(rows.map((o) => o.lead_id));

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="font-display text-2xl font-bold uppercase tracking-wide">
        Corbeille — Opérations
      </h1>
      <p className="mt-1 font-mono text-sm text-gtf-text-muted">
        {rows.length} opération(s) supprimée(s)
      </p>

      <div className="mt-6">
        <TrashTable
          columns={["Titre", "Lead", "Statut"]}
          deletedLabel="Supprimée le"
          rows={rows.map((o) => ({
            id: o.id,
            name: o.titre,
            deletedAt: o.deleted_at ?? null,
            cells: [
              o.titre,
              pseudoById.get(o.lead_id) ?? "Agent inconnu",
              <OperationStatutBadge key="statut" statut={o.statut} />,
            ],
          }))}
          restore={restoreOperation}
          destroy={permanentlyDeleteOperation}
          restoreSuccess="Opération restaurée"
          destroySuccess="Opération supprimée définitivement"
          destroyConfirm="Supprimer définitivement l'opération"
          destroyWarning="Ses agents en écriture, ses liens et sa carte de planification seront aussi supprimés."
        />
      </div>
    </div>
  );
}
