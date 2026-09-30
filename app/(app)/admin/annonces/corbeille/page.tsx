import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminPage } from "@/lib/auth/require-page";
import { TrashTable } from "@/components/ui/TrashTable";
import {
  permanentlyDeleteAnnouncement,
  restoreAnnouncement,
} from "@/app/(app)/admin/corbeille/actions";
import type { Announcement } from "@/lib/supabase/announcements-types";
import { BADGE_TONES, badgeBase } from "@/lib/ui/styles";

export default async function CorbeilleAnnoncesPage() {
  await requireAdminPage();

  const { data } = await createAdminClient()
    .from("announcements")
    .select("id, titre, priorite, deleted_at")
    .not("deleted_at", "is", null)
    .order("deleted_at", { ascending: false })
    .returns<Pick<Announcement, "id" | "titre" | "priorite" | "deleted_at">[]>();
  const rows = data ?? [];

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="font-display text-2xl font-bold uppercase tracking-wide">
        Corbeille — Annonces
      </h1>
      <p className="mt-1 font-mono text-sm text-gtf-text-muted">
        {rows.length} notification(s) supprimée(s)
      </p>

      <div className="mt-6">
        <TrashTable
          columns={["Titre", "Priorité"]}
          deletedLabel="Supprimée le"
          rows={rows.map((a) => ({
            id: a.id,
            name: a.titre,
            deletedAt: a.deleted_at ?? null,
            cells: [
              a.titre,
              <span
                key="priorite"
                className={`${badgeBase} ${
                  a.priorite === "urgente" ? BADGE_TONES.red : BADGE_TONES.muted
                }`}
              >
                {a.priorite === "urgente" ? "Urgente" : "Normale"}
              </span>,
            ],
          }))}
          restore={restoreAnnouncement}
          destroy={permanentlyDeleteAnnouncement}
          restoreSuccess="Notification restaurée"
          destroySuccess="Notification supprimée définitivement"
          destroyConfirm="Supprimer définitivement la notification"
        />
      </div>
    </div>
  );
}
