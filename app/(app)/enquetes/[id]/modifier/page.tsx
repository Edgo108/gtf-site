import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { InvestigationForm } from "@/components/investigations/InvestigationForm";
import type { Investigation } from "@/lib/supabase/investigations-types";

export default async function ModifierEnquetePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: investigation } = await supabase
    .from("investigations")
    .select("*")
    .eq("id", id)
    .single<Investigation>();

  if (!investigation) {
    notFound();
  }

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
