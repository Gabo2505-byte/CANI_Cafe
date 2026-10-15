// Dominio sales: ventas, etapas (stageHistory) y avisos internos (responsable: Dylan).
// Contratos: src/shared/types/sale.ts, saleProduct.ts, stageHistory.ts
export { AlertsPage } from './AlertsPage';
export { SalesBoardPage } from './SalesBoardPage';
export { SaleProductsField } from './SaleProductsField';
export {
  newSaleProductRow,
  SALE_PRODUCT_MESSAGES,
  toSaleProductInputs,
  validateSaleProductRows,
  type SaleProductRow,
} from './saleProductRows';
export { ContactPicker } from './ContactPicker';
export { CONTACT_SEARCH_MESSAGES, searchContacts } from './contactSearch';
export { SaleDataFields } from './SaleDataFields';
export {
  EMPTY_SALE_FORM,
  followUpToDate,
  parseAmount,
  SALE_LIMITS,
  SALE_MESSAGES,
  validateSaleForm,
  type SaleFormErrors,
  type SaleFormValues,
} from './saleForm';
export { listOpenSaleTitles } from './salesApi';
