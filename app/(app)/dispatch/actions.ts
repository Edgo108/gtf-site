"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  isAgentStatut,
  isCategoriePatrouille,
  isDispatchExpired,
  SELF_STATUTS,
  type AgentStatut,
  type DispatchAgent,
  type DispatchSnapshot,
  type DispatchUnit,
} from "@/lib/supabase/dispatch-types";
import { requireActiveUser } from "@/lib/auth/require";

// Toutes les écritures passent par le client Supabase de l'utilisateur :
// ce sont la RLS et le trigger de supabase/dispatch.sql qui décident
// (dispatcheur actif, admin, agent lui-même…). Les vérifications faites
// ici ne servent qu'à renvoyer un message clair. La clé service_role ne
// sert qu'à lire pseudo/grade des autres agents (RLS de profiles).

type ActionResult = { error?: string };

const DENIED = "Action non autorisée (droits insuffisants ou rôle expiré).";

type SupabaseServer = Awaited<ReturnType<typeof createClient>>;

// Renouvelle l'activité du dispatcheur (no-op si l'appelant ne l'est pas).
async function touchDispatch(supabase: SupabaseServer, userId: string) {
  await supabase
    .from("dispatch_role")
    .update({ last_active_at: new Date().toISOString() })
    .eq("agent_id", userId);
}

export async function getDispatchSnapshot(): Promise<DispatchSnapshot> {
  const { supabase } = await requireActiveUser();

  const [{ data: units }, { data: statuses }, { data: role }] =
    await Promise.all([
      supabase
        .from("dispatch_units")
        .select("id, nom, categorie_patrouille")
        .order("nom")
        .returns<DispatchUnit[]>(),
      supabase
        .from("agent_status")
        .select("agent_id, statut, unite_id, updated_at")
        .returns<Omit<DispatchAgent, "pseudo" | "grade">[]>(),
      supabase
        .from("dispatch_role")
        .select("agent_id, taken_at, last_active_at")
        .maybeSingle<{ agent_id: string; taken_at: string; last_active_at: string }>(),
    ]);

  const ids = [
    ...new Set([
      ...(statuses ?? []).map((s) => s.agent_id),
      ...(role ? [role.agent_id] : []),
    ]),
  ];
  const { data: profiles } = ids.length
    ? await createAdminClient()
        .from("profiles")
        .select("id, pseudo, grade")
        .in("id", ids)
        .returns<{ id: string; pseudo: string; grade: string }[]>()
    : { data: [] as { id: string; pseudo: string; grade: string }[] };
  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

  const agents: DispatchAgent[] = (statuses ?? [])
    .map((s) => ({
      ...s,
      pseudo: profileById.get(s.agent_id)?.pseudo ?? "Agent inconnu",
      grade: profileById.get(s.agent_id)?.grade ?? "",
    }))
    .sort((a, b) => a.pseudo.localeCompare(b.pseudo, "fr"));

  return {
    units: units ?? [],
    agents,
    dispatcher: role
      ? {
          ...role,
          pseudo: profileById.get(role.agent_id)?.pseudo ?? "Agent inconnu",
        }
      : null,
  };
}

// ====================================================================
// Service
// ====================================================================

export async function prendreService(): Promise<ActionResult> {
  const { supabase, user } = await requireActiveUser();

  const { error } = await supabase.from("agent_status").insert({
    agent_id: user.id,
    statut: "en_attente_dispatch",
    unite_id: null,
  });

  if (error) {
    return {
      error:
        error.code === "23505"
          ? "Vous êtes déjà en service."
          : "Impossible de prendre votre service.",
    };
  }
  return {};
}

// Fin de service = suppression de la ligne (remise à zéro). Pour soi, ou
// pour un autre agent si l'on est dispatcheur actif / admin.
export async function finService(agentId?: string): Promise<ActionResult> {
  const { supabase, user } = await requireActiveUser();
  const target = agentId || user.id;

  const { data, error } = await supabase
    .from("agent_status")
    .delete()
    .eq("agent_id", target)
    .select("id");

  if (error || !data || data.length === 0) {
    return { error: target === user.id ? "Fin de service impossible." : DENIED };
  }
  if (target !== user.id) await touchDispatch(supabase, user.id);
  return {};
}

export async function setAgentStatut(
  agentId: string,
  statut: string,
): Promise<ActionResult> {
  const { supabase, user } = await requireActiveUser();

  if (!isAgentStatut(statut)) {
    return { error: "Statut invalide." };
  }

  const patch: { statut: AgentStatut; unite_id?: null } = { statut };
  // Remettre un agent « en attente » le sort aussi de son unité.
  if (statut === "en_attente_dispatch") patch.unite_id = null;

  const { data, error } = await supabase
    .from("agent_status")
    .update(patch)
    .eq("agent_id", agentId)
    .select("id");

  if (error || !data || data.length === 0) {
    if (agentId === user.id && !SELF_STATUTS.includes(statut)) {
      return { error: "Vous ne pouvez pas vous remettre en attente de dispatch." };
    }
    return {
      error:
        agentId === user.id
          ? "Vous devez d'abord être affecté à une unité par le dispatcheur."
          : DENIED,
    };
  }
  if (agentId !== user.id) await touchDispatch(supabase, user.id);
  return {};
}

// Affectation à une unité (glisser-déposer du dispatcheur). `uniteId` null
// = retour en attente de dispatch. Le passage automatique à « disponible »
// depuis l'attente est fait par le trigger en base.
export async function assignAgentUnit(
  agentId: string,
  uniteId: string | null,
): Promise<ActionResult> {
  const { supabase, user } = await requireActiveUser();

  const patch = uniteId
    ? { unite_id: uniteId }
    : { unite_id: null, statut: "en_attente_dispatch" as const };

  const { data, error } = await supabase
    .from("agent_status")
    .update(patch)
    .eq("agent_id", agentId)
    .select("id");

  if (error || !data || data.length === 0) {
    return { error: "Seul le dispatcheur actif peut affecter un agent à une unité." };
  }
  await touchDispatch(supabase, user.id);
  return {};
}

export async function setUnitCategorie(
  unitId: string,
  categorie: string,
): Promise<ActionResult> {
  const { supabase, user } = await requireActiveUser();

  const value = categorie === "" ? null : categorie;
  if (value !== null && !isCategoriePatrouille(value)) {
    return { error: "Catégorie invalide." };
  }

  const { data, error } = await supabase
    .from("dispatch_units")
    .update({ categorie_patrouille: value })
    .eq("id", unitId)
    .select("id");

  if (error || !data || data.length === 0) {
    return {
      error:
        "Seuls le dispatcheur, un admin ou un agent de l'unité peuvent changer sa catégorie.",
    };
  }
  await touchDispatch(supabase, user.id);
  return {};
}

// ====================================================================
// Rôle de dispatcheur
// ====================================================================

export async function prendreDispatch(): Promise<ActionResult> {
  const { supabase, user } = await requireActiveUser();

  const { data: current } = await supabase
    .from("dispatch_role")
    .select("agent_id, last_active_at")
    .maybeSingle();

  if (current) {
    if (current.agent_id === user.id) {
      await touchDispatch(supabase, user.id);
      return {};
    }
    if (!isDispatchExpired(current.last_active_at, Date.now())) {
      return { error: "Un autre agent détient déjà le dispatch." };
    }
    // Rôle expiré par inactivité : on le libère avant de le prendre
    // (autorisé par la policy dispatch_role_delete).
    await supabase
      .from("dispatch_role")
      .delete()
      .eq("agent_id", current.agent_id);
  }

  const { error } = await supabase
    .from("dispatch_role")
    .insert({ agent_id: user.id });

  if (error) {
    return {
      error:
        error.code === "23505"
          ? "Un autre agent vient de prendre le dispatch."
          : "Impossible de prendre le dispatch.",
    };
  }
  return {};
}

// « Lâcher le dispatch » (le détenteur), ou libération forcée par un admin.
export async function lacherDispatch(): Promise<ActionResult> {
  const { supabase } = await requireActiveUser();

  const { data: current } = await supabase
    .from("dispatch_role")
    .select("agent_id")
    .maybeSingle();
  if (!current) return {};

  const { data, error } = await supabase
    .from("dispatch_role")
    .delete()
    .eq("agent_id", current.agent_id)
    .select("id");

  if (error || !data || data.length === 0) {
    return { error: DENIED };
  }
  return {};
}

// « Reset dispatch » : tous les agents en service repassent en attente sans
// unité, et toutes les unités perdent leur catégorie de patrouille. Le
// rôle de dispatcheur n'est pas touché. Réservé au dispatcheur actif —
// pas à l'admin qui ne l'est pas (vérifié par la fonction SQL
// is_active_dispatcher(), qui ne tient pas compte du rôle admin).
export async function resetDispatch(): Promise<ActionResult> {
  const { supabase, user } = await requireActiveUser();

  const { data: isDispatcher } = await supabase.rpc("is_active_dispatcher");
  if (isDispatcher !== true) {
    return { error: "Seul le dispatcheur actif peut réinitialiser le dispatch." };
  }

  const [agentsReset, unitsReset] = await Promise.all([
    supabase
      .from("agent_status")
      .update({ statut: "en_attente_dispatch", unite_id: null })
      .not("id", "is", null),
    supabase
      .from("dispatch_units")
      .update({ categorie_patrouille: null })
      .not("id", "is", null),
  ]);

  if (agentsReset.error || unitsReset.error) {
    return { error: "Réinitialisation incomplète, réessayez." };
  }
  await touchDispatch(supabase, user.id);
  return {};
}

// Signal d'activité du dispatcheur (envoyé par la page, au plus une fois
// par minute tant qu'il interagit).
export async function heartbeatDispatch(): Promise<void> {
  const { supabase, user } = await requireActiveUser();
  await touchDispatch(supabase, user.id);
}
