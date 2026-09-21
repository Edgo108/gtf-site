"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { rankNames } from "@/lib/suggestions/names";

// Charge une fois, à l'ouverture du formulaire, les noms connus des 3
// sources (membres B.D.D., suspects d'enquêtes, suspects de mandats) et
// les renvoie triés par pertinence. La lecture passe par le client
// Supabase (RLS : agents actifs uniquement, corbeille exclue côté base).
// Pas de rafraîchissement temps réel : la liste sert à de la saisie
// assistée, une donnée légèrement périmée est sans conséquence.
//
// `excludeInvestigationId` / `excludeNoticeId` : fiche en cours d'édition,
// ignorée pour ne pas re-suggérer ses propres noms (déjà enregistrés).
// En cas d'erreur de lecture, la source concernée est simplement ignorée :
// la suggestion ne doit jamais gêner la saisie.
export function useNameSuggestions({
  excludeInvestigationId,
  excludeNoticeId,
}: {
  excludeInvestigationId?: string;
  excludeNoticeId?: string;
} = {}): string[] {
  const [names, setNames] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    loadNames();

    async function loadNames() {
      try {
        const supabase = createClient();

        let investigationsQuery = supabase
          .from("investigations")
          .select("suspects")
          .order("created_at", { ascending: false });
        if (excludeInvestigationId) {
          investigationsQuery = investigationsQuery.neq(
            "id",
            excludeInvestigationId,
          );
        }

        let noticesQuery = supabase
          .from("wanted_notices")
          .select("nom_suspect")
          .order("created_at", { ascending: false });
        if (excludeNoticeId) {
          noticesQuery = noticesQuery.neq("id", excludeNoticeId);
        }

        const [members, investigations, notices] = await Promise.all([
          supabase.from("gang_members").select("nom"),
          investigationsQuery,
          noticesQuery,
        ]);

        if (cancelled) return;
        setNames(
          rankNames({
            members: (members.data ?? []).map((row) => row.nom as string),
            investigationSuspects: (investigations.data ?? []).map(
              (row) => row.suspects as string,
            ),
            notices: (notices.data ?? []).map(
              (row) => row.nom_suspect as string,
            ),
          }),
        );
      } catch {
        // Réseau indisponible : aucune suggestion, saisie inchangée.
      }
    }

    return () => {
      cancelled = true;
    };
  }, [excludeInvestigationId, excludeNoticeId]);

  return names;
}
