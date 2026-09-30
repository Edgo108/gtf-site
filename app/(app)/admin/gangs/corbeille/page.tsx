import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminPage } from "@/lib/auth/require-page";
import { TrashTable } from "@/components/ui/TrashTable";
import { CategorieBadge } from "@/components/gangs/CategorieBadge";
import { permanentlyDeleteGang, restoreGang } from "./actions";
import type { Gang } from "@/lib/supabase/gangs-types";

export default async function CorbeilleGangsPage() {
  await requireAdminPage();

  const admin = createAdminClient();
  const { data: gangs } = await admin
    .from("gangs")
    .select("id, nom, categorie, territoire, deleted_at")
    .not("deleted_at", "is", null)
    .order("deleted_at", { ascending: false })
    .returns<Pick<Gang, "id" | "nom" | "categorie" | "territoire" | "deleted_at">[]>();

  const rows = gangs ?? [];

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="font-display text-2xl font-bold uppercase tracking-wide">
        Corbeille — B.D.D
      </h1>
      <p className="mt-1 font-mono text-sm text-gtf-text-muted">
        {rows.length} fiche(s) supprimée(s)
      </p>

      <div className="mt-6">
        <TrashTable
          columns={["Nom", "Territoire"]}
          rows={rows.map((g) => ({
            id: g.id,
            name: g.nom,
            deletedAt: g.deleted_at,
            cells: [
              <div key="nom" className="flex flex-wrap items-center gap-2">
                <CategorieBadge categorie={g.categorie} />
                <span>{g.nom}</span>
              </div>,
              g.territoire || "—",
            ],
          }))}
          restore={restoreGang}
          destroy={permanentlyDeleteGang}
          restoreSuccess="Fiche B.D.D restaurée"
          destroySuccess="Fiche B.D.D supprimée définitivement"
          destroyConfirm="Supprimer définitivement la fiche"
          destroyWarning="Ses membres et ses liens avec les opérations seront aussi supprimés."
        />
      </div>
    </div>
  );
}
