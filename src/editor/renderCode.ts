import { highlight } from '../lumen/highlight';

/** Renders a highlighted Lumen snippet into a DOM element (used inside editor tooltips). */
export function renderCodeInto(parent: HTMLElement, code: string) {
  let cursor = 0;
  const spans = highlight(code).sort((a, b) => a.from - b.from);
  for (const s of spans) {
    if (s.from > cursor) parent.appendChild(document.createTextNode(code.slice(cursor, s.from)));
    const el = document.createElement('span');
    el.className = `tok-${s.cls}`;
    el.textContent = code.slice(s.from, s.to);
    parent.appendChild(el);
    cursor = s.to;
  }
  if (cursor < code.length) parent.appendChild(document.createTextNode(code.slice(cursor)));
}
