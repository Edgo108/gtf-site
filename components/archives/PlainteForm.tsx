"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createPlainte, updatePlainte } from "@/app/(app)/archives/actions";
import type { AgentOption, Plainte } from "@/lib/supabase/archives-types";
import { toParisInputValue } from "@/lib/datetime";
import { FormFooter } from "@/components/ui/FormFooter";
import { useActionRunner } from "@/lib/ui/use-action-runner";
import { fieldClass, labelClass } from "@/lib/ui/styles";
import { SignatureField } from "./SignatureField";
import { VERSION_FIELD } from "@/lib/concurrency";
import { AttachmentsSection } from "@/components/attachments/AttachmentsSection";
import { useAttachmentDrafts } from "@/lib/attachments/use-attachment-drafts";
import { TestModeField } from "./TestModeField";
import type { AttachmentView } from "@/lib/attachments/types";

export function PlainteForm({
  plainte,
  attachments,
  agents,
  defaultDateRedaction,
  defaultRedacteurId,
}: {
  plainte?: Plainte;
  // Pièces jointes déjà enregistrées (modification).
  attachments?: AttachmentView[];
  agents: AgentOption[];
  defaultDateRedaction?: string;
  // Agent connecté : pré-sélectionné comme rédacteur à la création.
  defaultRedacteurId?: string;
}) {
  const router = useRouter();
  const run = useActionRunner();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const drafts = useAttachmentDrafts("plainte");
  // Mode test : choisi à la création uniquement, figé ensuite.
  const [estTest, setEstTest] = useState(plainte?.est_test ?? false);

  function handleTestModeChange(checked: boolean) {
    // Un test n'a pas de pièces jointes : celles déjà envoyées sont
    // retirées après confirmation.
    if (
      checked &&
      drafts.drafts.length > 0 &&
      !window.confirm(
        "Les fichiers déjà joints seront supprimés : un test n'a pas de pièces jointes. Continuer ?",
      )
    ) {
      return;
    }
    if (checked) drafts.discardAll();
    setEstTest(checked);
  }
  const [nomVictime, setNomVictime] = useState(plainte?.nom_victime ?? "");
  const [redacteurId, setRedacteurId] = useState(
    plainte?.agent_redacteur_id ??
      (agents.some((a) => a.id === defaultRedacteurId)
        ? defaultRedacteurId!
        : ""),
  );
  const redacteurPseudo =
    agents.find((a) => a.id === redacteurId)?.pseudo ?? "";

  function handleAction(formData: FormData) {
    setError(null);
    if (plainte) {
      formData.set("id", plainte.id);
      // Version ouverte : refus à l'enregistrement si la fiche a changé.
      formData.set(VERSION_FIELD, plainte.updated_at);
    } else {
      // Identifiant généré à l'ouverture du formulaire : les pièces
      // jointes déjà envoyées sont rangées sous ce chemin.
      formData.set("id", drafts.parentId);
      drafts.markSubmitting(true);
    }

    startTransition(async () => {
      const action = plainte ? updatePlainte : createPlainte;
      const result = await run(() => action(formData), {
        success: plainte
          ? "Plainte mise à jour"
          : estTest
            ? "Test enregistré"
            : "Plainte enregistrée",
        inline: true,
      });
      if (result?.error) {
        setError(result.error);
        drafts.markSubmitting(false);
      }
    });
  }

  return (
    <form action={handleAction} className="flex flex-col gap-5">
      <p className="font-mono text-[11px] text-gtf-text-muted">
        Dates et heures en heure de Paris.
      </p>

      {plainte ? (
        <TestModeField checked={plainte.est_test} />
      ) : (
        <TestModeField
          checked={estTest}
          onChange={handleTestModeChange}
          disabled={drafts.uploading > 0}
        />
      )}

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
              plainte
                ? toParisInputValue(plainte.date_redaction)
                : defaultDateRedaction
            }
            className={fieldClass}
          />
        </div>

        <div>
          <label htmlFor="date_faits" className={labelClass}>
            Date et heure des faits
          </label>
          <input
            id="date_faits"
            name="date_faits"
            type="datetime-local"
            defaultValue={toParisInputValue(plainte?.date_faits)}
            className={fieldClass}
          />
        </div>
      </div>

      <div>
        <label htmlFor="nom_victime" className={labelClass}>
          Nom + prénom de la victime
        </label>
        <input
          id="nom_victime"
          name="nom_victime"
          type="text"
          required
          autoComplete="off"
          value={nomVictime}
          onChange={(e) => setNomVictime(e.target.value)}
          className={fieldClass}
        />
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
        <label htmlFor="descriptif_plainte" className={labelClass}>
          Descriptif de la plainte
        </label>
        <textarea
          id="descriptif_plainte"
          name="descriptif_plainte"
          rows={8}
          defaultValue={plainte?.descriptif_plainte}
          className={fieldClass}
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <SignatureField
          name="signature_victime"
          label="Signature de la victime"
          sourceName={nomVictime.trim()}
          initiallySigned={!!plainte?.signature_victime}
          missingSourceHint="Renseignez d'abord le nom de la victime."
        />
        <SignatureField
          name="signature_agent_assermente"
          label="Signature de l'agent assermenté"
          sourceName={redacteurPseudo}
          initiallySigned={!!plainte?.signature_agent_assermente}
          missingSourceHint="Sélectionnez d'abord l'agent rédacteur."
        />
      </div>

      {/* Un test n'a pas de pièces jointes. */}
      {estTest ? null : plainte ? (
        <AttachmentsSection
          parentType="plainte"
          parentId={plainte.id}
          initial={attachments ?? []}
          canEdit
        />
      ) : (
        <AttachmentsSection drafts={drafts} canEdit />
      )}

      <FormFooter
        error={error}
        pending={pending || drafts.uploading > 0}
        onCancel={() => {
          drafts.discardAll();
          router.back();
        }}
      />
    </form>
  );
}
