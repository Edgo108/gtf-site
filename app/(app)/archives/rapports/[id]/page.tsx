import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getPseudoMap } from "@/lib/archives/agents";
import { formatParisDateTime } from "@/lib/datetime";
import { Panel } from "@/components/ui/Panel";
import { ArchiveField, EmptyValue } from "@/components/archives/ArchiveField";
import { TrashButton } from "@/components/ui/TrashButton";
import {
  deleteTestRapport,
  softDeleteRapport,
} from "@/app/(app)/archives/actions";
import { Signature } from "@/components/archives/Signature";
import {
  archiveReference,
  TEST_MODE_EXPLANATION,
  type Rapport,
} from "@/lib/supabase/archives-types";
import { TestBadge } from "@/components/archives/TestBadge";
import { ActionButton } from "@/components/ui/ActionButton";
import { ExportPdfButton } from "@/components/archives/ExportPdfButton";
import { btn } from "@/lib/ui/styles";
import { loadAttachments } from "@/lib/attachments/server";
import { AttachmentsSection } from "@/components/attachments/AttachmentsSection";
import { InfractionList } from "@/components/archives/InfractionList";
import {
  getCodePenalArticlesByIds,
  getRapportInfractions,
} from "@/lib/archives/code-penal";

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

  const [infractions, attachments] = await Promise.all([
    getRapportInfractions(rapport.id),
    rapport.est_test ? [] : loadAttachments(supabase, "rapport", rapport.id),
  ]);
  const articles = await getCodePenalArticlesByIds(
    infractions.map((l) => l.article_id),
  );

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
          <h1 className="flex flex-wrap items-center gap-3 font-display text-2xl font-bold uppercase tracking-wide">
            Rapport {archiveReference(rapport)}
            {rapport.est_test && <TestBadge />}
          </h1>
          <p className="mt-1 font-mono text-xs text-gtf-text-muted">
            Saisi par {pseudo(rapport.created_by)} · modifié le{" "}
            {formatParisDateTime(rapport.updated_at)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ExportPdfButton kind="rapport" id={rapport.id} />
          <Link
            href={`/archives/rapports/${rapport.id}/modifier`}
            className={btn("secondary", "md")}
          >
            Modifier
          </Link>
          {canDelete && rapport.est_test && (
            <ActionButton
              action={deleteTestRapport}
              fields={{ id: rapport.id }}
              confirm="Supprimer définitivement ce test ? Cette action est irréversible."
              success="Test supprimé"
              variant="danger"
            >
              Supprimer
            </ActionButton>
          )}
          {canDelete && !rapport.est_test && (
            <TrashButton
              action={softDeleteRapport}
              id={rapport.id}
              what="ce rapport"
              success="Rapport déplacé vers la corbeille"
            />
          )}
        </div>
      </div>

      {rapport.est_test && (
        <p className="mt-4 rounded-md border border-gtf-violet/60 bg-gtf-violet/10 px-4 py-3 text-sm text-gtf-violet">
          {TEST_MODE_EXPLANATION}
        </p>
      )}

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
        <InfractionList lines={infractions} articles={articles} />
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

      {/* Un test n'a pas de pièces jointes. */}
      {!rapport.est_test && (
        <div className="mt-4">
          <AttachmentsSection
            parentType="rapport"
            parentId={rapport.id}
            initial={attachments}
            canEdit
          />
        </div>
      )}
    </div>
  );
}
