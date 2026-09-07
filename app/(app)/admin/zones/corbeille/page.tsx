import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ZoneTrashTable } from "@/components/zones/ZoneTrashTable";
import { LabMarkerTrashTable } from "@/components/zones/LabMarkerTrashTable";
import type { Gang } from "@/lib/supabase/gangs-types";
import type { SensitiveZone } from "@/lib/supabase/zones-types";
import type { LabMarker } from "@/lib/supabase/lab-markers-types";

export default async function CorbeilleZonesPage() {
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
  const [{ data: zones }, { data: labMarkers }, { data: gangs }] =
    await Promise.all([
      admin
        .from("sensitive_zones")
        .select("*")
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false })
        .returns<SensitiveZone[]>(),
      admin
        .from("lab_markers")
        .select("*")
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false })
        .returns<LabMarker[]>(),
      admin.from("gangs").select("*").returns<Gang[]>(),
    ]);

  const gangsById = new Map((gangs ?? []).map((g) => [g.id, g]));

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="font-display text-2xl font-bold uppercase tracking-wide">
        Corbeille — Carte interactive
      </h1>

      <h2 className="mt-6 font-display text-sm font-semibold uppercase tracking-wider text-gtf-text-muted">
        Zones sensibles — {zones?.length ?? 0} supprimée(s)
      </h2>
      <div className="mt-3">
        <ZoneTrashTable zones={zones ?? []} gangsById={gangsById} />
      </div>

      <h2 className="mt-8 font-display text-sm font-semibold uppercase tracking-wider text-gtf-text-muted">
        Marqueurs laboratoire — {labMarkers?.length ?? 0} supprimé(s)
      </h2>
      <div className="mt-3">
        <LabMarkerTrashTable
          markers={labMarkers ?? []}
          gangsById={gangsById}
        />
      </div>
    </div>
  );
}
