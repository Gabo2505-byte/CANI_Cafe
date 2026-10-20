import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { listProducts } from '../products/productsApi';
import type { Product } from '../shared/types';
import { toCostaRicaDateKey } from '../shared/utils/dates';
import { SaleDataFields } from './SaleDataFields';
import type { SaleDetailData } from './saleDetail';
import { EDIT_MESSAGES, isNotesOnly, toEditValues, validateSaleEdit, type SaleEditValues } from './saleEdit';
import { followUpToDate, parseAmount, SALE_MESSAGES, type SaleFormErrors, type SaleFormValues } from './saleForm';
import {
  newSaleProductRow,
  toSaleProductInputs,
  validateSaleProductRows,
  type SaleProductErrors,
  type SaleProductRow,
} from './saleProductRows';
import { SaleProductsField } from './SaleProductsField';
import { listOpenSaleTitles, updateSale } from './salesApi';

interface SaleEditFormProps {
  detail: SaleDetailData;
  /** Se guardaron los cambios. */
  onSaved: () => void;
  /** "Cancelar": se descartan los cambios. */
  onCancel: () => void;
}

/**
 * HU-309: edita título, monto, productos, seguimiento y notas de una posible venta. Las reglas son las
 * de crearla (validateSaleEdit). En una venta ganada solo se pueden cambiar las notas.
 */
export function SaleEditForm({ detail, onSaved, onCancel }: SaleEditFormProps) {
  const { sale } = detail;
  const notesOnly = isNotesOnly(sale);
  const original = useMemo(() => toEditValues(sale), [sale]);

  const [values, setValues] = useState<SaleEditValues>(original);
  const [rows, setRows] = useState<SaleProductRow[]>(() =>
    detail.products.map((p) => ({ ...newSaleProductRow(), variety: p.name, productId: p.productId, quantity: String(p.quantity) })),
  );
  const [catalog, setCatalog] = useState<Product[]>([]);
  const [productsFailed, setProductsFailed] = useState(false);
  const [errors, setErrors] = useState<SaleFormErrors>({});
  const [productErrors, setProductErrors] = useState<SaleProductErrors>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (notesOnly) return;
    let cancelled = false;
    listProducts().then(
      (list) => !cancelled && setCatalog(list),
      () => !cancelled && setProductsFailed(true),
    );
    return () => {
      cancelled = true;
    };
  }, [notesOnly]);

  // Los activos, más los que la venta ya tiene aunque estén inactivos (para que no desaparezcan).
  const inSale = new Set(detail.products.map((p) => p.productId));
  const options = catalog.filter((product) => product.active || inSale.has(product.id));

  /** El mensaje de un dato desaparece cuando se vuelve a editar ese dato. */
  function clearError(field: keyof SaleFormErrors) {
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const { [field]: _removed, ...rest } = prev;
      return rest;
    });
  }

  function handleRowsChange(next: SaleProductRow[]) {
    setProductErrors((prev) => {
      const rest = { ...prev };
      for (const key of Object.keys(prev)) {
        const before = rows.find((r) => r.key === key);
        const after = next.find((r) => r.key === key);
        if (!after || before?.productId !== after.productId || before?.quantity !== after.quantity) delete rest[key];
      }
      return rest;
    });
    setRows(next);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaveError(null);
    setSaving(true);
    try {
      const openTitles = notesOnly ? [] : await listOpenSaleTitles(sale.contactId, sale.id);
      const formErrors = validateSaleEdit(sale, values, { today: toCostaRicaDateKey(new Date()), openTitles });
      const rowErrors = notesOnly ? {} : validateSaleProductRows(rows);
      setErrors(formErrors);
      setProductErrors(rowErrors);
      if (Object.keys(formErrors).length > 0 || Object.keys(rowErrors).length > 0) {
        setSaving(false);
        return;
      }

      await updateSale(sale.id, {
        title: values.title,
        estimatedAmount: parseAmount(values.amount) as number,
        // Un seguimiento que no se tocó conserva su fecha y hora originales.
        nextFollowUpAt:
          values.followUpDate === original.followUpDate ? (sale.nextFollowUpAt?.toDate() ?? null) : followUpToDate(values.followUpDate),
        notes: values.notes,
        products: toSaleProductInputs(rows),
      });
      onSaved();
    } catch {
      setSaveError(EDIT_MESSAGES.saveError);
      setSaving(false);
    }
  }

  return (
    <form className="form" onSubmit={handleSubmit} noValidate>
      <SaleDataFields
        values={values}
        onChange={(patch: Partial<SaleFormValues>) => {
          setValues((prev) => ({ ...prev, ...patch }));
          if (patch.title !== undefined) clearError('title');
          if (patch.amount !== undefined) clearError('amount');
          if (patch.followUpDate !== undefined) clearError('followUpDate');
          if (patch.notes !== undefined) clearError('notes');
        }}
        errors={errors}
        showStage={false}
        notesOnly={notesOnly}
      />

      {!notesOnly && (
        <>
          <SaleProductsField products={options} rows={rows} onChange={handleRowsChange} errors={productErrors} />
          {productsFailed && (
            <p className="field-error" role="alert">
              {SALE_MESSAGES.productsLoadError}
            </p>
          )}
        </>
      )}

      {saveError && (
        <p className="field-error" role="alert">
          {saveError}
        </p>
      )}
      <div className="form-actions">
        <button type="button" className="button-secondary" onClick={onCancel}>
          Cancelar
        </button>
        <button type="submit" disabled={saving}>
          Guardar
        </button>
      </div>
    </form>
  );
}
