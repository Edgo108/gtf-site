import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ZoneTrashTable } from "@/components/zones/ZoneTrashTable";
import type { Gang } from "@/lib/supabase/gangs-types";
import type { SensitiveZone } from "@/lib/supabase/zones-types";

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
  const [{ data: zones }, { data: gangs }] = await Promise.all([
    admin
      .from("sensitive_zones")
      .select("*")
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false })
      .returns<SensitiveZone[]>(),
    admin.from("gangs").select("*").returns<Gang[]>(),
  ]);

  const gangsById = new Map((gangs ?? []).map((g) => [g.id, g]));

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="font-display text-2xl font-bold uppercase tracking-wide">
        Corbeille — Zones sensibles
      </h1>
      <p className="mt-1 font-mono text-sm text-gtf-text-muted">
        {zones?.length ?? 0} zone(s) supprimée(s)
      </p>

      <div className="mt-6">
        <ZoneTrashTable zones={zones ?? []} gangsById={gangsById} />
      </div>
    </div>
  );
}
