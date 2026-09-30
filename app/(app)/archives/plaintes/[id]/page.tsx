import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getPseudoMap } from "@/lib/archives/agents";
import { formatParisDateTime } from "@/lib/datetime";
import { Panel } from "@/components/ui/Panel";
import { ArchiveField, EmptyValue } from "@/components/archives/ArchiveField";
import { DeletePlainteButton } from "@/components/archives/DeleteArchiveButtons";
import { Signature } from "@/components/archives/Signature";
import { formatNumero, type Plainte } from "@/lib/supabase/archives-types";
import { btn } from "@/lib/ui/styles";

export default async function PlainteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const user = await getCurrentUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user!.id)
    .single();

  const { data: plainte } = await supabase
    .from("plaintes")
    .select("*")
    .eq("id", id)
    .maybeSingle<Plainte>();

  if (!plainte) {
    notFound();
  }

  const pseudoById = await getPseudoMap([
    plainte.agent_redacteur_id,
    plainte.created_by,
  ]);
  const pseudo = (agentId: string | null) =>
    (agentId && pseudoById.get(agentId)) || "Agent inconnu";

  const canDelete =
    plainte.created_by === user!.id || profile?.role === "admin";

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/archives/plaintes"
        className="font-mono text-xs uppercase tracking-wider text-gtf-text-muted hover:text-gtf-text"
      >
        ← Plaintes
      </Link>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold uppercase tracking-wide">
            Plainte #{formatNumero(plainte.numero)}
          </h1>
          <p className="mt-1 font-mono text-xs text-gtf-text-muted">
            Saisie par {pseudo(plainte.created_by)} · modifiée le{" "}
            {formatParisDateTime(plainte.updated_at)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/archives/plaintes/${plainte.id}/modifier`}
            className={btn("secondary", "md")}
          >
            Modifier
          </Link>
          {canDelete && <DeletePlainteButton id={plainte.id} />}
        </div>
      </div>

      <Panel title="Plainte" className="mt-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <ArchiveField label="Date et heure de rédaction">
            <span className="font-mono">
              {formatParisDateTime(plainte.date_redaction)}
            </span>
          </ArchiveField>
          <ArchiveField label="Date et heure des faits">
            {plainte.date_faits ? (
              <span className="font-mono">
                {formatParisDateTime(plainte.date_faits)}
              </span>
            ) : (
              <EmptyValue />
            )}
          </ArchiveField>
          <ArchiveField label="Nom + prénom de la victime">
            {plainte.nom_victime || <EmptyValue />}
          </ArchiveField>
          <ArchiveField label="Agent rédacteur">
            {pseudo(plainte.agent_redacteur_id)}
          </ArchiveField>
        </div>
      </Panel>

      <Panel title="Descriptif de la plainte" className="mt-4">
        <p className="whitespace-pre-wrap break-words text-sm">
          {plainte.descriptif_plainte || "—"}
        </p>
      </Panel>

      <Panel title="Signatures" className="mt-4">
        <div className="grid gap-6 sm:grid-cols-2">
          <ArchiveField label="Signature de la victime">
            <Signature name={plainte.signature_victime} />
          </ArchiveField>
          <ArchiveField label="Signature de l'agent assermenté">
            <Signature name={plainte.signature_agent_assermente} />
          </ArchiveField>
        </div>
      </Panel>
    </div>
  );
}
