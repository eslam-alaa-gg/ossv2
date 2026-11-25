// Tiny, safe markdown renderer. All user text is HTML-escaped BEFORE formatting is applied (no raw HTML ever passes through).
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

function inline(s: string) {
  let t = esc(s);
  t = t.replace(/`([^`]+)`/g, "<code>$1</code>");
  t = t.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>").replace(/(^|[^*])\*([^*\s][^*]*)\*/g, "$1<em>$2</em>");
  t = t.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+|mailto:[^\s)]+)\)/g, (_m, text: string, url: string) => `<a href="${url}" target="_blank" rel="noopener noreferrer nofollow">${text}</a>`);
  return t;
}

export function renderMarkdown(src: string): string {
  const lines = src.split("\n");
  const out: string[] = [];
  let list: "ul" | "ol" | "todo" | null = null;
  const close = () => { if (list) { out.push(list === "ol" ? "</ol>" : "</ul>"); list = null; } };
  const open = (k: "ul" | "ol" | "todo") => { if (list !== k) { close(); out.push(k === "ol" ? "<ol>" : k === "todo" ? '<ul class="todo">' : "<ul>"); list = k; } };
  for (const raw of lines) {
    let m: RegExpMatchArray | null;
    if ((m = raw.match(/^(#{1,3})\s+(.*)$/))) { close(); out.push(`<h${m[1].length}>${inline(m[2])}</h${m[1].length}>`); }
    else if ((m = raw.match(/^\s*[-*]\s+\[( |x|X)\]\s+(.*)$/))) { open("todo"); out.push(`<li>${m[1] === " " ? "☐" : "☑"} ${inline(m[2])}</li>`); }
    else if ((m = raw.match(/^\s*[-*]\s+(.*)$/))) { open("ul"); out.push(`<li>${inline(m[1])}</li>`); }
    else if ((m = raw.match(/^\s*\d+[.)]\s+(.*)$/))) { open("ol"); out.push(`<li>${inline(m[1])}</li>`); }
    else if (!raw.trim()) close();
    else { close(); out.push(`<p>${inline(raw)}</p>`); }
  }
  close();
  return out.join("");
}

/** Toggle the Nth checklist item in raw markdown (used by interactive previews). */
export function toggleCheck(src: string, index: number): string {
  let i = -1;
  return src.split("\n").map((l) => {
    if (/^\s*[-*]\s+\[( |x|X)\]\s/.test(l)) { i++; if (i === index) return l.replace(/\[( |x|X)\]/, (m) => (m === "[ ]" ? "[x]" : "[ ]")); }
    return l;
  }).join("\n");
}
