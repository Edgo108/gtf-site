import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { GangTrashTable } from "@/components/gangs/GangTrashTable";
import type { Gang } from "@/lib/supabase/gangs-types";

export default async function CorbeilleGangsPage() {
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
  const { data: gangs } = await admin
    .from("gangs")
    .select("*")
    .not("deleted_at", "is", null)
    .order("deleted_at", { ascending: false })
    .returns<Gang[]>();

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="font-display text-2xl font-bold uppercase tracking-wide">
        Corbeille — Gangs
      </h1>
      <p className="mt-1 font-mono text-sm text-gtf-text-muted">
        {gangs?.length ?? 0} gang(s) supprimé(s)
      </p>

      <div className="mt-6">
        <GangTrashTable gangs={gangs ?? []} />
      </div>
    </div>
  );
}
