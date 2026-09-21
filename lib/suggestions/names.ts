import {
  DIACRITICS_REGEX,
  normalizeName,
  parseSuspectNames,
} from "@/lib/investigations/suspects";

// Logique pure de l'auto-suggestion de noms (texte fantôme façon Gmail),
// séparée du composant pour rester testable et sans dépendance React.

export type NameSuggestion = {
  // Index, dans la valeur du champ, où commence le nom en cours de saisie
  // (après d'éventuels séparateurs/espaces précédents).
  start: number;
  // Nom complet suggéré, tel qu'il est enregistré dans la source.
  name: string;
  // Suite du nom à afficher en texte fantôme après ce qui est tapé.
  suffix: string;
};

const SEPARATOR_REGEX = /[,;\n]/;

// Minuscule + sans accent, caractère par caractère : garde une
// correspondance 1:1 entre le texte tapé et le nom suggéré pour pouvoir
// en déduire la suite exacte (« rem » → « Rémi » suggère « i »).
function foldChar(char: string): string {
  return char.normalize("NFD").replace(DIACRITICS_REGEX, "").toLowerCase();
}

type NameSources = {
  // Noms des membres de la B.D.D. (gang_members).
  members: string[];
  // Champs « suspects » bruts des enquêtes, du plus récent au plus ancien.
  investigationSuspects: string[];
  // Noms de suspects des mandats, du plus récent au plus ancien.
  notices: string[];
};

// Fusionne les 3 sources en une liste dédoublonnée (insensible à la casse
// et aux accents), triée par pertinence :
//   1. les noms présents dans la B.D.D. (source de référence, et son
//      orthographe est celle qui est conservée) ;
//   2. puis les plus fréquents (utilisés dans le plus de fiches) ;
//   3. à égalité, le plus récemment utilisé (ordre d'entrée conservé :
//      B.D.D., puis enquêtes/mandats du plus récent au plus ancien).
export function rankNames(sources: NameSources): string[] {
  const entries = new Map<
    string,
    { name: string; inBdd: boolean; count: number }
  >();

  function add(raw: string, fromBdd: boolean) {
    const name = raw.trim().replace(/\s+/g, " ");
    const key = normalizeName(name);
    if (name.length < 2 || !key) return;

    const existing = entries.get(key);
    if (existing) {
      existing.count += 1;
      existing.inBdd ||= fromBdd;
    } else {
      entries.set(key, { name, inBdd: fromBdd, count: 1 });
    }
  }

  for (const name of sources.members) add(name, true);
  for (const raw of sources.investigationSuspects) {
    for (const name of parseSuspectNames(raw)) add(name, false);
  }
  for (const name of sources.notices) add(name, false);

  return [...entries.values()]
    .sort((a, b) => Number(b.inBdd) - Number(a.inBdd) || b.count - a.count)
    .map((entry) => entry.name);
}

// Cherche la suggestion pour le nom en cours de saisie, situé en fin de
// `value`. En mode `multiple` (champ « suspects » : plusieurs noms séparés
// par virgule, point-virgule ou retour à la ligne), seul le dernier nom
// est complété, et les noms déjà saisis plus haut ne sont pas re-suggérés.
// `candidates` doit être déjà trié par pertinence : le premier nom qui
// commence par le texte tapé l'emporte.
export function findNameSuggestion(
  value: string,
  candidates: string[],
  multiple: boolean,
): NameSuggestion | null {
  let segmentStart = 0;
  if (multiple) {
    for (let i = value.length - 1; i >= 0; i--) {
      if (SEPARATOR_REGEX.test(value[i])) {
        segmentStart = i + 1;
        break;
      }
    }
  }

  const segment = value.slice(segmentStart);
  const start = segmentStart + (segment.length - segment.trimStart().length);
  const typed = value.slice(start);
  if (!typed) return null;

  const typedFolded = Array.from(typed.normalize("NFC")).map(foldChar);
  const alreadyListed = multiple
    ? new Set(parseSuspectNames(value.slice(0, segmentStart)).map(normalizeName))
    : new Set<string>();

  for (const name of candidates) {
    const chars = Array.from(name.normalize("NFC"));
    if (chars.length <= typedFolded.length) continue;
    if (!typedFolded.every((folded, i) => foldChar(chars[i]) === folded)) {
      continue;
    }
    if (alreadyListed.has(normalizeName(name))) continue;

    return { start, name, suffix: chars.slice(typedFolded.length).join("") };
  }

  return null;
}
