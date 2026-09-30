import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getPseudoMap } from "@/lib/archives/agents";
import { formatParisDateTime } from "@/lib/datetime";
import { Panel } from "@/components/ui/Panel";
import { ArchiveField, EmptyValue } from "@/components/archives/ArchiveField";
import { TrashButton } from "@/components/ui/TrashButton";
import { softDeleteRapport } from "@/app/(app)/archives/actions";
import { Signature } from "@/components/archives/Signature";
import { formatNumero, type Rapport } from "@/lib/supabase/archives-types";
import { btn } from "@/lib/ui/styles";

export default async function RapportDetailPage({
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

  const { data: rapport } = await supabase
    .from("rapports")
    .select("*")
    .eq("id", id)
    .maybeSingle<Rapport>();

  if (!rapport) {
    notFound();
  }

  const pseudoById = await getPseudoMap([
    rapport.agent_redacteur_id,
    rapport.created_by,
    ...rapport.agents_lies,
  ]);
  const pseudo = (agentId: string | null) =>
    (agentId && pseudoById.get(agentId)) || "Agent inconnu";

  const canDelete =
    rapport.created_by === user!.id || profile?.role === "admin";

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/archives/rapports"
        className="font-mono text-xs uppercase tracking-wider text-gtf-text-muted hover:text-gtf-text"
      >
        ← Rapports
      </Link>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold uppercase tracking-wide">
            Rapport #{formatNumero(rapport.numero)}
          </h1>
          <p className="mt-1 font-mono text-xs text-gtf-text-muted">
            Saisi par {pseudo(rapport.created_by)} · modifié le{" "}
            {formatParisDateTime(rapport.updated_at)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/archives/rapports/${rapport.id}/modifier`}
            className={btn("secondary", "md")}
          >
            Modifier
          </Link>
          {canDelete && (
            <TrashButton
              action={softDeleteRapport}
              id={rapport.id}
              what="ce rapport"
              success="Rapport déplacé vers la corbeille"
            />
          )}
        </div>
      </div>

      <Panel title="Intervention" className="mt-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <ArchiveField label="Date et heure de rédaction">
            <span className="font-mono">
              {formatParisDateTime(rapport.date_redaction)}
            </span>
          </ArchiveField>
          <ArchiveField label="Date et heure d'intervention">
            {rapport.date_intervention ? (
              <span className="font-mono">
                {formatParisDateTime(rapport.date_intervention)}
              </span>
            ) : (
              <EmptyValue />
            )}
          </ArchiveField>
          <ArchiveField label="Agent rédacteur">
            {pseudo(rapport.agent_redacteur_id)}
          </ArchiveField>
          <ArchiveField label="Agents liés à l'intervention">
            {rapport.agents_lies.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {rapport.agents_lies.map((agentId) => (
                  <span
                    key={agentId}
                    className="rounded border border-gtf-blue bg-gtf-blue/10 px-2 py-0.5 font-mono text-xs text-gtf-blue-hover"
                  >
                    {pseudo(agentId)}
                  </span>
                ))}
              </div>
            ) : (
              <EmptyValue />
            )}
          </ArchiveField>
          <ArchiveField label="Nom du suspect">
            {rapport.nom_suspect || <EmptyValue />}
          </ArchiveField>
          <ArchiveField label="Lecture des droits Miranda">
            {rapport.date_lecture_miranda ? (
              <span className="font-mono">
                {formatParisDateTime(rapport.date_lecture_miranda)}
              </span>
            ) : (
              <EmptyValue />
            )}
          </ArchiveField>
        </div>
      </Panel>

      <Panel title="Faits reprochés" className="mt-4">
        <p className="whitespace-pre-wrap break-words text-sm">
          {rapport.faits_reproches || "—"}
        </p>
      </Panel>

      <Panel title="Descriptif de la situation" className="mt-4">
        <p className="whitespace-pre-wrap break-words text-sm">
          {rapport.descriptif_situation || "—"}
        </p>
      </Panel>

      <Panel title="Signature de l'agent rédacteur" className="mt-4">
        <div className="max-w-sm">
          <Signature name={rapport.signature_agent_redacteur} />
        </div>
      </Panel>
    </div>
  );
}
