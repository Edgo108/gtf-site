import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { InvestigationForm } from "@/components/investigations/InvestigationForm";
import { uniteCanWrite } from "@/lib/permissions";

export default async function NouvelleEnquetePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, unite")
    .eq("id", user!.id)
    .single();

  // Défense en profondeur : la RLS bloque déjà l'insertion côté base.
  if (!uniteCanWrite("enquetes", profile ?? {})) {
    redirect("/enquetes");
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-display text-2xl font-bold uppercase tracking-wide">
        Nouvelle enquête
      </h1>
      <div className="mt-6">
        <InvestigationForm />
      </div>
    </div>
  );
}
