import { createClient } from "@/lib/supabase/server";
import { getAgentOptions } from "@/lib/archives/agents";
import { nowParisInputValue } from "@/lib/archives/datetime";
import { PlainteForm } from "@/components/archives/PlainteForm";

export default async function NouvellePlaintePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const agents = await getAgentOptions();

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-display text-2xl font-bold uppercase tracking-wide">
        Nouvelle plainte
      </h1>
      <p className="mt-1 font-mono text-xs text-gtf-text-muted">
        Le numéro est attribué automatiquement à l&apos;enregistrement.
      </p>
      <div className="mt-6">
        <PlainteForm
          agents={agents}
          defaultDateRedaction={nowParisInputValue()}
          defaultRedacteurId={user?.id}
        />
      </div>
    </div>
  );
}
