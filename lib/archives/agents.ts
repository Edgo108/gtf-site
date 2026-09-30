import { createAdminClient } from "@/lib/supabase/admin";
import type { AgentOption } from "@/lib/supabase/archives-types";

// Résolution des agents pour les Archives, côté serveur uniquement (clé
// service_role : la RLS de profiles ne laisse lire que sa propre ligne).
// Seuls id + pseudo sortent d'ici.

// Agents proposés dans les listes déroulantes : les agents actifs, plus
// ceux déjà sélectionnés sur la fiche (`keepIds`) même s'ils ont été
// suspendus depuis, pour ne pas perdre la sélection à la modification.
export async function getAgentOptions(
  keepIds: string[] = [],
): Promise<AgentOption[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("id, pseudo, statut")
    .returns<{ id: string; pseudo: string; statut: string }[]>();

  const keep = new Set(keepIds);
  return (data ?? [])
    .filter((p) => p.statut === "actif" || keep.has(p.id))
    .map((p) => ({ id: p.id, pseudo: p.pseudo }))
    .sort((a, b) => a.pseudo.localeCompare(b.pseudo, "fr"));
}

// id → pseudo pour l'affichage (liste, détail, corbeille).
export async function getPseudoMap(
  ids: (string | null | undefined)[],
): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter((id): id is string => !!id))];
  if (unique.length === 0) return new Map();

  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("id, pseudo")
    .in("id", unique)
    .returns<AgentOption[]>();

  return new Map((data ?? []).map((p) => [p.id, p.pseudo]));
}
