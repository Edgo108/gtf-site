import {
  PDFDocument,
  degrees,
  rgb,
  type PDFFont,
  type PDFImage,
  type PDFPage,
} from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import type { ArchivePdfData, PdfAttachment } from "./archive-pdf-types";

// Génération du PDF d'un Rapport / d'une Plainte DANS LE NAVIGATEUR
// (pdf-lib) : aucune limite de durée ni de taille de réponse côté
// serveur (Vercel), les pièces jointes sont téléchargées directement
// depuis le stockage via des URL signées. Module chargé à la demande
// (import dynamique) pour ne pas alourdir les pages.
//
// Document sobre : A4, noir sur blanc, lisible imprimé en noir et blanc.

const A4: [number, number] = [595.28, 841.89];
const MARGIN_X = 56;
const MARGIN_TOP = 56;
// Réserve en bas de page pour le pied de page.
const MARGIN_BOTTOM = 64;

const BLACK = rgb(0, 0, 0);
const DARK = rgb(0.2, 0.2, 0.2);
const GREY = rgb(0.4, 0.4, 0.4);
const RULE = rgb(0.75, 0.75, 0.75);

// Images intégrées : côté le plus long ramené à cette taille (poids du
// PDF raisonnable, qualité suffisante à l'impression A4).
const MAX_IMAGE_SIDE = 2400;

export type PdfProgress = (label: string) => void;

export type PdfResult = {
  bytes: Uint8Array;
  // Pièces jointes qui n'ont pas pu être intégrées (illisibles).
  unreadable: string[];
};

type Fonts = { regular: PDFFont; bold: PDFFont; script: PDFFont };

let fontCache: Promise<[ArrayBuffer, ArrayBuffer, ArrayBuffer]> | null = null;

function loadFontFiles() {
  fontCache ??= Promise.all(
    [
      "/fonts/pdf/IBMPlexSans-Regular.ttf",
      "/fonts/pdf/IBMPlexSans-Bold.ttf",
      "/fonts/pdf/GreatVibes-Regular.ttf",
    ].map(async (url) => {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Police introuvable : ${url}`);
      return res.arrayBuffer();
    }),
  ) as Promise<[ArrayBuffer, ArrayBuffer, ArrayBuffer]>;
  // En cas d'échec, on réessaiera au prochain export.
  fontCache.catch(() => {
    fontCache = null;
  });
  return fontCache;
}

// Les polices n'ont pas de glyphe pour les caractères de contrôle.
function clean(text: string): string {
  return text.replace(/\r\n?/g, "\n").replace(/\t/g, "    ").replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, "");
}

// Découpe en lignes tenant dans `maxWidth` (mots trop longs coupés).
function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of clean(text).split("\n")) {
    if (paragraph.trim() === "") {
      lines.push("");
      continue;
    }
    let line = "";
    for (const word of paragraph.split(/ +/)) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        line = candidate;
        continue;
      }
      if (line) lines.push(line);
      // Mot plus large que la ligne : coupé caractère par caractère.
      let rest = word;
      while (font.widthOfTextAtSize(rest, size) > maxWidth) {
        let cut = rest.length - 1;
        while (cut > 1 && font.widthOfTextAtSize(rest.slice(0, cut), size) > maxWidth) cut--;
        lines.push(rest.slice(0, cut));
        rest = rest.slice(cut);
      }
      line = rest;
    }
    lines.push(line);
  }
  return lines;
}

// Curseur de mise en page : ajoute une page dès qu'un élément ne tient
// plus (jamais de ligne coupée en deux).
class Writer {
  page!: PDFPage;
  y = 0;
  readonly width = A4[0] - MARGIN_X * 2;

  constructor(
    readonly doc: PDFDocument,
    readonly fonts: Fonts,
  ) {
    this.newPage();
  }

  newPage() {
    this.page = this.doc.addPage(A4);
    this.y = A4[1] - MARGIN_TOP;
  }

  ensure(height: number) {
    if (this.y - height < MARGIN_BOTTOM) this.newPage();
  }

  gap(height: number) {
    this.y -= height;
  }

  text(
    text: string,
    opts: { size?: number; font?: PDFFont; color?: ReturnType<typeof rgb>; indent?: number; lineGap?: number } = {},
  ) {
    const size = opts.size ?? 10.5;
    const font = opts.font ?? this.fonts.regular;
    const indent = opts.indent ?? 0;
    const lineHeight = size * (opts.lineGap ?? 1.4);
    for (const line of wrap(text, font, size, this.width - indent)) {
      this.ensure(lineHeight);
      this.y -= lineHeight;
      if (line) {
        this.page.drawText(line, {
          x: MARGIN_X + indent,
          y: this.y + size * 0.3,
          size,
          font,
          color: opts.color ?? BLACK,
        });
      }
    }
  }

  rule(color = RULE) {
    this.ensure(8);
    this.y -= 4;
    this.page.drawLine({
      start: { x: MARGIN_X, y: this.y },
      end: { x: MARGIN_X + this.width, y: this.y },
      thickness: 0.6,
      color,
    });
    this.y -= 4;
  }

  label(text: string) {
    // Libellé + au moins une ligne de valeur sur la même page.
    this.ensure(9 * 1.5 + 10.5 * 1.4);
    this.text(text.toUpperCase(), { size: 8.5, font: this.fonts.bold, color: GREY, lineGap: 1.5 });
  }

  signature(name: string | null) {
    const height = 46;
    this.ensure(height);
    const baseline = this.y - 34;
    if (name) {
      // Nom en écriture manuscrite, réduit s'il est très long.
      let size = 26;
      while (size > 12 && this.fonts.script.widthOfTextAtSize(clean(name), size) > this.width * 0.6) size--;
      this.page.drawText(clean(name), {
        x: MARGIN_X + 8,
        y: baseline + 4,
        size,
        font: this.fonts.script,
        color: BLACK,
        rotate: degrees(2),
      });
    } else {
      this.page.drawText("NON SIGNÉ", {
        x: MARGIN_X + 8,
        y: baseline + 6,
        size: 8.5,
        font: this.fonts.bold,
        color: GREY,
      });
    }
    this.page.drawLine({
      start: { x: MARGIN_X, y: baseline },
      end: { x: MARGIN_X + this.width * 0.6, y: baseline },
      thickness: 0.6,
      color: GREY,
      dashArray: [3, 2],
    });
    this.y -= height;
  }
}

// --- Annexes -----------------------------------------------------------

type PreparedAttachment = {
  meta: PdfAttachment;
  status: string;
  unreadable?: boolean;
  image?: PDFImage;
  pdf?: PDFDocument;
};

function isPdf(a: PdfAttachment) {
  return a.typeMime === "application/pdf" || /\.pdf$/i.test(a.nom);
}

function isImage(a: PdfAttachment) {
  return a.typeMime.startsWith("image/");
}

// Toute image lisible par le navigateur → PNG (et réduite si énorme).
async function rasterize(blob: Blob): Promise<Uint8Array> {
  const bitmap = await createImageBitmap(blob);
  const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const png = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!png) throw new Error("png");
  return new Uint8Array(await png.arrayBuffer());
}

async function embedImage(doc: PDFDocument, blob: Blob, mime: string): Promise<PDFImage> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  try {
    if (mime === "image/jpeg") {
      const image = await doc.embedJpg(bytes);
      if (Math.max(image.width, image.height) <= MAX_IMAGE_SIDE) return image;
    } else if (mime === "image/png") {
      const image = await doc.embedPng(bytes);
      if (Math.max(image.width, image.height) <= MAX_IMAGE_SIDE) return image;
    }
  } catch {
    // Format non géré directement (ou variante exotique) : conversion.
  }
  return doc.embedPng(await rasterize(blob));
}

async function prepareAttachment(doc: PDFDocument, meta: PdfAttachment): Promise<PreparedAttachment> {
  const unreadable = { meta, status: "Fichier non intégré : illisible", unreadable: true };
  if (!isImage(meta) && !isPdf(meta)) {
    return { meta, status: "Fichier non intégré au PDF" };
  }
  if (!meta.url) return unreadable;
  try {
    const res = await fetch(meta.url);
    if (!res.ok) return unreadable;
    const blob = await res.blob();
    if (isPdf(meta)) {
      // Un PDF chiffré / protégé lève une erreur ici → « illisible ».
      const pdf = await PDFDocument.load(await blob.arrayBuffer());
      return { meta, status: `Intégré (${pdf.getPageCount()} page${pdf.getPageCount() > 1 ? "s" : ""})`, pdf };
    }
    const image = await embedImage(doc, blob, meta.typeMime);
    return { meta, status: "Intégré (image)", image };
  } catch {
    return unreadable;
  }
}

function drawImagePage(doc: PDFDocument, fonts: Fonts, image: PDFImage, caption: string) {
  // Orientation de la page selon celle de l'image, pour la remplir au
  // mieux sans la déformer.
  const landscape = image.width > image.height;
  const page = doc.addPage(landscape ? [A4[1], A4[0]] : A4);
  const { width, height } = page.getSize();
  const captionSpace = 28;
  const boxW = width - MARGIN_X * 2;
  const boxH = height - MARGIN_TOP - MARGIN_BOTTOM - captionSpace;
  const scale = Math.min(boxW / image.width, boxH / image.height);
  const w = image.width * scale;
  const h = image.height * scale;
  const x = (width - w) / 2;
  const y = MARGIN_BOTTOM + captionSpace + (boxH - h) / 2;
  page.drawImage(image, { x, y, width: w, height: h });

  const text = wrap(caption, fonts.regular, 9, boxW)[0] ?? "";
  page.drawText(text, {
    x: (width - fonts.regular.widthOfTextAtSize(text, 9)) / 2,
    y: MARGIN_BOTTOM + 8,
    size: 9,
    font: fonts.regular,
    color: DARK,
  });
}

// --- Document -------------------------------------------------------------

export async function buildArchivePdf(
  data: ArchivePdfData,
  onProgress: PdfProgress,
): Promise<PdfResult> {
  onProgress("Chargement des polices…");
  const [regularBytes, boldBytes, scriptBytes] = await loadFontFiles();

  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const fonts: Fonts = {
    regular: await doc.embedFont(regularBytes, { subset: true }),
    bold: await doc.embedFont(boldBytes, { subset: true }),
    script: await doc.embedFont(scriptBytes, { subset: true }),
  };
  doc.setTitle(`${data.typeLabel} ${data.numeroLabel}`);
  doc.setCreator("S.A.S.P - MDT");
  doc.setProducer("S.A.S.P - MDT");

  onProgress("Mise en page du document…");
  const w = new Writer(doc, fonts);

  // 1. En-tête
  w.text("S.A.S.P - MDT", { size: 11, font: fonts.bold, color: GREY });
  w.gap(2);
  w.text(`${data.typeLabel} ${data.numeroLabel}`, { size: 20, font: fonts.bold, lineGap: 1.3 });
  w.text(`Rédigé le ${data.dateRedaction}`, { size: 10, color: DARK });
  if (data.estTest) {
    w.text("Document d'entraînement (mode test) : sans valeur officielle.", { size: 9.5, font: fonts.bold, color: DARK });
  }
  if (data.enCorbeille) {
    w.text("Document placé en corbeille au moment de l'export.", { size: 9.5, font: fonts.bold, color: DARK });
  }
  w.rule(BLACK);
  w.gap(6);

  // 2. Champs du modèle, dans l'ordre
  for (const field of data.fields) {
    w.label(field.label);
    if (field.kind === "text") {
      w.text(field.value);
    } else if (field.kind === "list") {
      if (field.items.length === 0) w.text("—");
      for (const item of field.items) w.text(`•  ${item}`, { indent: 4 });
    } else {
      w.signature(field.name);
    }
    w.gap(10);
  }

  // 3. Détail des infractions + totaux (rapport)
  if (data.infractions) {
    w.ensure(60);
    w.rule();
    w.gap(4);
    w.text("DÉTAIL DES INFRACTIONS", { size: 11, font: fonts.bold });
    w.gap(4);
    if (data.infractions.lines.length === 0) {
      w.text("Aucune infraction.", { color: DARK });
    }
    for (const line of data.infractions.lines) {
      w.ensure(10.5 * 1.4 * 2);
      w.text(`Art. ${line.numeroArticle}  ·  Catégorie ${line.categorie}`, { size: 9.5, font: fonts.bold });
      w.text(line.titre, { indent: 10 });
      if (line.montantCalcule) {
        w.text(`Montant calculé : ${line.montantCalcule}`, { indent: 10, size: 9.5, color: DARK });
      }
      w.gap(5);
    }
    w.gap(4);
    w.ensure(3 * 10.5 * 1.4 + 16);
    w.rule();
    w.text(`Amende minimum totale : ${data.infractions.amendeMin}`, { font: fonts.bold });
    w.text(`Amende maximum totale : ${data.infractions.amendeMax}`, { font: fonts.bold });
    w.text(`Temps de prison total : ${data.infractions.prison}`, { font: fonts.bold });
  }

  // Annexes (documents officiels uniquement)
  const unreadable: string[] = [];
  if (!data.estTest && data.attachments.length > 0) {
    const prepared: PreparedAttachment[] = [];
    for (const [index, meta] of data.attachments.entries()) {
      onProgress(`Pièces jointes ${index + 1}/${data.attachments.length}…`);
      const item = await prepareAttachment(doc, meta);
      if (item.unreadable) unreadable.push(meta.nom);
      prepared.push(item);
    }

    onProgress("Assemblage des annexes…");
    w.newPage();
    w.text("ANNEXES", { size: 18, font: fonts.bold, lineGap: 1.3 });
    w.text(`${data.attachments.length} pièce${data.attachments.length > 1 ? "s" : ""} jointe${data.attachments.length > 1 ? "s" : ""}`, { size: 10, color: DARK });
    w.rule(BLACK);
    w.gap(4);
    for (const [index, item] of prepared.entries()) {
      w.ensure(4 * 10 * 1.4);
      w.text(`${index + 1}. ${item.meta.nom}`, { font: fonts.bold, size: 10 });
      w.text(`Type : ${item.meta.typeMime}  ·  Taille : ${item.meta.taille}`, { size: 9, color: DARK, indent: 12 });
      w.text(`Ajouté le ${item.meta.ajouteLe} par ${item.meta.ajoutePar}`, { size: 9, color: DARK, indent: 12 });
      w.text(item.status, { size: 9, font: fonts.bold, color: DARK, indent: 12 });
      w.gap(6);
    }

    for (const item of prepared) {
      if (item.image) {
        drawImagePage(doc, fonts, item.image, item.meta.nom);
      } else if (item.pdf) {
        try {
          const pages = await doc.copyPages(item.pdf, item.pdf.getPageIndices());
          for (const page of pages) doc.addPage(page);
        } catch {
          unreadable.push(item.meta.nom);
        }
      }
    }
  }

  onProgress("Finalisation…");
  const pages = doc.getPages();
  const footerLeft = `Généré le ${data.generatedAt} par ${data.generatedBy}`;
  pages.forEach((page, index) => {
    const { width, height } = page.getSize();

    // Filigrane « TEST » en diagonale (mode test).
    if (data.estTest) {
      const size = Math.min(width, height) * 0.32;
      const textWidth = fonts.bold.widthOfTextAtSize("TEST", size);
      const angle = Math.atan2(height, width);
      page.drawText("TEST", {
        x: width / 2 - (Math.cos(angle) * textWidth) / 2 + (Math.sin(angle) * size) / 3,
        y: height / 2 - (Math.sin(angle) * textWidth) / 2 - (Math.cos(angle) * size) / 3,
        size,
        font: fonts.bold,
        color: rgb(0.55, 0.55, 0.55),
        opacity: 0.18,
        rotate: degrees((angle * 180) / Math.PI),
      });
    }

    // Pied de page sur chaque page, annexes comprises.
    const right = `Page ${index + 1} sur ${pages.length}`;
    page.drawLine({
      start: { x: MARGIN_X, y: 42 },
      end: { x: width - MARGIN_X, y: 42 },
      thickness: 0.5,
      color: RULE,
    });
    page.drawText(footerLeft, { x: MARGIN_X, y: 30, size: 8, font: fonts.regular, color: GREY });
    page.drawText(right, {
      x: width - MARGIN_X - fonts.regular.widthOfTextAtSize(right, 8),
      y: 30,
      size: 8,
      font: fonts.regular,
      color: GREY,
    });
  });

  return { bytes: await doc.save(), unreadable };
}
