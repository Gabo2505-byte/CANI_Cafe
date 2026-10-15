import type { Product } from '../shared/types';
import {
  newSaleProductRow,
  SALE_PRODUCT_MESSAGES,
  type SaleProductErrors,
  type SaleProductRow,
} from './saleProductRows';

interface SaleProductsFieldProps {
  /** Catálogo para elegir (HT-002). */
  products: Product[];
  rows: SaleProductRow[];
  onChange: (rows: SaleProductRow[]) => void;
  /** Errores por fila, calculados por el formulario al guardar (validateSaleProductRows). */
  errors?: SaleProductErrors;
}

/**
 * HU-304: productos de una posible venta. "Agregar producto" suma una fila con el producto del
 * catálogo y la cantidad estimada; la "X" la quita. Es opcional: sin filas también se puede guardar.
 */
export function SaleProductsField({ products, rows, onChange, errors = {} }: SaleProductsFieldProps) {
  const update = (key: string, patch: Partial<SaleProductRow>) =>
    onChange(rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));

  return (
    <fieldset className="sale-products">
      <legend>
        Productos <span className="optional">(opcional)</span>
      </legend>

      {rows.map((row, index) => {
        const rowErrors = errors[row.key];
        const n = index + 1;
        return (
          <div key={row.key} className="sale-product-row">
            <div className="sale-product-controls">
              <select
                aria-label={`Producto ${n}`}
                value={row.productId}
                onChange={(e) => update(row.key, { productId: e.target.value })}
                aria-invalid={rowErrors?.product ? true : undefined}
                aria-describedby={rowErrors?.product ? `${row.key}-product-error` : undefined}
              >
                <option value="">Seleccione un producto</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name} · {product.presentation}
                  </option>
                ))}
              </select>
              <input
                aria-label={`Cantidad del producto ${n}`}
                inputMode="numeric"
                placeholder="Cantidad"
                value={row.quantity}
                onChange={(e) => update(row.key, { quantity: e.target.value })}
                autoComplete="off"
                aria-invalid={rowErrors?.quantity ? true : undefined}
                aria-describedby={rowErrors?.quantity ? `${row.key}-quantity-error` : undefined}
              />
              <span className="sale-product-unit">unidades</span>
              <button
                type="button"
                className="button-secondary sale-product-remove"
                aria-label={`Quitar producto ${n}`}
                onClick={() => onChange(rows.filter((r) => r.key !== row.key))}
              >
                X
              </button>
            </div>
            {rowErrors?.product && (
              <p id={`${row.key}-product-error`} className="field-error" role="alert">
                {rowErrors.product}
              </p>
            )}
            {rowErrors?.quantity && (
              <p id={`${row.key}-quantity-error`} className="field-error" role="alert">
                {rowErrors.quantity}
              </p>
            )}
          </div>
        );
      })}

      <button type="button" className="button-secondary" onClick={() => onChange([...rows, newSaleProductRow()])}>
        {SALE_PRODUCT_MESSAGES.add}
      </button>
    </fieldset>
  );
}
