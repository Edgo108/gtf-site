import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { TrashTable } from "@/components/investigations/TrashTable";
import type { Investigation } from "@/lib/supabase/investigations-types";

export default async function CorbeilleEnquetesPage() {
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
  const { data: investigations } = await admin
    .from("investigations")
    .select("*")
    .not("deleted_at", "is", null)
    .order("deleted_at", { ascending: false })
    .returns<Investigation[]>();

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="font-display text-2xl font-bold uppercase tracking-wide">
        Corbeille — Enquêtes
      </h1>
      <p className="mt-1 font-mono text-sm text-gtf-text-muted">
        {investigations?.length ?? 0} enquête(s) supprimée(s)
      </p>

      <div className="mt-6">
        <TrashTable investigations={investigations ?? []} />
      </div>
    </div>
  );
}
