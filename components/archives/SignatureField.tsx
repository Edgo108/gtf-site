"use client";

import { useState } from "react";
import { Signature } from "./Signature";
import { btn } from "@/lib/ui/styles";

// Zone « clic-pour-signer » : un clic génère la signature manuscrite du
// nom courant (`sourceName`, ex. l'agent rédacteur sélectionné). Si ce nom
// change après coup, la signature n'est plus valable et disparaît : il
// faut re-signer. Le serveur ne reçoit qu'un indicateur « signé » (champ
// caché non vide) et recalcule lui-même le nom à enregistrer.
export function SignatureField({
  name,
  label,
  sourceName,
  initiallySigned = false,
  missingSourceHint,
}: {
  name: string;
  label: string;
  sourceName: string;
  initiallySigned?: boolean;
  // Message affiché tant qu'il n'y a pas de nom à signer.
  missingSourceHint: string;
}) {
  const [signedAs, setSignedAs] = useState<string | null>(
    initiallySigned && sourceName ? sourceName : null,
  );
  const hasSource = sourceName.trim() !== "";
  const signed = hasSource && signedAs === sourceName;

  return (
    <div>
      <span className="mb-1 block font-mono text-xs uppercase tracking-wider text-gtf-text-muted">
        {label}
      </span>
      <input type="hidden" name={name} value={signed ? "1" : ""} />

      {signed ? (
        <div className="rounded-md border border-gtf-border bg-gtf-panel-alt/50 p-3">
          <Signature name={sourceName} />
          <button
            type="button"
            onClick={() => setSignedAs(null)}
            className={btn("secondary", "sm", "mt-3")}
          >
            Effacer la signature
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={!hasSource}
          onClick={() => setSignedAs(sourceName)}
          className="flex min-h-24 w-full flex-col items-center justify-center gap-1 rounded-md border border-dashed border-gtf-border bg-gtf-panel-alt/50 p-3 text-center transition-colors hover:border-gtf-blue disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:border-gtf-border"
        >
          <span className="font-mono text-xs uppercase tracking-wider text-gtf-blue-hover">
            {hasSource ? "Cliquer pour signer" : "Signature indisponible"}
          </span>
          <span className="text-xs text-gtf-text-muted">
            {hasSource ? `Signé au nom de : ${sourceName}` : missingSourceHint}
          </span>
        </button>
      )}
    </div>
  );
}
