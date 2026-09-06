import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Panel } from "@/components/ui/Panel";
import { ChangePasswordForm } from "@/components/auth/ChangePasswordForm";
import type { Profile } from "@/lib/supabase/types";

export default async function ProfilPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("pseudo, grade, statut, role")
    .eq("id", user!.id)
    .single<Pick<Profile, "pseudo" | "grade" | "statut" | "role">>();

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="font-display text-2xl font-bold uppercase tracking-wide">
        Mon profil
      </h1>

      <Panel title="Informations" className="mt-6">
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 text-sm">
          <dt className="font-mono text-xs uppercase tracking-wider text-gtf-text-muted">
            Pseudo
          </dt>
          <dd>{profile?.pseudo}</dd>

          <dt className="font-mono text-xs uppercase tracking-wider text-gtf-text-muted">
            Grade
          </dt>
          <dd>{profile?.grade}</dd>

          <dt className="font-mono text-xs uppercase tracking-wider text-gtf-text-muted">
            Statut
          </dt>
          <dd>
            <span
              className={
                profile?.statut === "actif"
                  ? "text-gtf-green"
                  : "text-gtf-red"
              }
            >
              {profile?.statut}
            </span>
          </dd>
        </dl>
        <p className="mt-4 text-xs text-gtf-text-muted">
          {profile?.role === "admin" ? (
            <>
              Modifiable depuis{" "}
              <Link href="/admin/agents" className="text-gtf-blue-hover underline">
                Gestion des agents
              </Link>
              .
            </>
          ) : (
            "Ces informations ne sont modifiables que par un administrateur."
          )}
        </p>
      </Panel>

      <Panel title="Changer mon mot de passe" className="mt-6">
        <ChangePasswordForm mode="voluntary" userId={user!.id} />
      </Panel>
    </div>
  );
}
