import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { WantedForm } from "@/components/wanted/WantedForm";
import type { WantedNotice } from "@/lib/supabase/wanted-notices-types";

export default async function ModifierMandatPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: notice } = await supabase
    .from("wanted_notices")
    .select("*")
    .eq("id", id)
    .single<WantedNotice>();

  if (!notice) {
    notFound();
  }

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
