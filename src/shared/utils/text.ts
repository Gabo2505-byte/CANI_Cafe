/**
 * Clave para ordenar alfabéticamente en Firestore (HU-204): minúsculas, sin tildes y sin
 * espacios repetidos. Así "Álvaro" queda con la A y "ana" junto a "Ana".
 * Firestore ordena por código de caracteres, por eso no se ordena directamente por fullName.
 */
export function toSortKey(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}
