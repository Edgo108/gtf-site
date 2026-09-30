import type { createClient } from "@/lib/supabase/server";

// Colonnes des enquêtes lisibles par tous les agents : TOUT sauf le code
// d'accès du casier (supabase/casier_code_restrict.sql). Ne jamais faire
// `select("*")` sur investigations avec la session d'un agent : la base
// refuse la requête entière dès qu'une colonne non autorisée est demandée.
export const INVESTIGATION_COLUMNS =
  "id, titre, statut, suspects, preuves, description, agent_responsable, created_by, created_at, updated_at, deleted_at, casier_numero";

type ServerSupabase = Awaited<ReturnType<typeof createClient>>;

// Code d'accès du casier, réservé aux unités en écriture (ID / GTF / EM,
// admin) : la fonction SQL get_casier_code() le vérifie et renvoie null
// sinon. Repli tant que ce script SQL n'a pas été lancé : lecture directe
// de la colonne (encore autorisée à ce moment-là). Sans ce repli, le
// formulaire d'édition afficherait un code vide et l'enregistrement
// l'effacerait.
export async function fetchCasierCode(
  supabase: ServerSupabase,
  investigationId: string,
): Promise<string | null> {
  const { data, error } = await supabase.rpc("get_casier_code", {
    target_id: investigationId,
  });
  if (!error) return (data as string | null) ?? null;

  const { data: row } = await supabase
    .from("investigations")
    .select("casier_code_acces")
    .eq("id", investigationId)
    .maybeSingle<{ casier_code_acces: string | null }>();
  return row?.casier_code_acces ?? null;
}
