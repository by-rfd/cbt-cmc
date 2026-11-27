import { Soal } from "../types";

export type OpsiKey = "A" | "B" | "C" | "D" | "E";

export interface ParsedSoalItem {
  numberHint?: number;
  teks: string;
  gambarUrl?: string;
  opsi: {
    A: string;
    B: string;
    C: string;
    D: string;
    E: string;
  };
  opsiGambar?: Partial<Record<OpsiKey, string>>;
  kunci: OpsiKey;
}

export interface SkippedSoalDiagnostic {
  index: number;
  preview: string;
  reason: string;
}

export interface MassSoalParseResult {
  questions: ParsedSoalItem[];
  skipped: SkippedSoalDiagnostic[];
  totalBlocks: number;
}

const ARABIC_DIGIT_MAP: Record<string, string> = {
  "٠": "0",
  "١": "1",
  "٢": "2",
  "٣": "3",
  "٤": "4",
  "٥": "5",
  "٦": "6",
  "٧": "7",
  "٨": "8",
  "٩": "9",
  "۰": "0",
  "۱": "1",
  "۲": "2",
  "۳": "3",
  "۴": "4",
  "۵": "5",
  "۶": "6",
  "۷": "7",
  "۸": "8",
  "۹": "9",
};

const ARABIC_OPT_TO_LATIN: Record<string, OpsiKey> = {
  أ: "A",
  ا: "A",
  إ: "A",
  آ: "A",
  ب: "B",
  ج: "C",
  د: "D",
  هـ: "E",
  ه: "E",
  و: "E",
};

// Strip Unicode directional controls, zero-width spaces, and formatting markers ONLY for structural prefix inspection
function stripBidiControls(str: string): string {
  return str
    .replace(/[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF\u061C]/g, "")
    .replace(/\[\[\/?U\]\]|<\/?u>/gi, "");
}

function normalizeDigits(str: string): string {
  return str.replace(/[٠-٩۰-۹]/g, (ch) => ARABIC_DIGIT_MAP[ch] ?? ch);
}

export function extractImageTokens(text: string): { cleanText: string; images: string[] } {
  const images: string[] = [];
  const cleanText = text
    .replace(/\[\[IMG_TOKEN:(data:image\/[^\]]+|https?:\/\/[^\]]+)\]\]/g, (_m, url) => {
      images.push(url.trim());
      return "";
    })
    .replace(/[ \t]+$/gm, "")
    .trim();
  return { cleanText, images };
}

function mapKeyTokenToLatin(raw: string): OpsiKey | null {
  const cleaned = stripBidiControls(raw).trim();
  if (!cleaned) return null;
  if (ARABIC_OPT_TO_LATIN[cleaned]) return ARABIC_OPT_TO_LATIN[cleaned];
  const upper = cleaned.toUpperCase();
  if (upper === "A" || upper === "B" || upper === "C" || upper === "D" || upper === "E") {
    return upper;
  }
  return null;
}

// Match an option line prefix strictly (so English sentences like "A dog barked" are NEVER treated as Option A!)
interface OptionLineMatch {
  key: OpsiKey;
  rest: string;
  isStarred: boolean;
}

function matchSingleOptionPrefix(rawLine: string): OptionLineMatch | null {
  const line = stripBidiControls(rawLine).trimStart();
  if (!line || line.startsWith("[[TABLE]]")) return null;

  // Star/asterisk marking answer key: "*A. ...", "**A.** ...", "A*. ..."
  const starLatin = line.match(
    /^\*{1,2}\s*\[?\(?([A-E])\)?\]?\s*[\.\)\-:]?\s*(.*)$/i
  ) || line.match(/^\(?([A-E])\)?\*\s*[\.\)\-:]\s*(.*)$/i);
  if (starLatin) {
    const rest = starLatin[2].replace(/^\*{1,2}\s*/, "").trim();
    return { key: starLatin[1].toUpperCase() as OpsiKey, rest, isStarred: true };
  }

  // Bracketed or parenthesized Latin options: "(A) ...", "[A] ...", "A. ...", "a) ...", "A: ..."
  // Also allow "A\t..." (tab separated from Word tables)
  const latinMatch =
    line.match(/^[\(\[]([A-E])[\)\]]\s*[\.\-:]?\s*(.*)$/i) ||
    line.match(/^([A-E])\s*[\.\)\:]\s*(.*)$/i) ||
    line.match(/^([A-E])\t+(.*)$/i) ||
    line.match(/^([A-E])\s+\-\s+(.*)$/);
  if (latinMatch) {
    return {
      key: latinMatch[1].toUpperCase() as OpsiKey,
      rest: (latinMatch[2] || "").trim(),
      isStarred: false,
    };
  }

  // Arabic option letters: أ. ب. ج. د. هـ. (or with ), -, :, brackets, or optional asterisk)
  const arabicStar = line.match(
    /^\*{1,2}\s*[\(\[]?(أ|ا|إ|آ|ب|ج|د|هـ|ه|و)[\)\]]?\s*[\.\)\-:]?\s*(.*)$/
  );
  if (arabicStar) {
    const mapped = ARABIC_OPT_TO_LATIN[arabicStar[1]];
    if (mapped) {
      return { key: mapped, rest: (arabicStar[2] || "").trim(), isStarred: true };
    }
  }

  const arabicMatch = line.match(
    /^[\(\[]?(أ|ا|إ|آ|ب|ج|د|هـ|ه|و)[\)\]]?\s*(?:[\.\)\-:\t]|(?<=[\)\]أابجدهو])\s*[\.\)\-:])\s*(.*)$/
  ) || line.match(/^(أ|ب|ج|د|هـ)\s*[\.\)\-:]\s*(.*)$/);
  if (arabicMatch) {
    const mapped = ARABIC_OPT_TO_LATIN[arabicMatch[1]];
    if (mapped) {
      return { key: mapped, rest: (arabicMatch[2] || "").trim(), isStarred: false };
    }
  }

  return null;
}

// Split a line that packs multiple options horizontally (e.g., "A. 10 cm   B. 20 cm   C. 30 cm" or Word table tabs)
function splitInlineMultiOptions(line: string): string[] {
  const check = stripBidiControls(line);
  // Look for 2+ option markers separated by whitespace/tabs where at least B follows A, or D follows C, etc.
  const hasTabOptions = /\t\s*(?:\*?\s*)?(?:[\(\[]?[B-E][\)\]]?[\.\)\-:\t]|(?:أ|ب|ج|د|هـ)[\.\)\-:])/i.test(check);
  const hasSpacedOptions = /\s{2,}(?:\*?\s*)?(?:[\(\[]?[B-E][\)\]]?[\.\)\-:]|(?:ب|ج|د|هـ)[\.\)\-:])/i.test(check);
  const hasDirectSeq = /(?:^|\s)\(?A\)?[\.\)]\s+.+\s+\(?B\)?[\.\)]\s+/i.test(check);

  if (!hasTabOptions && !hasSpacedOptions && !hasDirectSeq) {
    return [line];
  }

  // Tokenize at boundaries preceding an option marker separated by tab or 2+ spaces, or single space before uppercase B./C./D./E. or (b)-(e)
  const parts: string[] = [];
  let lastIdx = 0;
  let match: RegExpExecArray | null;
  const normalized = line;

  const boundaryRe =
    /(?:\t+|\s{2,}|\s+(?=\*?(?:\([B-Eb-e]\)|\[[B-Eb-e]\]|[B-E][\.\)])\s))(?=\*?(?:[\(\[]?[A-Ea-e][\)\]]?[\.\)\-:\t\s]|(?:أ|ب|ج|د|هـ)[\.\)\-:]))/g;

  while ((match = boundaryRe.exec(normalized)) !== null) {
    const piece = normalized.slice(lastIdx, match.index).trim();
    if (piece) parts.push(piece);
    lastIdx = match.index + match[0].length;
  }
  const tail = normalized.slice(lastIdx).trim();
  if (tail) parts.push(tail);

  // Only accept multi-split if at least 2 resulting pieces look like valid option prefixes
  if (parts.length >= 2 && parts.filter((p) => matchSingleOptionPrefix(p) !== null).length >= 2) {
    return parts;
  }
  return [line];
}

// Match question start ONLY at line beginning
function matchQuestionStart(rawLine: string): { num: number | null; rest: string; isExplicitSeparator: boolean } | null {
  const clean = stripBidiControls(rawLine).trimStart();
  if (!clean || clean.startsWith("[[TABLE]]")) return null;

  // Explicit separators: === or --- or [Soal] or [Soal 1]
  if (/^={3,}/.test(clean) || /^-{4,}/.test(clean) || /^\[Soal(?:\s*\d+)?\]/i.test(clean)) {
    const rest = clean.replace(/^={3,}|^-{4,}|^\[Soal(?:\s*\d+)?\]\s*/i, "").trim();
    return { num: null, rest, isExplicitSeparator: true };
  }

  const digitNorm = normalizeDigits(clean);

  // Decimal numbers like 3.14 or years like "1945 merupakan..." MUST NOT start a question unless followed by "." or ")" + space
  // Patterns:
  // "1. Text", "1) Text", "01. Text", "No. 1. Text", "No 1: Text", "Soal 1. Text", "Soal No. 1) Text", "1.- Text"
  const qMatch = digitNorm.match(
    /^(?:(?:Soal\s*(?:No\.?)?\s*|No\.?\s*|س\s*)?)(\d{1,3})\s*(?:[\.\)\:]|\.\-)\s*(.*)$/i
  );
  if (qMatch) {
    const num = parseInt(qMatch[1], 10);
    // Avoid mistaking standalone percentages or years like "2024:" unless small question number (1..300)
    if (num >= 1 && num <= 300) {
      // Recover rest preserving original characters (not digit-normalized body if Arabic numbers inside body!)
      const origPrefixMatch = clean.match(
        /^(?:(?:Soal\s*(?:No\.?)?\s*|No\.?\s*|س\s*)?)[0-9٠-٩۰-۹]{1,3}\s*(?:[\.\)\:]|\.\-)\s*(.*)$/i
      );
      return {
        num,
        rest: origPrefixMatch ? origPrefixMatch[1].trim() : qMatch[2].trim(),
        isExplicitSeparator: false,
      };
    }
  }

  return null;
}

// Parse trailing/standalone answer-key block at bottom of document (e.g., "Kunci Jawaban:\n1. A 2. B 3. C...")
function extractGlobalAnswerKeySection(lines: string[]): {
  contentLines: string[];
  keyMap: Map<number, OpsiKey>;
} {
  const keyMap = new Map<number, OpsiKey>();
  let keyHeaderIdx = -1;

  for (let i = lines.length - 1; i >= Math.max(0, lines.length - 120); i--) {
    const clean = stripBidiControls(lines[i]).trim();
    if (
      /^(?:KUNCI\s*JAWABAN|KUNCI\s*SOAL|DAFTAR\s*KUNCI|ANSWER\s*KEY|KEY\s*ANSWERS|مفتاح\s*الإجابة|الإجابات)\s*[:\-]?\s*$/i.test(
        clean
      )
    ) {
      keyHeaderIdx = i;
      break;
    }
  }

  if (keyHeaderIdx === -1) {
    return { contentLines: lines, keyMap };
  }

  const tailLines = lines.slice(keyHeaderIdx + 1).join("\n");
  const normTail = normalizeDigits(stripBidiControls(tailLines));
  const pairRegex = /(\d{1,3})\s*[\.\)\-:]?\s*([A-E]|أ|ا|إ|آ|ب|ج|د|هـ|ه|و)\b/gi;
  let m: RegExpExecArray | null;
  while ((m = pairRegex.exec(normTail)) !== null) {
    const num = parseInt(m[1], 10);
    const key = mapKeyTokenToLatin(m[2]);
    if (num >= 1 && num <= 500 && key) {
      keyMap.set(num, key);
    }
  }

  if (keyMap.size > 0) {
    return { contentLines: lines.slice(0, keyHeaderIdx), keyMap };
  }
  return { contentLines: lines, keyMap };
}

export function parseMassSoalText(rawInput: string): MassSoalParseResult {
  const normalizedInput = (rawInput || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const rawLines = normalizedInput.split("\n");
  const { contentLines, keyMap: globalKeyMap } = extractGlobalAnswerKeySection(rawLines);

  interface RawBlock {
    numberHint?: number;
    subListNextNum: number | null;
    lines: string[];
  }

  const blocks: RawBlock[] = [];
  let currentBlock: RawBlock | null = null;

  const blockHasOptions = (blk: RawBlock | null): boolean => {
    if (!blk) return false;
    let foundOpts = 0;
    for (const l of blk.lines) {
      if (/^\[?(?:Gambar|Image|Pic|Foto)\s*(?:Opsi)?\s*[A-E]\s*[:=]/i.test(stripBidiControls(l).trim())) {
        foundOpts++;
        continue;
      }
      const expanded = splitInlineMultiOptions(l);
      for (const part of expanded) {
        if (matchSingleOptionPrefix(part)) foundOpts++;
      }
    }
    return foundOpts >= 2;
  };

  for (let i = 0; i < contentLines.length; i++) {
    const line = contentLines[i];
    const trimmed = line.trim();
    if (!trimmed) {
      if (currentBlock && currentBlock.lines.length > 0) {
        currentBlock.lines.push(""); // preserve paragraph break inside block
      }
      continue;
    }

    const qStart = matchQuestionStart(trimmed);

    if (qStart) {
      if (qStart.isExplicitSeparator) {
        if (currentBlock && currentBlock.lines.some((l) => l.trim().length > 0)) {
          blocks.push(currentBlock);
        }
        currentBlock = qStart.rest
          ? { subListNextNum: null, lines: [qStart.rest] }
          : { subListNextNum: null, lines: [] };
        continue;
      }

      const activeBlock = currentBlock as RawBlock | null;
      const curNum = activeBlock?.numberHint;
      const curHasOpts = blockHasOptions(activeBlock);
      const hasStemContent = Boolean(activeBlock?.lines.some((l) => l.trim().length > 0));

      // Sub-point protection: e.g., inside Question 1 ("Perhatikan langkah berikut:\n1. ...\n2. ...\n3. ...")
      // While the current block has NO options yet, numbered sub-items starting at 1..N (1, 2, 3...) belong inside the stem.
      let isLikelySubPointInStem = false;
      if (currentBlock !== null && !curHasOpts && hasStemContent && qStart.num !== null) {
        if (currentBlock.subListNextNum !== null && qStart.num === currentBlock.subListNextNum) {
          isLikelySubPointInStem = true;
          currentBlock.subListNextNum = qStart.num + 1;
        } else if (curNum !== undefined && qStart.num === 1) {
          isLikelySubPointInStem = true;
          currentBlock.subListNextNum = 2;
        } else if (curNum !== undefined && qStart.num <= curNum && qStart.num !== curNum + 1) {
          isLikelySubPointInStem = true;
          currentBlock.subListNextNum = qStart.num + 1;
        }
      }

      if (!isLikelySubPointInStem) {
        if (currentBlock && hasStemContent) {
          blocks.push(currentBlock);
        }
        currentBlock = {
          numberHint: qStart.num ?? undefined,
          subListNextNum: null,
          lines: qStart.rest ? [qStart.rest] : [],
        };
        continue;
      }
    }

    if (!currentBlock) {
      currentBlock = { subListNextNum: null, lines: [trimmed] };
    } else {
      currentBlock.lines.push(trimmed);
    }
  }

  if (currentBlock && currentBlock.lines.some((l) => l.trim().length > 0)) {
    blocks.push(currentBlock);
  }

  const parsedQuestions: ParsedSoalItem[] = [];
  const skipped: SkippedSoalDiagnostic[] = [];

  blocks.forEach((blk, bIdx) => {
    const expandedLines: string[] = [];
    blk.lines.forEach((l) => {
      if (!l.trim()) {
        expandedLines.push("");
      } else {
        splitInlineMultiOptions(l).forEach((part) => expandedLines.push(part));
      }
    });

    let teks = "";
    const opsiObj: Record<OpsiKey, string> = { A: "", B: "", C: "", D: "", E: "" };
    const opsiGambar: Partial<Record<OpsiKey, string>> = {};
    let kunci: OpsiKey | null = null;
    let gambarUrl = "";
    let currentTarget: "teks" | OpsiKey | "kunci" = "teks";

    for (const rawLine of expandedLines) {
      const textLine = rawLine.trim();
      if (!textLine) {
        if (currentTarget === "teks" && teks) {
          teks += "\n";
        }
        continue;
      }

      const cleanCheck = stripBidiControls(textLine);

      // 1. Option image tag: GambarA: ..., GambarOpsiA: ..., [GambarA: ...]
      const matchOptGambar = cleanCheck.match(
        /^\[?(?:Gambar|Image|Pic|Foto)\s*(?:Opsi)?\s*([A-E])\s*[:=]\s*([^\]]+)\]?$/i
      );
      if (matchOptGambar) {
        const optKey = matchOptGambar[1].toUpperCase() as OpsiKey;
        const url = matchOptGambar[2].trim();
        if (url) opsiGambar[optKey] = url;
        continue;
      }

      // 2. Question image tag: Gambar: ..., [Gambar: ...], Image: ...
      const matchSoalGambar = cleanCheck.match(
        /^\[?(?:Gambar|Image|Pic|Foto|Media)\s*[:=]\s*([^\]]+)\]?$/i
      );
      if (matchSoalGambar) {
        const url = matchSoalGambar[1].trim();
        if (url) gambarUrl = url;
        continue;
      }

      // 3. Answer key line (Indonesian, English, Arabic)
      const matchKunci = cleanCheck.match(
        /^(?:\[)?(?:Kunci\s*Jawaban|Kunci|Jawaban|Jawab|Key|Answer|Ans|الإجابة\s*الصحيحة|الإجابة|الاجابة|الجواب|المفتاح|صحيح)\s*[:\-=]?\s*[\(\[]?([A-E]|أ|ا|إ|آ|ب|ج|د|هـ|ه|و)[\)\]]?\s*\.?\]?$/i
      );
      if (matchKunci) {
        const mapped = mapKeyTokenToLatin(matchKunci[1]);
        if (mapped) {
          kunci = mapped;
          currentTarget = "kunci";
          continue;
        }
      }

      // Inline [Kunci: A] at end of a line
      const inlineKunciMatch = textLine.match(
        /\s*[\[\(](?:Kunci|Jawaban|Key|Ans)\s*[:\-]?\s*([A-E]|أ|ب|ج|د|هـ)[\]\)]\s*$/i
      );
      let workingLine = textLine;
      if (inlineKunciMatch) {
        const mapped = mapKeyTokenToLatin(inlineKunciMatch[1]);
        if (mapped) kunci = mapped;
        workingLine = textLine.slice(0, inlineKunciMatch.index).trim();
        if (!workingLine) continue;
      }

      // 4. Option line match (A-E or Arabic أ ب ج د هـ)
      const optMatch = matchSingleOptionPrefix(workingLine);
      if (optMatch) {
        const { cleanText, images } = extractImageTokens(optMatch.rest);
        opsiObj[optMatch.key] = cleanText;
        if (images.length > 0 && !opsiGambar[optMatch.key]) {
          opsiGambar[optMatch.key] = images[0];
        }
        if (optMatch.isStarred && !kunci) {
          kunci = optMatch.key;
        }
        currentTarget = optMatch.key;
        continue;
      }

      // 5. Append continuation text or inline [[IMG_TOKEN:...]] to current section
      const { cleanText, images } = extractImageTokens(workingLine);
      if (currentTarget === "teks") {
        if (images.length > 0 && !gambarUrl) {
          gambarUrl = images[0];
        }
        if (cleanText) {
          teks = teks ? `${teks}\n${cleanText}` : cleanText;
        }
      } else if (currentTarget !== "kunci") {
        if (images.length > 0 && !opsiGambar[currentTarget]) {
          opsiGambar[currentTarget] = images[0];
        }
        if (cleanText) {
          opsiObj[currentTarget] = opsiObj[currentTarget]
            ? `${opsiObj[currentTarget]}\n${cleanText}`
            : cleanText;
        }
      }
    }

    // Extract any lingering IMG_TOKEN inside teks
    const teksExtracted = extractImageTokens(teks);
    teks = teksExtracted.cleanText.replace(/\n{3,}/g, "\n\n").trim();
    if (!gambarUrl && teksExtracted.images.length > 0) {
      gambarUrl = teksExtracted.images[0];
    }

    // Resolve global answer key if question-level key was not specified
    if (!kunci && blk.numberHint && globalKeyMap.has(blk.numberHint)) {
      kunci = globalKeyMap.get(blk.numberHint)!;
    } else if (!kunci && globalKeyMap.has(bIdx + 1)) {
      kunci = globalKeyMap.get(bIdx + 1)!;
    }

    const hasA = Boolean(opsiObj.A.trim() || opsiGambar.A);
    const hasB = Boolean(opsiObj.B.trim() || opsiGambar.B);
    const hasStem = Boolean(teks || gambarUrl);

    if (hasStem && hasA && hasB) {
      const candidate: ParsedSoalItem = {
        numberHint: blk.numberHint ?? bIdx + 1,
        teks: teks || "(Lihat gambar soal di atas)",
        opsi: {
          A: opsiObj.A.trim(),
          B: opsiObj.B.trim(),
          C: opsiObj.C.trim(),
          D: opsiObj.D.trim(),
          E: opsiObj.E.trim(),
        },
        kunci: kunci || "A",
      };
      if (gambarUrl) candidate.gambarUrl = gambarUrl;
      if (Object.keys(opsiGambar).length > 0) candidate.opsiGambar = opsiGambar;
      parsedQuestions.push(candidate);
    } else {
      const reasons: string[] = [];
      if (!hasStem) reasons.push("teks/gambar pertanyaan kosong");
      if (!hasA) reasons.push("opsi A tidak ditemukan");
      if (!hasB) reasons.push("opsi B tidak ditemukan");
      skipped.push({
        index: blk.numberHint ?? bIdx + 1,
        preview: blk.lines.filter((l) => l.trim()).slice(0, 2).join(" | ").slice(0, 120),
        reason: reasons.join(", "),
      });
    }
  });

  return {
    questions: parsedQuestions,
    skipped,
    totalBlocks: blocks.length,
  };
}

export function buildSoalObjectsFromParsed(
  items: ParsedSoalItem[],
  params: {
    mapelId: string;
    guruId?: string;
    kelasIds?: string[];
    idPrefix?: string;
  }
): Soal[] {
  const prefix = params.idPrefix || "soal_mass_";
  const now = Date.now();
  return items.map((item, idx) => {
    const paddedIdx = String(idx).padStart(4, "0");
    const soal: Soal = {
      id: `${prefix}${now}_${paddedIdx}_${Math.random().toString(36).slice(2, 7)}`,
      mapelId: params.mapelId,
      teks: item.teks,
      opsi: { ...item.opsi },
      kunci: item.kunci,
      kelasIds: [...(params.kelasIds || [])],
      urutan: idx + 1,
    };
    if (params.guruId) soal.guruId = params.guruId;
    if (item.gambarUrl) soal.gambarUrl = item.gambarUrl;
    if (item.opsiGambar && Object.keys(item.opsiGambar).length > 0) {
      soal.opsiGambar = { ...item.opsiGambar };
    }
    return soal;
  });
}
