import { useMemo } from 'react';
import { groupByVariety } from '../products/catalog';
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

/** Opciones vacías de los dos pasos (el PDF no da un texto para ellas). */
export const PRODUCT_PLACEHOLDERS = {
  variety: 'Seleccione una variedad',
  presentation: 'Seleccione una presentación',
  /** Mientras no hay variedad elegida, la presentación está deshabilitada y lo indica (sin literal en el PDF). */
  presentationDisabled: 'Primero elija una variedad',
} as const;

/**
 * HU-304: productos de una posible venta. "Agregar producto" suma una fila donde el producto del catálogo se elige
 * en dos pasos (variedad y, ya elegida, su presentación) y se escribe la cantidad estimada; la "X" la quita.
 * El producto que queda en la fila sigue siendo uno solo del catálogo (variedad + presentación). Es opcional: sin
 * filas también se puede guardar.
 */
export function SaleProductsField({ products, rows, onChange, errors = {} }: SaleProductsFieldProps) {
  const varieties = useMemo(() => groupByVariety(products), [products]);
  const presentationsOf = (variety: string): Product[] => varieties.find((v) => v.name === variety)?.products ?? [];
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
                aria-label={`Variedad del producto ${n}`}
                value={row.variety}
                // Al cambiar la variedad se borra la presentación: era de otra variedad.
                onChange={(e) => update(row.key, { variety: e.target.value, productId: '' })}
                aria-invalid={rowErrors?.product && !row.variety ? true : undefined}
                aria-describedby={rowErrors?.product && !row.variety ? `${row.key}-product-error` : undefined}
              >
                <option value="">{PRODUCT_PLACEHOLDERS.variety}</option>
                {varieties.map((variety) => (
                  <option key={variety.name} value={variety.name}>
                    {variety.name}
                  </option>
                ))}
              </select>
              <select
                aria-label={`Presentación del producto ${n}`}
                value={row.productId}
                disabled={!row.variety}
                onChange={(e) => update(row.key, { productId: e.target.value })}
                aria-invalid={rowErrors?.product && row.variety ? true : undefined}
                aria-describedby={rowErrors?.product && row.variety ? `${row.key}-product-error` : undefined}
              >
                <option value="">
                  {row.variety ? PRODUCT_PLACEHOLDERS.presentation : PRODUCT_PLACEHOLDERS.presentationDisabled}
                </option>
                {presentationsOf(row.variety).map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.presentation}
                  </option>
                ))}
              </select>
              <div className="sale-product-quantity">
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
              </div>
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
