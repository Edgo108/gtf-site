"use client";

import { useState } from "react";
import { FileDown } from "lucide-react";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/ToastProvider";
import { useActionRunner } from "@/lib/ui/use-action-runner";
import { btn, type ButtonSize } from "@/lib/ui/styles";
import { getArchivePdfData } from "@/lib/actions/archive-pdf";
import type { ArchivePdfKind } from "@/lib/pdf/archive-pdf-types";

// « Exporter en PDF » (fiche d'un rapport / d'une plainte, et corbeille
// pour l'admin). Le serveur prépare les données avec la session de
// l'agent (RLS), le navigateur assemble le PDF et le télécharge.
export function ExportPdfButton({
  kind,
  id,
  size = "md",
}: {
  kind: ArchivePdfKind;
  id: string;
  size?: ButtonSize;
}) {
  const run = useActionRunner();
  const toast = useToast();
  const [progress, setProgress] = useState<string | null>(null);

  async function handleExport() {
    setProgress("Préparation…");
    try {
      const result = await run(() => getArchivePdfData(kind, id));
      if (result.error || !("data" in result) || !result.data) return;
      const data = result.data;

      const { buildArchivePdf } = await import("@/lib/pdf/archive-pdf");
      const { bytes, unreadable } = await buildArchivePdf(data, setProgress);

      const url = URL.createObjectURL(
        new Blob([bytes as BlobPart], { type: "application/pdf" }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = data.fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);

      toast.success(`PDF généré : ${data.fileName}`);
      if (unreadable.length > 0) {
        toast.error(
          unreadable.length === 1
            ? `La pièce jointe « ${unreadable[0]} » est illisible : elle n'a pas été intégrée au PDF (elle figure dans la liste des annexes).`
            : `${unreadable.length} pièces jointes illisibles n'ont pas été intégrées au PDF (elles figurent dans la liste des annexes).`,
        );
      }
    } catch {
      toast.error(
        "La génération du PDF a échoué. Vérifiez votre connexion puis réessayez.",
      );
    } finally {
      setProgress(null);
    }
  }

  return (
    <button
      type="button"
      onClick={handleExport}
      disabled={progress !== null}
      aria-busy={progress !== null}
      className={btn("secondary", size)}
    >
      {progress ? (
        <>
          <Spinner className="h-3 w-3" />
          <span className="normal-case tracking-normal">{progress}</span>
        </>
      ) : (
        <>
          <FileDown aria-hidden className="h-4 w-4" />
          Exporter en PDF
        </>
      )}
    </button>
  );
}
