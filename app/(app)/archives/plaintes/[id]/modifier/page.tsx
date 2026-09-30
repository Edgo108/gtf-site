import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAgentOptions } from "@/lib/archives/agents";
import { PlainteForm } from "@/components/archives/PlainteForm";
import { formatNumero, type Plainte } from "@/lib/supabase/archives-types";

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

  const agents = await getAgentOptions([plainte.agent_redacteur_id]);

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-display text-2xl font-bold uppercase tracking-wide">
        Modifier la plainte #{formatNumero(plainte.numero)}
      </h1>
      <div className="mt-6">
        <PlainteForm plainte={plainte} agents={agents} />
      </div>
    </div>
  );
}
