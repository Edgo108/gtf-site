import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { GangForm } from "@/components/gangs/GangForm";
import type { Gang } from "@/lib/supabase/gangs-types";

export default async function ModifierGangPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: gang } = await supabase
    .from("gangs")
    .select("*")
    .eq("id", id)
    .single<Gang>();

  if (!gang) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-display text-2xl font-bold uppercase tracking-wide">
        Modifier la fiche gang
      </h1>
      <div className="mt-6">
        <GangForm gang={gang} />
      </div>
    </div>
  );
}
