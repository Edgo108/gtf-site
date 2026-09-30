// Dates/heures des Archives, toujours exprimées en heure de Paris : le
// rendu serveur (UTC sur Vercel) et le rendu navigateur affichent ainsi
// exactement la même valeur, et un <input type="datetime-local"> (qui
// n'a pas de fuseau) se relit sans ambiguïté.

export const ARCHIVES_TIME_ZONE = "Europe/Paris";

function parisParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: ARCHIVES_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
}

const pad = (n: number) => String(n).padStart(2, "0");

// ISO (ou Date) → « YYYY-MM-DDTHH:mm » en heure de Paris, pour la valeur
// d'un <input type="datetime-local">. Chaîne vide si pas de date.
export function toParisInputValue(value: string | Date | null | undefined): string {
  if (!value) return "";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  const p = parisParts(date);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

// Écart (ms) entre l'heure de Paris et UTC à l'instant `utcMs`.
function parisOffsetMs(utcMs: number): number {
  const p = parisParts(new Date(utcMs));
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(utcMs / 1000) * 1000;
}

// « YYYY-MM-DDTHH:mm » saisi en heure de Paris → ISO UTC. null si vide ou
// invalide.
export function parisInputToISO(value: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value.trim());
  if (!match) return null;
  const [, y, mo, d, h, mi] = match.map(Number);
  const naive = Date.UTC(y, mo - 1, d, h, mi);
  if (Number.isNaN(naive)) return null;
  // Deux passes : l'écart peut changer entre l'estimation et le résultat
  // autour d'un changement d'heure été/hiver.
  let utc = naive - parisOffsetMs(naive);
  utc = naive - parisOffsetMs(utc);
  return new Date(utc).toISOString();
}

// Affichage « 30/09/2026 14:05 » en heure de Paris.
export function formatParisDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("fr-FR", {
    timeZone: ARCHIVES_TIME_ZONE,
    dateStyle: "short",
    timeStyle: "short",
  });
}

// Valeur par défaut « maintenant » du champ « Date et heure de rédaction ».
// À appeler côté serveur (page), jamais dans le rendu d'un composant client
// (règle react-hooks/purity).
export function nowParisInputValue(): string {
  return toParisInputValue(new Date());
}
