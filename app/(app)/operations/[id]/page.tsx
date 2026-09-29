import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Panel } from "@/components/ui/Panel";
import { ActionButton } from "@/components/ui/ActionButton";
import { OperationStatutBadge } from "@/components/operations/OperationStatutBadge";
import { WritersSection, type WriterRow } from "@/components/operations/WritersSection";
import { LinkSection, type LinkedRow } from "@/components/operations/LinkSection";
import { deleteOperation } from "@/app/(app)/operations/actions";
import { LAB_CATEGORIE_LABELS } from "@/lib/supabase/lab-markers-types";
import type { Operation } from "@/lib/supabase/operations-types";
import { btn } from "@/lib/ui/styles";

const ZONE_TYPE_LABELS: Record<string, string> = {
  vente: "Vente",
  qg: "QG",
  influence: "QG", // valeur historique, cf. supabase/sensitive_zones_qg.sql
};

export default async function OperationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

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

  const linkedInvestigationIds = new Set(
    (linkedInvestigationRows ?? []).map((r) => r.investigation_id),
  );
  const linkedWantedIds = new Set(
    (linkedWantedRows ?? []).map((r) => r.wanted_notice_id),
  );
  const linkedLabIds = new Set((linkedLabRows ?? []).map((r) => r.lab_marker_id));
  const linkedZoneIds = new Set((linkedZoneRows ?? []).map((r) => r.zone_id));
  const linkedGangIds = new Set((linkedGangRows ?? []).map((r) => r.gang_id));

  const [
    { data: allInvestigations },
    { data: allWanted },
    { data: allLabs },
    { data: allZones },
    { data: allGangs },
  ] = await Promise.all([
    supabase.from("investigations").select("id, titre").order("titre"),
    supabase.from("wanted_notices").select("id, nom_suspect").order("nom_suspect"),
    supabase
      .from("lab_markers")
      .select("id, categorie, gangs(nom)")
      .order("created_at", { ascending: false }),
    supabase
      .from("sensitive_zones")
      .select("id, type_zone, gangs(nom)")
      .order("created_at", { ascending: false }),
    supabase.from("gangs").select("id, nom").order("nom"),
  ]);

  function labMarkerLabel(row: {
    id: string;
    categorie: string | null;
    gangs: { nom: string } | { nom: string }[] | null;
  }): string {
    const gang = Array.isArray(row.gangs) ? row.gangs[0] : row.gangs;
    const categorieLabel = row.categorie
      ? (LAB_CATEGORIE_LABELS as Record<string, string>)[row.categorie] ??
        row.categorie
      : "Potentiel";
    return `${gang?.nom ?? "Organisation inconnue"} — ${categorieLabel}`;
  }

  function zoneLabel(row: {
    id: string;
    type_zone: string;
    gangs: { nom: string } | { nom: string }[] | null;
  }): string {
    const gang = Array.isArray(row.gangs) ? row.gangs[0] : row.gangs;
    return `${gang?.nom ?? "Organisation inconnue"} — ${
      ZONE_TYPE_LABELS[row.type_zone] ?? row.type_zone
    }`;
  }

  const linkedInvestigations: LinkedRow[] = (allInvestigations ?? [])
    .filter((i) => linkedInvestigationIds.has(i.id))
    .map((i) => ({
      linkId:
        linkedInvestigationRows?.find((r) => r.investigation_id === i.id)
          ?.id ?? i.id,
      label: i.titre,
      href: `/enquetes/${i.id}`,
    }));

  const linkedWanted: LinkedRow[] = (allWanted ?? [])
    .filter((w) => linkedWantedIds.has(w.id))
    .map((w) => ({
      linkId:
        linkedWantedRows?.find((r) => r.wanted_notice_id === w.id)?.id ?? w.id,
      label: w.nom_suspect,
      href: `/mandats/${w.id}`,
    }));

  const linkedLabs: LinkedRow[] = (allLabs ?? [])
    .filter((l) => linkedLabIds.has(l.id))
    .map((l) => ({
      linkId: linkedLabRows?.find((r) => r.lab_marker_id === l.id)?.id ?? l.id,
      label: labMarkerLabel(l),
      href: "/zones",
    }));

  const linkedZones: LinkedRow[] = (allZones ?? [])
    .filter((z) => linkedZoneIds.has(z.id))
    .map((z) => ({
      linkId: linkedZoneRows?.find((r) => r.zone_id === z.id)?.id ?? z.id,
      label: zoneLabel(z),
      href: "/zones",
    }));

  const linkedGangs: LinkedRow[] = (allGangs ?? [])
    .filter((g) => linkedGangIds.has(g.id))
    .map((g) => ({
      linkId: linkedGangRows?.find((r) => r.gang_id === g.id)?.id ?? g.id,
      label: g.nom,
      href: `/gangs/${g.id}`,
    }));

  const availableInvestigations = (allInvestigations ?? [])
    .filter((i) => !linkedInvestigationIds.has(i.id))
    .map((i) => ({ id: i.id, label: i.titre }));
  const availableWanted = (allWanted ?? [])
    .filter((w) => !linkedWantedIds.has(w.id))
    .map((w) => ({ id: w.id, label: w.nom_suspect }));
  const availableLabs = (allLabs ?? [])
    .filter((l) => !linkedLabIds.has(l.id))
    .map((l) => ({ id: l.id, label: labMarkerLabel(l) }));
  const availableZones = (allZones ?? [])
    .filter((z) => !linkedZoneIds.has(z.id))
    .map((z) => ({ id: z.id, label: zoneLabel(z) }));
  const availableGangs = (allGangs ?? [])
    .filter((g) => !linkedGangIds.has(g.id))
    .map((g) => ({ id: g.id, label: g.nom }));

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
          <ActionButton
            action={deleteOperation}
            fields={{ id: operation.id }}
            confirm="Supprimer définitivement cette opération ? Cette action est irréversible."
            success="Opération supprimée."
            variant="danger"
            size="md"
          >
            Supprimer
          </ActionButton>
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
          linked={linkedWanted}
          available={availableWanted}
        />
        <LinkSection
          title="Enquêtes liées"
          kind="investigation"
          operationId={operation.id}
          linked={linkedInvestigations}
          available={availableInvestigations}
        />
        <LinkSection
          title="Labos liés"
          kind="lab_marker"
          operationId={operation.id}
          linked={linkedLabs}
          available={availableLabs}
        />
        <LinkSection
          title="Zones liées"
          kind="zone"
          operationId={operation.id}
          linked={linkedZones}
          available={availableZones}
        />
        <LinkSection
          title="Groupes B.D.D. liés"
          kind="gang"
          operationId={operation.id}
          linked={linkedGangs}
          available={availableGangs}
        />
      </div>

      <Panel title="Carte de planification" className="mt-4">
        <p className="text-sm text-gtf-text-muted">
          Emplacement réservé — sera ajoutée dans un second temps.
        </p>
      </Panel>
    </div>
  );
}
