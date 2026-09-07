"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { uniteCanWrite } from "@/lib/permissions";
import {
  isGangCategorie,
  type GangCategorie,
  type MembreStatut,
  type NiveauMenace,
} from "@/lib/supabase/gangs-types";

type ActionResult = { error?: string };

const NO_WRITE_GANGS =
  "Votre unité n'autorise pas la modification de la B.D.D (lecture seule).";

const VALID_NIVEAUX: NiveauMenace[] = ["faible", "moyen", "eleve"];
const VALID_MEMBER_STATUTS: MembreStatut[] = [
  "actif",
  "arrete",
  "recherche",
  "decede",
];
const HEX_COLOR_REGEX = /^#[0-9a-fA-F]{6}$/;
const DEFAULT_COLOR = "#3E6FA6";

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
    .select("role, unite")
    .eq("id", user.id)
    .single();

  return { supabase, user, profile: profile ?? {} };
}

function ensureCanWriteGangs(profile: {
  role?: string | null;
  unite?: string | null;
}): ActionResult | null {
  return uniteCanWrite("gangs", profile) ? null : { error: NO_WRITE_GANGS };
}

function readGangFields(formData: FormData) {
  const nom = String(formData.get("nom") ?? "").trim();

  const categorieRaw = String(formData.get("categorie") ?? "Gang");
  const categorie: GangCategorie = isGangCategorie(categorieRaw)
    ? categorieRaw
    : "Gang";

  const territoire = String(formData.get("territoire") ?? "").trim();
  const activites = String(formData.get("activites") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  const niveauRaw = String(formData.get("niveau_menace") ?? "moyen");
  const niveau_menace: NiveauMenace = VALID_NIVEAUX.includes(
    niveauRaw as NiveauMenace,
  )
    ? (niveauRaw as NiveauMenace)
    : "moyen";

  const couleurRaw = String(formData.get("couleur") ?? DEFAULT_COLOR);
  const couleur = HEX_COLOR_REGEX.test(couleurRaw) ? couleurRaw : DEFAULT_COLOR;

  return {
    nom,
    categorie,
    territoire,
    niveau_menace,
    activites,
    couleur,
    notes,
  };
}

export async function createGang(formData: FormData): Promise<ActionResult> {
  const { supabase, profile } = await requireActiveUser();

  const denied = ensureCanWriteGangs(profile);
  if (denied) return denied;

  const fields = readGangFields(formData);

  if (!fields.nom) {
    return { error: "Le nom est obligatoire." };
  }

  const { data, error } = await supabase
    .from("gangs")
    .insert(fields)
    .select("id")
    .single();

  if (error || !data) {
    return { error: "Impossible de créer la fiche." };
  }

  revalidatePath("/gangs");
  redirect(`/gangs/${data.id}`);
}

export async function updateGang(formData: FormData): Promise<ActionResult> {
  const { supabase, profile } = await requireActiveUser();

  const denied = ensureCanWriteGangs(profile);
  if (denied) return denied;

  const id = String(formData.get("id") ?? "");
  if (!id) {
    return { error: "Identifiant manquant." };
  }

  const fields = readGangFields(formData);
  if (!fields.nom) {
    return { error: "Le nom est obligatoire." };
  }

  const { error } = await supabase.from("gangs").update(fields).eq("id", id);

  if (error) {
    return { error: "Impossible de mettre à jour la fiche." };
  }

  revalidatePath(`/gangs/${id}`);
  revalidatePath("/gangs");
  redirect(`/gangs/${id}`);
}

export async function deleteGang(formData: FormData): Promise<ActionResult> {
  const { profile } = await requireActiveUser();

  const denied = ensureCanWriteGangs(profile);
  if (denied) return denied;

  const id = String(formData.get("id") ?? "");
  if (!id) {
    return { error: "Identifiant manquant." };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("gangs")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    return { error: "Suppression impossible." };
  }

  revalidatePath("/gangs");
  redirect("/gangs");
}

function readMemberStatut(formData: FormData): MembreStatut {
  const raw = String(formData.get("statut") ?? "actif");
  return VALID_MEMBER_STATUTS.includes(raw as MembreStatut)
    ? (raw as MembreStatut)
    : "actif";
}

export async function createGangMember(
  formData: FormData,
): Promise<ActionResult> {
  const { supabase, profile } = await requireActiveUser();

  const denied = ensureCanWriteGangs(profile);
  if (denied) return denied;

  const gang_id = String(formData.get("gang_id") ?? "");
  const nom = String(formData.get("nom") ?? "").trim();
  const role = String(formData.get("role") ?? "").trim();
  const statut = readMemberStatut(formData);

  if (!gang_id || !nom) {
    return { error: "Champs manquants." };
  }

  const { error } = await supabase
    .from("gang_members")
    .insert({ gang_id, nom, role, statut });

  if (error) {
    return { error: "Impossible d'ajouter le membre." };
  }

  revalidatePath(`/gangs/${gang_id}`);
  return {};
}

export async function updateGangMember(
  formData: FormData,
): Promise<ActionResult> {
  const { supabase, profile } = await requireActiveUser();

  const denied = ensureCanWriteGangs(profile);
  if (denied) return denied;

  const id = String(formData.get("id") ?? "");
  const gang_id = String(formData.get("gang_id") ?? "");
  const nom = String(formData.get("nom") ?? "").trim();
  const role = String(formData.get("role") ?? "").trim();
  const statut = readMemberStatut(formData);

  if (!id || !nom) {
    return { error: "Champs manquants." };
  }

  const { error } = await supabase
    .from("gang_members")
    .update({ nom, role, statut })
    .eq("id", id);

  if (error) {
    return { error: "Impossible de mettre à jour le membre." };
  }

  revalidatePath(`/gangs/${gang_id}`);
  return {};
}

export async function deleteGangMember(
  formData: FormData,
): Promise<ActionResult> {
  const { supabase, profile } = await requireActiveUser();

  const denied = ensureCanWriteGangs(profile);
  if (denied) return denied;

  const id = String(formData.get("id") ?? "");
  const gang_id = String(formData.get("gang_id") ?? "");
  if (!id) {
    return { error: "Identifiant manquant." };
  }

  const { error } = await supabase.from("gang_members").delete().eq("id", id);

  if (error) {
    return { error: "Impossible de supprimer le membre." };
  }

  revalidatePath(`/gangs/${gang_id}`);
  return {};
}
