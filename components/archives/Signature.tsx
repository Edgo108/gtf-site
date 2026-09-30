import { Great_Vibes } from "next/font/google";

// Police manuscrite des signatures « clic-pour-signer » des Archives.
// Chargée ici seulement : aucune autre page n'en a besoin.
const signatureFont = Great_Vibes({
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

// Rendu visuel d'une signature : le nom en écriture cursive sur une ligne
// de signature. `name` vide/null → emplacement « Non signé ».
export function Signature({
  name,
  className = "",
}: {
  name: string | null | undefined;
  className?: string;
}) {
  return (
    <div
      className={`flex min-h-20 items-end border-b border-dashed border-gtf-text-muted/50 px-2 pb-1 ${className}`}
    >
      {name ? (
        <span
          className={`${signatureFont.className} -rotate-2 break-words text-4xl leading-tight text-gtf-text`}
        >
          {name}
        </span>
      ) : (
        <span className="pb-1 font-mono text-xs uppercase tracking-wider text-gtf-text-muted">
          Non signé
        </span>
      )}
    </div>
  );
}
