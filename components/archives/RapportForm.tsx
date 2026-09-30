"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createRapport, updateRapport } from "@/app/(app)/archives/actions";
import type { AgentOption, Rapport } from "@/lib/supabase/archives-types";
import { toParisInputValue } from "@/lib/datetime";
import { NameSuggestField } from "@/components/ui/NameSuggestField";
import { useNameSuggestions } from "@/lib/suggestions/use-name-suggestions";
import { FormFooter } from "@/components/ui/FormFooter";
import { useActionRunner } from "@/lib/ui/use-action-runner";
import { fieldClass, labelClass } from "@/lib/ui/styles";
import { AgentMultiSelect } from "./AgentMultiSelect";
import { SignatureField } from "./SignatureField";
import { VERSION_FIELD } from "@/lib/concurrency";
import { InfractionPicker } from "./InfractionPicker";
import type {
  CodePenalPickerArticle,
  InfractionLine,
} from "@/lib/supabase/code-penal-types";

export function RapportForm({
  rapport,
  agents,
  articles,
  infractions,
  defaultDateRedaction,
  defaultRedacteurId,
}: {
  rapport?: Rapport;
  agents: AgentOption[];
  // Code Pénal (sélecteur des faits reprochés).
  articles: CodePenalPickerArticle[];
  // Infractions déjà enregistrées (modification).
  infractions?: InfractionLine[];
  // « Maintenant » (heure de Paris), calculé par la page serveur à
  // l'ouverture du formulaire de création.
  defaultDateRedaction?: string;
  // Agent connecté : pré-sélectionné comme rédacteur à la création.
  defaultRedacteurId?: string;
}) {
  const router = useRouter();
  const run = useActionRunner();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const nameSuggestions = useNameSuggestions();
  const [redacteurId, setRedacteurId] = useState(
    rapport?.agent_redacteur_id ??
      (agents.some((a) => a.id === defaultRedacteurId)
        ? defaultRedacteurId!
        : ""),
  );
  const redacteurPseudo =
    agents.find((a) => a.id === redacteurId)?.pseudo ?? "";

  function handleAction(formData: FormData) {
    setError(null);
    if (rapport) {
      formData.set("id", rapport.id);
      // Version ouverte : refus à l'enregistrement si la fiche a changé.
      formData.set(VERSION_FIELD, rapport.updated_at);
    }

    startTransition(async () => {
      const action = rapport ? updateRapport : createRapport;
      const result = await run(() => action(formData), {
        success: rapport ? "Rapport mis à jour" : "Rapport créé",
        inline: true,
      });
      if (result?.error) setError(result.error);
    });
  }

  return (
    <form action={handleAction} className="flex flex-col gap-5">
      <p className="font-mono text-[11px] text-gtf-text-muted">
        Dates et heures en heure de Paris.
      </p>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="date_redaction" className={labelClass}>
            Date et heure de rédaction
          </label>
          <input
            id="date_redaction"
            name="date_redaction"
            type="datetime-local"
            required
            defaultValue={
              rapport
                ? toParisInputValue(rapport.date_redaction)
                : defaultDateRedaction
            }
            className={fieldClass}
          />
        </div>

        <div>
          <label htmlFor="date_intervention" className={labelClass}>
            Date et heure d&apos;intervention
          </label>
          <input
            id="date_intervention"
            name="date_intervention"
            type="datetime-local"
            defaultValue={toParisInputValue(rapport?.date_intervention)}
            className={fieldClass}
          />
        </div>
      </div>

      <div>
        <label htmlFor="agent_redacteur_id" className={labelClass}>
          Agent rédacteur
        </label>
        <select
          id="agent_redacteur_id"
          name="agent_redacteur_id"
          required
          value={redacteurId}
          onChange={(e) => setRedacteurId(e.target.value)}
          className={fieldClass}
        >
          <option value="" disabled>
            Sélectionner un agent…
          </option>
          {agents.map((agent) => (
            <option key={agent.id} value={agent.id}>
              {agent.pseudo}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="agents_lies" className={labelClass}>
          Agents liés à l&apos;intervention
        </label>
        <AgentMultiSelect
          id="agents_lies"
          name="agents_lies"
          agents={agents}
          defaultValue={rapport?.agents_lies}
        />
      </div>

      <div>
        <label htmlFor="nom_suspect" className={labelClass}>
          Nom du suspect
        </label>
        <NameSuggestField
          id="nom_suspect"
          name="nom_suspect"
          suggestions={nameSuggestions}
          defaultValue={rapport?.nom_suspect}
        />
        <p className="mt-1 font-mono text-[11px] text-gtf-text-muted">
          Tab ou → accepte la suggestion en gris.
        </p>
      </div>

      <div>
        <label htmlFor="date_lecture_miranda" className={labelClass}>
          Date et heure de lecture des droits Miranda
        </label>
        <input
          id="date_lecture_miranda"
          name="date_lecture_miranda"
          type="datetime-local"
          defaultValue={toParisInputValue(rapport?.date_lecture_miranda)}
          className={fieldClass}
        />
      </div>

      <div>
        <label htmlFor="infractions" className={labelClass}>
          Faits reprochés (articles du Code Pénal enfreints)
        </label>
        <InfractionPicker
          id="infractions"
          name="infractions"
          articles={articles}
          defaultValue={infractions}
        />
      </div>

      <div>
        <label htmlFor="descriptif_situation" className={labelClass}>
          Descriptif de la situation
        </label>
        <textarea
          id="descriptif_situation"
          name="descriptif_situation"
          rows={8}
          defaultValue={rapport?.descriptif_situation}
          className={fieldClass}
        />
      </div>

      <SignatureField
        name="signature_agent_redacteur"
        label="Signature de l'agent rédacteur"
        sourceName={redacteurPseudo}
        initiallySigned={!!rapport?.signature_agent_redacteur}
        missingSourceHint="Sélectionnez d'abord l'agent rédacteur."
      />

      <FormFooter
        error={error}
        pending={pending}
        onCancel={() => router.back()}
      />
    </form>
  );
}
