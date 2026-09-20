"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { uniteCanWrite } from "@/lib/permissions";
import { buildLabMarkerChangeSummary } from "@/lib/lab-markers/change-summary";
import { LOCK_DURATION_MS } from "@/lib/supabase/zones-types";
import {
  isLabCategorie,
  isLabStatut,
  type LabCategorie,
  type LabMarker,
  type LabMarkerPosition,
} from "@/lib/supabase/lab-markers-types";

type ActionResult = { error?: string; id?: string };

const NO_WRITE_LABS =
  "Seuls les rôles ID et GTF peuvent gérer les marqueurs laboratoire.";

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
    .select("pseudo, role, unite")
    .eq("id", user.id)
    .single();

  if (!profile) {
    throw new Error("Profil introuvable.");
  }

  return { supabase, user, profile };
}

function parsePosition(raw: string): LabMarkerPosition | null {
  try {
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed.x === "number" &&
      typeof parsed.y === "number" &&
      Number.isFinite(parsed.x) &&
      Number.isFinite(parsed.y)
    ) {
      return { x: parsed.x, y: parsed.y };
    }
    return null;
  } catch {
    return null;
  }
}

// Catégorie obligatoire sauf statut "potentiel" (labo repéré mais pas
// encore confirmé) — même règle que la contrainte
// lab_markers_categorie_required_unless_potentiel en base.
function parseCategorieAndStatut(
  formData: FormData,
  fallbackStatut: LabMarker["statut"],
): { categorie: LabCategorie | null; statut: LabMarker["statut"] } | { error: string } {
  const categorieRaw = String(formData.get("categorie") ?? "").trim();
  const statutRaw = String(formData.get("statut") ?? "");
  const statut = isLabStatut(statutRaw) ? statutRaw : fallbackStatut;

  let categorie: LabCategorie | null = null;
  if (categorieRaw) {
    if (!isLabCategorie(categorieRaw)) return { error: "Catégorie invalide." };
    categorie = categorieRaw;
  } else if (statut !== "potentiel") {
    return { error: "La catégorie est obligatoire (sauf statut Potentiel)." };
  }

  return { categorie, statut };
}

export async function createLabMarker(
  formData: FormData,
): Promise<ActionResult> {
  const { supabase, user, profile } = await requireActiveUser();

  if (!uniteCanWrite("zones", profile)) return { error: NO_WRITE_LABS };

  const organisation_id = String(formData.get("organisation_id") ?? "");
  const position = parsePosition(String(formData.get("position") ?? ""));
  // Enquête liée : optionnelle, une seule à la fois. Sélectionnée via
  // auto-complétion côté client (pas de texte libre), donc pas de
  // validation de format ici — une valeur invalide échouerait de toute
  // façon sur la contrainte de clé étrangère.
  const investigation_id =
    String(formData.get("investigation_id") ?? "").trim() || null;

  const parsed = parseCategorieAndStatut(formData, "actif");
  if ("error" in parsed) return { error: parsed.error };
  const { categorie, statut } = parsed;

  if (!organisation_id) return { error: "L'organisation est obligatoire." };
  if (!position) return { error: "Position invalide." };

  const { data, error } = await supabase
    .from("lab_markers")
    .insert({
      categorie,
      statut,
      organisation_id,
      position,
      investigation_id,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { error: "Impossible de créer le marqueur laboratoire." };
  }

  await supabase.from("lab_marker_history").insert({
    marker_id: data.id,
    agent_id: user.id,
    agent_pseudo: profile.pseudo,
    resume: "Laboratoire créé",
  });

  revalidatePath("/zones");
  return { id: data.id };
}

export async function updateLabMarker(
  formData: FormData,
): Promise<ActionResult> {
  const { supabase, user, profile } = await requireActiveUser();

  if (!uniteCanWrite("zones", profile)) return { error: NO_WRITE_LABS };

  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Identifiant manquant." };

  const { data: oldMarker } = await supabase
    .from("lab_markers")
    .select("*")
    .eq("id", id)
    .single<LabMarker>();

  if (!oldMarker) return { error: "Marqueur introuvable." };

  const organisation_id =
    String(formData.get("organisation_id") ?? "") || oldMarker.organisation_id;
  const position =
    parsePosition(String(formData.get("position") ?? "")) ?? oldMarker.position;
  // Toujours envoyée explicitement par le formulaire (vide = pas/plus de
  // lien), contrairement aux autres champs qui retombent sur l'ancienne
  // valeur si absents.
  const investigation_id =
    String(formData.get("investigation_id") ?? "").trim() || null;

  const parsed = parseCategorieAndStatut(formData, oldMarker.statut);
  if ("error" in parsed) return { error: parsed.error };
  const { categorie, statut } = parsed;

  if (!organisation_id) return { error: "L'organisation est obligatoire." };

  const { error } = await supabase
    .from("lab_markers")
    .update({ categorie, statut, organisation_id, position, investigation_id })
    .eq("id", id);

  if (error) {
    return {
      error:
        "Mise à jour impossible (marqueur verrouillé par un autre agent ?).",
    };
  }

  const resume = buildLabMarkerChangeSummary(oldMarker, {
    categorie,
    statut,
    organisation_id,
    position,
    investigation_id,
  });

  await supabase.from("lab_marker_history").insert({
    marker_id: id,
    agent_id: user.id,
    agent_pseudo: profile.pseudo,
    resume,
  });

  await supabase.from("lab_marker_locks").delete().eq("marker_id", id);

  revalidatePath("/zones");
  return {};
}

export async function deleteLabMarker(
  formData: FormData,
): Promise<ActionResult> {
  const { user, profile } = await requireActiveUser();

  if (!uniteCanWrite("zones", profile)) return { error: NO_WRITE_LABS };

  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Identifiant manquant." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("lab_markers")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    return { error: "Suppression impossible." };
  }

  await admin.from("lab_marker_history").insert({
    marker_id: id,
    agent_id: user.id,
    agent_pseudo: profile.pseudo,
    resume: "Laboratoire déplacé vers la corbeille",
  });

  await admin.from("lab_marker_locks").delete().eq("marker_id", id);

  revalidatePath("/zones");
  return {};
}

export async function acquireLabLock(
  formData: FormData,
): Promise<ActionResult> {
  const { user, profile } = await requireActiveUser();

  if (!uniteCanWrite("zones", profile)) return { error: NO_WRITE_LABS };

  const markerId = String(formData.get("marker_id") ?? "");
  if (!markerId) return { error: "Identifiant manquant." };

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("lab_marker_locks")
    .select("locked_by, locked_at")
    .eq("marker_id", markerId)
    .maybeSingle();

  const isExpired = existing
    ? Date.now() - new Date(existing.locked_at).getTime() > LOCK_DURATION_MS
    : true;
  const isOwn = existing?.locked_by === user.id;

  if (existing && !isExpired && !isOwn) {
    return {
      error: "Ce marqueur est en cours de modification par un autre agent.",
    };
  }

  const { error } = await admin.from("lab_marker_locks").upsert(
    {
      marker_id: markerId,
      locked_by: user.id,
      locked_at: new Date().toISOString(),
    },
    { onConflict: "marker_id" },
  );

  if (error) {
    return { error: "Impossible de verrouiller le marqueur." };
  }

  return {};
}

export async function releaseLabLock(
  formData: FormData,
): Promise<ActionResult> {
  const { supabase } = await requireActiveUser();

  const markerId = String(formData.get("marker_id") ?? "");
  if (!markerId) return { error: "Identifiant manquant." };

  await supabase.from("lab_marker_locks").delete().eq("marker_id", markerId);
  return {};
}

export async function getLabLocksWithPseudos(): Promise<
  { marker_id: string; locked_by: string; locked_at: string; pseudo: string }[]
> {
  await requireActiveUser();

  const admin = createAdminClient();
  const { data: locks } = await admin.from("lab_marker_locks").select("*");

  if (!locks || locks.length === 0) return [];

  const userIds = [...new Set(locks.map((l) => l.locked_by))];
  const { data: profiles } = await admin
    .from("profiles")
    .select("id, pseudo")
    .in("id", userIds);

  const pseudoMap = new Map((profiles ?? []).map((p) => [p.id, p.pseudo]));

  return locks.map((l) => ({
    marker_id: l.marker_id,
    locked_by: l.locked_by,
    locked_at: l.locked_at,
    pseudo: pseudoMap.get(l.locked_by) ?? "Agent inconnu",
  }));
}
