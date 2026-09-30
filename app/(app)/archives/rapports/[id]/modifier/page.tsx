import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAgentOptions } from "@/lib/archives/agents";
import { RapportForm } from "@/components/archives/RapportForm";
import { formatNumero, type Rapport } from "@/lib/supabase/archives-types";

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

  const agents = await getAgentOptions([
    rapport.agent_redacteur_id,
    ...rapport.agents_lies,
  ]);

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-display text-2xl font-bold uppercase tracking-wide">
        Modifier le rapport #{formatNumero(rapport.numero)}
      </h1>
      <div className="mt-6">
        <RapportForm rapport={rapport} agents={agents} />
      </div>
    </div>
  );
}
