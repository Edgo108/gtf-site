"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CATEGORIE_HOVER_CLASSES,
  CATEGORIE_TEXT_HOVER_CLASSES,
  computeFormulaAmount,
  computeTotals,
  normalizeSearch,
  parseFormula,
  type CodePenalPickerArticle,
  type InfractionLine,
  type InfractionTotals,
} from "@/lib/supabase/code-penal-types";
import { btn, fieldClass } from "@/lib/ui/styles";
import { InfractionTotalsView } from "./InfractionTotalsView";

const MAX_RESULTS = 12;

// Sélecteur d'infractions du Code Pénal (formulaire Rapport). La liste
// est envoyée en JSON dans le champ caché `name`, relue et revalidée par
// la server action.
export function InfractionPicker({
  id,
  name,
  articles,
  defaultValue = [],
}: {
  id?: string;
  name: string;
  articles: CodePenalPickerArticle[];
  defaultValue?: InfractionLine[];
}) {
  const articleById = useMemo(
    () => new Map(articles.map((a) => [a.id, a])),
    [articles],
  );
  // Clé locale stable par ligne (un même article peut figurer 2 fois).
  const [lines, setLines] = useState(() =>
    defaultValue
      .filter((l) => articleById.has(l.article_id))
      .map((l, index) => ({ ...l, key: `init-${index}` })),
  );
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const [pendingFormula, setPendingFormula] =
    useState<CodePenalPickerArticle | null>(null);
  const [totals, setTotals] = useState<InfractionTotals | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const searchIndex = useMemo(
    () =>
      articles.map((a) => ({
        article: a,
        numero: a.numero_article.toLowerCase(),
        titre: normalizeSearch(a.titre),
      })),
    [articles],
  );

  const results = useMemo(() => {
    const q = normalizeSearch(query);
    if (!q) return [];
    return searchIndex
      .filter((e) => e.numero.includes(q) || e.titre.includes(q))
      // Numéro commençant par la saisie en premier.
      .sort(
        (x, y) =>
          Number(!x.numero.startsWith(q)) - Number(!y.numero.startsWith(q)),
      )
      .slice(0, MAX_RESULTS)
      .map((e) => e.article);
  }, [query, searchIndex]);

  // Fermeture des résultats au clic en dehors.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  function addLine(line: InfractionLine) {
    setLines((current) => [
      ...current,
      { ...line, key: crypto.randomUUID() },
    ]);
    setTotals(null);
  }

  function removeLine(key: string) {
    setLines((current) => current.filter((l) => l.key !== key));
    setTotals(null);
  }

  function pick(article: CodePenalPickerArticle) {
    setQuery("");
    setOpen(false);
    setHighlighted(0);
    if (article.amende_formule) {
      setPendingFormula(article);
    } else {
      addLine({
        article_id: article.id,
        variable_utilisee: null,
        montant_calcule: null,
      });
      inputRef.current?.focus();
    }
  }

  function onSearchKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setHighlighted((h) => Math.min(h + 1, results.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlighted((h) => Math.max(h - 1, 0));
    } else if (event.key === "Enter") {
      // Jamais de soumission du rapport depuis la recherche.
      event.preventDefault();
      const article = results[highlighted];
      if (open && article) pick(article);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  const serialized = JSON.stringify(
    lines.map(({ article_id, variable_utilisee, montant_calcule }) => ({
      article_id,
      variable_utilisee,
      montant_calcule,
    })),
  );

  return (
    <div ref={rootRef} className="flex flex-col gap-3">
      <input type="hidden" name={name} value={serialized} />

      <div className="relative">
        <input
          ref={inputRef}
          id={id}
          type="search"
          autoComplete="off"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setHighlighted(0);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onSearchKeyDown}
          placeholder="Rechercher par numéro (ex : 5.41) ou par titre…"
          role="combobox"
          aria-expanded={open && results.length > 0}
          aria-controls={id ? `${id}-results` : undefined}
          className={fieldClass}
        />

        {open && query.trim() !== "" && (
          <ul
            id={id ? `${id}-results` : undefined}
            role="listbox"
            className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded border border-gtf-border bg-gtf-panel-alt py-1 shadow-lg"
          >
            {results.length === 0 && (
              <li className="px-3 py-2 text-sm text-gtf-text-muted">
                Aucun article trouvé.
              </li>
            )}
            {results.map((article, index) => (
              <li key={article.id} role="option" aria-selected={index === highlighted}>
                <button
                  type="button"
                  onMouseEnter={() => setHighlighted(index)}
                  onClick={() => pick(article)}
                  className={`flex w-full items-baseline gap-3 px-3 py-2 text-left text-sm ${
                    index === highlighted ? "bg-gtf-panel" : ""
                  }`}
                >
                  <span className="shrink-0 font-mono text-xs text-gtf-text-muted">
                    {article.numero_article}
                  </span>
                  <span className="flex-1">{article.titre}</span>
                  {article.amende_formule && (
                    <span className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-gtf-amber">
                      Formule
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {lines.length === 0 ? (
        <p className="font-mono text-xs text-gtf-text-muted">
          Aucune infraction ajoutée.
        </p>
      ) : (
        <ul className="flex flex-col gap-1">
          {lines.map((line) => {
            const article = articleById.get(line.article_id)!;
            return (
              <li
                key={line.key}
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
                <button
                  type="button"
                  onClick={() => removeLine(line.key)}
                  aria-label={`Retirer l'article ${article.numero_article}`}
                  className="shrink-0 px-1 text-gtf-text-muted opacity-0 transition-opacity hover:text-gtf-text focus-visible:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100"
                >
                  ×
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div>
        <button
          type="button"
          onClick={() => setTotals(computeTotals(lines, articleById))}
          disabled={lines.length === 0}
          className={btn("info", "sm")}
        >
          Valider
        </button>
      </div>

      {totals && <InfractionTotalsView totals={totals} />}

      {pendingFormula && (
        <FormulaModal
          article={pendingFormula}
          onCancel={() => {
            setPendingFormula(null);
            inputRef.current?.focus();
          }}
          onConfirm={(variable, montant) => {
            addLine({
              article_id: pendingFormula.id,
              variable_utilisee: variable,
              montant_calcule: montant,
            });
            setPendingFormula(null);
            inputRef.current?.focus();
          }}
        />
      )}
    </div>
  );
}

// Popup de saisie de la variable d'un article à montant variable.
function FormulaModal({
  article,
  onCancel,
  onConfirm,
}: {
  article: CodePenalPickerArticle;
  onCancel: () => void;
  onConfirm: (variable: number, montant: number) => void;
}) {
  const spec = useMemo(
    () => parseFormula(article.amende_formule ?? ""),
    [article.amende_formule],
  );
  const [rawVariable, setRawVariable] = useState("");
  const [rateIndex, setRateIndex] = useState(0);
  const rate = spec.rates[rateIndex];
  const [rawRate, setRawRate] = useState(String(spec.rates[0].min));

  const variable = Number(rawVariable.replace(",", "."));
  const rateValue =
    rate.min === rate.max ? rate.min : Number(rawRate.replace(",", "."));

  let error: string | null = null;
  if (rawVariable.trim() === "" || !Number.isFinite(variable) || variable < 0) {
    error = "Valeur invalide.";
  } else if (spec.integer && !Number.isInteger(variable)) {
    error = "Nombre entier attendu.";
  } else if (
    !Number.isFinite(rateValue) ||
    rateValue < rate.min ||
    rateValue > rate.max
  ) {
    error = `Taux entre $${rate.min} et $${rate.max}.`;
  }
  const montant = error ? null : computeFormulaAmount(variable, rateValue);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onCancel]);

  function confirm() {
    if (montant !== null) onConfirm(variable, montant);
  }

  // Entrée valide la popup sans soumettre le rapport.
  function onEnter(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      confirm();
    }
  }

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 p-4"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="formula-modal-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-md border border-gtf-border bg-gtf-panel p-5"
      >
        <p className="font-mono text-xs text-gtf-text-muted">
          Article {article.numero_article}
        </p>
        <h3
          id="formula-modal-title"
          className="mt-1 font-display text-lg font-semibold uppercase tracking-wide"
        >
          {article.titre}
        </h3>
        <p className="mt-2 font-mono text-xs text-gtf-amber">
          Amende : {article.amende_formule}
        </p>

        <div className="mt-4 flex flex-col gap-4">
          {spec.rates.length > 1 && (
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 font-mono text-xs uppercase tracking-wider text-gtf-text-muted">
                Taux applicable
              </legend>
              {spec.rates.map((r, index) => (
                <label key={index} className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="radio"
                    checked={rateIndex === index}
                    onChange={() => {
                      setRateIndex(index);
                      setRawRate(String(r.min));
                    }}
                    className="accent-gtf-blue"
                  />
                  ${r.min} / unité{r.label ? ` — ${r.label}` : ""}
                </label>
              ))}
            </fieldset>
          )}

          <div>
            <label
              htmlFor="formula-variable"
              className="mb-1 block font-mono text-xs uppercase tracking-wider text-gtf-text-muted"
            >
              {spec.variableLabel}
            </label>
            <input
              id="formula-variable"
              type="number"
              inputMode={spec.integer ? "numeric" : "decimal"}
              min={0}
              step={spec.integer ? 1 : "any"}
              autoFocus
              value={rawVariable}
              onChange={(e) => setRawVariable(e.target.value)}
              onKeyDown={onEnter}
              className={fieldClass}
            />
          </div>

          {rate.min !== rate.max && (
            <div>
              <label
                htmlFor="formula-rate"
                className="mb-1 block font-mono text-xs uppercase tracking-wider text-gtf-text-muted"
              >
                Taux par unité (${rate.min} à ${rate.max})
              </label>
              <input
                id="formula-rate"
                type="number"
                min={rate.min}
                max={rate.max}
                step="any"
                value={rawRate}
                onChange={(e) => setRawRate(e.target.value)}
                onKeyDown={onEnter}
                className={fieldClass}
              />
            </div>
          )}

          <div className="rounded border border-gtf-border bg-gtf-panel-alt px-3 py-2">
            <span className="font-mono text-xs uppercase tracking-wider text-gtf-text-muted">
              Montant calculé
            </span>
            <p className="mt-1 font-mono text-lg">
              {montant !== null ? (
                `$${montant.toLocaleString("en-US")}`
              ) : (
                <span className="text-sm text-gtf-text-muted">
                  {rawVariable.trim() === "" ? "—" : error}
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className={btn("secondary", "sm")}>
            Annuler
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={montant === null}
            className={btn("primary", "sm")}
          >
            Ajouter
          </button>
        </div>
      </div>
    </div>
  );
}
