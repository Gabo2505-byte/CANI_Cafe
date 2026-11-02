import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { listPublicProductsIn } from '../../../src/products/publicCatalog';
import type { Product } from '../../../src/shared/types';
import { ConsultaForm } from '../components/ConsultaForm';
import { DatosContacto } from '../components/DatosContacto';
import type { EstadoProductos } from '../components/ProductosField';
import { usePageTitle } from '../components/usePageTitle';
import { CONTACTENOS, TITULOS_PESTANA } from '../contenido';
import { aSolicitud, crearEnviador } from '../formulario/envio';
import { guardarSolicitudIn, nuevoIdSolicitudIn } from '../formulario/guardarSolicitud';
import { db } from '../firebase';

export function ContactenosPage() {
  usePageTitle(TITULOS_PESTANA.contactenos);
  const [params, setParams] = useSearchParams();
  const [productos, setProductos] = useState<Product[]>([]);
  const [estado, setEstado] = useState<EstadoProductos>('cargando');
  // Recuerda el último intento fallido para decidir el id de un reintento (ver formulario/envio.ts).
  const enviador = useRef(
    crearEnviador({ nuevoId: () => nuevoIdSolicitudIn(db), guardar: (id, datos) => guardarSolicitudIn(db, id, datos) }),
  );

  useEffect(() => {
    let vigente = true;
    listPublicProductsIn(db)
      .then((lista) => {
        if (!vigente) return;
        setProductos(lista);
        setEstado('listo');
      })
      .catch(() => vigente && setEstado('error'));
    return () => {
      vigente = false;
    };
  }, []);

  return (
    <main className="pub-main">
      <h1 className="pub-title">{CONTACTENOS.titulo}</h1>
      <div className="pub-contact">
        <section className="pub-panel">
          <ConsultaForm
            productos={productos}
            estadoProductos={estado}
            productoInicial={params.get('producto')}
            onValido={(valores) => enviador.current(aSolicitud(valores))}
            // La nueva consulta empieza vacía: se quita el producto elegido en el catálogo de la dirección.
            onOtraConsulta={() => setParams({}, { replace: true })}
          />
        </section>
        <aside className="pub-panel pub-aside" aria-labelledby="pub-datos-titulo">
          <h2 id="pub-datos-titulo" className="pub-heading">
            {CONTACTENOS.datos}
          </h2>
          <DatosContacto className="pub-contact-list" />
        </aside>
      </div>
    </main>
  );
}
