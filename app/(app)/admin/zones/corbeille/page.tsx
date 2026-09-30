import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminPage } from "@/lib/auth/require-page";
import { TrashTable } from "@/components/ui/TrashTable";
import { LabCategorieBadge, LabStatutBadge } from "@/components/zones/LabBadges";
import {
  permanentlyDeleteLabMarker,
  permanentlyDeleteZone,
  restoreLabMarker,
  restoreZone,
} from "./actions";
import type { SensitiveZone } from "@/lib/supabase/zones-types";
import type { LabMarker } from "@/lib/supabase/lab-markers-types";

const TYPE_LABELS: Record<string, string> = {
  vente: "Vente",
  qg: "QG",
  influence: "QG",
};

export default async function CorbeilleZonesPage() {
  await requireAdminPage();

  const admin = createAdminClient();
  const [{ data: zones }, { data: labMarkers }, { data: gangs }] =
    await Promise.all([
      admin
        .from("sensitive_zones")
        .select("id, gang_id, type_zone, deleted_at")
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false })
        .returns<Pick<SensitiveZone, "id" | "gang_id" | "type_zone" | "deleted_at">[]>(),
      admin
        .from("lab_markers")
        .select("id, organisation_id, categorie, statut, deleted_at")
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false })
        .returns<
          Pick<LabMarker, "id" | "organisation_id" | "categorie" | "statut" | "deleted_at">[]
        >(),
      admin
        .from("gangs")
        .select("id, nom, deleted_at")
        .returns<{ id: string; nom: string; deleted_at: string | null }[]>(),
    ]);

  // Organisation en corbeille : on le signale plutôt que « inconnue ».
  const gangLabel = new Map(
    (gangs ?? []).map((g) => [g.id, g.deleted_at ? `${g.nom} (en corbeille)` : g.nom]),
  );
  const orgOf = (id: string) => gangLabel.get(id) ?? "Organisation inconnue";

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="font-display text-2xl font-bold uppercase tracking-wide">
        Corbeille — Carte interactive
      </h1>

      <h2 className="mt-6 font-display text-sm font-semibold uppercase tracking-wider text-gtf-text-muted">
        Zones sensibles — {zones?.length ?? 0} supprimée(s)
      </h2>
      <div className="mt-3">
        <TrashTable
          columns={["Organisation", "Type"]}
          deletedLabel="Supprimée le"
          rows={(zones ?? []).map((z) => ({
            id: z.id,
            name: `${TYPE_LABELS[z.type_zone] ?? z.type_zone} — ${orgOf(z.gang_id)}`,
            deletedAt: z.deleted_at,
            cells: [orgOf(z.gang_id), TYPE_LABELS[z.type_zone] ?? z.type_zone],
          }))}
          restore={restoreZone}
          destroy={permanentlyDeleteZone}
          restoreSuccess="Zone restaurée"
          destroySuccess="Zone supprimée définitivement"
          destroyConfirm="Supprimer définitivement la zone"
        />
      </div>

      <h2 className="mt-8 font-display text-sm font-semibold uppercase tracking-wider text-gtf-text-muted">
        Marqueurs laboratoire — {labMarkers?.length ?? 0} supprimé(s)
      </h2>
      <div className="mt-3">
        <TrashTable
          columns={["Catégorie", "Statut", "Organisation"]}
          rows={(labMarkers ?? []).map((m) => ({
            id: m.id,
            name: `labo — ${orgOf(m.organisation_id)}`,
            deletedAt: m.deleted_at,
            cells: [
              <LabCategorieBadge key="cat" categorie={m.categorie} />,
              <LabStatutBadge key="statut" statut={m.statut} />,
              orgOf(m.organisation_id),
            ],
          }))}
          restore={restoreLabMarker}
          destroy={permanentlyDeleteLabMarker}
          restoreSuccess="Marqueur laboratoire restauré"
          destroySuccess="Marqueur laboratoire supprimé définitivement"
          destroyConfirm="Supprimer définitivement le marqueur"
        />
      </div>
    </div>
  );
}
