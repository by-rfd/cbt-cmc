import JSZip from "jszip";
import { compressImageBlobToDataUrl } from "./imageUtils";
import { parseMassSoalText, MassSoalParseResult } from "./massSoalParser";

// Convert Word OMML (<m:oMath> / <m:oMathPara>) into clean LaTeX for KaTeX rendering
const OMML_NS = "http://schemas.openxmlformats.org/officeDocument/2006/math";
const W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

function getChildrenByLocalName(el: Element, localName: string): Element[] {
  const res: Element[] = [];
  for (let i = 0; i < el.childNodes.length; i++) {
    const node = el.childNodes[i];
    if (node.nodeType === 1 && (node as Element).localName === localName) {
      res.push(node as Element);
    }
  }
  return res;
}

function getFirstChildByLocalName(el: Element, localName: string): Element | null {
  for (let i = 0; i < el.childNodes.length; i++) {
    const node = el.childNodes[i];
    if (node.nodeType === 1 && (node as Element).localName === localName) {
      return node as Element;
    }
  }
  return null;
}

function getAttr(el: Element, attrName: string): string {
  return (
    el.getAttribute(`m:${attrName}`) ||
    el.getAttribute(`w:${attrName}`) ||
    el.getAttributeNS(OMML_NS, attrName) ||
    el.getAttributeNS(W_NS, attrName) ||
    el.getAttribute(attrName) ||
    ""
  );
}

const UNICODE_MATH_TO_LATEX: Record<string, string> = {
  "×": "\\times ",
  "÷": "\\div ",
  "±": "\\pm ",
  "∓": "\\mp ",
  "≤": "\\leq ",
  "≥": "\\geq ",
  "≠": "\\neq ",
  "≈": "\\approx ",
  "≡": "\\equiv ",
  "∞": "\\infty ",
  "∑": "\\sum ",
  "∏": "\\prod ",
  "∫": "\\int ",
  "∬": "\\iint ",
  "∮": "\\oint ",
  "√": "\\sqrt",
  "∂": "\\partial ",
  "∇": "\\nabla ",
  "∈": "\\in ",
  "∉": "\\notin ",
  "⊂": "\\subset ",
  "⊆": "\\subseteq ",
  "∪": "\\cup ",
  "∩": "\\cap ",
  "∅": "\\emptyset ",
  "∀": "\\forall ",
  "∃": "\\exists ",
  "→": "\\rightarrow ",
  "←": "\\leftarrow ",
  "↔": "\\leftrightarrow ",
  "⇒": "\\Rightarrow ",
  "⇔": "\\Leftrightarrow ",
  "°": "^\\circ ",
  "π": "\\pi ",
  "α": "\\alpha ",
  "β": "\\beta ",
  "γ": "\\gamma ",
  "δ": "\\delta ",
  "θ": "\\theta ",
  "λ": "\\lambda ",
  "μ": "\\mu ",
  "σ": "\\sigma ",
  "φ": "\\phi ",
  "ω": "\\omega ",
  "Δ": "\\Delta ",
  "Σ": "\\Sigma ",
  "Ω": "\\Omega ",
  "·": "\\cdot ",
  "⋅": "\\cdot ",
};

function sanitizeMathText(raw: string): string {
  let out = "";
  for (const ch of raw) {
    out += UNICODE_MATH_TO_LATEX[ch] ?? ch;
  }
  return out;
}

function ommlNodeToLatex(node: Element): string {
  const name = node.localName;

  if (name === "oMathPara") {
    return getChildrenByLocalName(node, "oMath").map(ommlNodeToLatex).join(" ");
  }

  if (name === "oMath" || name === "e" || name === "num" || name === "den" || name === "sup" || name === "sub" || name === "deg" || name === "lim") {
    let acc = "";
    for (let i = 0; i < node.childNodes.length; i++) {
      const ch = node.childNodes[i];
      if (ch.nodeType === 1) acc += ommlNodeToLatex(ch as Element);
    }
    return acc;
  }

  if (name === "r") {
    const tList = getChildrenByLocalName(node, "t");
    if (tList.length > 0) {
      return sanitizeMathText(tList.map((t) => t.textContent || "").join(""));
    }
    return sanitizeMathText(node.textContent || "");
  }

  if (name === "f") {
    const numEl = getFirstChildByLocalName(node, "num");
    const denEl = getFirstChildByLocalName(node, "den");
    const num = numEl ? ommlNodeToLatex(numEl).trim() : "";
    const den = denEl ? ommlNodeToLatex(denEl).trim() : "";
    return `\\frac{${num}}{${den}}`;
  }

  if (name === "sSup") {
    const eEl = getFirstChildByLocalName(node, "e");
    const supEl = getFirstChildByLocalName(node, "sup");
    const base = eEl ? ommlNodeToLatex(eEl).trim() : "";
    const sup = supEl ? ommlNodeToLatex(supEl).trim() : "";
    return `${base}^{${sup}}`;
  }

  if (name === "sSub") {
    const eEl = getFirstChildByLocalName(node, "e");
    const subEl = getFirstChildByLocalName(node, "sub");
    const base = eEl ? ommlNodeToLatex(eEl).trim() : "";
    const sub = subEl ? ommlNodeToLatex(subEl).trim() : "";
    return `${base}_{${sub}}`;
  }

  if (name === "sSubSup") {
    const eEl = getFirstChildByLocalName(node, "e");
    const subEl = getFirstChildByLocalName(node, "sub");
    const supEl = getFirstChildByLocalName(node, "sup");
    const base = eEl ? ommlNodeToLatex(eEl).trim() : "";
    const sub = subEl ? ommlNodeToLatex(subEl).trim() : "";
    const sup = supEl ? ommlNodeToLatex(supEl).trim() : "";
    return `${base}_{${sub}}^{${sup}}`;
  }

  if (name === "rad") {
    const degEl = getFirstChildByLocalName(node, "deg");
    const eEl = getFirstChildByLocalName(node, "e");
    const deg = degEl ? ommlNodeToLatex(degEl).trim() : "";
    const inner = eEl ? ommlNodeToLatex(eEl).trim() : "";
    return deg ? `\\sqrt[${deg}]{${inner}}` : `\\sqrt{${inner}}`;
  }

  if (name === "nary") {
    const pr = getFirstChildByLocalName(node, "naryPr");
    const chrEl = pr ? getFirstChildByLocalName(pr, "chr") : null;
    const chr = chrEl ? getAttr(chrEl, "val") : "∫";
    let op = "\\int";
    if (chr === "∑") op = "\\sum";
    else if (chr === "∏") op = "\\prod";
    else if (chr === "∮") op = "\\oint";
    else if (chr === "∬") op = "\\iint";

    const subEl = getFirstChildByLocalName(node, "sub");
    const supEl = getFirstChildByLocalName(node, "sup");
    const eEl = getFirstChildByLocalName(node, "e");
    const sub = subEl ? ommlNodeToLatex(subEl).trim() : "";
    const sup = supEl ? ommlNodeToLatex(supEl).trim() : "";
    const body = eEl ? ommlNodeToLatex(eEl).trim() : "";
    return `${op}${sub ? `_{${sub}}` : ""}${sup ? `^{${sup}}` : ""} ${body}`;
  }

  if (name === "d") {
    const pr = getFirstChildByLocalName(node, "dPr");
    const begChr = pr ? getFirstChildByLocalName(pr, "begChr") : null;
    const endChr = pr ? getFirstChildByLocalName(pr, "endChr") : null;
    const open = (begChr ? getAttr(begChr, "val") : "(") || "(";
    const close = (endChr ? getAttr(endChr, "val") : ")") || ")";
    const innerList = getChildrenByLocalName(node, "e").map((e) => ommlNodeToLatex(e).trim());
    const safeOpen = open === "{" || open === "}" ? `\\${open}` : open === "|" ? "|" : open;
    const safeClose = close === "{" || close === "}" ? `\\${close}` : close === "|" ? "|" : close;
    return `\\left${safeOpen}${innerList.join(", ")}\\right${safeClose}`;
  }

  if (name === "m") {
    const rows = getChildrenByLocalName(node, "mr").map((mr) =>
      getChildrenByLocalName(mr, "e")
        .map((e) => ommlNodeToLatex(e).trim())
        .join(" & ")
    );
    return `\\begin{matrix} ${rows.join(" \\\\ ")} \\end{matrix}`;
  }

  if (name === "limLow" || name === "limUpp") {
    const eEl = getFirstChildByLocalName(node, "e");
    const limEl = getFirstChildByLocalName(node, "lim");
    const base = eEl ? ommlNodeToLatex(eEl).trim() : "";
    const lim = limEl ? ommlNodeToLatex(limEl).trim() : "";
    const latexBase = base === "lim" ? "\\lim" : base;
    return name === "limLow" ? `${latexBase}_{${lim}}` : `${latexBase}^{${lim}}`;
  }

  if (name === "bar" || name === "acc") {
    const eEl = getFirstChildByLocalName(node, "e");
    const inner = eEl ? ommlNodeToLatex(eEl).trim() : "";
    if (name === "bar") return `\\overline{${inner}}`;
    const pr = getFirstChildByLocalName(node, "accPr");
    const chrEl = pr ? getFirstChildByLocalName(pr, "chr") : null;
    const chr = chrEl ? getAttr(chrEl, "val") : "";
    if (chr.includes("⃗") || chr.includes("→")) return `\\vec{${inner}}`;
    if (chr.includes("^") || chr.includes("̂")) return `\\hat{${inner}}`;
    return `\\bar{${inner}}`;
  }

  if (name === "func") {
    const fNameEl = getFirstChildByLocalName(node, "fName");
    const eEl = getFirstChildByLocalName(node, "e");
    const fName = fNameEl ? ommlNodeToLatex(fNameEl).trim() : "";
    const arg = eEl ? ommlNodeToLatex(eEl).trim() : "";
    const known = ["sin", "cos", "tan", "cot", "sec", "csc", "log", "ln", "lim"];
    const cleanF = known.includes(fName.toLowerCase()) ? `\\${fName.toLowerCase()}` : fName;
    return `${cleanF}\\left(${arg}\\right)`;
  }

  // Fallback: traverse children cleanly skipping Pr elements
  if (name.endsWith("Pr")) return "";
  let fallback = "";
  for (let i = 0; i < node.childNodes.length; i++) {
    const ch = node.childNodes[i];
    if (ch.nodeType === 1) fallback += ommlNodeToLatex(ch as Element);
  }
  return fallback;
}

function getMimeFromExt(path: string): string {
  const lower = path.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".bmp")) return "image/bmp";
  if (lower.endsWith(".svg")) return "image/svg+xml";
  return "image/png";
}

interface NumberingLevelSpec {
  fmt: string; // decimal, upperLetter, lowerLetter, arabicAlpha, arabicAbjad, etc.
  start: number;
  lvlText: string;
}

async function parseDocxNumbering(zip: JSZip): Promise<{
  formatPrefix: (numId: string, ilvl: string) => string;
}> {
  const numberingFile = zip.file("word/numbering.xml");
  const counters = new Map<string, number>();

  if (!numberingFile) {
    return {
      formatPrefix: (numId, ilvl) => {
        const key = `${numId}::${ilvl}`;
        const next = (counters.get(key) || 0) + 1;
        counters.set(key, next);
        return ilvl === "0" ? `${next}. ` : `${String.fromCharCode(64 + ((next - 1) % 5) + 1)}. `;
      },
    };
  }

  const xmlStr = await numberingFile.async("string");
  const doc = new DOMParser().parseFromString(xmlStr, "application/xml");

  const abstractMap = new Map<string, Map<string, NumberingLevelSpec>>();
  const abstractNodes = doc.getElementsByTagNameNS("*", "abstractNum");
  for (let i = 0; i < abstractNodes.length; i++) {
    const absEl = abstractNodes[i];
    const absId = getAttr(absEl, "abstractNumId");
    const lvlMap = new Map<string, NumberingLevelSpec>();
    const lvls = getChildrenByLocalName(absEl, "lvl");
    for (const lvl of lvls) {
      const ilvl = getAttr(lvl, "ilvl") || "0";
      const numFmtEl = getFirstChildByLocalName(lvl, "numFmt");
      const startEl = getFirstChildByLocalName(lvl, "start");
      const lvlTextEl = getFirstChildByLocalName(lvl, "lvlText");
      lvlMap.set(ilvl, {
        fmt: numFmtEl ? getAttr(numFmtEl, "val") : "decimal",
        start: startEl ? parseInt(getAttr(startEl, "val") || "1", 10) || 1 : 1,
        lvlText: lvlTextEl ? getAttr(lvlTextEl, "val") : "%1.",
      });
    }
    if (absId) abstractMap.set(absId, lvlMap);
  }

  const numToAbstract = new Map<string, string>();
  const numNodes = doc.getElementsByTagNameNS("*", "num");
  for (let i = 0; i < numNodes.length; i++) {
    const numEl = numNodes[i];
    const numId = getAttr(numEl, "numId");
    const absIdEl = getFirstChildByLocalName(numEl, "abstractNumId");
    const absId = absIdEl ? getAttr(absIdEl, "val") : "";
    if (numId && absId) numToAbstract.set(numId, absId);
  }

  return {
    formatPrefix: (numId: string, ilvl: string) => {
      const absId = numToAbstract.get(numId);
      const spec = absId ? abstractMap.get(absId)?.get(ilvl) : undefined;
      // Reset deeper sub-level counters when parent ilvl increments
      if (ilvl === "0") {
        counters.forEach((_v, k) => {
          if (k.startsWith(`${numId}::`) && k !== `${numId}::0`) {
            counters.delete(k);
          }
        });
      }
      const key = `${numId}::${ilvl}`;
      const curCount = counters.get(key);
      const val = curCount !== undefined ? curCount + 1 : spec?.start ?? 1;
      counters.set(key, val);

      const fmt = spec?.fmt || (ilvl === "0" ? "decimal" : "upperLetter");
      if (fmt === "bullet") return "";
      if (fmt === "upperLetter") {
        const ch = String.fromCharCode(65 + ((val - 1) % 26));
        return `${ch}. `;
      }
      if (fmt === "lowerLetter") {
        const ch = String.fromCharCode(97 + ((val - 1) % 26));
        return `${ch}. `;
      }
      if (fmt === "arabicAlpha" || fmt === "arabicAbjad") {
        const arab = ["أ", "ب", "ج", "د", "هـ"];
        return `${arab[(val - 1) % arab.length]}. `;
      }
      return `${val}. `;
    },
  };
}

export interface DocxParseOutput {
  rawExtractedText: string;
  parsed: MassSoalParseResult;
  extractedImageCount: number;
}

export async function parseDocxSoalFile(file: File): Promise<DocxParseOutput> {
  const buffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(buffer);

  const docXmlFile = zip.file("word/document.xml");
  if (!docXmlFile) {
    throw new Error("Berkas Word (.docx) tidak valid: word/document.xml tidak ditemukan.");
  }

  // 1. Load relationships -> image data URLs
  const rIdToDataUrl = new Map<string, string>();
  const relsFile = zip.file("word/_rels/document.xml.rels");
  if (relsFile) {
    const relsXml = await relsFile.async("string");
    const relsDoc = new DOMParser().parseFromString(relsXml, "application/xml");
    const relEls = relsDoc.getElementsByTagName("Relationship");
    for (let i = 0; i < relEls.length; i++) {
      const rel = relEls[i];
      const id = rel.getAttribute("Id") || "";
      const type = rel.getAttribute("Type") || "";
      const target = rel.getAttribute("Target") || "";
      if (!id || !target || !type.includes("/image")) continue;

      const normalizedPath = target.startsWith("/")
        ? target.slice(1)
        : target.startsWith("word/")
        ? target
        : `word/${target.replace(/^\.\//, "")}`;

      // Skip WMF/EMF vector blobs which browsers cannot render natively in <img>
      if (normalizedPath.toLowerCase().endsWith(".wmf") || normalizedPath.toLowerCase().endsWith(".emf")) {
        continue;
      }

      const mediaFile = zip.file(normalizedPath);
      if (mediaFile) {
        const uint8 = await mediaFile.async("uint8array");
        const mime = getMimeFromExt(normalizedPath);
        const blob = new Blob([uint8.slice().buffer], { type: mime });
        const compressed = await compressImageBlobToDataUrl(blob, 900, 0.78);
        rIdToDataUrl.set(id, compressed);
      }
    }
  }

  // 2. Prepare numbering helper
  const numbering = await parseDocxNumbering(zip);

  // 3. Parse word/document.xml
  const docXml = await docXmlFile.async("string");
  const xmlDoc = new DOMParser().parseFromString(docXml, "application/xml");
  const body = xmlDoc.getElementsByTagNameNS("*", "body")[0];
  if (!body) {
    throw new Error("Struktur isi dokumen Word tidak ditemukan.");
  }

  const extractParagraphText = (pEl: Element, includeNumPrefix = true): string => {
    let prefix = "";
    if (includeNumPrefix) {
      const pPr = getFirstChildByLocalName(pEl, "pPr");
      const numPr = pPr ? getFirstChildByLocalName(pPr, "numPr") : null;
      if (numPr) {
        const numIdEl = getFirstChildByLocalName(numPr, "numId");
        const ilvlEl = getFirstChildByLocalName(numPr, "ilvl");
        const numId = numIdEl ? getAttr(numIdEl, "val") : "";
        const ilvl = ilvlEl ? getAttr(ilvlEl, "val") : "0";
        if (numId && numId !== "0") {
          prefix = numbering.formatPrefix(numId, ilvl);
        }
      }
    }

    let lineAcc = "";

    const walkInline = (el: Element) => {
      const lname = el.localName;

      if (lname === "oMathPara" || lname === "oMath") {
        const latex = ommlNodeToLatex(el).trim();
        if (latex) {
          lineAcc += ` $${latex}$ `;
        }
        return;
      }

      if (lname === "r") {
        const rPr = getFirstChildByLocalName(el, "rPr");
        const vertAlignEl = rPr ? getFirstChildByLocalName(rPr, "vertAlign") : null;
        const vertAlign = vertAlignEl ? getAttr(vertAlignEl, "val") : "";

        let runText = "";
        for (let i = 0; i < el.childNodes.length; i++) {
          const ch = el.childNodes[i];
          if (ch.nodeType !== 1) continue;
          const chEl = ch as Element;
          if (chEl.localName === "t" || chEl.localName === "delText") {
            runText += chEl.textContent || "";
          } else if (chEl.localName === "tab") {
            runText += "\t";
          } else if (chEl.localName === "br" || chEl.localName === "cr") {
            runText += "\n";
          } else if (chEl.localName === "drawing" || chEl.localName === "pict" || chEl.localName === "object") {
            walkInline(chEl);
          }
        }

        if (runText) {
          if (vertAlign === "superscript") {
            lineAcc += `$^{${runText}}$`;
          } else if (vertAlign === "subscript") {
            lineAcc += `$_{${runText}}$`;
          } else {
            lineAcc += runText;
          }
        }
        return;
      }

      if (lname === "blip") {
        const embedId =
          el.getAttribute("r:embed") ||
          el.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "embed") ||
          "";
        const imgUrl = embedId ? rIdToDataUrl.get(embedId) : undefined;
        if (imgUrl) {
          lineAcc += ` [[IMG_TOKEN:${imgUrl}]] `;
        }
        return;
      }

      if (lname === "imagedata") {
        const rId =
          el.getAttribute("r:id") ||
          el.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id") ||
          "";
        const imgUrl = rId ? rIdToDataUrl.get(rId) : undefined;
        if (imgUrl) {
          lineAcc += ` [[IMG_TOKEN:${imgUrl}]] `;
        }
        return;
      }

      if (lname === "hyperlink" || lname === "sdt" || lname === "sdtContent" || lname === "smartTag" || lname === "ins") {
        for (let i = 0; i < el.childNodes.length; i++) {
          if (el.childNodes[i].nodeType === 1) walkInline(el.childNodes[i] as Element);
        }
        return;
      }

      // Skip hidden AlternateContent fallback to prevent duplicate image/math extraction
      if (lname === "Fallback") return;

      for (let i = 0; i < el.childNodes.length; i++) {
        if (el.childNodes[i].nodeType === 1) walkInline(el.childNodes[i] as Element);
      }
    };

    for (let i = 0; i < pEl.childNodes.length; i++) {
      const ch = pEl.childNodes[i];
      if (ch.nodeType === 1) {
        const chEl = ch as Element;
        if (chEl.localName === "pPr") continue;
        walkInline(chEl);
      }
    }

    const cleaned = lineAcc.replace(/[ ]{2,}/g, " ").trim();
    if (!cleaned) return "";
    // Avoid doubling prefix if teacher already typed "1." or "A." manually alongside Word numbering
    if (prefix && /^(?:\d+[\.\)]|[A-E][\.\)]|[أبجدهـ][\.\)])/i.test(cleaned)) {
      return cleaned;
    }
    return `${prefix}${cleaned}`.trim();
  };

  const outLines: string[] = [];

  for (let i = 0; i < body.childNodes.length; i++) {
    const node = body.childNodes[i];
    if (node.nodeType !== 1) continue;
    const el = node as Element;

    if (el.localName === "p") {
      const txt = extractParagraphText(el, true);
      if (txt) {
        outLines.push(txt);
      }
    } else if (el.localName === "tbl") {
      // Walk Word table rows cleanly:
      // Case A: Header row like [No | Soal | Opsi A | ...] or vertical Q blocks per cell
      const rows = getChildrenByLocalName(el, "tr");
      for (const tr of rows) {
        const cells = getChildrenByLocalName(tr, "tc");
        const cellTexts = cells.map((tc) => {
          const pLines: string[] = [];
          for (let c = 0; c < tc.childNodes.length; c++) {
            const ch = tc.childNodes[c];
            if (ch.nodeType === 1 && (ch as Element).localName === "p") {
              const t = extractParagraphText(ch as Element, true);
              if (t) pLines.push(t);
            }
          }
          return pLines.join("\n");
        }).filter((t) => t.trim().length > 0);

        if (cellTexts.length === 0) continue;

        // If first cell is strictly a number ("1" or "1.") and second cell contains the question content:
        const firstClean = cellTexts[0].trim();
        if (cellTexts.length >= 2 && /^\d{1,3}[\.\)]?$/.test(firstClean)) {
          const qNum = firstClean.replace(/[\.\)]$/, "");
          const restFirst = cellTexts[1];
          const startsWithNum = /^\d{1,3}[\.\)]/.test(restFirst);
          outLines.push(startsWithNum ? restFirst : `${qNum}. ${restFirst}`);
          for (let ci = 2; ci < cellTexts.length; ci++) {
            outLines.push(cellTexts[ci]);
          }
        } else {
          // Multi-cell option row (e.g. ["A.", "Option text + img"] or ["A. ...", "B. ..."])
          const merged = cellTexts.every((c) => !c.includes("\n"))
            ? cellTexts.join("   ")
            : cellTexts.join("\n");
          outLines.push(merged);
        }
      }
    }
  }

  const rawExtractedText = outLines.join("\n");
  const parsed = parseMassSoalText(rawExtractedText);

  return {
    rawExtractedText,
    parsed,
    extractedImageCount: rIdToDataUrl.size,
  };
}
