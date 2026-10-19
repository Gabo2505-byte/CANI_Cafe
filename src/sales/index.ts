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
export { changeSaleStage, createSale, listOpenSaleTitles, updateSale } from './salesApi';
export { NewSalePage } from './NewSalePage';
export { TimedNotice } from './TimedNotice';
export { BOARD_MESSAGES, buildBoard, formatColumnHeader } from './board';
export { SaleCard } from './SaleCard';
export { SaleDetailPage } from './SaleDetailPage';
export { DETAIL_MESSAGES, sortHistory } from './saleDetail';
export { loadSaleDetail } from './saleDetailApi';
export { EDIT_MESSAGES, isNotesOnly, validateSaleEdit } from './saleEdit';
export { SaleEditForm } from './SaleEditForm';
export { ChangeStageDialog } from './ChangeStageDialog';
export { canChangeStage, stageOptions, STAGE_CHANGE_MESSAGES } from './stageChange';
