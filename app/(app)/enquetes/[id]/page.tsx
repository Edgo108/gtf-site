import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { Panel } from "@/components/ui/Panel";
import { StatutBadge } from "@/components/investigations/StatutBadge";
import { DeleteInvestigationButton } from "@/components/investigations/DeleteInvestigationButton";
import {
  LabCategorieBadge,
  LabStatutBadge,
} from "@/components/zones/LabBadges";
import { uniteCanWrite } from "@/lib/permissions";
import type {
  Investigation,
  InvestigationHistoryEntry,
} from "@/lib/supabase/investigations-types";
import type { LabMarker } from "@/lib/supabase/lab-markers-types";
import { btn } from "@/lib/ui/styles";
import { formatParisDateTime } from "@/lib/datetime";
import { fetchCasierCode, INVESTIGATION_COLUMNS } from "@/lib/investigations/casier";

export default async function EnqueteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const user = await getCurrentUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, unite")
    .eq("id", user!.id)
    .single();

  const canWrite = uniteCanWrite("enquetes", profile ?? {});

  const { data: investigation } = await supabase
    .from("investigations")
    .select(INVESTIGATION_COLUMNS)
    .eq("id", id)
    .single<Investigation>();

  if (!investigation) {
    notFound();
  }

  const casierCode = canWrite ? await fetchCasierCode(supabase, id) : null;

  const { data: history } = await supabase
    .from("investigation_history")
    .select("*")
    .eq("investigation_id", id)
    .order("created_at", { ascending: false })
    .returns<InvestigationHistoryEntry[]>();

  const { data: linkedLabs } = await supabase
    .from("lab_markers")
    .select("id, categorie, statut, organisation_id")
    .eq("investigation_id", id)
    .returns<Pick<LabMarker, "id" | "categorie" | "statut" | "organisation_id">[]>();

  const labOrgIds = [...new Set((linkedLabs ?? []).map((l) => l.organisation_id))];
  const { data: labOrgs } = labOrgIds.length
    ? await supabase.from("gangs").select("id, nom").in("id", labOrgIds)
    : { data: [] as { id: string; nom: string }[] };
  const labOrgNomById = new Map((labOrgs ?? []).map((g) => [g.id, g.nom]));

  const canDelete =
    canWrite &&
    (investigation.created_by === user!.id || profile?.role === "admin");

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="break-words font-display text-2xl font-bold uppercase tracking-wide">
            {investigation.titre}
          </h1>
          <div className="mt-2">
            <StatutBadge statut={investigation.statut} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {canWrite && (
            <Link
              href={`/enquetes/${investigation.id}/modifier`}
              className={btn("secondary", "md")}
            >
              Modifier
            </Link>
          )}
          {canDelete && <DeleteInvestigationButton id={investigation.id} />}
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Panel title="Suspects">
          <p className="whitespace-pre-wrap text-sm">
            {investigation.suspects || "—"}
          </p>
        </Panel>
        <Panel title="Agent responsable">
          <p className="text-sm">{investigation.agent_responsable || "—"}</p>
        </Panel>
      </div>

      <Panel title="Description" className="mt-4">
        <p className="whitespace-pre-wrap text-sm">
          {investigation.description || "—"}
        </p>
      </Panel>

      <Panel title="Preuves" className="mt-4">
        <p className="whitespace-pre-wrap text-sm">
          {investigation.preuves || "—"}
        </p>
      </Panel>

      <Panel title="Casier de preuves" className="mt-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <span className="font-mono text-xs uppercase tracking-wider text-gtf-text-muted">
              Numéro de casier
            </span>
            <p className="mt-1 text-sm">
              {investigation.casier_numero || (
                <span className="text-gtf-text-muted">Non renseigné</span>
              )}
            </p>
          </div>
          <div>
            <span className="font-mono text-xs uppercase tracking-wider text-gtf-text-muted">
              Code d&apos;accès
            </span>
            <p className="mt-1 text-sm">
              {!canWrite ? (
                <span className="text-gtf-text-muted">
                  Masqué (réservé aux unités ID / GTF / EM)
                </span>
              ) : (
                casierCode || (
                  <span className="text-gtf-text-muted">Non renseigné</span>
                )
              )}
            </p>
          </div>
        </div>
      </Panel>

      {linkedLabs && linkedLabs.length > 0 && (
        <Panel title="Laboratoires liés" className="mt-4">
          <ul className="flex flex-col gap-2">
            {linkedLabs.map((lab) => (
              <li key={lab.id} className="flex flex-wrap items-center gap-2">
                <LabCategorieBadge categorie={lab.categorie} />
                <LabStatutBadge statut={lab.statut} />
                <span className="text-sm text-gtf-text-muted">
                  {labOrgNomById.get(lab.organisation_id) ??
                    "Organisation inconnue"}
                </span>
              </li>
            ))}
          </ul>
          <Link
            href="/zones"
            className="mt-3 inline-block text-xs text-gtf-blue-hover underline"
          >
            Voir sur la carte
          </Link>
        </Panel>
      )}

      <Panel title="Historique" className="mt-4">
        {history && history.length > 0 ? (
          <ul className="flex flex-col gap-3">
            {history.map((entry) => (
              <li key={entry.id} className="border-l-2 border-gtf-border pl-3">
                <p className="text-sm">{entry.resume}</p>
                <p className="mt-0.5 font-mono text-xs text-gtf-text-muted">
                  {entry.agent_pseudo} ·{" "}
                  {formatParisDateTime(entry.created_at)}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gtf-text-muted">Aucun historique.</p>
        )}
      </Panel>
    </div>
  );
}
