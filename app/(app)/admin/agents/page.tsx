import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { CreateAgentForm } from "@/components/admin/CreateAgentForm";
import { AgentsTable } from "@/components/admin/AgentsTable";
import type { Profile } from "@/lib/supabase/types";

export default async function AdminAgentsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  const { data: currentProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  // Défense en profondeur : le proxy bloque déjà les non-admins sur /admin/*.
  if (currentProfile?.role !== "admin") {
    redirect("/dashboard");
  }

  const admin = createAdminClient();
  const { data: profiles } = await admin
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: true });

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="font-display text-2xl font-bold uppercase tracking-wide">
        Gestion des agents
      </h1>
      <p className="mt-1 font-mono text-sm text-gtf-text-muted">
        {profiles?.length ?? 0} compte(s)
      </p>

      <div className="mt-6">
        <CreateAgentForm />
      </div>

      <div className="mt-6">
        <AgentsTable
          profiles={(profiles as Profile[]) ?? []}
          currentUserId={user.id}
        />
      </div>
    </div>
  );
}
