// Tabla de contrastes del rediseño (WCAG 2.x). Lee los tokens de src/styles.css, así que siempre mide los colores reales.
// Uso, desde la raíz del repo: node docs/evidencia/DISENO/contrastes.mjs   → escribe docs/evidencia/DISENO/contrastes.md
import { readFileSync, writeFileSync } from 'node:fs';

const css = readFileSync('src/styles.css', 'utf8');
const root = css.slice(css.indexOf(':root {'), css.indexOf('}', css.indexOf(':root {')));
const tokens = Object.fromEntries([...root.matchAll(/--(color-[a-z-]+):\s*(#[0-9a-fA-F]{3,6}|rgb\([^)]*\))/g)].map((m) => [m[1], m[2]]));

const hex = (v) => {
  if (v.startsWith('#')) {
    const h = v.length === 4 ? [...v.slice(1)].map((c) => c + c).join('') : v.slice(1);
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  }
  return v.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number);
};
const t = (name) => hex(tokens[name] ?? name);
/** Color con transparencia sobre un fondo (para las cajas de "perdida" y "ganada" y el fondo de los diálogos). */
const over = (fg, alpha, bg) => fg.map((c, i) => Math.round(c * alpha + bg[i] * (1 - alpha)));
const lum = (rgb) => {
  const [r, g, b] = rgb.map((c) => c / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
const toHex = (rgb) => '#' + rgb.map((c) => c.toString(16).padStart(2, '0')).join('').toUpperCase();

const BG = t('color-bg');
const SURFACE = t('color-surface');
const RAISED = t('color-surface-raised');
const LOSS_BOX = over(t('color-danger'), 0.08, SURFACE);
const WIN_BOX = over(t('color-success'), 0.08, SURFACE);

// [qué es, color, fondo, mínimo exigido] — 4.5 texto normal, 3 texto grande (≥ 24 px) o componentes/bordes, 0 = exento (deshabilitado o decorativo)
const rows = [
  ['Texto principal sobre fondo', t('color-text'), BG, 4.5],
  ['Texto principal sobre columna/panel', t('color-text'), SURFACE, 4.5],
  ['Texto principal sobre tarjeta/campo', t('color-text'), RAISED, 4.5],
  ['Texto secundario (etiquetas, títulos de tarjeta) sobre fondo', t('color-text-secondary'), BG, 4.5],
  ['Texto secundario sobre panel', t('color-text-secondary'), SURFACE, 4.5],
  ['Texto secundario sobre tarjeta/campo', t('color-text-secondary'), RAISED, 4.5],
  ['Texto atenuado (contadores, ayudas) sobre panel', t('color-text-muted'), SURFACE, 4.5],
  ['Placeholder sobre campo', t('color-text-muted'), RAISED, 4.5],
  ['Dorado (enlaces, montos, opción activa) sobre fondo', t('color-accent'), BG, 4.5],
  ['Dorado sobre panel', t('color-accent'), SURFACE, 4.5],
  ['Dorado (montos) sobre tarjeta', t('color-accent'), RAISED, 4.5],
  ['Texto del botón principal sobre dorado', t('color-on-accent'), t('color-accent'), 4.5],
  ['Texto del botón principal sobre dorado (cursor encima)', t('color-on-accent'), t('color-accent-hover'), 4.5],
  ['Error / seguimiento vencido sobre fondo', t('color-danger'), BG, 4.5],
  ['Error / seguimiento vencido sobre panel', t('color-danger'), SURFACE, 4.5],
  ['Seguimiento vencido sobre tarjeta', t('color-danger'), RAISED, 4.5],
  ['Texto del botón de peligro y etiqueta "Seguimiento vencido"', t('color-on-accent'), t('color-danger'), 4.5],
  ['Texto del botón de peligro con el cursor encima', t('color-on-accent'), t('color-danger-hover'), 4.5],
  ['Etiqueta "Seguimiento para hoy" (naranja)', t('color-on-accent'), t('color-warning'), 4.5],
  ['Etiqueta "Sin comunicación" (amarillo)', t('color-on-accent'), t('color-attention'), 4.5],
  ['Contador al máximo (naranja) sobre panel', t('color-warning'), SURFACE, 4.5],
  ['"Emuladores locales" (amarillo) sobre fondo', t('color-attention'), BG, 4.5],
  ['Número blanco sobre el círculo de avisos', t('color-on-count'), t('color-count'), 4.5],
  ['Franja verde: texto sobre su fondo', t('color-success-text'), t('color-success-bg'), 4.5],
  ['Ganada / "Cliente" (verde) sobre panel', t('color-success'), SURFACE, 4.5],
  ['"Cliente" (verde) sobre tarjeta', t('color-success'), RAISED, 4.5],
  ['"Persona interesada" (azul) sobre tarjeta', t('color-info'), RAISED, 4.5],
  ['Venta perdida (atenuada) sobre columna', t('color-lost'), SURFACE, 4.5],
  ['Venta perdida (atenuada) sobre fondo', t('color-lost'), BG, 4.5],
  ['Pregunta de pérdida sobre su caja roja', t('color-danger'), LOSS_BOX, 4.5],
  ['Texto del motivo (etiqueta) sobre la caja roja', t('color-text-secondary'), LOSS_BOX, 4.5],
  ['Pregunta de venta ganada sobre su caja verde', t('color-success'), WIN_BOX, 4.5],
  ['Paginación deshabilitada ("Anterior"/"Siguiente") sobre fondo', t('color-text-disabled'), BG, 4.5],
  ['Opción deshabilitada ("Venta ganada" desde perdida) sobre diálogo', t('color-text-disabled'), SURFACE, 0],
  ['Título serif (≥ 24 px) sobre fondo', t('color-text'), BG, 3],
  ['Logo: escudo y frase dorados sobre fondo', t('color-accent'), BG, 3],
  ['Logo: "CANI CAFÉ" crema sobre fondo', t('color-text'), BG, 3],
  ['Logo en el ingreso sobre el panel', t('color-accent'), SURFACE, 3],
  ['Borde de campos sobre tarjeta/campo', t('color-border-strong'), RAISED, 3],
  ['Borde de campos sobre panel', t('color-border-strong'), SURFACE, 3],
  ['Borde de campos sobre fondo', t('color-border-strong'), BG, 3],
  ['Borde de campo con error sobre panel', t('color-danger'), SURFACE, 3],
  ['Anillo de foco dorado sobre fondo', t('color-accent'), BG, 3],
  ['Anillo de foco dorado sobre panel', t('color-accent'), SURFACE, 3],
  ['Anillo de foco dorado sobre tarjeta', t('color-accent'), RAISED, 3],
  ['Borde del botón secundario sobre fondo', t('color-text-secondary'), BG, 3],
  ['Borde del botón secundario sobre panel', t('color-text-secondary'), SURFACE, 3],
  ['Subrayado dorado de la opción activa sobre fondo', t('color-accent'), BG, 3],
  ['Círculo rojo de avisos sobre la barra', t('color-count'), BG, 3],
  ['Borde verde de tarjeta ganada sobre columna', t('color-success'), SURFACE, 3],
  ['Borde del diálogo sobre el fondo oscurecido', t('color-border-strong'), over(t('color-backdrop'), 0.72, BG), 3],
  ['Borde decorativo de tarjetas y columnas sobre fondo', t('color-border'), BG, 0],
];

let fails = 0;
const lines = rows.map(([what, fg, bg, min]) => {
  const r = ratio(fg, bg);
  const ok = min === 0 ? 'exento' : r >= min ? '✅' : '❌';
  if (min > 0 && r < min) fails += 1;
  return `| ${what} | ${toHex(fg)} | ${toHex(bg)} | ${r.toFixed(2)}:1 | ${min ? `${min}:1` : '—'} | ${ok} |`;
});
const md = `# Tabla de contrastes del rediseño

Generada con \`node docs/evidencia/DISENO/contrastes.mjs\` a partir de los tokens de \`src/styles.css\` (WCAG 2.x).
Mínimos: 4.5:1 en texto normal; 3:1 en texto grande (≥ 24 px, títulos serif y logo) y en componentes (bordes de campos,
foco, botones con borde). "Exento": controles deshabilitados y bordes decorativos (WCAG no exige contraste).
Las cajas de "perdida" y "ganada" y el fondo de los diálogos son colores con transparencia: se miden ya mezclados.

| Uso | Color | Fondo | Contraste | Mínimo | Resultado |
|---|---|---|---|---|---|
${lines.join('\n')}

Resultado: ${rows.length} pares medidos, ${fails === 0 ? 'todos cumplen su mínimo' : `${fails} no cumplen`}.
`;
writeFileSync('docs/evidencia/DISENO/contrastes.md', md);
console.log(md);
process.exitCode = fails === 0 ? 0 : 1;
