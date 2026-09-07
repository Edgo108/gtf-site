"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildZoneChangeSummary } from "@/lib/zones/change-summary";
import { uniteCanWrite } from "@/lib/permissions";
import { LOCK_DURATION_MS } from "@/lib/supabase/zones-types";
import type {
  SensitiveZone,
  ZonePoint,
  ZoneType,
} from "@/lib/supabase/zones-types";

type ActionResult = { error?: string; id?: string };

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

const NO_WRITE_ZONES =
  "Votre unité n'autorise pas la modification de la carte des zones (lecture seule).";

function parsePoints(raw: string): ZonePoint[] | null {
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length < 3) return null;
    if (
      !parsed.every(
        (p) => typeof p?.x === "number" && typeof p?.y === "number",
      )
    ) {
      return null;
    }
    return parsed as ZonePoint[];
  } catch {
    return null;
  }
}

function parseTypeZone(raw: string): ZoneType | null {
  return raw === "vente" || raw === "influence" ? raw : null;
}

export async function createZone(formData: FormData): Promise<ActionResult> {
  const { supabase, user, profile } = await requireActiveUser();

  if (!uniteCanWrite("zones", profile)) return { error: NO_WRITE_ZONES };

  const gang_id = String(formData.get("gang_id") ?? "");
  const type_zone = parseTypeZone(String(formData.get("type_zone") ?? ""));
  const points = parsePoints(String(formData.get("points") ?? ""));

  if (!gang_id) return { error: "Le gang est obligatoire." };
  if (!type_zone) return { error: "Type de zone invalide." };
  if (!points) return { error: "La zone doit avoir au moins 3 points." };

  const { data, error } = await supabase
    .from("sensitive_zones")
    .insert({ gang_id, type_zone, points, created_by: user.id })
    .select("id")
    .single();

  if (error || !data) {
    return { error: "Impossible de créer la zone." };
  }

  await supabase.from("zone_history").insert({
    zone_id: data.id,
    agent_id: user.id,
    agent_pseudo: profile.pseudo,
    resume: "Zone créée",
  });

  revalidatePath("/zones");
  return { id: data.id };
}

export async function updateZone(formData: FormData): Promise<ActionResult> {
  const { supabase, user, profile } = await requireActiveUser();

  if (!uniteCanWrite("zones", profile)) return { error: NO_WRITE_ZONES };

  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Identifiant manquant." };

  const { data: oldZone } = await supabase
    .from("sensitive_zones")
    .select("*")
    .eq("id", id)
    .single<SensitiveZone>();

  if (!oldZone) {
    return { error: "Zone introuvable." };
  }

  const gang_id = String(formData.get("gang_id") ?? oldZone.gang_id);
  const type_zone =
    parseTypeZone(String(formData.get("type_zone") ?? "")) ??
    oldZone.type_zone;
  const points =
    parsePoints(String(formData.get("points") ?? "")) ?? oldZone.points;

  if (!gang_id) return { error: "Le gang est obligatoire." };

  const { error } = await supabase
    .from("sensitive_zones")
    .update({ gang_id, type_zone, points })
    .eq("id", id);

  if (error) {
    return {
      error:
        "Impossible de mettre à jour la zone (verrouillée par un autre agent ?).",
    };
  }

  const resume = buildZoneChangeSummary(oldZone, {
    gang_id,
    type_zone,
    points,
  });

  await supabase.from("zone_history").insert({
    zone_id: id,
    agent_id: user.id,
    agent_pseudo: profile.pseudo,
    resume,
  });

  await supabase.from("zone_locks").delete().eq("zone_id", id);

  revalidatePath("/zones");
  return {};
}

export async function deleteZone(formData: FormData): Promise<ActionResult> {
  const { user, profile } = await requireActiveUser();

  if (!uniteCanWrite("zones", profile)) return { error: NO_WRITE_ZONES };

  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Identifiant manquant." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("sensitive_zones")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    return { error: "Suppression impossible." };
  }

  await admin.from("zone_history").insert({
    zone_id: id,
    agent_id: user.id,
    agent_pseudo: profile.pseudo,
    resume: "Zone déplacée vers la corbeille",
  });

  await admin.from("zone_locks").delete().eq("zone_id", id);

  revalidatePath("/zones");
  return {};
}

export async function acquireLock(formData: FormData): Promise<ActionResult> {
  const { user, profile } = await requireActiveUser();

  if (!uniteCanWrite("zones", profile)) return { error: NO_WRITE_ZONES };

  const zoneId = String(formData.get("zone_id") ?? "");
  if (!zoneId) return { error: "Identifiant manquant." };

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("zone_locks")
    .select("locked_by, locked_at")
    .eq("zone_id", zoneId)
    .maybeSingle();

  const isExpired = existing
    ? Date.now() - new Date(existing.locked_at).getTime() > LOCK_DURATION_MS
    : true;
  const isOwn = existing?.locked_by === user.id;

  if (existing && !isExpired && !isOwn) {
    return {
      error: "Cette zone est en cours de modification par un autre agent.",
    };
  }

  const { error } = await admin.from("zone_locks").upsert(
    { zone_id: zoneId, locked_by: user.id, locked_at: new Date().toISOString() },
    { onConflict: "zone_id" },
  );

  if (error) {
    return { error: "Impossible de verrouiller la zone." };
  }

  return {};
}

export async function releaseLock(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireActiveUser();

  const zoneId = String(formData.get("zone_id") ?? "");
  if (!zoneId) return { error: "Identifiant manquant." };

  await supabase.from("zone_locks").delete().eq("zone_id", zoneId);
  return {};
}

export async function getLocksWithPseudos(): Promise<
  { zone_id: string; locked_by: string; locked_at: string; pseudo: string }[]
> {
  await requireActiveUser();

  const admin = createAdminClient();
  const { data: locks } = await admin.from("zone_locks").select("*");

  if (!locks || locks.length === 0) return [];

  const userIds = [...new Set(locks.map((l) => l.locked_by))];
  const { data: profiles } = await admin
    .from("profiles")
    .select("id, pseudo")
    .in("id", userIds);

  const pseudoMap = new Map((profiles ?? []).map((p) => [p.id, p.pseudo]));

  return locks.map((l) => ({
    zone_id: l.zone_id,
    locked_by: l.locked_by,
    locked_at: l.locked_at,
    pseudo: pseudoMap.get(l.locked_by) ?? "Agent inconnu",
  }));
}
