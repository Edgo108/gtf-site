"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPseudoMap } from "@/lib/archives/agents";
import { parisInputToISO } from "@/lib/archives/datetime";

type ActionResult = { error?: string };

// Rapports / Plaintes : ouverts à tout agent actif, quelle que soit son
// unité (la RLS vérifie is_active_agent() de son côté).
async function requireActiveUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Non authentifié.");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, statut")
    .eq("id", user.id)
    .single();

  if (!profile || profile.statut !== "actif") {
    throw new Error("Compte inactif.");
  }

  return { supabase, user, profile };
}

function text(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function date(formData: FormData, key: string): string | null {
  return parisInputToISO(text(formData, key));
}

// Vérifie que tous les ids désignent bien des comptes existants et
// renvoie leurs pseudos (nécessaire aussi pour la signature).
async function resolveAgents(ids: string[]) {
  const pseudoById = await getPseudoMap(ids);
  const allKnown = ids.every((id) => pseudoById.has(id));
  return { pseudoById, allKnown };
}

// ====================================================================
// Rapports
// ====================================================================

async function readRapportFields(formData: FormData) {
  const date_redaction = date(formData, "date_redaction");
  const agent_redacteur_id = text(formData, "agent_redacteur_id");
  const agents_lies = [
    ...new Set(
      formData
        .getAll("agents_lies")
        .map((v) => String(v).trim())
        .filter(Boolean),
    ),
  ];

  if (!date_redaction) {
    return { error: "La date et l'heure de rédaction sont obligatoires." };
  }
  if (!agent_redacteur_id) {
    return { error: "L'agent rédacteur est obligatoire." };
  }

  const { pseudoById, allKnown } = await resolveAgents([
    agent_redacteur_id,
    ...agents_lies,
  ]);
  if (!allKnown) {
    return { error: "Agent inconnu dans la sélection." };
  }

  // La signature reprend toujours le nom de l'agent rédacteur : le client
  // indique seulement si la fiche a été signée.
  const signed = text(formData, "signature_agent_redacteur") !== "";

  return {
    fields: {
      date_redaction,
      date_intervention: date(formData, "date_intervention"),
      agent_redacteur_id,
      agents_lies,
      nom_suspect: text(formData, "nom_suspect"),
      date_lecture_miranda: date(formData, "date_lecture_miranda"),
      faits_reproches: text(formData, "faits_reproches"),
      descriptif_situation: text(formData, "descriptif_situation"),
      signature_agent_redacteur: signed
        ? (pseudoById.get(agent_redacteur_id) ?? null)
        : null,
    },
  };
}

export async function createRapport(
  formData: FormData,
): Promise<ActionResult> {
  const { supabase, user } = await requireActiveUser();

  const parsed = await readRapportFields(formData);
  if ("error" in parsed) return { error: parsed.error };

  const { data, error } = await supabase
    .from("rapports")
    .insert({ ...parsed.fields, created_by: user.id })
    .select("id")
    .single();

  if (error || !data) {
    return { error: "Impossible de créer le rapport." };
  }

  revalidatePath("/archives/rapports");
  redirect(`/archives/rapports/${data.id}`);
}

export async function updateRapport(
  formData: FormData,
): Promise<ActionResult> {
  const { supabase } = await requireActiveUser();

  const id = text(formData, "id");
  if (!id) {
    return { error: "Identifiant manquant." };
  }

  const parsed = await readRapportFields(formData);
  if ("error" in parsed) return { error: parsed.error };

  const { data, error } = await supabase
    .from("rapports")
    .update(parsed.fields)
    .eq("id", id)
    .select("id");

  if (error) {
    return { error: "Impossible de mettre à jour le rapport." };
  }
  if (!data || data.length === 0) {
    return { error: "Rapport introuvable." };
  }

  revalidatePath(`/archives/rapports/${id}`);
  revalidatePath("/archives/rapports");
  redirect(`/archives/rapports/${id}`);
}

export async function softDeleteRapport(
  formData: FormData,
): Promise<ActionResult> {
  const { supabase, user, profile } = await requireActiveUser();

  const id = text(formData, "id");
  if (!id) {
    return { error: "Identifiant manquant." };
  }

  const { data: rapport } = await supabase
    .from("rapports")
    .select("created_by")
    .eq("id", id)
    .single();

  if (!rapport) {
    return { error: "Rapport introuvable." };
  }

  if (rapport.created_by !== user.id && profile.role !== "admin") {
    return {
      error: "Seul le créateur ou un administrateur peut supprimer ce rapport.",
    };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("rapports")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    return { error: "Suppression impossible." };
  }

  revalidatePath("/archives/rapports");
  redirect("/archives/rapports");
}

// ====================================================================
// Plaintes
// ====================================================================

async function readPlainteFields(formData: FormData) {
  const date_redaction = date(formData, "date_redaction");
  const agent_redacteur_id = text(formData, "agent_redacteur_id");
  const nom_victime = text(formData, "nom_victime");

  if (!date_redaction) {
    return { error: "La date et l'heure de rédaction sont obligatoires." };
  }
  if (!nom_victime) {
    return { error: "Le nom et prénom de la victime sont obligatoires." };
  }
  if (!agent_redacteur_id) {
    return { error: "L'agent rédacteur est obligatoire." };
  }

  const { pseudoById, allKnown } = await resolveAgents([agent_redacteur_id]);
  if (!allKnown) {
    return { error: "Agent inconnu dans la sélection." };
  }

  const victimSigned = text(formData, "signature_victime") !== "";
  const agentSigned = text(formData, "signature_agent_assermente") !== "";

  return {
    fields: {
      date_redaction,
      date_faits: date(formData, "date_faits"),
      nom_victime,
      agent_redacteur_id,
      descriptif_plainte: text(formData, "descriptif_plainte"),
      signature_victime: victimSigned ? nom_victime : null,
      signature_agent_assermente: agentSigned
        ? (pseudoById.get(agent_redacteur_id) ?? null)
        : null,
    },
  };
}

export async function createPlainte(
  formData: FormData,
): Promise<ActionResult> {
  const { supabase, user } = await requireActiveUser();

  const parsed = await readPlainteFields(formData);
  if ("error" in parsed) return { error: parsed.error };

  const { data, error } = await supabase
    .from("plaintes")
    .insert({ ...parsed.fields, created_by: user.id })
    .select("id")
    .single();

  if (error || !data) {
    return { error: "Impossible de créer la plainte." };
  }

  revalidatePath("/archives/plaintes");
  redirect(`/archives/plaintes/${data.id}`);
}

export async function updatePlainte(
  formData: FormData,
): Promise<ActionResult> {
  const { supabase } = await requireActiveUser();

  const id = text(formData, "id");
  if (!id) {
    return { error: "Identifiant manquant." };
  }

  const parsed = await readPlainteFields(formData);
  if ("error" in parsed) return { error: parsed.error };

  const { data, error } = await supabase
    .from("plaintes")
    .update(parsed.fields)
    .eq("id", id)
    .select("id");

  if (error) {
    return { error: "Impossible de mettre à jour la plainte." };
  }
  if (!data || data.length === 0) {
    return { error: "Plainte introuvable." };
  }

  revalidatePath(`/archives/plaintes/${id}`);
  revalidatePath("/archives/plaintes");
  redirect(`/archives/plaintes/${id}`);
}

export async function softDeletePlainte(
  formData: FormData,
): Promise<ActionResult> {
  const { supabase, user, profile } = await requireActiveUser();

  const id = text(formData, "id");
  if (!id) {
    return { error: "Identifiant manquant." };
  }

  const { data: plainte } = await supabase
    .from("plaintes")
    .select("created_by")
    .eq("id", id)
    .single();

  if (!plainte) {
    return { error: "Plainte introuvable." };
  }

  if (plainte.created_by !== user.id && profile.role !== "admin") {
    return {
      error: "Seul le créateur ou un administrateur peut supprimer cette plainte.",
    };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("plaintes")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    return { error: "Suppression impossible." };
  }

  revalidatePath("/archives/plaintes");
  redirect("/archives/plaintes");
}
