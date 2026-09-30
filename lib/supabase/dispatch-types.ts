// Dispatch : prise de service, unités Alpha → Zulu, rôle de dispatcheur.

export type AgentStatut =
  | "en_attente_dispatch"
  | "disponible"
  | "occupe"
  | "en_intervention";

export const AGENT_STATUTS: readonly AgentStatut[] = [
  "en_attente_dispatch",
  "disponible",
  "occupe",
  "en_intervention",
];

// Statuts qu'un agent peut se donner lui-même, une fois dispatché.
export const SELF_STATUTS: readonly AgentStatut[] = [
  "disponible",
  "occupe",
  "en_intervention",
];

export const AGENT_STATUT_LABELS: Record<AgentStatut, string> = {
  en_attente_dispatch: "En attente de dispatch",
  disponible: "Disponible",
  occupe: "Occupé",
  en_intervention: "En intervention",
};

export function isAgentStatut(value: unknown): value is AgentStatut {
  return (
    typeof value === "string" &&
    (AGENT_STATUTS as readonly string[]).includes(value)
  );
}

export type CategoriePatrouille =
  | "patrouille"
  | "henry"
  | "marry"
  | "gnd"
  | "cid"
  | "em";

export const CATEGORIES_PATROUILLE: readonly CategoriePatrouille[] = [
  "patrouille",
  "henry",
  "marry",
  "gnd",
  "cid",
  "em",
];

export const CATEGORIE_PATROUILLE_LABELS: Record<CategoriePatrouille, string> = {
  patrouille: "Patrouille",
  henry: "Henry",
  marry: "Marry",
  gnd: "G.N.D",
  cid: "C.I.D",
  em: "E.M",
};

export function isCategoriePatrouille(
  value: unknown,
): value is CategoriePatrouille {
  return (
    typeof value === "string" &&
    (CATEGORIES_PATROUILLE as readonly string[]).includes(value)
  );
}

// Délai d'inactivité après lequel le rôle de dispatcheur est libéré.
// Doit rester aligné avec l'intervalle de public.is_active_dispatcher()
// et de la policy dispatch_role_delete (supabase/dispatch.sql).
export const DISPATCH_TIMEOUT_MS = 10 * 60 * 1000;

export function isDispatchExpired(lastActiveAt: string, now: number): boolean {
  return now - new Date(lastActiveAt).getTime() > DISPATCH_TIMEOUT_MS;
}

export type DispatchUnit = {
  id: string;
  nom: string;
  categorie_patrouille: CategoriePatrouille | null;
};

export type DispatchAgent = {
  agent_id: string;
  pseudo: string;
  grade: string;
  statut: AgentStatut;
  unite_id: string | null;
  updated_at: string;
};

export type DispatcherInfo = {
  agent_id: string;
  pseudo: string;
  taken_at: string;
  last_active_at: string;
};

export type DispatchSnapshot = {
  units: DispatchUnit[];
  agents: DispatchAgent[];
  dispatcher: DispatcherInfo | null;
};
