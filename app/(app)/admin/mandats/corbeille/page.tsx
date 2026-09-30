import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminPage } from "@/lib/auth/require-page";
import { TrashTable } from "@/components/ui/TrashTable";
import { DangerBadge } from "@/components/wanted/DangerBadge";
import { StatutBadge } from "@/components/wanted/StatutBadge";
import {
  permanentlyDeleteWantedNotice,
  restoreWantedNotice,
} from "@/app/(app)/admin/corbeille/actions";
import type { WantedNotice } from "@/lib/supabase/wanted-notices-types";

export default async function CorbeilleMandatsPage() {
  await requireAdminPage();

  const { data } = await createAdminClient()
    .from("wanted_notices")
    .select("id, nom_suspect, niveau_dangerosite, statut, deleted_at")
    .not("deleted_at", "is", null)
    .order("deleted_at", { ascending: false })
    .returns<
      Pick<WantedNotice, "id" | "nom_suspect" | "niveau_dangerosite" | "statut" | "deleted_at">[]
    >();
  const rows = data ?? [];

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="font-display text-2xl font-bold uppercase tracking-wide">
        Corbeille — Mandats de recherche
      </h1>
      <p className="mt-1 font-mono text-sm text-gtf-text-muted">
        {rows.length} mandat(s) supprimé(s)
      </p>

      <div className="mt-6">
        <TrashTable
          columns={["Suspect", "Dangerosité", "Statut"]}
          rows={rows.map((n) => ({
            id: n.id,
            name: n.nom_suspect,
            deletedAt: n.deleted_at ?? null,
            cells: [
              n.nom_suspect,
              <DangerBadge key="danger" niveau={n.niveau_dangerosite} />,
              <StatutBadge key="statut" statut={n.statut} />,
            ],
          }))}
          restore={restoreWantedNotice}
          destroy={permanentlyDeleteWantedNotice}
          restoreSuccess="Mandat restauré"
          destroySuccess="Mandat supprimé définitivement"
          destroyConfirm="Supprimer définitivement le mandat de"
          destroyWarning="Sa photo sera aussi effacée."
        />
      </div>
    </div>
  );
}
