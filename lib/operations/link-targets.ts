import type { createClient } from "@/lib/supabase/server";
import { LAB_CATEGORIE_LABELS } from "@/lib/supabase/lab-markers-types";
import {
  OPERATION_LINK_CONFIG,
  type OperationLinkKind,
} from "@/lib/supabase/operations-types";
import { TRASHED_ORGANISATION_LABEL } from "@/lib/supabase/gangs-types";

// Éléments qu'une opération peut lier (enquêtes, mandats, labos, zones,
// groupes B.D.D.), avec leur libellé d'affichage. Lecture via la session
// de l'agent : la RLS de chaque section s'applique (corbeille exclue).
//
// - `ids` fourni : uniquement ces éléments (affichage des liens existants,
//   chargé avec la page) ;
// - `ids` absent : tous les éléments (liste de choix, chargée seulement à
//   l'ouverture du champ de recherche — voir getOperationLinkOptions).

export type LinkTarget = { id: string; label: string; href: string };

type ServerSupabase = Awaited<ReturnType<typeof createClient>>;

const ZONE_TYPE_LABELS: Record<string, string> = {
  vente: "Vente",
  qg: "QG",
  influence: "QG", // valeur historique, cf. supabase/sensitive_zones_qg.sql
};

type GangJoin = { nom: string } | { nom: string }[] | null;

function gangNom(gangs: GangJoin): string {
  const gang = Array.isArray(gangs) ? gangs[0] : gangs;
  return gang?.nom ?? TRASHED_ORGANISATION_LABEL;
}

export async function fetchLinkTargets(
  supabase: ServerSupabase,
  kind: OperationLinkKind,
  ids?: string[],
): Promise<LinkTarget[]> {
  if (ids && ids.length === 0) return [];
  const href = OPERATION_LINK_CONFIG[kind].href;

  switch (kind) {
    case "investigation": {
      let q = supabase.from("investigations").select("id, titre").order("titre");
      if (ids) q = q.in("id", ids);
      const { data } = await q.returns<{ id: string; titre: string }[]>();
      return (data ?? []).map((r) => ({ id: r.id, label: r.titre, href: href(r.id) }));
    }
    case "wanted_notice": {
      let q = supabase
        .from("wanted_notices")
        .select("id, nom_suspect")
        .order("nom_suspect");
      if (ids) q = q.in("id", ids);
      const { data } = await q.returns<{ id: string; nom_suspect: string }[]>();
      return (data ?? []).map((r) => ({
        id: r.id,
        label: r.nom_suspect,
        href: href(r.id),
      }));
    }
    case "lab_marker": {
      let q = supabase
        .from("lab_markers")
        .select("id, categorie, gangs(nom)")
        .order("created_at", { ascending: false });
      if (ids) q = q.in("id", ids);
      const { data } = await q.returns<
        { id: string; categorie: string | null; gangs: GangJoin }[]
      >();
      return (data ?? []).map((r) => {
        const categorie = r.categorie
          ? ((LAB_CATEGORIE_LABELS as Record<string, string>)[r.categorie] ??
            r.categorie)
          : "Potentiel";
        return {
          id: r.id,
          label: `${gangNom(r.gangs)} — ${categorie}`,
          href: href(r.id),
        };
      });
    }
    case "zone": {
      let q = supabase
        .from("sensitive_zones")
        .select("id, type_zone, gangs(nom)")
        .order("created_at", { ascending: false });
      if (ids) q = q.in("id", ids);
      const { data } = await q.returns<
        { id: string; type_zone: string; gangs: GangJoin }[]
      >();
      return (data ?? []).map((r) => ({
        id: r.id,
        label: `${gangNom(r.gangs)} — ${ZONE_TYPE_LABELS[r.type_zone] ?? r.type_zone}`,
        href: href(r.id),
      }));
    }
    case "gang": {
      let q = supabase.from("gangs").select("id, nom").order("nom");
      if (ids) q = q.in("id", ids);
      const { data } = await q.returns<{ id: string; nom: string }[]>();
      return (data ?? []).map((r) => ({ id: r.id, label: r.nom, href: href(r.id) }));
    }
  }
}
