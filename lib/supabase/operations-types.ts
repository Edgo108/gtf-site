// Section « Opérations ». Permissions ligne par ligne (lead + agents en
// écriture), pas par unité — voir lib/permissions.ts (`canAccessOperations`,
// utilisé uniquement pour la VISIBILITÉ de la liste : verrou total DOJ).

export type OperationStatut = "en_cours" | "cloturee" | "archivee";

const OPERATION_STATUTS: readonly OperationStatut[] = [
  "en_cours",
  "cloturee",
  "archivee",
];

export const OPERATION_STATUT_LABELS: Record<OperationStatut, string> = {
  en_cours: "En cours",
  cloturee: "Clôturée",
  archivee: "Archivée",
};

export const OPERATION_STATUT_OPTIONS: {
  value: OperationStatut;
  label: string;
}[] = OPERATION_STATUTS.map((value) => ({
  value,
  label: OPERATION_STATUT_LABELS[value],
}));

export function isOperationStatut(value: unknown): value is OperationStatut {
  return (
    typeof value === "string" &&
    (OPERATION_STATUTS as readonly string[]).includes(value)
  );
}

export type Operation = {
  id: string;
  titre: string;
  description: string;
  statut: OperationStatut;
  lead_id: string;
  created_at: string;
  updated_at: string;
  // Corbeille (null = fiche active), voir supabase/corbeille_sections.sql.
  deleted_at?: string | null;
};

// Ligne résumée exposée à tout agent non-DOJ dans la liste (construite
// côté serveur avec la clé service_role — jamais via un select direct sur
// `operations`, dont la RLS restreint la lecture à l'admin/lead/écriture).
export type OperationListRow = {
  id: string;
  titre: string;
  statut: OperationStatut;
  lead_pseudo: string;
};

// --- Tables de liaison -------------------------------------------------

export type OperationLinkKind =
  | "investigation"
  | "wanted_notice"
  | "lab_marker"
  | "zone"
  | "gang";

export const OPERATION_LINK_CONFIG: Record<
  OperationLinkKind,
  { table: string; column: string; label: string; href: (targetId: string) => string }
> = {
  investigation: {
    table: "operation_investigations",
    column: "investigation_id",
    label: "Enquête",
    href: (id) => `/enquetes/${id}`,
  },
  wanted_notice: {
    table: "operation_wanted_notices",
    column: "wanted_notice_id",
    label: "Mandat",
    href: (id) => `/mandats/${id}`,
  },
  lab_marker: {
    table: "operation_lab_markers",
    column: "lab_marker_id",
    label: "Labo",
    href: () => `/zones`,
  },
  zone: {
    table: "operation_zones",
    column: "zone_id",
    label: "Zone",
    href: () => `/zones`,
  },
  gang: {
    table: "operation_gangs",
    column: "gang_id",
    label: "Groupe B.D.D.",
    href: (id) => `/gangs/${id}`,
  },
};
