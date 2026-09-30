"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildChangeSummary } from "@/lib/investigations/change-summary";
import { uniteCanWrite } from "@/lib/permissions";
import {
  normalizeName,
  parseSuspectNames,
  type SuspectMatch,
} from "@/lib/investigations/suspects";
import type {
  Investigation,
  InvestigationStatut,
} from "@/lib/supabase/investigations-types";
import { requireActiveUser } from "@/lib/auth/require";
import { readExpectedVersion, STALE_EDIT_ERROR } from "@/lib/concurrency";

type ActionResult = { error?: string };

const VALID_STATUTS: InvestigationStatut[] = [
  "en_cours",
  "cloturee",
  "archivee",
];

const NO_WRITE_ENQUETES =
  "Votre unité n'autorise pas la modification des enquêtes (lecture seule).";

function readFields(formData: FormData) {
  const titre = String(formData.get("titre") ?? "").trim();
  const statutRaw = String(formData.get("statut") ?? "en_cours");
  const statut: InvestigationStatut = VALID_STATUTS.includes(
    statutRaw as InvestigationStatut,
  )
    ? (statutRaw as InvestigationStatut)
    : "en_cours";
  const suspects = String(formData.get("suspects") ?? "").trim();
  const preuves = String(formData.get("preuves") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const agent_responsable = String(
    formData.get("agent_responsable") ?? "",
  ).trim();
  // Casier de preuves : champs optionnels, chaîne vide stockée comme null
  // plutôt que "" (cohérent avec la colonne nullable).
  const casierNumeroRaw = String(formData.get("casier_numero") ?? "").trim();
  const casier_numero = casierNumeroRaw || null;
  const casierCodeAccesRaw = String(
    formData.get("casier_code_acces") ?? "",
  ).trim();
  const casier_code_acces = casierCodeAccesRaw || null;

  return {
    titre,
    statut,
    suspects,
    preuves,
    description,
    agent_responsable,
    casier_numero,
    casier_code_acces,
  };
}

export async function createInvestigation(
  formData: FormData,
): Promise<ActionResult> {
  const { supabase, user, profile } = await requireActiveUser();

  if (!uniteCanWrite("enquetes", profile)) {
    return { error: NO_WRITE_ENQUETES };
  }

  const fields = readFields(formData);

  if (!fields.titre) {
    return { error: "Le titre est obligatoire." };
  }

  const { data, error } = await supabase
    .from("investigations")
    .insert({ ...fields, created_by: user.id })
    .select("id")
    .single();

  if (error || !data) {
    return { error: "Impossible de créer l'enquête." };
  }

  await supabase.from("investigation_history").insert({
    investigation_id: data.id,
    agent_id: user.id,
    agent_pseudo: profile.pseudo,
    resume: "Enquête créée",
  });

  revalidatePath("/enquetes");
  redirect(`/enquetes/${data.id}`);
}

export async function updateInvestigation(
  formData: FormData,
): Promise<ActionResult> {
  const { supabase, user, profile } = await requireActiveUser();

  if (!uniteCanWrite("enquetes", profile)) {
    return { error: NO_WRITE_ENQUETES };
  }

  const id = String(formData.get("id") ?? "");
  if (!id) {
    return { error: "Identifiant manquant." };
  }

  const { data: oldRow } = await supabase
    .from("investigations")
    .select("*")
    .eq("id", id)
    .single<Investigation>();

  if (!oldRow) {
    return { error: "Enquête introuvable." };
  }

  const fields = readFields(formData);
  if (!fields.titre) {
    return { error: "Le titre est obligatoire." };
  }

  const expected = readExpectedVersion(formData);
  let update = supabase
    .from("investigations")
    .update(fields)
    .eq("id", id);
  if (expected) update = update.eq("updated_at", expected);
  const { data: updated, error } = await update.select("id");

  if (error) {
    return { error: "Impossible de mettre à jour l'enquête." };
  }
  if (!updated || updated.length === 0) {
    return { error: STALE_EDIT_ERROR };
  }

  const resume = buildChangeSummary(oldRow, { ...oldRow, ...fields });

  await supabase.from("investigation_history").insert({
    investigation_id: id,
    agent_id: user.id,
    agent_pseudo: profile.pseudo,
    resume,
  });

  revalidatePath(`/enquetes/${id}`);
  revalidatePath("/enquetes");
  redirect(`/enquetes/${id}`);
}

export async function softDeleteInvestigation(
  formData: FormData,
): Promise<ActionResult> {
  const { supabase, user, profile } = await requireActiveUser();

  if (!uniteCanWrite("enquetes", profile)) {
    return { error: NO_WRITE_ENQUETES };
  }

  const id = String(formData.get("id") ?? "");
  if (!id) {
    return { error: "Identifiant manquant." };
  }

  const { data: investigation } = await supabase
    .from("investigations")
    .select("created_by")
    .eq("id", id)
    .single();

  if (!investigation) {
    return { error: "Enquête introuvable." };
  }

  const isOwner = investigation.created_by === user.id;
  const isAdmin = profile.role === "admin";

  if (!isOwner && !isAdmin) {
    return {
      error: "Seul le créateur ou un administrateur peut supprimer cette enquête.",
    };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("investigations")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    return { error: "Suppression impossible." };
  }

  await supabase.from("investigation_history").insert({
    investigation_id: id,
    agent_id: user.id,
    agent_pseudo: profile.pseudo,
    resume: "Enquête déplacée vers la corbeille",
  });

  revalidatePath("/enquetes");
  redirect("/enquetes");
}

// Cherche, pour chaque nom fourni, les autres enquêtes (non supprimées,
// hors `excludeId`) dont le champ "suspects" mentionne ce même nom.
export async function checkSuspectMatches(
  names: string[],
  excludeId?: string,
): Promise<SuspectMatch[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || names.length === 0) {
    return [];
  }

  let query = supabase.from("investigations").select("id, titre, suspects");
  if (excludeId) {
    query = query.neq("id", excludeId);
  }

  const { data } = await query;
  if (!data) {
    return [];
  }

  const results: SuspectMatch[] = [];

  for (const rawName of names) {
    const target = normalizeName(rawName);
    if (!target) continue;

    const matching = data.filter((investigation) =>
      parseSuspectNames(investigation.suspects).some(
        (suspectName) => normalizeName(suspectName) === target,
      ),
    );

    if (matching.length > 0) {
      results.push({
        name: rawName,
        investigations: matching.map((investigation) => ({
          id: investigation.id,
          titre: investigation.titre,
        })),
      });
    }
  }

  return results;
}
