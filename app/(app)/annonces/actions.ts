"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { uniteCanWrite } from "@/lib/permissions";
import type { AnnouncementPriorite } from "@/lib/supabase/announcements-types";

type ActionResult = { error?: string };

const VALID_PRIORITES: AnnouncementPriorite[] = ["normale", "urgente"];
const AUTHOR_GRADES = ["Lieutenant", "Commandant"];

const NO_WRITE_ANNONCES =
  "Votre unité n'autorise pas la gestion des notifications (lecture seule).";

function readPriorite(formData: FormData): AnnouncementPriorite {
  const raw = String(formData.get("priorite") ?? "normale");
  return VALID_PRIORITES.includes(raw as AnnouncementPriorite)
    ? (raw as AnnouncementPriorite)
    : "normale";
}

async function requireAnnouncementAuthor() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Non authentifié.");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("grade, role, unite")
    .eq("id", user.id)
    .single();

  if (!profile || !AUTHOR_GRADES.includes(profile.grade)) {
    throw new Error(
      "Seuls les Lieutenants et Commandants peuvent créer une notification.",
    );
  }

  if (!uniteCanWrite("annonces", profile)) {
    throw new Error(NO_WRITE_ANNONCES);
  }

  return { supabase, user };
}

// Créateur d'une annonce ou admin — ET unité habilitée à écrire.
async function requireAnnouncementManager() {
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

  const { error } = await supabase
    .from("announcements")
    .update({ titre, message, priorite })
    .eq("id", id);

  if (error) {
    return { error: "Impossible de modifier la notification." };
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
