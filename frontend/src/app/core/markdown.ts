/**
 * Renderer de markdown MINIMO y SEGURO para las respuestas del asistente.
 * Escapa todo el HTML primero y solo despues aplica un subconjunto: ###, **, *, listas, tablas, >.
 */
function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function inline(s: string): string {
  return s
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*(?!\s)(.+?)\*(?!\*)/g, '$1<em>$2</em>')
    .replace(/«(.+?)»/g, '«<strong>$1</strong>»');
}

export function renderMarkdown(src: string): string {
  const lines = escapeHtml(src).split(/\r?\n/);
  const out: string[] = [];
  let list: 'ul' | 'ol' | null = null;
  let table: string[][] | null = null;

  const closeList = () => {
    if (list) out.push(`</${list}>`);
    list = null;
  };
  const closeTable = () => {
    if (!table) return;
    const [head, ...rows] = table;
    out.push('<div class="overflow-x-auto"><table><thead><tr>');
    head.forEach((h) => out.push(`<th>${inline(h)}</th>`));
    out.push('</tr></thead><tbody>');
    rows.forEach((r) => out.push('<tr>' + r.map((c) => `<td>${inline(c)}</td>`).join('') + '</tr>'));
    out.push('</tbody></table></div>');
    table = null;
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (/^\|.*\|$/.test(line.trim())) {
      closeList();
      const cells = line.trim().slice(1, -1).split('|').map((c) => c.trim());
      if (cells.every((c) => /^-{2,}:?$|^:?-{2,}:?$/.test(c) || c === '---')) continue;
      (table ??= []).push(cells);
      continue;
    }
    closeTable();
    let m: RegExpMatchArray | null;
    if ((m = line.match(/^#{1,4}\s+(.*)$/))) {
      closeList();
      out.push(`<h3>${inline(m[1])}</h3>`);
    } else if ((m = line.match(/^\s*[-•]\s+(.*)$/))) {
      if (list !== 'ul') {
        closeList();
        out.push('<ul>');
        list = 'ul';
      }
      out.push(`<li>${inline(m[1])}</li>`);
    } else if ((m = line.match(/^\s*\d+\.\s+(.*)$/))) {
      if (list !== 'ol') {
        closeList();
        out.push('<ol>');
        list = 'ol';
      }
      out.push(`<li>${inline(m[1])}</li>`);
    } else if ((m = line.match(/^&gt;\s?(.*)$/))) {
      closeList();
      out.push(`<blockquote>${inline(m[1])}</blockquote>`);
    } else if (line.trim() === '') {
      closeList();
    } else {
      closeList();
      out.push(`<p>${inline(line)}</p>`);
    }
  }
  closeList();
  closeTable();
  return out.join('');
}
