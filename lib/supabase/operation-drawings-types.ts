// Carte de planification d'une opération (table `operation_drawings`).
// Isolée de la carte principale du site (sensitive_zones/lab_markers) :
// voir le commentaire en tête de supabase/operation_drawings.sql.

import type { ZonePoint } from "@/lib/supabase/zones-types";

export type OperationDrawingType =
  | "trait_libre"
  | "fleche"
  | "cercle"
  | "ligne"
  | "texte";

export function isOperationDrawingType(
  value: unknown,
): value is OperationDrawingType {
  return (
    typeof value === "string" &&
    ["trait_libre", "fleche", "cercle", "ligne", "texte"].includes(value)
  );
}

export type TraitLibreDonnees = {
  points: ZonePoint[];
  couleur: string;
  epaisseur: number;
};

export type LigneOuFlecheDonnees = {
  from: ZonePoint;
  to: ZonePoint;
  couleur: string;
  epaisseur: number;
};

export type CercleDonnees = {
  center: ZonePoint;
  radius: number;
  couleur: string;
  epaisseur: number;
};

export type TexteDonnees = {
  point: ZonePoint;
  texte: string;
  couleur: string;
};

export type OperationDrawingDonnees =
  | TraitLibreDonnees
  | LigneOuFlecheDonnees
  | CercleDonnees
  | TexteDonnees;

export type OperationDrawing = {
  id: string;
  operation_id: string;
  type_element: OperationDrawingType;
  donnees: OperationDrawingDonnees;
  created_by: string | null;
  created_at: string;
};

// Palette de couleurs par défaut proposée dans la barre d'outils (en plus
// du sélecteur libre <input type="color">).
export const DRAWING_DEFAULT_COLOR = "#5B94D6";
export const DRAWING_DEFAULT_THICKNESS = 3;
