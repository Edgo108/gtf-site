import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAgentOptions } from "@/lib/archives/agents";
import { RapportForm } from "@/components/archives/RapportForm";
import {
  getCodePenalPickerArticles,
  getRapportInfractions,
} from "@/lib/archives/code-penal";
import { archiveReference, type Rapport } from "@/lib/supabase/archives-types";
import { loadAttachments } from "@/lib/attachments/server";

export default async function ModifierRapportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: rapport } = await supabase
    .from("rapports")
    .select("*")
    .eq("id", id)
    .maybeSingle<Rapport>();

  if (!rapport) {
    notFound();
  }

  const [agents, articles, infractions, attachments] = await Promise.all([
    getAgentOptions([rapport.agent_redacteur_id, ...rapport.agents_lies]),
    getCodePenalPickerArticles(),
    getRapportInfractions(rapport.id),
    rapport.est_test ? [] : loadAttachments(supabase, "rapport", rapport.id),
  ]);

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-display text-2xl font-bold uppercase tracking-wide">
        Modifier le rapport {archiveReference(rapport)}
      </h1>
      <div className="mt-6">
        <RapportForm
          rapport={rapport}
          agents={agents}
          articles={articles}
          infractions={infractions}
          attachments={attachments}
        />
      </div>
    </div>
  );
}
