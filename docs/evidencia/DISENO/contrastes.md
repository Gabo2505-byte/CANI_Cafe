# Tabla de contrastes del rediseño

Generada con `node docs/evidencia/DISENO/contrastes.mjs` a partir de los tokens de `src/styles.css` (WCAG 2.x).
Mínimos: 4.5:1 en texto normal; 3:1 en texto grande (≥ 24 px, títulos serif y logo) y en componentes (bordes de campos,
foco, botones con borde). "Exento": controles deshabilitados y bordes decorativos (WCAG no exige contraste).
Las cajas de "perdida" y "ganada" y el fondo de los diálogos son colores con transparencia: se miden ya mezclados.

| Uso | Color | Fondo | Contraste | Mínimo | Resultado |
|---|---|---|---|---|---|
| Texto principal sobre fondo | #F3E9DA | #1A110C | 15.48:1 | 4.5:1 | ✅ |
| Texto principal sobre columna/panel | #F3E9DA | #241911 | 14.30:1 | 4.5:1 | ✅ |
| Texto principal sobre tarjeta/campo | #F3E9DA | #2E2118 | 12.98:1 | 4.5:1 | ✅ |
| Texto secundario (etiquetas, títulos de tarjeta) sobre fondo | #B8A58F | #1A110C | 7.81:1 | 4.5:1 | ✅ |
| Texto secundario sobre panel | #B8A58F | #241911 | 7.21:1 | 4.5:1 | ✅ |
| Texto secundario sobre tarjeta/campo | #B8A58F | #2E2118 | 6.55:1 | 4.5:1 | ✅ |
| Texto atenuado (contadores, ayudas) sobre panel | #A08F7A | #241911 | 5.49:1 | 4.5:1 | ✅ |
| Placeholder sobre campo | #A08F7A | #2E2118 | 4.98:1 | 4.5:1 | ✅ |
| Dorado (enlaces, montos, opción activa) sobre fondo | #D4A762 | #1A110C | 8.41:1 | 4.5:1 | ✅ |
| Dorado sobre panel | #D4A762 | #241911 | 7.78:1 | 4.5:1 | ✅ |
| Dorado (montos) sobre tarjeta | #D4A762 | #2E2118 | 7.06:1 | 4.5:1 | ✅ |
| Texto del botón principal sobre dorado | #1A110C | #D4A762 | 8.41:1 | 4.5:1 | ✅ |
| Texto del botón principal sobre dorado (cursor encima) | #1A110C | #E2B97A | 10.14:1 | 4.5:1 | ✅ |
| Error / seguimiento vencido sobre fondo | #E8705F | #1A110C | 6.12:1 | 4.5:1 | ✅ |
| Error / seguimiento vencido sobre panel | #E8705F | #241911 | 5.66:1 | 4.5:1 | ✅ |
| Seguimiento vencido sobre tarjeta | #E8705F | #2E2118 | 5.13:1 | 4.5:1 | ✅ |
| Texto del botón de peligro y etiqueta "Seguimiento vencido" | #1A110C | #E8705F | 6.12:1 | 4.5:1 | ✅ |
| Texto del botón de peligro con el cursor encima | #1A110C | #EF8A7B | 7.61:1 | 4.5:1 | ✅ |
| Etiqueta "Seguimiento para hoy" (naranja) | #1A110C | #E9A23B | 8.59:1 | 4.5:1 | ✅ |
| Etiqueta "Sin comunicación" (amarillo) | #1A110C | #F2D04D | 12.31:1 | 4.5:1 | ✅ |
| Contador al máximo (naranja) sobre panel | #E9A23B | #241911 | 7.93:1 | 4.5:1 | ✅ |
| "Emuladores locales" (amarillo) sobre fondo | #F2D04D | #1A110C | 12.31:1 | 4.5:1 | ✅ |
| Número blanco sobre el círculo de avisos | #FFFFFF | #C62828 | 5.62:1 | 4.5:1 | ✅ |
| Franja verde: texto sobre su fondo | #CFE8CC | #1F3A24 | 9.51:1 | 4.5:1 | ✅ |
| Ganada / "Cliente" (verde) sobre panel | #8DB58A | #241911 | 7.45:1 | 4.5:1 | ✅ |
| "Cliente" (verde) sobre tarjeta | #8DB58A | #2E2118 | 6.76:1 | 4.5:1 | ✅ |
| "Persona interesada" (azul) sobre tarjeta | #9CC3EE | #2E2118 | 8.50:1 | 4.5:1 | ✅ |
| Venta perdida (atenuada) sobre columna | #9A8873 | #241911 | 5.03:1 | 4.5:1 | ✅ |
| Venta perdida (atenuada) sobre fondo | #9A8873 | #1A110C | 5.44:1 | 4.5:1 | ✅ |
| Pregunta de pérdida sobre su caja roja | #E8705F | #342017 | 5.07:1 | 4.5:1 | ✅ |
| Texto del motivo (etiqueta) sobre la caja roja | #B8A58F | #342017 | 6.46:1 | 4.5:1 | ✅ |
| Pregunta de venta ganada sobre su caja verde | #8DB58A | #2C251B | 6.56:1 | 4.5:1 | ✅ |
| Paginación deshabilitada ("Anterior"/"Siguiente") sobre fondo | #8F7E6B | #1A110C | 4.75:1 | 4.5:1 | ✅ |
| Opción deshabilitada ("Venta ganada" desde perdida) sobre diálogo | #8F7E6B | #241911 | 4.39:1 | — | exento |
| Título serif (≥ 24 px) sobre fondo | #F3E9DA | #1A110C | 15.48:1 | 3:1 | ✅ |
| Logo: escudo y frase dorados sobre fondo | #D4A762 | #1A110C | 8.41:1 | 3:1 | ✅ |
| Logo: "CANI CAFÉ" crema sobre fondo | #F3E9DA | #1A110C | 15.48:1 | 3:1 | ✅ |
| Logo en el ingreso sobre el panel | #D4A762 | #241911 | 7.78:1 | 3:1 | ✅ |
| Borde de campos sobre tarjeta/campo | #856F57 | #2E2118 | 3.27:1 | 3:1 | ✅ |
| Borde de campos sobre panel | #856F57 | #241911 | 3.61:1 | 3:1 | ✅ |
| Borde de campos sobre fondo | #856F57 | #1A110C | 3.90:1 | 3:1 | ✅ |
| Borde de campo con error sobre panel | #E8705F | #241911 | 5.66:1 | 3:1 | ✅ |
| Anillo de foco dorado sobre fondo | #D4A762 | #1A110C | 8.41:1 | 3:1 | ✅ |
| Anillo de foco dorado sobre panel | #D4A762 | #241911 | 7.78:1 | 3:1 | ✅ |
| Anillo de foco dorado sobre tarjeta | #D4A762 | #2E2118 | 7.06:1 | 3:1 | ✅ |
| Borde del botón secundario sobre fondo | #B8A58F | #1A110C | 7.81:1 | 3:1 | ✅ |
| Borde del botón secundario sobre panel | #B8A58F | #241911 | 7.21:1 | 3:1 | ✅ |
| Subrayado dorado de la opción activa sobre fondo | #D4A762 | #1A110C | 8.41:1 | 3:1 | ✅ |
| Círculo rojo de avisos sobre la barra | #C62828 | #1A110C | 3.31:1 | 3:1 | ✅ |
| Borde verde de tarjeta ganada sobre columna | #8DB58A | #241911 | 7.45:1 | 3:1 | ✅ |
| Borde del diálogo sobre el fondo oscurecido | #856F57 | #0E0906 | 4.16:1 | 3:1 | ✅ |
| Borde decorativo de tarjetas y columnas sobre fondo | #4A3829 | #1A110C | 1.67:1 | — | exento |

Resultado: 52 pares medidos, todos cumplen su mínimo.
