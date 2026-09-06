import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ChangePasswordForm } from "@/components/auth/ChangePasswordForm";

export default async function ChangerMotDePassePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-gtf-bg px-4">
      <div className="text-center">
        <h1 className="font-display text-2xl font-bold uppercase tracking-wide text-gtf-text">
          Changement de mot de passe requis
        </h1>
        <p className="mt-2 max-w-sm font-mono text-xs text-gtf-text-muted">
          Pour des raisons de sécurité, vous devez définir un nouveau mot de
          passe avant d&apos;accéder au site.
        </p>
      </div>

      <ChangePasswordForm mode="forced" userId={user.id} />
    </main>
  );
}
