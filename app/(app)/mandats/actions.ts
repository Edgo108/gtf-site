"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { uniteCanWrite } from "@/lib/permissions";
import { normalizeName } from "@/lib/investigations/suspects";
import { WANTED_PHOTOS_BUCKET, wantedPhotoPath } from "@/lib/wanted/photos";
import type {
  NiveauDangerosite,
  WantedStatut,
} from "@/lib/supabase/wanted-notices-types";
import { requireActiveUser } from "@/lib/auth/require";
import {
  isSameVersion,
  readExpectedVersion,
  STALE_EDIT_ERROR,
} from "@/lib/concurrency";

type ActionResult = { error?: string };

const NO_WRITE_MANDATS =
  "Votre unité n'autorise pas la modification des mandats (lecture seule).";
type ServerSupabase = Awaited<ReturnType<typeof createClient>>;

const VALID_NIVEAUX: NiveauDangerosite[] = ["faible", "moyen", "eleve"];
const VALID_STATUTS: WantedStatut[] = ["actif", "capture"];

const MAX_PHOTO_SIZE = 5 * 1024 * 1024; // 5 Mo
const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const BUCKET = WANTED_PHOTOS_BUCKET;

async function uploadWantedPhoto(
  supabase: ServerSupabase,
  file: File,
): Promise<{ url?: string; error?: string }> {
  const extension = ALLOWED_TYPES[file.type];
  if (!extension) {
    return { error: "Format d'image non supporté (JPEG, PNG ou WebP uniquement)." };
  }
  if (file.size > MAX_PHOTO_SIZE) {
    return { error: "L'image dépasse la taille maximale (5 Mo)." };
  }

  const path = `${crypto.randomUUID()}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });

  if (uploadError) {
    return { error: "Échec de l'upload de la photo." };
  }

  // Bucket privé : on enregistre le chemin, l'URL d'affichage (signée)
  // est générée à chaque rendu (lib/wanted/photos.ts).
  return { url: path };
}

// Correspondance EXACTE (nom + prénom, insensible casse/accents/espaces
// superflus, pas de floue) avec un membre de gang_members appartenant à
// une organisation non archivée (gangs.deleted_at is null, déjà filtré
// par RLS). Recalculée à chaque création/modification du mandat — pas de
// mise à jour si gang_members change indépendamment entretemps (ce sens
// inverse est couvert par le trigger DB de
// supabase/wanted_notice_organisation_sync.sql, qui applique la même
// règle de départage : en cas d'homonymes dans des organisations
// différentes, le membre le plus ancien l'emporte).
async function resolveOrganisationGangId(
  supabase: ServerSupabase,
  nomSuspect: string,
): Promise<string | null> {
  const target = normalizeName(nomSuspect);
  if (!target) return null;

  const [{ data: members }, { data: gangs }] = await Promise.all([
    supabase
      .from("gang_members")
      .select("nom, gang_id")
      .order("created_at", { ascending: true }),
    supabase.from("gangs").select("id"),
  ]);

  const validGangIds = new Set((gangs ?? []).map((g) => g.id));
  const match = (members ?? []).find(
    (member) =>
      validGangIds.has(member.gang_id) && normalizeName(member.nom) === target,
  );

  return match?.gang_id ?? null;
}

function readFields(formData: FormData) {
  const nom_suspect = String(formData.get("nom_suspect") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();

  const niveauRaw = String(formData.get("niveau_dangerosite") ?? "moyen");
  const niveau_dangerosite: NiveauDangerosite = VALID_NIVEAUX.includes(
    niveauRaw as NiveauDangerosite,
  )
    ? (niveauRaw as NiveauDangerosite)
    : "moyen";

  return { nom_suspect, description, niveau_dangerosite };
}

export async function createWantedNotice(
  formData: FormData,
): Promise<ActionResult> {
  const { supabase, user, profile } = await requireActiveUser();

  if (!uniteCanWrite("mandats", profile)) {
    return { error: NO_WRITE_MANDATS };
  }

  const fields = readFields(formData);

  if (!fields.nom_suspect) {
    return { error: "Le nom du suspect est obligatoire." };
  }

  let photo_url: string | null = null;
  const photo = formData.get("photo");
  if (photo instanceof File && photo.size > 0) {
    const uploaded = await uploadWantedPhoto(supabase, photo);
    if (uploaded.error) return { error: uploaded.error };
    photo_url = uploaded.url ?? null;
  }

  const organisation_gang_id = await resolveOrganisationGangId(
    supabase,
    fields.nom_suspect,
  );

  const { data, error } = await supabase
    .from("wanted_notices")
    .insert({
      ...fields,
      photo_url,
      organisation_gang_id,
      statut: "actif",
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { error: "Impossible de créer le mandat." };
  }

  revalidatePath("/mandats");
  redirect(`/mandats/${data.id}`);
}

export async function updateWantedNotice(
  formData: FormData,
): Promise<ActionResult> {
  const { supabase, profile } = await requireActiveUser();

  if (!uniteCanWrite("mandats", profile)) {
    return { error: NO_WRITE_MANDATS };
  }

  const id = String(formData.get("id") ?? "");
  if (!id) {
    return { error: "Identifiant manquant." };
  }

  const { data: existing } = await supabase
    .from("wanted_notices")
    .select("photo_url, updated_at")
    .eq("id", id)
    .single();

  if (!existing) {
    return { error: "Mandat introuvable." };
  }

  // Vérifié dès maintenant : ne pas toucher à la photo d'une fiche que
  // quelqu'un d'autre vient de modifier.
  const expected = readExpectedVersion(formData);
  if (expected && !isSameVersion(expected, existing.updated_at)) {
    return { error: STALE_EDIT_ERROR };
  }

  const fields = readFields(formData);
  if (!fields.nom_suspect) {
    return { error: "Le nom du suspect est obligatoire." };
  }

  const statutRaw = String(formData.get("statut") ?? "actif");
  const statut: WantedStatut = VALID_STATUTS.includes(statutRaw as WantedStatut)
    ? (statutRaw as WantedStatut)
    : "actif";

  let photo_url = existing.photo_url as string | null;
  const photo = formData.get("photo");
  if (photo instanceof File && photo.size > 0) {
    const uploaded = await uploadWantedPhoto(supabase, photo);
    if (uploaded.error) return { error: uploaded.error };

    if (existing.photo_url) {
      const oldPath = wantedPhotoPath(existing.photo_url);
      if (oldPath) {
        await supabase.storage.from(BUCKET).remove([oldPath]);
      }
    }

    photo_url = uploaded.url ?? photo_url;
  }

  const organisation_gang_id = await resolveOrganisationGangId(
    supabase,
    fields.nom_suspect,
  );

  let update = supabase
    .from("wanted_notices")
    .update({ ...fields, statut, photo_url, organisation_gang_id })
    .eq("id", id);
  if (expected) update = update.eq("updated_at", expected);
  const { data: updated, error } = await update.select("id");

  if (error) {
    return { error: "Impossible de mettre à jour le mandat." };
  }
  if (!updated || updated.length === 0) {
    return { error: STALE_EDIT_ERROR };
  }

  revalidatePath(`/mandats/${id}`);
  revalidatePath("/mandats");
  redirect(`/mandats/${id}`);
}

export async function toggleWantedStatut(
  formData: FormData,
): Promise<ActionResult> {
  const { supabase, profile } = await requireActiveUser();

  if (!uniteCanWrite("mandats", profile)) {
    return { error: NO_WRITE_MANDATS };
  }

  const id = String(formData.get("id") ?? "");
  const current = String(formData.get("statut") ?? "");
  if (!id) {
    return { error: "Identifiant manquant." };
  }
  const next: WantedStatut = current === "actif" ? "capture" : "actif";

  const { error } = await supabase
    .from("wanted_notices")
    .update({ statut: next })
    .eq("id", id);

  if (error) {
    return { error: "Impossible de mettre à jour le statut." };
  }

  revalidatePath(`/mandats/${id}`);
  revalidatePath("/mandats");
  return {};
}

export async function deleteWantedNotice(
  formData: FormData,
): Promise<ActionResult> {
  const { supabase, profile } = await requireActiveUser();

  if (!uniteCanWrite("mandats", profile)) {
    return { error: NO_WRITE_MANDATS };
  }

  const id = String(formData.get("id") ?? "");
  if (!id) {
    return { error: "Identifiant manquant." };
  }

  const { data: existing } = await supabase
    .from("wanted_notices")
    .select("photo_url")
    .eq("id", id)
    .single();

  const { error } = await supabase.from("wanted_notices").delete().eq("id", id);
  if (error) {
    return { error: "Impossible de supprimer ce mandat." };
  }

  if (existing?.photo_url) {
    const path = wantedPhotoPath(existing.photo_url);
    if (path) {
      await supabase.storage.from(BUCKET).remove([path]);
    }
  }

  revalidatePath("/mandats");
  redirect("/mandats");
}
