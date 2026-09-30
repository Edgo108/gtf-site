import {
  CATEGORIE_HOVER_CLASSES,
  CATEGORIE_TEXT_HOVER_CLASSES,
  computeTotals,
  type CodePenalPickerArticle,
  type InfractionLine,
} from "@/lib/supabase/code-penal-types";
import { InfractionTotalsView } from "./InfractionTotalsView";

// Infractions d'un rapport, en lecture seule (fiche du rapport).
export function InfractionList({
  lines,
  articles,
}: {
  lines: InfractionLine[];
  articles: CodePenalPickerArticle[];
}) {
  const articleById = new Map(articles.map((a) => [a.id, a]));
  const known = lines.filter((l) => articleById.has(l.article_id));

  if (known.length === 0) {
    return <p className="text-sm text-gtf-text-muted">Aucune infraction.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-1">
        {known.map((line, index) => {
          const article = articleById.get(line.article_id)!;
          return (
            <li
              key={index}
              className={`group flex items-center gap-3 rounded border border-gtf-border bg-gtf-panel-alt px-3 py-2 text-sm transition-colors ${CATEGORIE_HOVER_CLASSES[article.categorie]}`}
            >
              <span
                className={`shrink-0 font-mono text-xs text-gtf-text-muted transition-colors ${CATEGORIE_TEXT_HOVER_CLASSES[article.categorie]}`}
              >
                {article.numero_article}
              </span>
              <span className="flex-1">
                {article.titre}
                {line.montant_calcule !== null && (
                  <span className="ml-2 font-mono text-xs text-gtf-text-muted">
                    (${line.montant_calcule.toLocaleString("en-US")})
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
      <InfractionTotalsView totals={computeTotals(known, articleById)} />
    </div>
  );
}
