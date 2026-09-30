import { createClient } from "@/lib/supabase/server";
import {
  CODE_PENAL_PICKER_COLUMNS,
  compareNumeroArticle,
  type CodePenalPickerArticle,
  type InfractionLine,
} from "@/lib/supabase/code-penal-types";

// Lecture du Code Pénal et des infractions d'un rapport, côté serveur,
// avec la session de l'agent (RLS : agent actif).

export async function getCodePenalPickerArticles(): Promise<
  CodePenalPickerArticle[]
> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("code_penal_articles")
    .select(CODE_PENAL_PICKER_COLUMNS)
    .returns<CodePenalPickerArticle[]>();
  return (data ?? []).sort((a, b) =>
    compareNumeroArticle(a.numero_article, b.numero_article),
  );
}

export async function getRapportInfractions(
  rapportId: string,
): Promise<InfractionLine[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("rapport_infractions")
    .select("article_id, variable_utilisee, montant_calcule")
    .eq("rapport_id", rapportId)
    .order("position")
    .returns<InfractionLine[]>();
  return (data ?? []).map((l) => ({
    article_id: l.article_id,
    variable_utilisee:
      l.variable_utilisee === null ? null : Number(l.variable_utilisee),
    montant_calcule:
      l.montant_calcule === null ? null : Number(l.montant_calcule),
  }));
}

// Articles référencés par une liste d'infractions (fiche du rapport).
export async function getCodePenalArticlesByIds(
  ids: string[],
): Promise<CodePenalPickerArticle[]> {
  if (ids.length === 0) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("code_penal_articles")
    .select(CODE_PENAL_PICKER_COLUMNS)
    .in("id", [...new Set(ids)])
    .returns<CodePenalPickerArticle[]>();
  return data ?? [];
}
