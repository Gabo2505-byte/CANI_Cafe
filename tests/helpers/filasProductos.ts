// Ayuda para las pruebas del formulario público: arma las filas de productos (HU-404) a partir de { productoId: cantidad }.
import { type FilaProducto, nuevaFila } from '../../sitio-publico/src/formulario/validacion';

export function filasDe(productos: Record<string, string>, variedad = 'Variedad'): FilaProducto[] {
  return Object.entries(productos).map(([productoId, cantidad]) => nuevaFila({ variedad, productoId, cantidad }));
}
