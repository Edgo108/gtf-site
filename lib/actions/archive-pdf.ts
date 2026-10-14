"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireActiveUser } from "@/lib/auth/require";
import { getPseudoMap } from "@/lib/archives/agents";
import { formatParisDateTime } from "@/lib/datetime";
import {
  CODE_PENAL_PICKER_COLUMNS,
  computeTotals,
  formatDollars,
  formatPrisonDuration,
  type CodePenalPickerArticle,
  type InfractionLine,
} from "@/lib/supabase/code-penal-types";
import {
  formatNumero,
  type Plainte,
  type Rapport,
} from "@/lib/supabase/archives-types";
import {
  ATTACHMENTS_BUCKET,
  UUID_RE,
  formatFileSize,
} from "@/lib/attachments/types";
import type {
  ArchivePdfData,
  ArchivePdfKind,
  PdfField,
} from "@/lib/pdf/archive-pdf-types";

// Données d'un export PDF. Lecture avec la SESSION DE L'AGENT : la RLS
// décide (DOJ refusé, corbeille invisible…) — on ne peut pas exporter ce
// qu'on ne peut pas voir. Seule exception : un admin peut exporter une
// fiche en corbeille ; la lecture passe alors par la clé service_role,
// après vérification du rôle.

const TABLES = { rapport: "rapports", plainte: "plaintes" } as const;
// Validité des URL signées des pièces jointes (le temps de générer).
const ATTACHMENT_URL_TTL_SECONDS = 10 * 60;

const NOT_FOUND = "Document introuvable, ou vous n'avez pas accès à ce document.";

const dateOrDash = (value: string | null) =>
  value ? formatParisDateTime(value) : "—";

export async function getArchivePdfData(
  kind: ArchivePdfKind,
  id: string,
): Promise<{ error?: string; data?: ArchivePdfData }> {
  const { supabase, profile } = await requireActiveUser();
  if ((kind !== "rapport" && kind !== "plainte") || !UUID_RE.test(id)) {
    return { error: NOT_FOUND };
  }

  let client = supabase as unknown as ReturnType<typeof createAdminClient>;
  let { data: row } = await supabase
    .from(TABLES[kind])
    .select("*")
    .eq("id", id)
    .maybeSingle<Rapport & Plainte>();

  if (!row && profile.role === "admin") {
    // Fiche en corbeille (invisible via la RLS) : admin uniquement.
    const admin = createAdminClient();
    const { data } = await admin
      .from(TABLES[kind])
      .select("*")
      .eq("id", id)
      .not("deleted_at", "is", null)
      .maybeSingle<Rapport & Plainte>();
    if (data) {
      row = data;
      client = admin;
    }
  }
  if (!row) return { error: NOT_FOUND };

  // Pièces jointes (jamais pour un test).
  const { data: attachmentRows } = row.est_test
    ? { data: [] }
    : await client
        .from("attachments")
        .select("nom_fichier, storage_path, taille_octets, type_mime, created_at, uploaded_by")
        .eq("parent_type", kind)
        .eq("parent_id", id)
        .order("created_at", { ascending: true })
        .returns<
          {
            nom_fichier: string;
            storage_path: string;
            taille_octets: number;
            type_mime: string;
            created_at: string;
            uploaded_by: string | null;
          }[]
        >();
  const attachments = attachmentRows ?? [];

  // Infractions (rapport).
  let lines: InfractionLine[] = [];
  let articles: CodePenalPickerArticle[] = [];
  if (kind === "rapport") {
    const { data } = await client
      .from("rapport_infractions")
      .select("article_id, variable_utilisee, montant_calcule")
      .eq("rapport_id", id)
      .order("position")
      .returns<InfractionLine[]>();
    lines = (data ?? []).map((l) => ({
      article_id: l.article_id,
      variable_utilisee: l.variable_utilisee === null ? null : Number(l.variable_utilisee),
      montant_calcule: l.montant_calcule === null ? null : Number(l.montant_calcule),
    }));
    if (lines.length > 0) {
      const { data: arts } = await client
        .from("code_penal_articles")
        .select(CODE_PENAL_PICKER_COLUMNS)
        .in("id", [...new Set(lines.map((l) => l.article_id))])
        .returns<CodePenalPickerArticle[]>();
      articles = arts ?? [];
    }
  }

  const [pseudoById, signed] = await Promise.all([
    getPseudoMap([
      row.agent_redacteur_id,
      ...(row.agents_lies ?? []),
      ...attachments.map((a) => a.uploaded_by),
    ]),
    attachments.length
      ? client.storage
          .from(ATTACHMENTS_BUCKET)
          .createSignedUrls(
            attachments.map((a) => a.storage_path),
            ATTACHMENT_URL_TTL_SECONDS,
          )
      : Promise.resolve({ data: [] }),
  ]);
  const pseudo = (agentId: string | null | undefined) =>
    (agentId && pseudoById.get(agentId)) || "Agent inconnu";
  const urlByPath = new Map(
    (signed.data ?? []).flatMap((d) =>
      d.path && d.signedUrl ? [[d.path, d.signedUrl] as const] : [],
    ),
  );

  const articleById = new Map(articles.map((a) => [a.id, a]));
  const known = lines.filter((l) => articleById.has(l.article_id));

  const fields: PdfField[] =
    kind === "rapport"
      ? [
          { kind: "text", label: "Date et heure de rédaction", value: dateOrDash(row.date_redaction) },
          { kind: "text", label: "Date et heure d'intervention", value: dateOrDash(row.date_intervention) },
          { kind: "text", label: "Agent rédacteur", value: pseudo(row.agent_redacteur_id) },
          {
            kind: "list",
            label: "Agents liés à l'intervention",
            items: (row.agents_lies ?? []).map((a) => pseudo(a)),
          },
          { kind: "text", label: "Nom du suspect", value: row.nom_suspect || "—" },
          {
            kind: "text",
            label: "Date et heure de lecture des droits Miranda",
            value: dateOrDash(row.date_lecture_miranda),
          },
          {
            kind: "list",
            label: "Faits reprochés (articles du Code Pénal enfreints)",
            items: known.map((l) => {
              const a = articleById.get(l.article_id)!;
              return `Art. ${a.numero_article} — ${a.titre}`;
            }),
          },
          { kind: "text", label: "Descriptif de la situation", value: row.descriptif_situation || "—" },
          { kind: "signature", label: "Signature de l'agent rédacteur", name: row.signature_agent_redacteur },
        ]
      : [
          { kind: "text", label: "Date et heure de rédaction", value: dateOrDash(row.date_redaction) },
          { kind: "text", label: "Date et heure des faits", value: dateOrDash(row.date_faits) },
          { kind: "text", label: "Nom et prénom de la victime", value: row.nom_victime || "—" },
          { kind: "text", label: "Agent rédacteur", value: pseudo(row.agent_redacteur_id) },
          { kind: "text", label: "Descriptif de la plainte", value: row.descriptif_plainte || "—" },
          { kind: "signature", label: "Signature de la victime", name: row.signature_victime },
          { kind: "signature", label: "Signature de l'agent assermenté", name: row.signature_agent_assermente },
        ];

  const totals = computeTotals(known, articleById);
  const numero = row.est_test
    ? `TEST-${formatNumero(row.numero_test ?? 0)}`
    : formatNumero(row.numero ?? 0);
  const typeName = kind === "rapport" ? "Rapport" : "Plainte";

  return {
    data: {
      kind,
      typeLabel: typeName.toUpperCase(),
      numeroLabel: row.est_test ? numero : `N° ${numero}`,
      estTest: row.est_test,
      enCorbeille: row.deleted_at !== null,
      dateRedaction: dateOrDash(row.date_redaction),
      fields,
      infractions:
        kind === "rapport"
          ? {
              lines: known.map((l) => {
                const a = articleById.get(l.article_id)!;
                return {
                  numeroArticle: a.numero_article,
                  titre: a.titre,
                  categorie: a.categorie,
                  montantCalcule:
                    a.amende_formule && l.montant_calcule !== null
                      ? formatDollars(l.montant_calcule)
                      : null,
                };
              }),
              amendeMin: formatDollars(totals.amendeMin),
              amendeMax: formatDollars(totals.amendeMax),
              prison: `${totals.prisonUp} UP (${formatPrisonDuration(totals.prisonUp)})`,
            }
          : null,
      attachments: attachments.map((a) => ({
        nom: a.nom_fichier,
        typeMime: a.type_mime,
        taille: formatFileSize(a.taille_octets),
        ajouteLe: formatParisDateTime(a.created_at),
        ajoutePar: pseudo(a.uploaded_by),
        url: urlByPath.get(a.storage_path) ?? null,
      })),
      generatedBy: profile.pseudo,
      generatedAt: formatParisDateTime(new Date().toISOString()),
      fileName: `${typeName}-${numero}.pdf`,
    },
  };
}
