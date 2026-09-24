/* =========================================================================
   Encuesta_APS — Detalle de una ficha guardada en la base
   -------------------------------------------------------------------------
   Sirve el modal «Ver» del historial para una fila que llegó desde
   `listar_fichas.js` sin todavía tener su detalle: esa consulta trae lo
   justo para pintar una tabla, no lo que necesita el modal de detalle. Aquí
   se pide una ficha puntual, por su código, y se arma el mismo objeto que
   `abrirModalDetalle` ya sabe leer.

   NO ES LA FICHA COMPLETA

   Deliberadamente no reconstruye familias, integrantes ni planes de
   cuidado: eso es lo que usa «Corregir» para repoblar el formulario entero,
   y reunirlo exige recorrer una docena de tablas más y siete pasos de
   enrutado inverso (el que hace `correccion.js` al revés). Este endpoint
   sólo cubre lo que el modal de detalle muestra hoy —los datos de la ficha,
   la vivienda y el entorno—, que es una consulta plana sin esa complejidad.
   Por eso «Corregir» sigue reservado a las fichas que ya están en el
   dispositivo: no hay de dónde traer el resto todavía.
   ========================================================================= */

'use strict';

const { consultar } = require('./_db');
const { COLUMNAS_PLAN, resumenPlanDesdeFila } = require('./_plan_cuidado');
const { requerirSesion } = require('./_auth');
const roles = require('../roles.js');

function aSiNo(booleano) {
  if (booleano === null || booleano === undefined) return null;
  return booleano ? 'si' : 'no';
}

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const usuario = await requerirSesion(req, res);
  if (!usuario) return;

  const alcance = roles.alcanceDeLectura(usuario.rol);
  if (!alcance) return res.status(403).json({ error: 'Su rol no permite consultar fichas', codigo: 'sin_permiso' });

  const codigo = req.query && req.query.codigo ? String(req.query.codigo).trim() : '';
  if (codigo === '') {
    return res.status(400).json({ error: 'Falta el parámetro «codigo».' });
  }

  /* RN-224.3: fuera del equipo la ficha «no existe». Un 403 confirmaría que
     el código es real, y el código de ficha es un dato que no se regala. */
  const filtroAlcance = alcance === 'todas' ? '' : 'AND f.equipo_salud_id = $2';
  const parametros = alcance === 'todas' ? [codigo] : [codigo, usuario.equipoSaludId || -1];

  try {
    const resultado = await consultar(`
      SELECT
        f.id                        AS ficha_id,
        f.codigo                    AS codigo_ficha,
        f.consentimiento,
        f.situacion_inminente,
        (SELECT array_agg(s.codigo ORDER BY s.codigo) FROM aps.ficha_situacion_inminente s
          WHERE s.ficha_id = f.id) AS situaciones_inminentes,
        f.departamento_codigo,
        f.municipio_codigo,
        f.uzpe_codigo,
        f.prestador_codigo,
        f.fecha_diligenciamiento,
        f.entorno_abordaje,
        f.nombre_institucion,
        f.lider_entorno,
        f.jovenes_en_paz,

        eq.codigo                   AS equipo_salud_id,
        r.tipo_id                   AS responsable_tipo_id,
        r.numero_id                 AS responsable_numero_id,
        r.perfil_profesional,
        r.perfil_otro,

        h.area_ubicacion,
        h.territorio_codigo         AS territorio,
        h.microterritorio_codigo    AS microterritorio,
        h.division_territorial,
        h.direccion_normalizada     AS direccion,
        h.latitud,
        h.longitud,
        h.punto_referencia,

        v.estrato,
        v.hogares_en_vivienda,
        v.personas_en_vivienda,
        v.habitaciones_vivienda,
        v.elementos_para_dormir,
        v.personas_por_habitacion,
        v.hacinamiento,
        v.tipo_vivienda,
        v.material_techo,
        v.vectores,

        (SELECT array_agg(codigo ORDER BY codigo)
           FROM aps.vivienda_riesgo_accidente WHERE ficha_id = f.id) AS riesgos_accidente,
        (SELECT array_agg(codigo ORDER BY codigo)
           FROM aps.vivienda_factor_contaminacion WHERE ficha_id = f.id) AS factores_contaminacion,
        ${COLUMNAS_PLAN}

      FROM aps.ficha f
      JOIN aps.hogar h        ON h.id = f.hogar_id
      JOIN aps.equipo_salud eq ON eq.id = f.equipo_salud_id
      JOIN aps.funcionario r   ON r.id = f.responsable_id
      LEFT JOIN aps.vivienda v ON v.ficha_id = f.id
      WHERE f.codigo = $1 ${filtroAlcance}
    `, parametros);

    const fila = resultado.rows[0];
    if (!fila) {
      return res.status(404).json({ error: 'No existe ninguna ficha con ese código.' });
    }

    /* RN-224.2 / RN-225: la consulta del detalle queda en auditoría con quien
       la hizo. No bloquea la respuesta si falla: se anota y se sigue. */
    consultar(`
      INSERT INTO aud.acceso_sensible (ficha_id, funcionario_id, grupo_dato)
      VALUES ($1, $2, 'ficha')
    `, [fila.ficha_id, usuario.funcionarioId]).catch(function (error) {
      console.warn('No se pudo registrar el acceso en auditoría:', error.message);
    });

    res.status(200).json({
      codigoFicha: fila.codigo_ficha,
      consentimiento: aSiNo(fila.consentimiento),
      situacionInminente: Array.isArray(fila.situaciones_inminentes)
        ? fila.situaciones_inminentes
        : (fila.situacion_inminente ? [fila.situacion_inminente] : []),

      departamentoCodigo: fila.departamento_codigo,
      municipioCodigo: fila.municipio_codigo,
      uzpe: fila.uzpe_codigo,
      areaUbicacion: fila.area_ubicacion,
      territorio: fila.territorio,
      microterritorio: fila.microterritorio,
      divisionTerritorial: fila.division_territorial,

      equipoSaludId: fila.equipo_salud_id,
      prestadorPrimario: fila.prestador_codigo,

      responsableTipoId: fila.responsable_tipo_id,
      responsableNumeroId: fila.responsable_numero_id,
      perfilProfesional: fila.perfil_profesional,
      perfilProfesionalOtro: fila.perfil_otro,
      fechaDiligenciamiento: fila.fecha_diligenciamiento,

      entornoAbordaje: fila.entorno_abordaje,
      nombreInstitucion: fila.nombre_institucion,
      cabezaFamilia: fila.lider_entorno,
      jovenesEnPaz: aSiNo(fila.jovenes_en_paz),

      direccion: fila.direccion,
      latitud: fila.latitud,
      longitud: fila.longitud,
      ubicacionReferencia: fila.punto_referencia,

      estrato: fila.estrato,
      hogaresEnVivienda: fila.hogares_en_vivienda,
      personasEnVivienda: fila.personas_en_vivienda,
      habitacionesVivienda: fila.habitaciones_vivienda,
      elementosParaDormir: fila.elementos_para_dormir,
      personasPorHabitacion: fila.personas_por_habitacion === null
        ? null : Number(fila.personas_por_habitacion),
      hacinamiento: aSiNo(fila.hacinamiento),

      tipoVivienda: fila.tipo_vivienda,
      materialTecho: fila.material_techo,
      vectores: fila.vectores,
      riesgosAccidente: fila.riesgos_accidente || [],
      factoresContaminacion: fila.factores_contaminacion || [],
      planCuidado: resumenPlanDesdeFila(fila)
    });
  } catch (err) {
    console.error('Error al obtener el detalle de la ficha:', err);
    res.status(500).json({ error: 'Error de servidor', detalles: err.message });
  }
};
