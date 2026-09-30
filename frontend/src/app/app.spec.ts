import { describe, expect, it } from 'vitest';
import { renderMarkdown } from './core/markdown';
import { money, pct } from './core/format';

describe('renderMarkdown', () => {
  it('escapa HTML antes de aplicar formato (seguro contra XSS)', () => {
    const html = renderMarkdown('<img src=x onerror=alert(1)> **hola**');
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img');
    expect(html).toContain('<strong>hola</strong>');
  });

  it('renderiza encabezados, listas y tablas', () => {
    const html = renderMarkdown('### Titulo\n- a\n- b\n\n| A | B |\n|---|---|\n| 1 | 2 |');
    expect(html).toContain('<h3>Titulo</h3>');
    expect(html).toContain('<ul><li>a</li><li>b</li></ul>');
    expect(html).toContain('<th>A</th>');
    expect(html).toContain('<td>2</td>');
  });
});

describe('format', () => {
  it('formatea montos y porcentajes en es-MX', () => {
    expect(money(null)).toBe('N/D');
    expect(money(1500)).toContain('1,500');
    expect(pct(45.5)).toBe('45.5%');
  });
});
