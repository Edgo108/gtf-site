// 3e dimension de permissions du site GTF : le RÔLE / UNITÉ d'un compte,
// en plus du type de compte (admin/agent) et du grade hiérarchique.
//
// Miroir applicatif des règles appliquées en Row Level Security dans
// supabase/permissions_unite.sql. La RLS reste la source de vérité ;
// ces helpers servent à masquer/désactiver les actions dans l'interface
// et à renvoyer des messages d'erreur clairs côté Server Actions.

export const UNITES = ["ID", "GTF", "SASP", "DOJ"] as const;
export type Unite = (typeof UNITES)[number];

export const UNITE_LABELS: Record<Unite, string> = {
  ID: "ID — Unité d'enquête",
  GTF: "GTF — Gang Task Force",
  SASP: "SASP — Unité partenaire",
  DOJ: "DOJ — Department of Justice",
};

export function isUnite(value: unknown): value is Unite {
  return typeof value === "string" && (UNITES as readonly string[]).includes(value);
}

// Sections soumises à la matrice d'écriture par unité.
export type PermissionSection =
  | "enquetes"
  | "mandats"
  | "gangs"
  | "zones"
  | "annonces";

// Matrice d'ÉCRITURE (création / modification / suppression) par unité.
// La LECTURE est toujours autorisée pour un agent actif, quelle que soit
// l'unité — elle n'apparaît donc pas ici.
const WRITE_MATRIX: Record<Unite, Record<PermissionSection, boolean>> = {
  ID: { enquetes: true, mandats: true, gangs: true, zones: true, annonces: true },
  GTF: { enquetes: true, mandats: true, gangs: true, zones: true, annonces: true },
  SASP: {
    enquetes: false,
    mandats: false,
    gangs: false,
    zones: false,
    annonces: false,
  },
  DOJ: {
    enquetes: false,
    mandats: true,
    gangs: false,
    zones: false,
    annonces: false,
  },
};

type ActorUnite = { role?: string | null; unite?: string | null };

// L'unité autorise-t-elle l'écriture sur cette section ?
// Le compte admin conserve tous ses droits quelle que soit son unité.
export function uniteCanWrite(
  section: PermissionSection,
  actor: ActorUnite,
): boolean {
  if (actor.role === "admin") return true;
  if (!isUnite(actor.unite)) return false;
  return WRITE_MATRIX[actor.unite][section];
}

// --- Qui peut modifier le rôle/unité d'un compte ---------------------
// L'admin (gestionnaire de comptes) + les grades Commandant / Capitaine /
// Lieutenant (sur ce point précis uniquement — pas les autres droits admin).
export const UNITE_MANAGER_GRADES = ["Commandant", "Capitaine", "Lieutenant"];

export function canManageUnite(actor: {
  role?: string | null;
  grade?: string | null;
}): boolean {
  return (
    actor.role === "admin" ||
    UNITE_MANAGER_GRADES.includes(actor.grade ?? "")
  );
}
