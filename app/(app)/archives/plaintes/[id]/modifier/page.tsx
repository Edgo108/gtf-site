import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAgentOptions } from "@/lib/archives/agents";
import { PlainteForm } from "@/components/archives/PlainteForm";
import { archiveReference, type Plainte } from "@/lib/supabase/archives-types";
import { loadAttachments } from "@/lib/attachments/server";

export default async function ModifierPlaintePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: plainte } = await supabase
    .from("plaintes")
    .select("*")
    .eq("id", id)
    .maybeSingle<Plainte>();

  if (!plainte) {
    notFound();
  }

  const [agents, attachments] = await Promise.all([
    getAgentOptions([plainte.agent_redacteur_id]),
    plainte.est_test ? [] : loadAttachments(supabase, "plainte", plainte.id),
  ]);

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-display text-2xl font-bold uppercase tracking-wide">
        Modifier la plainte {archiveReference(plainte)}
      </h1>
      <div className="mt-6">
        <PlainteForm
          plainte={plainte}
          attachments={attachments}
          agents={agents}
        />
      </div>
    </div>
  );
}
