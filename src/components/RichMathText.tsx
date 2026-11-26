import React from "react";
import katex from "katex";
import "katex/dist/katex.min.css";

interface RichMathTextProps {
  text: string;
  className?: string;
}

const ARABIC_CHAR_REGEX = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
const ARABIC_BASE_LETTER_REGEX = /[\u0621-\u064A\u066E-\u06D3\u06FA-\u06FF\uFB50-\uFDFF\uFE70-\uFEFF]/g;
const LATIN_LETTER_REGEX = /[A-Za-zÀ-ÖØ-öø-ÿ]/g;
const MATH_STRIP_REGEX = /\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\)|\$(?:[^\s$][^$\n]*?[^\s$]|[^\s$0-9])\$/g;

// Match contiguous multi-word Arabic phrases (letters, marks, Arabic digits, Arabic punctuation & connecting spaces)
const ARABIC_PHRASE_REGEX =
  /([\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]+(?:[\s،؛؟«»\-–/]*[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]+)*)/g;

// Match contiguous Latin/Indonesian phrases inside an RTL Arabic line
const LATIN_PHRASE_REGEX =
  /([A-Za-zÀ-ÖØ-öø-ÿ]+(?:[\s.,:;'"\-–/]+[A-Za-zÀ-ÖØ-öø-ÿ0-9]+)*)/g;

export function hasArabicText(text: string): boolean {
  return ARABIC_CHAR_REGEX.test(text || "");
}

/**
 * Determine natural direction ("rtl" or "ltr") for a single line/paragraph,
 * handling pure Arabic, pure Indonesian, mixed Arabic+Indonesian, and numbered lines.
 */
export function getLineDirection(line: string): "rtl" | "ltr" {
  const cleaned = (line || "")
    .replace(MATH_STRIP_REGEX, " ")
    // Strip leading question/option prefixes such as "1.", "(1)", "١.", "A.", "أ."
    .replace(/^\s*(?:\(?[0-9\u0660-\u0669A-Za-z\u0621-\u064A]\s*[.)\]:-]\s*)+/, "")
    .trim();

  if (!cleaned) return "ltr";

  const hasArabic = ARABIC_CHAR_REGEX.test(cleaned);
  if (!hasArabic) return "ltr";

  const latinMatches = cleaned.match(LATIN_LETTER_REGEX);
  if (!latinMatches || latinMatches.length === 0) return "rtl";

  // Check first strong directional character (ignoring punctuation, digits, blanks, parentheses)
  const firstStrongMatch = cleaned.match(
    /[\u0621-\u064A\u066E-\u06D3\u06FA-\u06FF\uFB50-\uFDFF\uFE70-\uFEFFA-Za-zÀ-ÖØ-öø-ÿ]/
  );
  const firstIsLatin = firstStrongMatch ? /[A-Za-zÀ-ÖØ-öø-ÿ]/.test(firstStrongMatch[0]) : false;

  if (firstIsLatin) {
    // Line begins with Indonesian/Latin text (e.g. "Arti kata الكِتَابُ adalah...")
    return "ltr";
  }

  // Line begins with Arabic. Distinguish between:
  // 1) Arabic sentence with parenthetical Indonesian note -> RTL
  // 2) Arabic headword followed by Indonesian translation/definition ("الكتاب artinya..." or "الكتاب = Buku") -> LTR
  const withoutParens = cleaned.replace(/\([^)]*\)/g, " ").trim();
  const latinOutsideParens = withoutParens.match(LATIN_LETTER_REGEX) || [];
  if (latinOutsideParens.length === 0) {
    return "rtl";
  }

  const latinWordsOutside = withoutParens.match(/[A-Za-zÀ-ÖØ-öø-ÿ]{2,}/g) || [];
  const arabicBaseCount = (withoutParens.match(ARABIC_BASE_LETTER_REGEX) || []).length;

  // Patterns like "الكتاب = Buku" or "الكتاب : Buku" or "الكتاب artinya adalah ..."
  if (/^[\u0600-\u06FF\s\u064B-\u065F\u0670]+[=:\-–]\s*[A-Za-zÀ-ÖØ-öø-ÿ]/.test(withoutParens)) {
    return "ltr";
  }

  if (latinWordsOutside.length >= 2 && latinOutsideParens.length > arabicBaseCount * 0.75) {
    return "ltr";
  }

  return "rtl";
}

/**
 * Determine whether a multi-line text block is predominantly Arabic RTL
 * (used for container/badge alignment across question stems and options).
 */
export function isArabicDominant(text: string): boolean {
  if (!text || !hasArabicText(text)) return false;
  const nonEmptyLines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (nonEmptyLines.length === 0) return false;

  let rtlCount = 0;
  let ltrCount = 0;
  for (const line of nonEmptyLines) {
    if (getLineDirection(line) === "rtl") rtlCount++;
    else ltrCount++;
  }

  return rtlCount > ltrCount || (rtlCount === ltrCount && getLineDirection(nonEmptyLines[0]) === "rtl");
}

/**
 * Check if all non-empty text options in a question are Arabic-dominant RTL.
 * When true, option badges (A-E) can be synchronized cleanly on the right side.
 */
export function areAllOptionsArabicRtl(opsi?: Partial<Record<string, string>>): boolean {
  if (!opsi) return false;
  const values = Object.values(opsi)
    .map((v) => (v || "").trim())
    .filter(Boolean);
  return values.length > 0 && values.every((v) => isArabicDominant(v));
}

// Segment string into plain text vs display math ($$...$$, \[...\]) vs inline math ($...$, \(...\))
interface Segment {
  type: "text" | "inline-math" | "display-math";
  content: string;
}

type Paragraph =
  | { kind: "display-math"; content: string }
  | { kind: "line"; parts: Segment[] };

function tokenizeMathSegments(input: string): Segment[] {
  const segments: Segment[] = [];
  // Regex matches $$...$$, \[...\], \(...\), or $...$ (avoiding $100 currency false-positives)
  const mathRe =
    /\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\\\(([\s\S]+?)\\\)|\$([^\s$][^$\n]*?[^\s$]|[^\s$0-9])\$/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = mathRe.exec(input)) !== null) {
    if (match.index > lastIndex) {
      segments.push({
        type: "text",
        content: input.slice(lastIndex, match.index),
      });
    }
    if (match[1] !== undefined) {
      segments.push({ type: "display-math", content: match[1] });
    } else if (match[2] !== undefined) {
      segments.push({ type: "display-math", content: match[2] });
    } else if (match[3] !== undefined) {
      segments.push({ type: "inline-math", content: match[3] });
    } else if (match[4] !== undefined) {
      segments.push({ type: "inline-math", content: match[4] });
    }
    lastIndex = mathRe.lastIndex;
  }

  if (lastIndex < input.length) {
    segments.push({ type: "text", content: input.slice(lastIndex) });
  }

  return segments;
}

function buildParagraphs(segments: Segment[]): Paragraph[] {
  const paragraphs: Paragraph[] = [];
  let currentLine: Segment[] = [];

  const flushLine = () => {
    paragraphs.push({ kind: "line", parts: currentLine });
    currentLine = [];
  };

  for (const seg of segments) {
    if (seg.type === "display-math") {
      if (currentLine.length > 0) flushLine();
      paragraphs.push({ kind: "display-math", content: seg.content });
    } else if (seg.type === "inline-math") {
      currentLine.push(seg);
    } else {
      const splitLines = seg.content.split(/\r?\n/);
      for (let i = 0; i < splitLines.length; i++) {
        if (splitLines[i].length > 0) {
          currentLine.push({ type: "text", content: splitLines[i] });
        }
        if (i < splitLines.length - 1) {
          flushLine();
        }
      }
    }
  }

  if (currentLine.length > 0 || paragraphs.length === 0) {
    flushLine();
  }

  return paragraphs;
}

function renderInlineBidiText(content: string, lineDir: "rtl" | "ltr"): React.ReactNode {
  if (!content) return null;

  if (lineDir === "ltr") {
    if (!hasArabicText(content)) return content;

    const nodes: React.ReactNode[] = [];
    let lastIdx = 0;
    ARABIC_PHRASE_REGEX.lastIndex = 0;
    let m: RegExpExecArray | null;
    let keyIdx = 0;

    while ((m = ARABIC_PHRASE_REGEX.exec(content)) !== null) {
      if (m.index > lastIdx) {
        nodes.push(content.slice(lastIdx, m.index));
      }
      nodes.push(
        <span
          key={`ar-${keyIdx++}`}
          dir="rtl"
          style={{ unicodeBidi: "isolate" }}
          className="font-arabic inline text-[1.18em] leading-[1.8] px-0.5 font-normal"
        >
          {m[0]}
        </span>
      );
      lastIdx = ARABIC_PHRASE_REGEX.lastIndex;
    }

    if (lastIdx < content.length) {
      nodes.push(content.slice(lastIdx));
    }

    return nodes;
  }

  // lineDir === "rtl": isolate inline Latin/Indonesian phrases so punctuation & word order stay intact
  if (!/[A-Za-zÀ-ÖØ-öø-ÿ]/.test(content)) return content;

  const nodes: React.ReactNode[] = [];
  let lastIdx = 0;
  LATIN_PHRASE_REGEX.lastIndex = 0;
  let m: RegExpExecArray | null;
  let keyIdx = 0;

  while ((m = LATIN_PHRASE_REGEX.exec(content)) !== null) {
    if (m.index > lastIdx) {
      nodes.push(content.slice(lastIdx, m.index));
    }
    nodes.push(
      <span
        key={`lat-${keyIdx++}`}
        dir="ltr"
        style={{ unicodeBidi: "isolate" }}
        className="font-sans text-[0.84em] inline px-0.5"
      >
        {m[0]}
      </span>
    );
    lastIdx = LATIN_PHRASE_REGEX.lastIndex;
  }

  if (lastIdx < content.length) {
    nodes.push(content.slice(lastIdx));
  }

  return nodes;
}

function renderKatexSpan(latex: string, displayMode: boolean, key: React.Key) {
  try {
    const html = katex.renderToString(latex, {
      displayMode,
      throwOnError: false,
      strict: false,
    });
    return (
      <span
        key={key}
        dir="ltr"
        style={{ unicodeBidi: "isolate" }}
        className={
          displayMode
            ? "block my-1.5 overflow-x-auto text-center"
            : "inline-block align-middle mx-0.5"
        }
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  } catch {
    return <React.Fragment key={key}>{latex}</React.Fragment>;
  }
}

export default function RichMathText({ text, className = "" }: RichMathTextProps) {
  const sanitizedText = React.useMemo(
    () => (text || "").replace(/[\u200E\u200F\u202A-\u202E\u2066-\u2069\u061C]/g, ""),
    [text]
  );

  const paragraphs = React.useMemo(() => {
    if (!sanitizedText) return [];
    return buildParagraphs(tokenizeMathSegments(sanitizedText));
  }, [sanitizedText]);

  if (!sanitizedText) return null;

  return (
    <div className={`w-full space-y-1 ${className}`}>
      {paragraphs.map((para, pIdx) => {
        if (para.kind === "display-math") {
          return renderKatexSpan(para.content, true, `dm-${pIdx}`);
        }

        const plainLineText = para.parts
          .map((p) => (p.type === "text" ? p.content : ""))
          .join("");

        if (!plainLineText.trim() && para.parts.every((p) => p.type === "text")) {
          return <div key={`sp-${pIdx}`} className="h-1.5" aria-hidden="true" />;
        }

        const lineDir = getLineDirection(plainLineText);
        const isRtl = lineDir === "rtl";

        return (
          <div
            key={`ln-${pIdx}`}
            dir={lineDir}
            style={{ unicodeBidi: "isolate" }}
            className={
              isRtl
                ? "font-arabic text-right w-full text-[1.18em] leading-[2.05]"
                : "text-left w-full leading-relaxed"
            }
          >
            {para.parts.map((seg, sIdx) => {
              if (seg.type === "text") {
                return (
                  <React.Fragment key={`t-${pIdx}-${sIdx}`}>
                    {renderInlineBidiText(seg.content, lineDir)}
                  </React.Fragment>
                );
              }
              return renderKatexSpan(seg.content, false, `im-${pIdx}-${sIdx}`);
            })}
          </div>
        );
      })}
    </div>
  );
}
