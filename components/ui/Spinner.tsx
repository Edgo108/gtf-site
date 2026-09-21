// Indicateur de chargement du thème tactique : anneau qui reprend la
// couleur du texte courant (blanc dans un bouton plein, bleu si on lui
// passe text-gtf-blue-hover).
export function Spinner({
  className = "",
  label = "Chargement",
}: {
  className?: string;
  label?: string;
}) {
  return (
    <span
      role="status"
      aria-label={label}
      className={`inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-current/25 border-t-current ${className}`}
    />
  );
}
