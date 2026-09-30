import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { InvestigationForm } from "@/components/investigations/InvestigationForm";
import { uniteCanWrite } from "@/lib/permissions";
import type { Investigation } from "@/lib/supabase/investigations-types";
import { fetchCasierCode, INVESTIGATION_COLUMNS } from "@/lib/investigations/casier";

export default async function ModifierEnquetePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const user = await getCurrentUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, unite")
    .eq("id", user!.id)
    .single();

  if (!uniteCanWrite("enquetes", profile ?? {})) {
    redirect(`/enquetes/${id}`);
  }

  const { data: row } = await supabase
    .from("investigations")
    .select(INVESTIGATION_COLUMNS)
    .eq("id", id)
    .single<Investigation>();

  if (!row) {
    notFound();
  }
  const investigation: Investigation = {
    ...row,
    casier_code_acces: await fetchCasierCode(supabase, id),
  };

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-display text-2xl font-bold uppercase tracking-wide">
        Modifier l&apos;enquête
      </h1>
      <div className="mt-6">
        <InvestigationForm investigation={investigation} />
      </div>
    </div>
  );
}
