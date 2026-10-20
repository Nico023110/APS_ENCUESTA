'use strict';

const { consultar } = require('./_db');
const { requerirSesion } = require('./_auth');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const usuario = await requerirSesion(req, res, { permiso: 'catalogos.consultar' });
  if (!usuario) return;

  try {
    /* Las cinco listas en una sola consulta. Eran cinco consultas en paralelo
       sobre el pool: con el pool frío, cinco conexiones nuevas a la base
       —cada una con su negociación TLS— para un catálogo que cabe en una. */
    const listas = (await consultar(`
      SELECT
        (SELECT coalesce(json_agg(json_build_object('valor', codigo, 'etiqueta', nombre, 'regimen', regimen) ORDER BY nombre), '[]')
           FROM cat.eapb WHERE vigente = true) AS eapb,
        (SELECT coalesce(json_agg(json_build_object('valor', codigo, 'etiqueta', nombre) ORDER BY nombre), '[]')
           FROM cat.prestador WHERE vigente = true) AS prestador,
        (SELECT coalesce(json_agg(json_build_object('valor', codigo, 'etiqueta', nombre) ORDER BY nombre), '[]')
           FROM cat.uzpe WHERE vigente = true) AS uzpe,
        (SELECT coalesce(json_agg(json_build_object('ter_codigo', t.codigo, 'mt_codigo', m.codigo,
                                                    'nombre', m.nombre, 'comuna', m.comuna)
                                  ORDER BY t.codigo, m.codigo), '[]')
           FROM cat.territorio t
           JOIN cat.microterritorio m ON t.codigo = m.territorio_codigo
          WHERE t.vigente = true AND m.vigente = true) AS territorios,
        /* Los EBS registrados: la coordinación, que lidera zonas con varios
           EBS, elige en el ítem 10 el de cada visita. Sólo códigos. */
        (SELECT coalesce(json_agg(codigo ORDER BY codigo), '[]')
           FROM aps.equipo_salud WHERE activo) AS equipos
    `)).rows[0];
    const eapbRes = { rows: listas.eapb };
    const prestadorRes = { rows: listas.prestador };
    const uzpeRes = { rows: listas.uzpe };
    const terRes = { rows: listas.territorios };
    const equiposRes = { rows: listas.equipos.map(function (codigo) { return { codigo: codigo }; }) };

    const territorios = {};
    for (const row of terRes.rows) {
      if (!territorios[row.ter_codigo]) territorios[row.ter_codigo] = [];
      territorios[row.ter_codigo].push({
        codigo: row.mt_codigo,
        nombre: row.nombre,
        comuna: row.comuna
      });
    }

    const catalogos = {
      eapb: eapbRes.rows,
      prestador: prestadorRes.rows,
      uzpe: uzpeRes.rows,
      territorios: territorios,
      equipos: equiposRes.rows.map(function (fila) { return fila.codigo; })
    };

    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.status(200).json(catalogos);
  } catch (err) {
    console.error('Error al obtener catálogos dinámicos:', err);
    res.status(500).json({ error: 'Error de servidor', detalles: err.message });
  }
};
