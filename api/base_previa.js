/* =========================================================================
   ¿Ya fue caracterizada? — buscar antes de la visita
   -------------------------------------------------------------------------
   POST /api/base_previa
     { accion: 'buscar', modo: 'documento', documento: '1143…' }
     { accion: 'buscar', modo: 'direccion', direccion: 'Cra 14 # 14-14' }
     { accion: 'buscar', modo: 'cercania', latitud, longitud, radio? }
     { accion: 'copia' }   las viviendas de los territorios de sus EBS, para
                           buscar sin señal (el teléfono las guarda cifradas)

   Busca en la base anterior a la app (2025 – primer semestre de 2026) y en
   las fichas de la app. La lógica, el tope y la auditoría están en
   api/_base_previa.js. Por POST: la cabecera anti-CSRF la exige
   requerirSesion, y un documento no viaja en la dirección de la petición.
   ========================================================================= */

'use strict';

const { obtenerPool } = require('./_db');
const { requerirSesion } = require('./_auth');
const base = require('./_base_previa');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const usuario = await requerirSesion(req, res, { permiso: 'base_previa.consultar' });
  if (!usuario) return;

  const cuerpo = req.body && typeof req.body === 'object' ? req.body : {};

  try {
    if (cuerpo.accion === 'buscar') {
      return res.status(200).json(await base.buscar(obtenerPool(), usuario, cuerpo));
    }
    if (cuerpo.accion === 'copia') {
      return res.status(200).json(await base.armarCopia(obtenerPool(), usuario));
    }
    return res.status(400).json({ error: 'Acción no reconocida', codigo: 'accion' });
  } catch (error) {
    if (error instanceof base.ErrorDeBusqueda) {
      return res.status(error.codigo === 'tope' ? 429 : 400).json({ error: error.message, codigo: error.codigo });
    }
    /* Sin las tablas (la migración 20 aún no se aplicó) se dice así, sin el
       detalle del motor. */
    if (error && error.code === '42P01') {
      return res.status(503).json({ error: 'La base anterior todavía no está cargada en el sistema.', codigo: 'sin_base' });
    }
    console.error('Error en base_previa:', error.message);
    return res.status(500).json({ error: 'No fue posible buscar en este momento' });
  }
};
