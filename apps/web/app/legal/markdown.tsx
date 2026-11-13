import type { ReactNode } from "react";

/**
 * A small renderer for the legal drafts in planning/legal/. It handles only
 * the subset those files use: headings, paragraphs, tables, lists, quotes and
 * rules, plus inline code, bold, italic and links. Output is React elements,
 * never raw HTML, so text in a draft can't inject markup.
 *
 * Reviewer-only material is removed before rendering: the leading "Draft for
 * owner approval" quote, every "*Basis: …*" note, "[Reviewer: …]" notes and
 * the "Reviewer notes" section at the end.
 */
export function publishable(source: string): string {
  let text = source.replace(/\r\n?/g, "\n");
  const notes = text.search(/^-{3,}\s*\n+#{1,6}\s*Reviewer notes/m);
  if (notes !== -1) text = text.slice(0, notes);
  text = text.replace(/^> \*\*Draft for owner approval\.\*\*.*\n/m, "");
  text = text.replace(/\s*\*Basis:[^*]*\*/g, "");
  text = text.replace(/\s*\[Reviewer:[^\]]*\]/g, "");
  return text.replace(/\n{3,}/g, "\n\n").trim();
}

type Block =
  | { kind: "heading"; level: number; text: string }
  | { kind: "para"; text: string }
  | { kind: "quote"; lines: string[] }
  | { kind: "list"; ordered: boolean; items: string[] }
  | { kind: "table"; head: string[]; rows: string[][] }
  | { kind: "rule" };

function cells(line: string): string[] {
  return line
    .trim()
    .replace(/^\||\|$/g, "")
    .split("|")
    .map((c) => c.trim());
}

export function parse(text: string): Block[] {
  const lines = text.split("\n");
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i] ?? "";
    if (line.trim() === "") {
      i++;
      continue;
    }
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      blocks.push({
        kind: "heading",
        level: (heading[1] ?? "").length,
        text: heading[2] ?? "",
      });
      i++;
      continue;
    }
    if (/^-{3,}\s*$/.test(line)) {
      blocks.push({ kind: "rule" });
      i++;
      continue;
    }
    if (line.trimStart().startsWith("|")) {
      const rows: string[][] = [];
      while (i < lines.length && (lines[i] ?? "").trimStart().startsWith("|")) {
        rows.push(cells(lines[i] ?? ""));
        i++;
      }
      const body = rows.filter(
        (r, n) => !(n === 1 && r.every((c) => /^:?-+:?$/.test(c))),
      );
      blocks.push({ kind: "table", head: body[0] ?? [], rows: body.slice(1) });
      continue;
    }
    if (line.startsWith(">")) {
      const quoted: string[] = [];
      while (i < lines.length && (lines[i] ?? "").startsWith(">")) {
        quoted.push((lines[i] ?? "").replace(/^>\s?/, ""));
        i++;
      }
      blocks.push({ kind: "quote", lines: quoted });
      continue;
    }
    const bullet = /^\s*(?:[-*]|(\d+)\.)\s+/;
    if (bullet.test(line)) {
      const ordered = /^\s*\d+\./.test(line);
      const items: string[] = [];
      while (i < lines.length && bullet.test(lines[i] ?? "")) {
        items.push((lines[i] ?? "").replace(bullet, ""));
        i++;
      }
      blocks.push({ kind: "list", ordered, items });
      continue;
    }
    const para: string[] = [];
    while (
      i < lines.length &&
      (lines[i] ?? "").trim() !== "" &&
      !/^(#{1,6}\s|>|\||-{3,}\s*$|\s*(?:[-*]|\d+\.)\s)/.test(lines[i] ?? "")
    ) {
      para.push((lines[i] ?? "").trim());
      i++;
    }
    blocks.push({ kind: "para", text: para.join(" ") });
  }
  return blocks;
}

const INLINE =
  /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*\s][^*]*\*)|(\[[^\]]+\]\([^)\s]+\))/g;

/** Inline formatting. Only absolute https links become links. */
export function inline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let key = 0;
  for (const m of text.matchAll(INLINE)) {
    const at = m.index;
    if (at > last) out.push(text.slice(last, at));
    const token = m[0];
    if (m[1]) out.push(<code key={key++}>{token.slice(1, -1)}</code>);
    else if (m[2])
      out.push(<strong key={key++}>{inline(token.slice(2, -2))}</strong>);
    else if (m[3]) out.push(<em key={key++}>{inline(token.slice(1, -1))}</em>);
    else {
      const link = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(token);
      const label = link?.[1] ?? token;
      const href = link?.[2] ?? "";
      out.push(
        /^https:\/\/[^\s]+$/.test(href) ? (
          <a key={key++} className="cx-tlink" href={href} rel="noreferrer">
            {inline(label)}
          </a>
        ) : (
          <span key={key++}>{inline(label)}</span>
        ),
      );
    }
    last = at + token.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function LegalDocument({ source }: { source: string }) {
  const blocks = parse(publishable(source));
  return (
    <div className="cx-legal grid max-w-[70ch] gap-4">
      {blocks.map((b, n) => {
        switch (b.kind) {
          case "heading": {
            // The page supplies the h1; the file's own title becomes hidden.
            if (b.level === 1) return null;
            return b.level === 2 ? (
              <h2 key={n} className="type-heading mt-6">
                {inline(b.text)}
              </h2>
            ) : (
              <h3 key={n} className="type-title mt-2">
                {inline(b.text)}
              </h3>
            );
          }
          case "para":
            return <p key={n}>{inline(b.text)}</p>;
          case "quote":
            return (
              <div key={n} className="cx-surface grid gap-2 rounded-xl p-4">
                {parse(b.lines.join("\n")).map((inner, k) =>
                  inner.kind === "list" ? (
                    <ol key={k} className="ml-5 list-decimal grid gap-1">
                      {inner.items.map((item, j) => (
                        <li key={j}>{inline(item)}</li>
                      ))}
                    </ol>
                  ) : inner.kind === "para" ? (
                    <p key={k}>{inline(inner.text)}</p>
                  ) : null,
                )}
              </div>
            );
          case "list":
            return b.ordered ? (
              <ol key={n} className="ml-5 grid list-decimal gap-1">
                {b.items.map((item, j) => (
                  <li key={j}>{inline(item)}</li>
                ))}
              </ol>
            ) : (
              <ul key={n} className="ml-5 grid list-disc gap-1">
                {b.items.map((item, j) => (
                  <li key={j}>{inline(item)}</li>
                ))}
              </ul>
            );
          case "table":
            return (
              <div key={n} className="overflow-x-auto">
                <table className="type-body-sm w-full border-collapse text-left">
                  <thead>
                    <tr>
                      {b.head.map((h, j) => (
                        <th
                          key={j}
                          scope="col"
                          className="border-b p-2 align-top"
                        >
                          {inline(h)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {b.rows.map((row, r) => (
                      <tr key={r}>
                        {row.map((c, j) => (
                          <td key={j} className="border-b p-2 align-top">
                            {inline(c)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          case "rule":
            return <hr key={n} />;
        }
      })}
    </div>
  );
}
