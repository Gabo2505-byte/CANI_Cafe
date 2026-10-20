// Catálogo oficial de productos de CANI Café (HT-002). A diferencia del resto del seed, estos datos son REALES: los
// entregó el cliente (variedades y descripciones del documento «variedades-cani.pdf»). No se inventan ni se reescriben.
// 9 variedades × 4 pesos × 2 formatos = 72 productos. No hay precios y no se guardan en ningún lado (RN-06).
//
// Este archivo no depende de Firebase: lo usa el seed de los emuladores y servirá para el cargador de producción (RT-02).
import type { Product } from '../../src/shared/types';

export interface CatalogVariety {
  /** Posición en el documento del cliente; va en el id del producto para ordenar. */
  order: number;
  /** Para el id del producto: sin tildes ni espacios. */
  slug: string;
  /** Nombre de la variedad: va en `Product.name`. */
  name: string;
  /** Descripción del cliente: la misma en los 8 productos de la variedad (máximo 300 caracteres, HU-402). */
  description: string;
}

/** En el orden del documento del cliente. */
export const CATALOG_VARIETIES: CatalogVariety[] = [
  {
    order: 1,
    slug: 'villa-sarchi',
    name: 'Villa Sarchí',
    description:
      'Variedad emblemática de Costa Rica, reconocida por su elegancia y excelente calidad en taza. Presenta una acidez brillante, cuerpo balanceado y notas dulces y frutales que ofrecen una experiencia limpia y armoniosa.',
  },
  {
    order: 2,
    slug: 'caturra',
    name: 'Caturra',
    description:
      'Variedad tradicional de gran importancia en la caficultura costarricense. Destaca por su equilibrio, dulzura y agradable acidez, con una taza aromática y de cuerpo medio. Una excelente opción para quienes disfrutan de un café clásico y refinado.',
  },
  {
    order: 3,
    slug: 'catuai',
    name: 'Catuaí',
    description:
      'Variedad reconocida por su versatilidad y consistencia. En taza puede ofrecer una combinación equilibrada de dulzura, acidez y cuerpo, acompañada de aromas agradables y notas frutales o achocolatadas según su proceso y terroir.',
  },
  {
    order: 4,
    slug: 'kenia',
    name: 'Kenia',
    description:
      'Café de perfil vibrante y complejo, caracterizado por una acidez marcada y una gran intensidad aromática. Puede presentar notas de frutos rojos, cítricos y frutas tropicales, dejando una sensación fresca y prolongada en el paladar.',
  },
  {
    order: 5,
    slug: 'san-roque',
    name: 'San Roque',
    description:
      'Variedad de carácter distintivo, cultivada en las montañas de Costa Rica. Su taza puede destacar por su dulzura, cuerpo balanceado y agradables matices frutales y florales, ofreciendo una experiencia sofisticada y diferente.',
  },
  {
    order: 6,
    slug: 'milenio',
    name: 'Milenio',
    description:
      'Variedad de gran potencial para producir cafés de alta calidad. Se caracteriza por una taza equilibrada, aromática y dulce, donde pueden encontrarse notas frutales, florales y achocolatadas dependiendo de la altitud, proceso y tueste.',
  },
  {
    order: 7,
    slug: 'centroamericano',
    name: 'Centroamericano',
    description:
      'Variedad reconocida por su excelente potencial sensorial y su capacidad para desarrollar cafés complejos. Ofrece una taza balanceada, con buena dulzura, acidez agradable y notas que pueden ir desde frutas y flores hasta chocolate y caramelo.',
  },
  {
    order: 8,
    slug: 'casiopea',
    name: 'Casiopea',
    description:
      'Una variedad de perfil moderno y atractivo para cafés de especialidad. Puede expresar una taza aromática, dulce y compleja, con presencia de notas florales, frutales y cítricas, acompañadas de una acidez elegante y un final prolongado.',
  },
  {
    order: 9,
    slug: 'geisha',
    name: 'Geisha',
    description:
      'Una de las variedades más reconocidas y apreciadas dentro del café de especialidad. Destaca por su extraordinaria complejidad aromática, con posibles notas de flores, jazmín, bergamota, frutas tropicales y cítricos. Una taza elegante, delicada y de gran persistencia.',
  },
];

/** Pesos en el orden en que se muestran. `idPart` va con ceros para que los ids se ordenen como texto. */
export const CATALOG_WEIGHTS = [
  { idPart: '0250', label: '250 g' },
  { idPart: '0340', label: '340 g' },
  { idPart: '0500', label: '500 g' },
  { idPart: '1000', label: '1 kg' },
] as const;

/**
 * Formatos. `label` es lo que se escribe en la presentación. Van en orden alfabético de `idPart` porque el orden de los
 * selectores sale de ordenar los ids como texto: dentro de cada peso, "grano entero" aparece antes que "molido".
 */
export const CATALOG_FORMATS = [
  { idPart: 'grano', label: 'grano entero' },
  { idPart: 'molido', label: 'molido' },
] as const;

export const CATALOG_MAX_DESCRIPTION = 300;

/** Producto del catálogo listo para escribir: el id lleva el orden (`prod-01-villa-sarchi-0250-molido`). */
export interface CatalogProduct {
  id: string;
  data: Omit<Product, 'id'>;
}

/** Id de un producto a partir de sus partes. Ordenar los ids como texto da el orden del catálogo. */
export function catalogProductId(varietySlug: string, weightIdPart: string, formatIdPart: string): string {
  const variety = CATALOG_VARIETIES.find((v) => v.slug === varietySlug);
  if (!variety) throw new Error(`Variedad desconocida: ${varietySlug}`);
  return `prod-${String(variety.order).padStart(2, '0')}-${variety.slug}-${weightIdPart}-${formatIdPart}`;
}

/** Los 72 productos, ordenados por id (variedad, peso y formato). Activos, sin precios y con ids fijos. */
export function buildCatalogProducts(): CatalogProduct[] {
  const products: CatalogProduct[] = [];
  for (const variety of CATALOG_VARIETIES) {
    for (const weight of CATALOG_WEIGHTS) {
      for (const format of CATALOG_FORMATS) {
        products.push({
          id: catalogProductId(variety.slug, weight.idPart, format.idPart),
          data: {
            name: variety.name,
            presentation: `Bolsa de ${weight.label}, ${format.label}`,
            description: variety.description,
            active: true,
          },
        });
      }
    }
  }
  return products;
}
