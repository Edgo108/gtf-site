"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { uniteCanWrite } from "@/lib/permissions";
import { checkTextLimits } from "@/lib/limits";
import { buildDealPointChangeSummary } from "@/lib/deal-points/change-summary";
import { LOCK_DURATION_MS } from "@/lib/supabase/zones-types";
import {
  isDealProduit,
  isDealStatut,
  type DealPoint,
  type DealPointPosition,
  type DealProduit,
  type DealStatut,
} from "@/lib/supabase/deal-points-types";
import { requireActiveUser } from "@/lib/auth/require";

// Points de deal : même fonctionnement que les marqueurs laboratoire
// (lab-actions.ts). Écritures avec la session de l'agent (RLS de
// supabase/map_deal_points.sql : ID / GTF / EM / admin, verrou de 3 min) ;
// la clé service_role ne sert qu'aux verrous et à la corbeille.

type ActionResult = { error?: string; id?: string };

const NO_WRITE_DEALS =
  "Seules les unités ID, GTF et EM peuvent gérer les points de deal.";

function parsePosition(raw: string): DealPointPosition | null {
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

function readFields(
  formData: FormData,
):
  | {
      produit: DealProduit;
      statut: DealStatut;
      organisation_id: string | null;
      note: string | null;
    }
  | { error: string } {
  const produit = String(formData.get("produit") ?? "");
  const statut = String(formData.get("statut") ?? "");
  if (!isDealProduit(produit)) return { error: "Produit invalide." };
  if (!isDealStatut(statut)) return { error: "Statut invalide." };

  const note = String(formData.get("note") ?? "").trim() || null;
  const tooLong = checkTextLimits("deal_points", { note });
  if (tooLong) return { error: tooLong };

  return {
    produit,
    statut,
    // Vide = aucune organisation (point gris).
    organisation_id: String(formData.get("organisation_id") ?? "").trim() || null,
    note,
  };
}

export async function createDealPoint(
  formData: FormData,
): Promise<ActionResult> {
  const { supabase, user, profile } = await requireActiveUser();

  if (!uniteCanWrite("zones", profile)) return { error: NO_WRITE_DEALS };

  const fields = readFields(formData);
  if ("error" in fields) return { error: fields.error };
  const position = parsePosition(String(formData.get("position") ?? ""));
  if (!position) return { error: "Cliquez sur la carte pour positionner le point." };

  const { data, error } = await supabase
    .from("deal_points")
    .insert({ ...fields, position, created_by: user.id })
    .select("id")
    .single();

  if (error || !data) {
    return { error: "Impossible de créer le point de deal." };
  }

  await supabase.from("deal_point_history").insert({
    point_id: data.id,
    agent_id: user.id,
    agent_pseudo: profile.pseudo,
    resume: "Point de deal créé",
  });

  revalidatePath("/zones");
  return { id: data.id };
}

export async function updateDealPoint(
  formData: FormData,
): Promise<ActionResult> {
  const { supabase, user, profile } = await requireActiveUser();

  if (!uniteCanWrite("zones", profile)) return { error: NO_WRITE_DEALS };

  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Identifiant manquant." };

  const { data: oldPoint } = await supabase
    .from("deal_points")
    .select("*")
    .eq("id", id)
    .single<DealPoint>();
  if (!oldPoint) return { error: "Point de deal introuvable." };

  const fields = readFields(formData);
  if ("error" in fields) return { error: fields.error };
  const position =
    parsePosition(String(formData.get("position") ?? "")) ?? oldPoint.position;

  const { data, error } = await supabase
    .from("deal_points")
    .update({ ...fields, position })
    .eq("id", id)
    .select("id");

  if (error || !data || data.length === 0) {
    return {
      error: "Mise à jour impossible (point verrouillé par un autre agent ?).",
    };
  }

  await supabase.from("deal_point_history").insert({
    point_id: id,
    agent_id: user.id,
    agent_pseudo: profile.pseudo,
    resume: buildDealPointChangeSummary(oldPoint, { ...fields, position }),
  });

  await supabase.from("deal_point_locks").delete().eq("point_id", id);

  revalidatePath("/zones");
  return {};
}

export async function deleteDealPoint(
  formData: FormData,
): Promise<ActionResult> {
  const { user, profile } = await requireActiveUser();

  if (!uniteCanWrite("zones", profile)) return { error: NO_WRITE_DEALS };

  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Identifiant manquant." };

  const admin = createAdminClient();

  // Corbeille via service_role (pas de grant sur deleted_at) : le verrou
  // anti-conflit est donc revérifié ici, comme le fait la RLS pour la
  // modification.
  const { data: lock } = await admin
    .from("deal_point_locks")
    .select("locked_by, locked_at")
    .eq("point_id", id)
    .maybeSingle();
  if (
    lock &&
    lock.locked_by !== user.id &&
    Date.now() - new Date(lock.locked_at).getTime() <= LOCK_DURATION_MS
  ) {
    return {
      error:
        "Ce point de deal est en cours de modification par un autre agent : suppression impossible pour l'instant.",
    };
  }

  const { error } = await admin
    .from("deal_points")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .is("deleted_at", null);

  if (error) {
    return { error: "Suppression impossible." };
  }

  await admin.from("deal_point_history").insert({
    point_id: id,
    agent_id: user.id,
    agent_pseudo: profile.pseudo,
    resume: "Point de deal déplacé vers la corbeille",
  });

  await admin.from("deal_point_locks").delete().eq("point_id", id);

  revalidatePath("/zones");
  return {};
}

export async function acquireDealLock(
  formData: FormData,
): Promise<ActionResult> {
  const { user, profile } = await requireActiveUser();

  if (!uniteCanWrite("zones", profile)) return { error: NO_WRITE_DEALS };

  const pointId = String(formData.get("point_id") ?? "");
  if (!pointId) return { error: "Identifiant manquant." };

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("deal_point_locks")
    .select("locked_by, locked_at")
    .eq("point_id", pointId)
    .maybeSingle();

  const isExpired = existing
    ? Date.now() - new Date(existing.locked_at).getTime() > LOCK_DURATION_MS
    : true;
  const isOwn = existing?.locked_by === user.id;

  if (existing && !isExpired && !isOwn) {
    return {
      error: "Ce point de deal est en cours de modification par un autre agent.",
    };
  }

  const { error } = await admin.from("deal_point_locks").upsert(
    {
      point_id: pointId,
      locked_by: user.id,
      locked_at: new Date().toISOString(),
    },
    { onConflict: "point_id" },
  );

  if (error) {
    return { error: "Impossible de verrouiller le point de deal." };
  }

  return {};
}

export async function releaseDealLock(
  formData: FormData,
): Promise<ActionResult> {
  const { supabase } = await requireActiveUser();

  const pointId = String(formData.get("point_id") ?? "");
  if (!pointId) return { error: "Identifiant manquant." };

  await supabase.from("deal_point_locks").delete().eq("point_id", pointId);
  return {};
}

export async function getDealLocksWithPseudos(): Promise<
  { point_id: string; locked_by: string; locked_at: string; pseudo: string }[]
> {
  await requireActiveUser();

  const admin = createAdminClient();
  const { data: locks } = await admin.from("deal_point_locks").select("*");

  if (!locks || locks.length === 0) return [];

  const userIds = [...new Set(locks.map((l) => l.locked_by))];
  const { data: profiles } = await admin
    .from("profiles")
    .select("id, pseudo")
    .in("id", userIds);

  const pseudoMap = new Map((profiles ?? []).map((p) => [p.id, p.pseudo]));

  return locks.map((l) => ({
    point_id: l.point_id,
    locked_by: l.locked_by,
    locked_at: l.locked_at,
    pseudo: pseudoMap.get(l.locked_by) ?? "Agent inconnu",
  }));
}
