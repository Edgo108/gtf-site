const DIACRITICS_REGEX = new RegExp("[\\u0300-\\u036f]", "g");

export type SuspectMatch = {
  name: string;
  investigations: { id: string; titre: string }[];
};

export function normalizeName(value: string): string {
  return value
    .normalize("NFD")
    .replace(DIACRITICS_REGEX, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

// Un champ "suspects" est du texte libre : on découpe sur virgule,
// point-virgule ou retour à la ligne pour obtenir des noms individuels.
export function parseSuspectNames(raw: string): string[] {
  const names = raw
    .split(/[,;\n]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 1);

  const seen = new Set<string>();
  const unique: string[] = [];
  for (const name of names) {
    const key = normalizeName(name);
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(name);
    }
  }
  return unique;
}
