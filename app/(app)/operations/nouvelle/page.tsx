import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OperationForm } from "@/components/operations/OperationForm";
import { canAccessOperations } from "@/lib/permissions";

export default async function NouvelleOperationPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, unite")
    .eq("id", user.id)
    .single();

  // Défense en profondeur : la RLS bloque déjà l'insertion côté base.
  if (!canAccessOperations(profile ?? {})) {
    redirect("/operations");
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-display text-2xl font-bold uppercase tracking-wide">
        Nouvelle opération
      </h1>
      <p className="mt-1 font-mono text-sm text-gtf-text-muted">
        Vous en serez automatiquement le lead.
      </p>
      <div className="mt-6">
        <OperationForm />
      </div>
    </div>
  );
}
