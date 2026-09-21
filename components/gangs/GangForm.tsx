"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createGang, updateGang } from "@/app/(app)/gangs/actions";
import {
  GANG_CATEGORIE_OPTIONS,
  type Gang,
} from "@/lib/supabase/gangs-types";
import { FormFooter } from "@/components/ui/FormFooter";
import { useActionRunner } from "@/lib/ui/use-action-runner";
import { fieldClass, labelClass } from "@/lib/ui/styles";

const NIVEAUX = [
  { value: "faible", label: "Faible" },
  { value: "moyen", label: "Moyen" },
  { value: "eleve", label: "Élevé" },
];

const DEFAULT_COLOR = "#3E6FA6";
const HEX_COLOR_REGEX = /^#[0-9a-fA-F]{6}$/;


export function GangForm({ gang }: { gang?: Gang }) {
  const router = useRouter();
  const run = useActionRunner();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [couleur, setCouleur] = useState(gang?.couleur ?? DEFAULT_COLOR);

  function handleAction(formData: FormData) {
    setError(null);
    if (gang) {
      formData.set("id", gang.id);
    }
    formData.set(
      "couleur",
      HEX_COLOR_REGEX.test(couleur) ? couleur : DEFAULT_COLOR,
    );

    startTransition(async () => {
      const action = gang ? updateGang : createGang;
      const result = await run(() => action(formData), {
        success: gang ? "Fiche B.D.D mise à jour" : "Fiche B.D.D créée",
        inline: true,
      });
      if (result?.error) setError(result.error);
    });
  }

  return (
    <form action={handleAction} className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="nom" className={labelClass}>
            Nom
          </label>
          <input
            id="nom"
            name="nom"
            type="text"
            required
            defaultValue={gang?.nom}
            className={fieldClass}
          />
        </div>
        <div>
          <label htmlFor="categorie" className={labelClass}>
            Catégorie
          </label>
          <select
            id="categorie"
            name="categorie"
            required
            defaultValue={gang?.categorie ?? "Gang"}
            className={fieldClass}
          >
            {GANG_CATEGORIE_OPTIONS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="territoire" className={labelClass}>
            Territoire
          </label>
          <input
            id="territoire"
            name="territoire"
            type="text"
            defaultValue={gang?.territoire}
            className={fieldClass}
          />
        </div>
        <div>
          <label htmlFor="niveau_menace" className={labelClass}>
            Niveau de menace
          </label>
          <select
            id="niveau_menace"
            name="niveau_menace"
            defaultValue={gang?.niveau_menace ?? "moyen"}
            className={fieldClass}
          >
            {NIVEAUX.map((n) => (
              <option key={n.value} value={n.value}>
                {n.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="couleur-picker" className={labelClass}>
          Couleur d&apos;identification
        </label>
        <div className="flex items-center gap-3">
          <input
            id="couleur-picker"
            type="color"
            value={couleur}
            onChange={(e) => setCouleur(e.target.value)}
            className="h-10 w-14 cursor-pointer rounded border border-gtf-border bg-gtf-panel-alt"
          />
          <input
            type="text"
            value={couleur}
            onChange={(e) => setCouleur(e.target.value)}
            aria-label="Code couleur hexadécimal"
            className={`${fieldClass} w-32 font-mono`}
          />
        </div>
      </div>

      <div>
        <label htmlFor="activites" className={labelClass}>
          Activités
        </label>
        <textarea
          id="activites"
          name="activites"
          rows={4}
          defaultValue={gang?.activites}
          className={fieldClass}
        />
      </div>

      <div>
        <label htmlFor="notes" className={labelClass}>
          Notes (optionnel)
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          defaultValue={gang?.notes}
          className={fieldClass}
        />
      </div>

      <FormFooter
        error={error}
        pending={pending}
        onCancel={() => router.back()}
      />
      </form>
  );
}
