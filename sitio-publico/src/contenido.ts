// Textos fijos del sitio público (HU-401 y HU-403). Salen de la web oficial hecha para CANI Café, así que cuentan como
// aprobados por el cliente, salvo lo marcado PROVISIONAL (redacción propuesta, por confirmar). No se agrega más contenido.

export const NOMBRE_EMPRESA = 'CANI Café';

export const TITULOS_PESTANA = {
  inicio: 'CANI Café | Inicio',
  catalogo: 'CANI Café | Catálogo',
  contactenos: 'CANI Café | Contáctenos',
} as const;

export const MENU = [
  { to: '/', label: 'Inicio' },
  { to: '/catalogo', label: 'Catálogo' },
  { to: '/contactenos', label: 'Contáctenos' },
] as const;

export const PRESENTACION = {
  titulo: 'Café de especialidad de las montañas de Naranjo',
  // PROVISIONAL: redacción propuesta, por confirmar.
  subtitulo:
    'Productores de tercera generación en Naranjo, Alajuela. Cultivamos, procesamos y comercializamos nuestro café directamente.',
  botonCatalogo: 'Ver catálogo',
  botonContacto: 'Contáctenos',
} as const;

export const QUIENES_SOMOS = {
  titulo: 'Quiénes somos',
  parrafo1:
    'En CANI CAFÉ, nuestra pasión es producir café de especialidad excepcional. Nos encontramos ubicados en las montañas de Naranjo, Alajuela, Costa Rica, una región bendecida con suelos volcánicos fértiles, un microclima ideal y altitudes que oscilan entre los 1,300 y 1,700 metros sobre el nivel del mar.',
  cita: 'No solo cultivamos café; cuidamos cada semilla como el inicio de una experiencia sensorial única para los paladares más exigentes.',
  parrafo2:
    'Como productores de tercera generación, controlamos rigurosamente cada etapa de la cadena de valor: desde la siembra responsable y la recolección manual de cerezas en su punto óptimo de madurez, hasta la industrialización artesanal y la comercialización directa. Esto nos permite garantizar una trazabilidad absoluta y una calidad inigualable en cada taza.',
  parrafo3:
    'Creemos firmemente en la sostenibilidad y el respeto al medio ambiente, implementando prácticas agrícolas que preserven el ecosistema local de Naranjo y apoyen el bienestar de nuestra comunidad recolectora.',
} as const;

export const COMO_COMPRAR = {
  titulo: '¿Cómo comprar?',
  // PROVISIONAL: redacción propuesta, por confirmar.
  texto:
    'Los precios de nuestros cafés dependen del tipo de cliente y de la cantidad que necesite. Elija en el catálogo los productos que le interesan, complete el formulario de Contáctenos y nos comunicaremos con usted con la información de precios.',
} as const;

// PROVISIONAL (rediseño): sello decorativo que gira junto a la foto de "¿Cómo comprar?". Por confirmar con el cliente.
export const SELLO = {
  arriba: 'Café fresco',
  abajo: 'Todos los días',
} as const;

// CONFIRMADOS por el cliente (2026-11-02). La empresa no tiene un correo propio: se usa este.
export const DATOS_CONTACTO = {
  telefono: '+506 6045 7872',
  correo: 'cmarotob@gmail.com',
  ubicacion: 'Naranjo, Alajuela, Costa Rica',
} as const;

/**
 * Rediseño: en Contáctenos los datos son tres opciones que se presionan. El teléfono abre un chat de WhatsApp, el
 * correo abre Gmail con el destinatario ya puesto y la ubicación abre Google Maps. Salen de DATOS_CONTACTO.
 */
export const ENLACES_CONTACTO = {
  whatsapp: `https://wa.me/${DATOS_CONTACTO.telefono.replace(/\D/g, '')}`,
  correo: `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(DATOS_CONTACTO.correo)}`,
  mapa: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(DATOS_CONTACTO.ubicacion)}`,
} as const;

export const CATALOGO = {
  titulo: 'Catálogo',
  texto: 'Los precios varían según la cantidad y el tipo de cliente. Solicite información en Contáctenos.',
  vacio: 'Pronto publicaremos nuestros productos.',
  boton: 'Me interesa',
  // Mensaje propio del sitio: la carga puede fallar y el criterio no define el texto (se confirma con el cliente).
  error: 'No se pudo cargar el catálogo. Intente de nuevo.',
  cargando: 'Cargando catálogo...',
  // PROVISIONAL (catálogo por variedad): etiqueta del selector de presentación de cada tarjeta.
  presentacion: 'Presentación',
  // PROVISIONALES (rediseño): nombre accesible de la foto que se abre en grande y del botón que la cierra.
  verFoto: 'Ver foto de',
  cerrarFoto: 'Cerrar foto',
} as const;

/**
 * Rediseño: foto real del producto de cada variedad (archivos en sitio-publico/public/fotos). Conviene que sea vertical
 * (más o menos 3:4 o 2:3), con el producto entero al centro. "tarjeta" es la foto completa a ~600 px de ancho, que llena
 * el espacio vertical de la tarjeta del catálogo; "grande" es la misma foto a ~800-1000 px, que se abre al tocarla (para
 * que la etiqueta se lea). La clave es el nombre de la variedad tal como está en el catálogo. Las variedades sin foto
 * muestran la taza con una bolsa dibujada.
 */
export const FOTOS_VARIEDAD: Readonly<Record<string, { tarjeta: string; grande: string }>> = {
  'Villa Sarchí': { tarjeta: '/fotos/villa-sarchi-tarjeta.jpg', grande: '/fotos/villa-sarchi.jpg' },
  Caturra: { tarjeta: '/fotos/caturra-tarjeta.jpg', grande: '/fotos/caturra.jpg' },
  Catuaí: { tarjeta: '/fotos/catuai-tarjeta.jpg', grande: '/fotos/catuai.jpg' },
  Kenia: { tarjeta: '/fotos/kenia-tarjeta.jpg', grande: '/fotos/kenia.jpg' },
  'San Roque': { tarjeta: '/fotos/san-roque-tarjeta.jpg', grande: '/fotos/san-roque.jpg' },
  Milenio: { tarjeta: '/fotos/milenio-tarjeta.jpg', grande: '/fotos/milenio.jpg' },
  Centroamericano: { tarjeta: '/fotos/centroamericano-tarjeta.jpg', grande: '/fotos/centroamericano.jpg' },
  Casiopea: { tarjeta: '/fotos/casiopea-tarjeta.jpg', grande: '/fotos/casiopea.jpg' },
  Geisha: { tarjeta: '/fotos/geisha-tarjeta.jpg', grande: '/fotos/geisha.jpg' },
};

export const FORMULARIO = {
  titulo: 'Envíenos su consulta',
  nombre: 'Nombre completo',
  correo: 'Correo electrónico',
  telefono: 'Teléfono',
  productos: 'Productos de interés',
  mensaje: 'Mensaje',
  enviar: 'Enviar',
  // Contrato v4 (HU-403.3): correo y teléfono van juntos en un grupo obligatorio, porque hace falta al menos uno.
  // PROVISIONAL: título del grupo. La ayuda es el mismo texto que el sistema interno (ContactFormFields, HU-201).
  correoOTelefono: 'Correo electrónico o teléfono',
  ayudaCorreoOTelefono: 'Ingrese al menos uno: correo electrónico o teléfono.',
  // Marca de lo opcional (el mensaje), como en el sistema interno.
  opcional: '(opcional)',
  // PROVISIONAL (rediseño): bajo "Enviar" mientras falten datos obligatorios. Por confirmar con Dylan y el cliente.
  faltanDatos: 'Complete los campos marcados con * para enviar.',
} as const;

/**
 * Selector de productos de interés (HU-404), con el mismo funcionamiento que el del sistema interno: filas con variedad,
 * presentación, cantidad y "X". PROVISIONALES (sin literal en los criterios): los toma del sistema interno.
 */
export const SELECTOR_PRODUCTOS = {
  agregar: 'Agregar producto',
  unidades: 'unidades',
  variedad: 'Seleccione una variedad',
  presentacion: 'Seleccione una presentación',
  presentacionSinVariedad: 'Primero elija una variedad',
  cantidad: 'Cantidad',
  quitar: 'X',
  // PROVISIONAL (rediseño): indicación junto a la cantidad, para que se sepa qué escribir antes de equivocarse. El
  // mensaje de error sigue siendo el literal de HU-501. Por confirmar con Dylan.
  ayudaCantidad: 'Solo números enteros, de 1 a 9999.',
  // PROVISIONAL (rediseño): etiqueta visible sobre el selector de variedad (la presentación y la cantidad reutilizan
  // CATALOGO.presentacion y SELECTOR_PRODUCTOS.cantidad). Por confirmar con Dylan.
  etiquetaVariedad: 'Variedad',
  // PROVISIONALES (rediseño): nombres accesibles de los botones "−" y "+" de la cantidad. Por confirmar con Dylan.
  restar: 'Restar 1 a la cantidad del producto',
  sumar: 'Sumar 1 a la cantidad del producto',
  // PROVISIONALES (rediseño): motivo de "−" / "+" bloqueados (se ve al pasar el mouse) y singular de "unidades".
  minimo: 'La cantidad mínima es 1.',
  maximo: 'La cantidad máxima es 9999.',
  unidad: 'unidad',
} as const;

export const CONTACTENOS = {
  titulo: 'Contáctenos',
  // Los criterios llaman a esta columna "datos de contacto de CANI Café".
  datos: 'Datos de contacto',
} as const;

/** Textos literales de HU-405. */
export const ENVIO = {
  privacidad: 'Sus datos se utilizarán únicamente para responder su consulta.',
  enviando: 'Enviando...',
  gracias: 'Gracias por su interés. CANI Café se comunicará con usted pronto.',
  otraConsulta: 'Enviar otra consulta',
  error: 'No se pudo enviar el formulario. Intente de nuevo.',
} as const;
