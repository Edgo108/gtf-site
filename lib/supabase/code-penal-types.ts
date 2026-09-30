// Code Pénal (« Livre des peines ») et infractions liées à un Rapport.
// Module partagé client/serveur : l'interprétation des formules sert à
// la fois à la popup de saisie et à la revalidation côté serveur.

export type CodePenalCategorie = "A" | "B" | "C";

export type CodePenalArticle = {
  id: string;
  categorie: CodePenalCategorie;
  nature: string;
  numero_article: string;
  titre: string;
  amende_min: number | null;
  amende_max: number | null;
  amende_formule: string | null;
  peine_prison_up: number | null;
  condition: string | null;
  sanction_complementaire: string | null;
  requalification: string | null;
  remarque: string | null;
  definition: string;
};

// Colonnes nécessaires au sélecteur et aux totaux.
export const CODE_PENAL_PICKER_COLUMNS =
  "id, categorie, numero_article, titre, amende_min, amende_max, amende_formule, peine_prison_up";

export type CodePenalPickerArticle = Pick<
  CodePenalArticle,
  | "id"
  | "categorie"
  | "numero_article"
  | "titre"
  | "amende_min"
  | "amende_max"
  | "amende_formule"
  | "peine_prison_up"
>;

// Ligne de la liste d'infractions (formulaire, fiche, enregistrement).
export type InfractionLine = {
  article_id: string;
  variable_utilisee: number | null;
  montant_calcule: number | null;
};

// Tri naturel des numéros d'article (« 1.2 » < « 1.10 » < « 2.14.1 »).
export function compareNumeroArticle(a: string, b: string): number {
  return a.localeCompare(b, "fr", { numeric: true });
}

// --------------------------------------------------------------------
// Interprétation des formules d'amende
// --------------------------------------------------------------------
//
// Une formule se ramène toujours à : amende = valeur saisie × taux.
// - « Montant de la somme * 1.5 » : valeur = montant ($), taux 1.5
// - « 5% du montant excédentaire » : valeur = montant ($), taux 0.05
// - « $10 * unités », « $50/Paquet », « $1,500 / arme » : valeur = nombre
// - « $25 * unités (>75% Pureté) / $10 * unité (<75% Pureté) » : l'agent
//   choisit le taux parmi les options
// - « $5 * unités à $20 * unités » : l'agent fixe le taux dans la
//   fourchette (pré-rempli au minimum)
// Formule non reconnue : l'agent saisit directement le montant.

export type FormulaRate = { label: string | null; min: number; max: number };

export type FormulaSpec = {
  variableLabel: string;
  // Valeur entière (unités, paquets, armes) ou montant libre.
  integer: boolean;
  rates: FormulaRate[];
};

const MONEY_RE = /\$\s*(\d[\d,]*(?:\.\d+)?)|(\d[\d,]*(?:\.\d+)?)\s*\$/g;

function toNumber(raw: string): number {
  return Number(raw.replace(/,/g, ""));
}

function unitLabel(lower: string): string {
  if (lower.includes("paquet")) return "Nombre de paquets";
  if (lower.includes("arme")) return "Nombre d'armes";
  return "Nombre d'unités";
}

function moneyAmounts(text: string): number[] {
  return [...text.matchAll(MONEY_RE)].map((m) => toNumber(m[1] ?? m[2]));
}

export function parseFormula(formula: string): FormulaSpec {
  const lower = formula.toLowerCase();

  // Pourcentage d'un montant.
  const pct = lower.match(/(\d+(?:[.,]\d+)?)\s*%/);
  if (pct && !lower.includes("pureté")) {
    return {
      variableLabel: lower.includes("excédentaire")
        ? "Montant excédentaire ($)"
        : "Montant de la somme ($)",
      integer: false,
      rates: [
        { label: null, min: toNumber(pct[1].replace(",", ".")) / 100, max: toNumber(pct[1].replace(",", ".")) / 100 },
      ],
    };
  }

  // Multiplicateur d'une somme.
  const mult = lower.match(/(?:somme|montant)[^*x×]*[*x×]\s*(\d+(?:\.\d+)?)/);
  if (mult) {
    return {
      variableLabel: lower.includes("blanchi")
        ? "Montant blanchi ($)"
        : "Montant de la somme ($)",
      integer: false,
      rates: [{ label: null, min: Number(mult[1]), max: Number(mult[1]) }],
    };
  }

  // Taux par unité selon la pureté (une option par segment).
  if (lower.includes("pureté")) {
    const rates = formula
      .split(/\)\s*\/\s*/)
      .map((segment) => {
        const [amount] = moneyAmounts(segment);
        const cond = segment.match(/\(([^)]*)/)?.[1]?.trim() ?? null;
        return amount === undefined
          ? null
          : { label: cond ? cond.replace(/\s+/g, " ") : null, min: amount, max: amount };
      })
      .filter((r): r is FormulaRate => r !== null);
    if (rates.length > 0) {
      return { variableLabel: unitLabel(lower), integer: true, rates };
    }
  }

  const amounts = moneyAmounts(formula);

  // Fourchette de taux par unité.
  if (amounts.length === 2 && /\sà\s/.test(lower)) {
    const [a, b] = amounts;
    return {
      variableLabel: unitLabel(lower),
      integer: true,
      rates: [{ label: null, min: Math.min(a, b), max: Math.max(a, b) }],
    };
  }

  // Taux fixe par unité / paquet / arme.
  if (amounts.length === 1) {
    return {
      variableLabel: unitLabel(lower),
      integer: true,
      rates: [{ label: null, min: amounts[0], max: amounts[0] }],
    };
  }

  return {
    variableLabel: "Montant de l'amende ($)",
    integer: false,
    rates: [{ label: null, min: 1, max: 1 }],
  };
}

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function computeFormulaAmount(variable: number, rate: number): number {
  return roundMoney(variable * rate);
}

// Vérifie (côté serveur) qu'un montant envoyé par le client correspond
// bien à la formule de l'article pour la valeur saisie.
export function isValidFormulaAmount(
  formula: string,
  variable: number,
  montant: number,
): boolean {
  const spec = parseFormula(formula);
  if (!Number.isFinite(variable) || variable < 0) return false;
  if (spec.integer && !Number.isInteger(variable)) return false;
  return spec.rates.some((r) => {
    const low = computeFormulaAmount(variable, r.min);
    const high = computeFormulaAmount(variable, r.max);
    return montant >= low - 0.005 && montant <= high + 0.005;
  });
}

// --------------------------------------------------------------------
// Totaux
// --------------------------------------------------------------------

export type InfractionTotals = {
  amendeMin: number;
  amendeMax: number;
  prisonUp: number;
};

export function computeTotals(
  lines: InfractionLine[],
  articleById: Map<string, CodePenalPickerArticle>,
): InfractionTotals {
  let amendeMin = 0;
  let amendeMax = 0;
  let prisonUp = 0;
  for (const line of lines) {
    const article = articleById.get(line.article_id);
    if (!article) continue;
    if (article.amende_formule) {
      amendeMin += line.montant_calcule ?? 0;
      amendeMax += line.montant_calcule ?? 0;
    } else {
      amendeMin += article.amende_min ?? 0;
      amendeMax += article.amende_max ?? 0;
    }
    prisonUp += article.peine_prison_up ?? 0;
  }
  return {
    amendeMin: roundMoney(amendeMin),
    amendeMax: roundMoney(amendeMax),
    prisonUp,
  };
}

// 1 UP = 1 minute : 420 → « 7h00 ».
export function formatPrisonDuration(up: number): string {
  const hours = Math.floor(up / 60);
  const minutes = up % 60;
  return `${hours}h${String(minutes).padStart(2, "0")}`;
}

export function formatDollars(value: number): string {
  return `$${value.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

// Recherche insensible à la casse et aux accents.
export function normalizeSearch(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

// Couleur de catégorie (affichée au survol).
export const CATEGORIE_HOVER_CLASSES: Record<CodePenalCategorie, string> = {
  A: "hover:border-gtf-blue-hover hover:bg-gtf-blue/15",
  B: "hover:border-gtf-orange hover:bg-gtf-orange/15",
  C: "hover:border-gtf-red hover:bg-gtf-red/15",
};

export const CATEGORIE_TEXT_HOVER_CLASSES: Record<CodePenalCategorie, string> = {
  A: "group-hover:text-gtf-blue-hover",
  B: "group-hover:text-gtf-orange",
  C: "group-hover:text-gtf-red",
};
