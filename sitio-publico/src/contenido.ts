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

export const DATOS_CONTACTO = {
  telefono: '+506 6045 7872',
  correo: 'cmarotob@gmail.com',
  ubicacion: 'Naranjo, Alajuela, Costa Rica',
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
} as const;

export const FORMULARIO = {
  titulo: 'Envíenos su consulta',
  nombre: 'Nombre completo',
  correo: 'Correo electrónico',
  telefono: 'Teléfono',
  productos: 'Productos de interés',
  mensaje: 'Mensaje',
  enviar: 'Enviar',
  // Los criterios solo dicen que el teléfono y el mensaje son opcionales; esta marca sigue el sistema interno.
  opcional: '(opcional)',
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
