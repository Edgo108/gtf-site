"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { canAccessOperations } from "@/lib/permissions";
import {
  isOperationStatut,
  OPERATION_LINK_CONFIG,
  type OperationLinkKind,
  type OperationStatut,
} from "@/lib/supabase/operations-types";
import {
  isOperationDrawingType,
  type OperationDrawingDonnees,
} from "@/lib/supabase/operation-drawings-types";
import { requireActiveUser } from "@/lib/auth/require";
import { fetchLinkTargets } from "@/lib/operations/link-targets";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkTextLimits } from "@/lib/limits";

type ActionResult = { error?: string };

const NO_ACCESS_OPERATIONS =
  "Votre unité n'a pas accès à la section Opérations.";

function readFields(formData: FormData) {
  const titre = String(formData.get("titre") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const statutRaw = String(formData.get("statut") ?? "en_cours");
  const statut: OperationStatut = isOperationStatut(statutRaw)
    ? statutRaw
    : "en_cours";

  return { titre, description, statut };
}

export async function createOperation(
  formData: FormData,
): Promise<ActionResult> {
  const { supabase, user, profile } = await requireActiveUser();

  if (!canAccessOperations(profile)) {
    return { error: NO_ACCESS_OPERATIONS };
  }

  const fields = readFields(formData);
  const tooLong = checkTextLimits("operations", fields);
  if (tooLong) return { error: tooLong };
  if (!fields.titre) {
    return { error: "Le titre est obligatoire." };
  }

  const { data, error } = await supabase
    .from("operations")
    .insert({ ...fields, lead_id: user.id })
    .select("id")
    .single();

  if (error || !data) {
    return { error: "Impossible de créer l'opération." };
  }

  revalidatePath("/operations");
  redirect(`/operations/${data.id}`);
}

export async function updateOperation(
  formData: FormData,
): Promise<ActionResult> {
  const { supabase, profile } = await requireActiveUser();

  if (!canAccessOperations(profile)) {
    return { error: NO_ACCESS_OPERATIONS };
  }

  const id = String(formData.get("id") ?? "");
  if (!id) {
    return { error: "Identifiant manquant." };
  }

  const fields = readFields(formData);
  const tooLong = checkTextLimits("operations", fields);
  if (tooLong) return { error: tooLong };
  if (!fields.titre) {
    return { error: "Le titre est obligatoire." };
  }

  const { data, error } = await supabase
    .from("operations")
    .update(fields)
    .eq("id", id)
    .select("id")
    .single();

  if (error || !data) {
    return {
      error:
        "Impossible de mettre à jour l'opération (accès refusé ou opération introuvable).",
    };
  }

  revalidatePath(`/operations/${id}`);
  revalidatePath("/operations");
  redirect(`/operations/${id}`);
}

export async function deleteOperation(
  formData: FormData,
): Promise<ActionResult> {
  const { supabase } = await requireActiveUser();

  const id = String(formData.get("id") ?? "");
  if (!id) {
    return { error: "Identifiant manquant." };
  }

  // Visible via la session = admin, lead ou agent en écriture (RLS
  // operations_select) : mêmes droits que pour la modifier.
  const { data: visible } = await supabase
    .from("operations")
    .select("id")
    .eq("id", id)
    .maybeSingle();
  if (!visible) {
    return { error: "Suppression impossible (accès refusé ?)." };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("operations")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) {
    return { error: "Suppression impossible." };
  }

  revalidatePath("/operations");
  redirect("/operations");
}

// --- Agents en écriture -------------------------------------------------
// Réservé au lead (ou à l'admin) : appliqué en RLS, revérifié ici pour un
// message d'erreur clair.

export async function addOperationWriter(
  formData: FormData,
): Promise<ActionResult> {
  const { supabase, user } = await requireActiveUser();

  const operationId = String(formData.get("operation_id") ?? "");
  const agentId = String(formData.get("agent_id") ?? "");
  if (!operationId || !agentId) {
    return { error: "Champs manquants." };
  }

  const { error } = await supabase.from("operation_writers").insert({
    operation_id: operationId,
    agent_id: agentId,
    added_by: user.id,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "Cet agent est déjà en écriture sur cette opération." };
    }
    return {
      error:
        "Impossible d'ajouter cet agent (seul le lead peut gérer cette liste).",
    };
  }

  revalidatePath(`/operations/${operationId}`);
  return {};
}

export async function removeOperationWriter(
  formData: FormData,
): Promise<ActionResult> {
  const { supabase } = await requireActiveUser();

  const id = String(formData.get("id") ?? "");
  const operationId = String(formData.get("operation_id") ?? "");
  if (!id || !operationId) {
    return { error: "Champs manquants." };
  }

  const { error, count } = await supabase
    .from("operation_writers")
    .delete({ count: "exact" })
    .eq("id", id);

  if (error || !count) {
    return {
      error: "Retrait impossible (seul le lead peut gérer cette liste).",
    };
  }

  revalidatePath(`/operations/${operationId}`);
  return {};
}

// --- Liens vers les autres sections --------------------------------------
// Une seule paire d'actions génériques, paramétrée par `kind`, pour les 5
// tables de liaison (enquêtes, mandats, labos, zones, groupes B.D.D.).

export async function addOperationLink(
  formData: FormData,
): Promise<ActionResult> {
  const { supabase } = await requireActiveUser();

  const operationId = String(formData.get("operation_id") ?? "");
  const kind = String(formData.get("kind") ?? "") as OperationLinkKind;
  const targetId = String(formData.get("target_id") ?? "");
  const config = OPERATION_LINK_CONFIG[kind];

  if (!operationId || !targetId || !config) {
    return { error: "Champs manquants." };
  }

  const { error } = await supabase
    .from(config.table)
    .insert({ operation_id: operationId, [config.column]: targetId });

  if (error) {
    if (error.code === "23505") {
      return { error: "Cet élément est déjà lié à cette opération." };
    }
    return { error: "Impossible d'ajouter ce lien (accès refusé ?)." };
  }

  revalidatePath(`/operations/${operationId}`);
  return {};
}

// Liste de choix d'un champ « Rechercher pour ajouter… », chargée à la
// demande (ouverture du champ) au lieu d'être envoyée avec chaque page.
export async function getOperationLinkOptions(
  kind: OperationLinkKind,
): Promise<{ id: string; label: string }[]> {
  const { supabase } = await requireActiveUser();
  if (!OPERATION_LINK_CONFIG[kind]) return [];
  const targets = await fetchLinkTargets(supabase, kind);
  return targets.map(({ id, label }) => ({ id, label }));
}

// --- Carte de planification (dessins) ------------------------------------
// Écriture réservée à l'admin/lead/agent en écriture, appliqué en RLS via
// can_access_operation() — aucune vérification supplémentaire nécessaire
// ici : le détail d'une opération n'est de toute façon accessible qu'à ces
// trois profils (voir la page /operations/[id]).

export async function addOperationDrawing(
  formData: FormData,
): Promise<ActionResult> {
  const { supabase, user } = await requireActiveUser();

  const operationId = String(formData.get("operation_id") ?? "");
  const typeRaw = String(formData.get("type_element") ?? "");
  const donneesRaw = String(formData.get("donnees") ?? "");

  if (!operationId || !isOperationDrawingType(typeRaw) || !donneesRaw) {
    return { error: "Champs manquants." };
  }

  let donnees: OperationDrawingDonnees;
  try {
    donnees = JSON.parse(donneesRaw);
  } catch {
    return { error: "Données de dessin invalides." };
  }

  const { error } = await supabase.from("operation_drawings").insert({
    operation_id: operationId,
    type_element: typeRaw,
    donnees,
    created_by: user.id,
  });

  if (error) {
    return { error: "Impossible d'ajouter cet élément (accès refusé ?)." };
  }

  revalidatePath(`/operations/${operationId}`);
  return {};
}

export async function deleteOperationDrawing(
  formData: FormData,
): Promise<ActionResult> {
  const { supabase } = await requireActiveUser();

  const id = String(formData.get("id") ?? "");
  const operationId = String(formData.get("operation_id") ?? "");
  if (!id || !operationId) {
    return { error: "Champs manquants." };
  }

  const { error, count } = await supabase
    .from("operation_drawings")
    .delete({ count: "exact" })
    .eq("id", id);

  if (error || !count) {
    return { error: "Suppression impossible (accès refusé ?)." };
  }

  revalidatePath(`/operations/${operationId}`);
  return {};
}

export async function clearOperationDrawings(
  formData: FormData,
): Promise<ActionResult> {
  const { supabase } = await requireActiveUser();

  const operationId = String(formData.get("operation_id") ?? "");
  if (!operationId) {
    return { error: "Identifiant manquant." };
  }

  const { error } = await supabase
    .from("operation_drawings")
    .delete()
    .eq("operation_id", operationId);

  if (error) {
    return { error: "Impossible de tout effacer (accès refusé ?)." };
  }

  revalidatePath(`/operations/${operationId}`);
  return {};
}

export async function removeOperationLink(
  formData: FormData,
): Promise<ActionResult> {
  const { supabase } = await requireActiveUser();

  const operationId = String(formData.get("operation_id") ?? "");
  const kind = String(formData.get("kind") ?? "") as OperationLinkKind;
  const linkId = String(formData.get("link_id") ?? "");
  const config = OPERATION_LINK_CONFIG[kind];

  if (!operationId || !linkId || !config) {
    return { error: "Champs manquants." };
  }

  const { error, count } = await supabase
    .from(config.table)
    .delete({ count: "exact" })
    .eq("id", linkId);

  if (error || !count) {
    return { error: "Retrait impossible (accès refusé ?)." };
  }

  revalidatePath(`/operations/${operationId}`);
  return {};
}
