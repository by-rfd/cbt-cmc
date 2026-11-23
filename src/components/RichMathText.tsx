import React from "react";
import katex from "katex";
import "katex/dist/katex.min.css";

interface RichMathTextProps {
  text: string;
  className?: string;
}

const ARABIC_CHAR_REGEX = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/;

export function hasArabicText(text: string): boolean {
  return ARABIC_CHAR_REGEX.test(text || "");
}

// Segment string into plain text vs display math ($$...$$, \[...\]) vs inline math ($...$, \(...\))
interface Segment {
  type: "text" | "inline-math" | "display-math";
  content: string;
}

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

export default function RichMathText({ text, className = "" }: RichMathTextProps) {
  if (!text) return null;

  const isArabic = hasArabicText(text);
  const segments = React.useMemo(() => tokenizeMathSegments(text), [text]);

  return (
    <span
      dir={isArabic ? "rtl" : "auto"}
      className={`${isArabic ? "font-arabic leading-loose text-right block" : "whitespace-pre-line"} ${className}`}
    >
      {segments.map((seg, idx) => {
        if (seg.type === "text") {
          return <React.Fragment key={idx}>{seg.content}</React.Fragment>;
        }
        try {
          const html = katex.renderToString(seg.content, {
            displayMode: seg.type === "display-math",
            throwOnError: false,
            strict: false,
          });
          return (
            <span
              key={idx}
              dir="ltr"
              className={seg.type === "display-math" ? "block my-1.5 overflow-x-auto" : "inline-block align-middle mx-0.5"}
              dangerouslySetInnerHTML={{ __html: html }}
            />
          );
        } catch {
          return <React.Fragment key={idx}>{seg.content}</React.Fragment>;
        }
      })}
    </span>
  );
}
