import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { WantedForm } from "@/components/wanted/WantedForm";
import { uniteCanWrite } from "@/lib/permissions";

export default async function NouveauMandatPage() {
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
  if (!uniteCanWrite("mandats", profile ?? {})) {
    redirect("/mandats");
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-display text-2xl font-bold uppercase tracking-wide">
        Nouveau mandat de recherche
      </h1>
      <div className="mt-6">
        <WantedForm />
      </div>
    </div>
  );
}
