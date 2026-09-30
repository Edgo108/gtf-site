import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { Panel } from "@/components/ui/Panel";
import { OperationStatutBadge } from "@/components/operations/OperationStatutBadge";
import { WritersSection, type WriterRow } from "@/components/operations/WritersSection";
import { LinkSection, type LinkedRow } from "@/components/operations/LinkSection";
import { PlanningMapLoader } from "@/components/operations/PlanningMapLoader";
import { deleteOperation } from "@/app/(app)/operations/actions";
import { TrashButton } from "@/components/ui/TrashButton";
import type { Operation, OperationLinkKind } from "@/lib/supabase/operations-types";
import { fetchLinkTargets } from "@/lib/operations/link-targets";
import { btn } from "@/lib/ui/styles";

export default async function OperationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const user = await getCurrentUser();

  if (!user) {
    redirect("/");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("pseudo, role, unite")
    .eq("id", user.id)
    .single();

  // La RLS ("operations_select") ne renvoie cette ligne que si l'appelant
  // est admin, lead, ou agent en écriture — même chemin pour "n'existe
  // pas" et "accès refusé", volontairement, pour ne rien révéler.
  const { data: operation } = await supabase
    .from("operations")
    .select("*")
    .eq("id", id)
    .single<Operation>();

  if (!operation) {
    notFound();
  }

  const isLead = operation.lead_id === user.id;
  const canManageWriters = isLead || profile?.role === "admin";

  const admin = createAdminClient();

  const { data: writerRows } = await supabase
    .from("operation_writers")
    .select("id, agent_id")
    .eq("operation_id", id);

  const agentIdsToResolve = [
    operation.lead_id,
    ...(writerRows ?? []).map((w) => w.agent_id),
  ];
  const { data: resolvedProfiles } = await admin
    .from("profiles")
    .select("id, pseudo")
    .in("id", [...new Set(agentIdsToResolve)]);
  const pseudoById = new Map(
    (resolvedProfiles ?? []).map((p) => [p.id, p.pseudo]),
  );

  const writers: WriterRow[] = (writerRows ?? []).map((w) => ({
    linkId: w.id,
    agentId: w.agent_id,
    pseudo: pseudoById.get(w.agent_id) ?? "Agent inconnu",
  }));
  const excludedAgentIds = new Set([
    operation.lead_id,
    ...writers.map((w) => w.agentId),
  ]);

  const { data: candidateAgents } = canManageWriters
    ? await admin
        .from("profiles")
        .select("id, pseudo, statut, unite")
        .eq("statut", "actif")
        .neq("unite", "DOJ")
    : { data: [] as { id: string; pseudo: string }[] };
  const availableAgents = (candidateAgents ?? [])
    .filter((a) => !excludedAgentIds.has(a.id))
    .map((a) => ({ id: a.id, label: a.pseudo }))
    .sort((a, b) => a.label.localeCompare(b.label));

  // --- Liens vers les autres sections ------------------------------------

  const [
    { data: linkedInvestigationRows },
    { data: linkedWantedRows },
    { data: linkedLabRows },
    { data: linkedZoneRows },
    { data: linkedGangRows },
  ] = await Promise.all([
    supabase
      .from("operation_investigations")
      .select("id, investigation_id")
      .eq("operation_id", id),
    supabase
      .from("operation_wanted_notices")
      .select("id, wanted_notice_id")
      .eq("operation_id", id),
    supabase
      .from("operation_lab_markers")
      .select("id, lab_marker_id")
      .eq("operation_id", id),
    supabase.from("operation_zones").select("id, zone_id").eq("operation_id", id),
    supabase.from("operation_gangs").select("id, gang_id").eq("operation_id", id),
  ]);

  // Seuls les éléments DÉJÀ liés sont chargés avec la page. Les listes de
  // choix (tout le reste) ne sont chargées qu'à l'ouverture d'un champ de
  // recherche (getOperationLinkOptions), plutôt qu'à chaque visite.
  const linkRows: Record<
    OperationLinkKind,
    { linkId: string; targetId: string }[]
  > = {
    investigation: (linkedInvestigationRows ?? []).map((r) => ({
      linkId: r.id,
      targetId: r.investigation_id,
    })),
    wanted_notice: (linkedWantedRows ?? []).map((r) => ({
      linkId: r.id,
      targetId: r.wanted_notice_id,
    })),
    lab_marker: (linkedLabRows ?? []).map((r) => ({
      linkId: r.id,
      targetId: r.lab_marker_id,
    })),
    zone: (linkedZoneRows ?? []).map((r) => ({ linkId: r.id, targetId: r.zone_id })),
    gang: (linkedGangRows ?? []).map((r) => ({ linkId: r.id, targetId: r.gang_id })),
  };

  const kinds: OperationLinkKind[] = [
    "investigation",
    "wanted_notice",
    "lab_marker",
    "zone",
    "gang",
  ];
  const targetsByKind = await Promise.all(
    kinds.map((kind) =>
      fetchLinkTargets(
        supabase,
        kind,
        linkRows[kind].map((r) => r.targetId),
      ),
    ),
  );

  // Un élément lié mais passé en corbeille (invisible via la RLS) n'est
  // simplement pas affiché, comme avant.
  const linked = Object.fromEntries(
    kinds.map((kind, i) => {
      const byId = new Map(targetsByKind[i].map((t) => [t.id, t]));
      const rows: LinkedRow[] = linkRows[kind].flatMap((r) => {
        const target = byId.get(r.targetId);
        return target
          ? [{ linkId: r.linkId, targetId: r.targetId, label: target.label, href: target.href }]
          : [];
      });
      return [kind, rows];
    }),
  ) as Record<OperationLinkKind, LinkedRow[]>;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="break-words font-display text-2xl font-bold uppercase tracking-wide">
            {operation.titre}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <OperationStatutBadge statut={operation.statut} />
            <span className="font-mono text-xs text-gtf-text-muted">
              Lead : {pseudoById.get(operation.lead_id) ?? "Agent inconnu"}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/operations/${operation.id}/modifier`}
            className={btn("secondary", "md")}
          >
            Modifier
          </Link>
          <TrashButton
            action={deleteOperation}
            id={operation.id}
            what="cette opération"
            success="Opération déplacée vers la corbeille"
          />
        </div>
      </div>

      <Panel title="Description" className="mt-6">
        <p className="whitespace-pre-wrap text-sm">
          {operation.description || "—"}
        </p>
      </Panel>

      <div className="mt-4">
        <WritersSection
          operationId={operation.id}
          writers={writers}
          availableAgents={availableAgents}
          canManage={canManageWriters}
        />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <LinkSection
          title="Mandats liés"
          kind="wanted_notice"
          operationId={operation.id}
          linked={linked["wanted_notice"]}
        />
        <LinkSection
          title="Enquêtes liées"
          kind="investigation"
          operationId={operation.id}
          linked={linked["investigation"]}
        />
        <LinkSection
          title="Labos liés"
          kind="lab_marker"
          operationId={operation.id}
          linked={linked["lab_marker"]}
        />
        <LinkSection
          title="Zones liées"
          kind="zone"
          operationId={operation.id}
          linked={linked["zone"]}
        />
        <LinkSection
          title="Groupes B.D.D. liés"
          kind="gang"
          operationId={operation.id}
          linked={linked["gang"]}
        />
      </div>

      <Panel title="Carte de planification" className="mt-4">
        <p className="mb-3 text-xs text-gtf-text-muted">
          Fond de référence (zones et labos en lecture seule) identique à
          la carte principale — les tracés ci-dessous sont propres à cette
          opération et n&apos;apparaissent nulle part ailleurs.
        </p>
        <PlanningMapLoader operationId={operation.id} />
      </Panel>
    </div>
  );
}
