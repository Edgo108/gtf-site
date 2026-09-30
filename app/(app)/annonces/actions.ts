"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireActiveUser } from "@/lib/auth/require";
import { canAuthorAnnouncements, uniteCanWrite } from "@/lib/permissions";
import type { AnnouncementPriorite } from "@/lib/supabase/announcements-types";
import { readExpectedVersion, STALE_EDIT_ERROR } from "@/lib/concurrency";

type ActionResult = { error?: string };

const VALID_PRIORITES: AnnouncementPriorite[] = ["normale", "urgente"];

const NO_WRITE_ANNONCES =
  "Votre unité n'autorise pas la gestion des notifications (lecture seule).";

function readPriorite(formData: FormData): AnnouncementPriorite {
  const raw = String(formData.get("priorite") ?? "normale");
  return VALID_PRIORITES.includes(raw as AnnouncementPriorite)
    ? (raw as AnnouncementPriorite)
    : "normale";
}

async function requireAnnouncementAuthor() {
  const { supabase, user, profile } = await requireActiveUser();

  if (!canAuthorAnnouncements(profile.grade)) {
    throw new Error(
      "Seuls les Lieutenants, Capitaines et Commandants peuvent créer une notification.",
    );
  }

  if (!uniteCanWrite("annonces", profile)) {
    throw new Error(NO_WRITE_ANNONCES);
  }

  return { supabase, user };
}

// Créateur d'une annonce ou admin — ET unité habilitée à écrire.
async function requireAnnouncementManager() {
  return requireActiveUser();
}

export async function createAnnouncement(
  formData: FormData,
): Promise<ActionResult> {
  const { supabase, user } = await requireAnnouncementAuthor();

  const titre = String(formData.get("titre") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();
  const priorite = readPriorite(formData);

  if (!titre) {
    return { error: "Le titre est obligatoire." };
  }

  const { error } = await supabase.from("announcements").insert({
    titre,
    message,
    priorite,
    created_by: user.id,
  });

  if (error) {
    return { error: "Impossible de créer la notification." };
  }

  revalidatePath("/annonces");
  revalidatePath("/dashboard");
  redirect("/annonces");
}

export async function updateAnnouncement(
  formData: FormData,
): Promise<ActionResult> {
  const { supabase, user, profile } = await requireAnnouncementManager();

  if (!user) {
    return { error: "Non authentifié." };
  }

  if (!uniteCanWrite("annonces", profile)) {
    return { error: NO_WRITE_ANNONCES };
  }

  const id = String(formData.get("id") ?? "");
  if (!id) {
    return { error: "Identifiant manquant." };
  }

  const titre = String(formData.get("titre") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();
  const priorite = readPriorite(formData);

  if (!titre) {
    return { error: "Le titre est obligatoire." };
  }

  const expected = readExpectedVersion(formData);
  let update = supabase
    .from("announcements")
    .update({ titre, message, priorite })
    .eq("id", id);
  if (expected) update = update.eq("updated_at", expected);
  const { data: updated, error } = await update.select("id");

  if (error) {
    return { error: "Impossible de modifier la notification." };
  }
  if (!updated || updated.length === 0) {
    return { error: STALE_EDIT_ERROR };
  }

  revalidatePath("/annonces");
  revalidatePath("/dashboard");
  redirect("/annonces");
}

export async function deleteAnnouncement(
  formData: FormData,
): Promise<ActionResult> {
  const { supabase, user, profile } = await requireAnnouncementManager();

  if (!user) {
    return { error: "Non authentifié." };
  }

  if (!uniteCanWrite("annonces", profile)) {
    return { error: NO_WRITE_ANNONCES };
  }

  const id = String(formData.get("id") ?? "");
  if (!id) {
    return { error: "Identifiant manquant." };
  }

  const { error } = await supabase.from("announcements").delete().eq("id", id);

  if (error) {
    return { error: "Impossible de supprimer la notification." };
  }

  revalidatePath("/annonces");
  revalidatePath("/dashboard");
  return {};
}

export async function markAnnouncementRead(
  formData: FormData,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Non authentifié." };
  }

  const announcementId = String(formData.get("announcement_id") ?? "");
  if (!announcementId) {
    return { error: "Identifiant manquant." };
  }

  const { error } = await supabase.from("announcement_reads").upsert(
    { announcement_id: announcementId, user_id: user.id },
    { onConflict: "announcement_id,user_id", ignoreDuplicates: true },
  );

  if (error) {
    return { error: "Impossible de marquer comme lu." };
  }

  revalidatePath("/annonces");
  revalidatePath("/dashboard");
  return {};
}
