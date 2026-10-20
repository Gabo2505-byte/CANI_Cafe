import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { ROUTES } from '../app/routes';
import { listActiveProducts } from '../products/productsApi';
import { SALES_LABELS } from '../shared/constants/labels';
import type { NoticeState } from '../shared/hooks/useLocationNotice';
import type { Contact, Product } from '../shared/types';
import { toCostaRicaDateKey } from '../shared/utils/dates';
import { ContactPicker } from './ContactPicker';
import { getContactForSale } from './contactSearchApi';
import { SaleDataFields } from './SaleDataFields';
import {
  EMPTY_SALE_FORM,
  followUpToDate,
  parseAmount,
  SALE_MESSAGES,
  validateSaleForm,
  type SaleFormErrors,
  type SaleFormValues,
} from './saleForm';
import {
  toSaleProductInputs,
  validateSaleProductRows,
  type SaleProductErrors,
  type SaleProductRow,
} from './saleProductRows';
import { SaleProductsField } from './SaleProductsField';
import { createSale, listOpenSaleTitles } from './salesApi';

type FixedContactState = { status: 'none' } | { status: 'loading' } | { status: 'notFound' } | { status: 'ready'; contact: Contact };

/**
 * HU-301: formulario "Nuevo registro" (crear una posible venta) con siete datos: contacto (HU-302), título, etapa, monto,
 * fecha de seguimiento y notas (HU-303) y productos (HU-304). Con `?contactId=` (desde la ficha)
 * el contacto viene elegido y no se puede cambiar.
 */
export function NewSalePage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const fixedContactId = params.get('contactId');

  const [fixed, setFixed] = useState<FixedContactState>(fixedContactId ? { status: 'loading' } : { status: 'none' });
  const [products, setProducts] = useState<Product[]>([]);
  const [productsFailed, setProductsFailed] = useState(false);
  const [selected, setSelected] = useState<Contact | null>(null);
  const [values, setValues] = useState<SaleFormValues>(EMPTY_SALE_FORM);
  const [rows, setRows] = useState<SaleProductRow[]>([]);
  const [errors, setErrors] = useState<SaleFormErrors>({});
  const [productErrors, setProductErrors] = useState<SaleProductErrors>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!fixedContactId) return;
    let cancelled = false;
    getContactForSale(fixedContactId).then(
      (contact) => {
        if (cancelled) return;
        setFixed(contact ? { status: 'ready', contact } : { status: 'notFound' });
      },
      () => !cancelled && setFixed({ status: 'notFound' }),
    );
    return () => {
      cancelled = true;
    };
  }, [fixedContactId]);

  useEffect(() => {
    let cancelled = false;
    listActiveProducts().then(
      (list) => !cancelled && setProducts(list),
      () => !cancelled && setProductsFailed(true),
    );
    return () => {
      cancelled = true;
    };
  }, []);

  const fixedContact = fixed.status === 'ready' ? fixed.contact : undefined;
  const contact = fixedContact ?? selected;

  /** El mensaje de un dato desaparece cuando se vuelve a editar ese dato. */
  function clearError(field: keyof SaleFormErrors) {
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const { [field]: _removed, ...rest } = prev;
      return rest;
    });
  }

  /** Igual para las filas de producto: se limpian las filas que cambiaron (o se quitaron). */
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
      const openTitles = contact ? await listOpenSaleTitles(contact.id) : [];
      const formErrors = validateSaleForm(values, {
        contactId: contact?.id ?? null,
        today: toCostaRicaDateKey(new Date()),
        openTitles,
      });
      const rowErrors = validateSaleProductRows(rows);
      setErrors(formErrors);
      setProductErrors(rowErrors);
      if (Object.keys(formErrors).length > 0 || Object.keys(rowErrors).length > 0 || !contact) {
        setSaving(false);
        return;
      }

      await createSale({
        contactId: contact.id,
        title: values.title,
        stage: values.stage,
        estimatedAmount: parseAmount(values.amount) as number,
        nextFollowUpAt: followUpToDate(values.followUpDate),
        notes: values.notes,
        products: toSaleProductInputs(rows),
      });
      const state: NoticeState = { notice: SALE_MESSAGES.created };
      // replace: "Atrás" desde el tablero no vuelve al formulario ya enviado.
      navigate(ROUTES.salesBoard, { replace: true, state });
    } catch {
      setSaveError(SALE_MESSAGES.saveError);
      setSaving(false);
    }
  }

  if (fixed.status === 'notFound') {
    return (
      <main className="page">
        <h1>{SALES_LABELS.newRecordTitle}</h1>
        <p className="field-error" role="alert">
          {SALE_MESSAGES.contactNotFound}
        </p>
        <Link to={ROUTES.salesBoard}>{SALES_LABELS.backToBoard}</Link>
      </main>
    );
  }

  return (
    <main className="page">
      <h1>{SALES_LABELS.newRecordTitle}</h1>
      {fixed.status === 'loading' ? (
        <p>Cargando contacto…</p>
      ) : (
        <form className="form" onSubmit={handleSubmit} noValidate>
          <label htmlFor="sale-contact">
            Contacto <span className="required" aria-hidden="true">*</span>
          </label>
          <ContactPicker
            id="sale-contact"
            selected={selected}
            onSelect={(next) => {
              setSelected(next);
              clearError('contact');
            }}
            fixedContact={fixedContact}
            error={errors.contact}
          />

          <SaleDataFields
            values={values}
            onChange={(patch) => {
              setValues((prev) => ({ ...prev, ...patch }));
              if (patch.title !== undefined) clearError('title');
              if (patch.amount !== undefined) clearError('amount');
              if (patch.followUpDate !== undefined) clearError('followUpDate');
              if (patch.notes !== undefined) clearError('notes');
            }}
            errors={errors}
          />

          <SaleProductsField products={products} rows={rows} onChange={handleRowsChange} errors={productErrors} />
          {productsFailed && (
            <p className="field-error" role="alert">
              {SALE_MESSAGES.productsLoadError}
            </p>
          )}

          {saveError && (
            <p className="field-error" role="alert">
              {saveError}
            </p>
          )}
          <div className="form-actions">
            <button type="button" className="button-secondary" onClick={() => navigate(ROUTES.salesBoard)}>
              Cancelar
            </button>
            <button type="submit" disabled={saving}>
              Guardar
            </button>
          </div>
        </form>
      )}
    </main>
  );
}
