import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { WantedForm } from "@/components/wanted/WantedForm";
import { uniteCanWrite } from "@/lib/permissions";
import type { WantedNotice } from "@/lib/supabase/wanted-notices-types";
import { withSignedPhotos } from "@/lib/wanted/photos";

export default async function ModifierMandatPage({
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

  if (!uniteCanWrite("mandats", profile ?? {})) {
    redirect(`/mandats/${id}`);
  }

  const { data: rawNotice } = await supabase
    .from("wanted_notices")
    .select("*")
    .eq("id", id)
    .single<WantedNotice>();

  if (!rawNotice) {
    notFound();
  }
  const [notice] = await withSignedPhotos(supabase, [rawNotice]);

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-display text-2xl font-bold uppercase tracking-wide">
        Modifier le mandat
      </h1>
      <div className="mt-6">
        <WantedForm notice={notice} />
      </div>
    </div>
  );
}
