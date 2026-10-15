/** Monto en colones sin decimales y con espacio para separar los miles. Ej.: 150000 → "₡ 150 000". */
export function formatColones(amount: number): string {
  const digits = String(Math.round(amount));
  return `₡ ${digits.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}`;
}
