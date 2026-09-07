import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { CreateAgentForm } from "@/components/admin/CreateAgentForm";
import { AgentsTable } from "@/components/admin/AgentsTable";
import { canManageUnite } from "@/lib/permissions";
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
    .select("role, grade")
    .eq("id", user.id)
    .single<Pick<Profile, "role" | "grade">>();

  const isFullAdmin = currentProfile?.role === "admin";
  const isUniteManager = currentProfile
    ? canManageUnite(currentProfile)
    : false;

  // Défense en profondeur : le proxy autorise déjà l'admin partout et les
  // grades habilités uniquement sur cette page.
  if (!isFullAdmin && !isUniteManager) {
    redirect("/dashboard");
  }

  const admin = createAdminClient();
  const { data: profiles } = await admin
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: true });

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="font-display text-2xl font-bold uppercase tracking-wide">
        Gestion des agents
      </h1>
      <p className="mt-1 font-mono text-sm text-gtf-text-muted">
        {profiles?.length ?? 0} compte(s)
        {!isFullAdmin && (
          <span className="ml-2 text-gtf-amber">
            · accès limité à la réattribution des unités
          </span>
        )}
      </p>

      {isFullAdmin && (
        <div className="mt-6">
          <CreateAgentForm />
        </div>
      )}

      <div className="mt-6">
        <AgentsTable
          profiles={(profiles as Profile[]) ?? []}
          currentUserId={user.id}
          canManageAgents={isFullAdmin}
          canManageUnite={isFullAdmin || isUniteManager}
        />
      </div>
    </div>
  );
}
