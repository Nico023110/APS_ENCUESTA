/* =========================================================================
   Encuesta_APS — Lectura de fichas completas desde la base (módulo interno)
   -------------------------------------------------------------------------
   Arma el mismo objeto que el formulario produce al guardar
   (construirEncuestaDesdeDatos), para que «Corregir» funcione con una ficha
   diligenciada en otro dispositivo igual que con una local: correccion.js
   recorre ese objeto y repuebla el formulario. El archivo plano del SI-APS
   (api/_reporte_sispro.js) lee por aquí también, así que el reporte y la
   corrección ven exactamente la misma ficha.

   Es el camino inverso de guardar_encuesta.js, tabla por tabla. Lo que el
   formulario recalcula (edad, IMC, hacinamiento, alertas, riesgo) no se lee:
   lo vuelve a calcular al cargar.

   Lee por lotes: cada consulta trae todas las fichas pedidas, y las tablas
   puente de un mismo nivel van en una sola consulta (UNION ALL). Leer una
   ficha o doscientas cuesta el mismo número de idas a la base.

   Dos datos no vuelven exactos, por cómo se guardan:
     - Ideación suicida (ítem 107) es booleana en la base. Desde los 14 años
       sólo caben «ha pensado» (sí) y «ninguno» (no), así que ahí es exacta;
       antes de los 14 el control no aplica y el formulario lo gobierna.
     - Las fichas guardadas antes de que se escribieran los componentes de la
       dirección no los tienen: la dirección vuelve como texto y hay que
       recomponerla (ver `direccionSinComponentes`).
   ========================================================================= */

'use strict';

const { obtenerMotor } = require('./_validacion');
const anexoBd = require('./_anexo_bd');

const PUENTES_VIVIENDA = [
  { campo: 'riesgosAccidente', tabla: 'aps.vivienda_riesgo_accidente' },
  { campo: 'factoresContaminacion', tabla: 'aps.vivienda_factor_contaminacion' },
  { campo: 'animales', tabla: 'aps.vivienda_animal', otroCual: 'animalesOtro' }
];

const PUENTES_FAMILIA = [
  { campo: 'situacionesRiesgo', tabla: 'aps.familia_situacion_riesgo' },
  { campo: 'practicasVinculo', tabla: 'aps.familia_practica_vinculo' },
  { campo: 'practicasCuidadoHogar', tabla: 'aps.familia_practica_cuidado_hogar' }
];

const PUENTES_INTEGRANTE = [
  { campo: 'sujetoEspecialProteccion', tabla: 'aps.integrante_sujeto_proteccion', otroCual: 'sujetoEspecialProteccionOtro' },
  { campo: 'modalidadViolencia', tabla: 'aps.integrante_modalidad_violencia' },
  { campo: 'saberesAncestrales', tabla: 'aps.integrante_saber_ancestral' },
  { campo: 'discapacidad', tabla: 'aps.integrante_discapacidad' },
  { campo: 'practicasCuidado', tabla: 'aps.integrante_practica_cuidado' },
  { campo: 'atencionesPendientesRpms', tabla: 'aps.integrante_atencion_rpms' },
  { campo: 'atencionesPendientesMaterno', tabla: 'aps.integrante_atencion_materno' },
  { campo: 'barrerasAcceso', tabla: 'aps.integrante_barrera_acceso' },
  { campo: 'conocimientoDerecho', tabla: 'aps.integrante_conocimiento_derecho' },
  { campo: 'signosDesnutricion', tabla: 'aps.integrante_signo_desnutricion' },
  { campo: 'enfermedadesNoTransmisibles', tabla: 'aps.integrante_enfermedad_no_transmisible' },
  { campo: 'condicionesTransmisibles', tabla: 'aps.integrante_condicion_transmisible' },
  { campo: 'zonaEndemica', tabla: 'aps.integrante_zona_endemica' },
  { campo: 'motivoNoTratamiento', tabla: 'aps.integrante_motivo_no_tratamiento' },
  { campo: 'riesgosSaludMentalJoven', tabla: 'aps.integrante_riesgo_salud_mental' },
  { campo: 'sintomatologiaDepresiva', tabla: 'aps.integrante_sintoma_depresivo' }
];

/* La base guarda booleanos; el instrumento, 'si'/'no'. */
function siNo(valor) {
  if (valor === null || valor === undefined) return null;
  return valor ? 'si' : 'no';
}

/* `numeric` llega de pg como texto. */
function numero(valor) {
  return valor === null || valor === undefined ? null : Number(valor);
}

function agruparPor(filas, columna) {
  const grupos = new Map();
  filas.forEach(function (fila) {
    const clave = String(fila[columna]);
    if (!grupos.has(clave)) grupos.set(clave, []);
    grupos.get(clave).push(fila);
  });
  return grupos;
}

/* Lee las tablas puente de un nivel para varios padres, en una sola
   consulta, y las agrupa por tabla y por padre. Los nombres de tabla y de
   columna salen de las constantes de arriba, nunca de la petición. */
async function leerPuentes(cliente, definiciones, columnaPadre, ids) {
  const lecturas = definiciones.map(function () { return new Map(); });
  if (ids.length === 0) return lecturas;

  const partes = definiciones.map(function (definicion, i) {
    return 'SELECT ' + i + ' AS n, ' + columnaPadre + ' AS padre, codigo, ' +
      (definicion.otroCual ? 'otro_cual' : 'NULL::text') + ' AS otro_cual FROM ' + definicion.tabla +
      ' WHERE ' + columnaPadre + ' = ANY($1::bigint[])';
  });
  const r = await cliente.query(partes.join(' UNION ALL ') + ' ORDER BY n, codigo', [ids.map(String)]);

  r.rows.forEach(function (fila) {
    const porPadre = lecturas[fila.n];
    const clave = String(fila.padre);
    if (!porPadre.has(clave)) porPadre.set(clave, { codigos: [], otroCual: null });
    const entrada = porPadre.get(clave);
    entrada.codigos.push(fila.codigo);
    if (fila.otro_cual) entrada.otroCual = fila.otro_cual;
  });
  return lecturas;
}

/* Vuelca las tablas puente en el objeto del modelo. Un padre sin filas en
   una tabla queda con lista vacía: al guardar, la lista vacía reemplaza el
   contenido, igual que en la ficha original. */
function aplicarPuentes(destino, definiciones, lecturas, idPadre) {
  definiciones.forEach(function (definicion, i) {
    const entrada = lecturas[i].get(String(idPadre));
    destino[definicion.campo] = entrada ? entrada.codigos : [];
    if (definicion.otroCual) destino[definicion.otroCual] = entrada ? entrada.otroCual : null;
  });
}

function planDesdeFila(fila) {
  return {
    codigoEbs: fila.codigo_ebs,
    codigoVivienda: fila.codigo_vivienda,
    codigoFamilia: fila.codigo_familia,
    tipoIdIntegrante: fila.tipo_id_integrante,
    numeroIdIntegrante: fila.numero_id_integrante,
    acciones: [],
    seguimientos: []
  };
}

/** @returns Map fichaId → [{ ambito, familiaFichaId, integranteId, plan }] */
async function leerPlanes(cliente, fichaIds) {
  const porFicha = new Map();
  const planes = (await cliente.query(
    'SELECT * FROM aps.plan_cuidado WHERE ficha_id = ANY($1::bigint[]) ORDER BY id', [fichaIds]
  )).rows;
  if (planes.length === 0) return porFicha;

  const ids = planes.map(function (p) { return p.id; });

  const acciones = agruparPor((await cliente.query(`
    SELECT pa.plan_id, pa.codigo_accion, pa.procedimiento_realizado, pa.tipo_respuesta,
           pa.institucion_destino, to_char(pa.fecha_cita, 'YYYY-MM-DD') AS fecha_cita,
           fu.tipo_id, fu.numero_id
      FROM aps.plan_accion pa
      JOIN aps.funcionario fu ON fu.id = pa.ejecutor_id
     WHERE pa.plan_id = ANY($1::bigint[])
     ORDER BY pa.id
  `, [ids])).rows, 'plan_id');

  const seguimientos = agruparPor((await cliente.query(`
    SELECT ps.plan_id, ps.accion_concertada,
           to_char(ps.seg1_fecha, 'YYYY-MM-DD') AS seg1_fecha, ps.seg1_estado, ps.seg1_motivo_nc,
           to_char(ps.seg2_fecha, 'YYYY-MM-DD') AS seg2_fecha, ps.seg2_estado, ps.seg2_motivo_nc,
           fu.tipo_id, fu.numero_id
      FROM aps.plan_seguimiento ps
      JOIN aps.funcionario fu ON fu.id = ps.responsable_id
     WHERE ps.plan_id = ANY($1::bigint[])
     ORDER BY ps.id
  `, [ids])).rows, 'plan_id');

  planes.forEach(function (fila) {
    const plan = planDesdeFila(fila);
    (acciones.get(String(fila.id)) || []).forEach(function (a) {
      plan.acciones.push({
        ejecutorTipoId: a.tipo_id,
        ejecutorNumeroId: a.numero_id,
        codigoAccion: a.codigo_accion,
        procedimientoRealizado: a.procedimiento_realizado,
        tipoRespuesta: a.tipo_respuesta,
        institucionDestino: a.institucion_destino,
        fechaCita: a.fecha_cita
      });
    });
    (seguimientos.get(String(fila.id)) || []).forEach(function (s) {
      plan.seguimientos.push({
        seguimientoTipoId: s.tipo_id,
        seguimientoNumeroId: s.numero_id,
        accionConcertada: s.accion_concertada,
        seg1Fecha: s.seg1_fecha,
        seg1Estado: s.seg1_estado,
        seg1MotivoNc: s.seg1_motivo_nc,
        seg2Fecha: s.seg2_fecha,
        seg2Estado: s.seg2_estado,
        seg2MotivoNc: s.seg2_motivo_nc
      });
    });
    const clave = String(fila.ficha_id);
    if (!porFicha.has(clave)) porFicha.set(clave, []);
    porFicha.get(clave).push({
      ambito: fila.ambito, familiaFichaId: fila.familia_ficha_id, integranteId: fila.integrante_id, plan: plan
    });
  });
  return porFicha;
}

function integranteDesdeFila(i) {
  return {
    primerNombre: i.primer_nombre,
    segundoNombre: i.segundo_nombre,
    primerApellido: i.primer_apellido,
    segundoApellido: i.segundo_apellido,
    tipoId: i.tipo_id,
    numeroId: i.numero_id,
    fechaNacimiento: i.fecha_nacimiento_texto,
    nacionalidad: i.nacionalidad,
    nacionalidadOtra: i.nacionalidad_otra,
    sexo: i.sexo,
    genero: i.genero,
    autoidentificacionGenero: i.autoidentificacion_genero,
    autoidentificacionGeneroOtro: i.autoidentificacion_genero_otro,
    orientacionSexual: i.orientacion_sexual,
    orientacionSexualOtro: i.orientacion_sexual_otro,
    telefono1: i.telefono1,
    telefono2: i.telefono2,
    rolFamiliar: i.rol_familiar,
    /* Ítem 73: el código CIUO; las fichas de cuando era texto libre
       traen el texto, que el formulario pedirá cambiar por un código. */
    ocupacion: i.ocupacion_codigo || i.ocupacion_texto,
    nivelEducativo: i.nivel_educativo,
    regimenAfiliacion: i.regimen_afiliacion,
    eapb: i.eapb_codigo,
    pertenenciaEtnica: i.pertenencia_etnica,
    puebloEtnico: i.pueblo_etnico,
    certificacionRlcpd: i.certificacion_rlcpd,
    intencionReproductiva: siNo(i.intencion_reproductiva),
    gestacionActual: siNo(i.gestacion_actual),
    lactanciaExclusiva: i.lactancia_exclusiva,
    peso: numero(i.peso),
    talla: numero(i.talla),
    circunferenciaCintura: numero(i.circunferencia_cintura),
    /* Columna generada en la base (RN-095): el formulario lo recalcula
       igual, pero sin él la ficha leída no se podría reenviar tal cual. */
    imc: numero(i.imc),
    clasificacionAntropometrica: i.clasificacion_antropometrica,
    tensionSistolica: i.tension_sistolica,
    tensionDiastolica: i.tension_diastolica,
    clasificacionTension: i.clasificacion_tension,
    adherenciaTratamiento: i.adherencia_tratamiento,
    consumoSpa: i.consumo_spa,
    puntajeCrafft: i.puntaje_crafft,
    puntajeAudit: i.puntaje_audit,
    puntajeAssist: i.puntaje_assist,
    ideacionSuicida: i.ideacion_suicida === null ? null : (i.ideacion_suicida ? 'ha_pensado' : 'ninguno'),
    limitacionCotidiana: siNo(i.limitacion_cotidiana)
  };
}

/**
 * Lee varias fichas completas.
 * @returns [{ id, encuesta, meta }] en el orden de `fichaIds`, sin las que
 *          no existan. `meta` trae lo que el archivo plano necesita y el
 *          formulario no: consecutivos del hogar y de cada familia, estado.
 */
async function leerFichasCompletas(cliente, fichaIds) {
  const ids = Array.from(new Set((fichaIds || []).map(String)));
  if (ids.length === 0) return [];

  const filas = (await cliente.query(`
    SELECT f.id, f.codigo, f.consentimiento, f.situacion_inminente,
           f.departamento_codigo, f.municipio_codigo, f.uzpe_codigo, f.prestador_codigo,
           to_char(f.fecha_diligenciamiento, 'YYYY-MM-DD') AS fecha_diligenciamiento,
           f.entorno_abordaje, f.nombre_institucion, f.lider_entorno, f.jovenes_en_paz,
           f.estado, f.motivo_cierre_incompleto, f.referencia_familia,
           f.fechas_modificacion, f.capturada_en,
           eq.codigo AS equipo_codigo,
           r.tipo_id AS responsable_tipo_id, r.numero_id AS responsable_numero_id,
           r.perfil_profesional, r.perfil_otro,
           h.id AS hogar_id, h.codigo AS hogar_codigo, h.consecutivo_sispro,
           h.area_ubicacion, h.territorio_codigo, h.microterritorio_codigo,
           h.division_territorial, h.direccion_normalizada, h.direccion_componentes,
           h.latitud, h.longitud, h.punto_referencia, h.geo_motivo_imposibilidad,
           v.estrato, v.hogares_en_vivienda, v.personas_en_vivienda, v.habitaciones_vivienda,
           v.personas_por_habitacion, v.hacinamiento,
           v.elementos_para_dormir, v.tipo_vivienda, v.material_techo, v.vectores,
           v.actividad_economica, v.perros, v.perros_vacunados, v.gatos, v.gatos_vacunados,
           v.carnet_antirrabico, v.fuente_agua, v.disposicion_excretas, v.aguas_residuales,
           v.residuos_solidos
      FROM aps.ficha f
      JOIN aps.hogar h         ON h.id = f.hogar_id
      JOIN aps.equipo_salud eq ON eq.id = f.equipo_salud_id
      JOIN aps.funcionario r   ON r.id = f.responsable_id
      LEFT JOIN aps.vivienda v ON v.ficha_id = f.id
     WHERE f.id = ANY($1::bigint[])
  `, [ids])).rows;

  if (filas.length === 0) return [];

  const idsFicha = filas.map(function (f) { return String(f.id); });
  const idsHogar = Array.from(new Set(filas.map(function (f) { return String(f.hogar_id); })));
  const motor = obtenerMotor();

  const puentesVivienda = await leerPuentes(cliente, PUENTES_VIVIENDA, 'ficha_id', idsFicha);
  const listas = await anexoBd.leerListasConvertidas(cliente, idsFicha);
  const anexoFicha = await anexoBd.leerAnexo(cliente, motor, 'ficha', idsFicha);
  const anexoHogar = await anexoBd.leerAnexo(cliente, motor, 'hogar', idsHogar);
  const anexoVivienda = await anexoBd.leerAnexo(cliente, motor, 'vivienda', idsFicha);

  /* --- Familias, en su orden de captura --- */
  const familias = (await cliente.query(`
    SELECT ff.id, ff.ficha_id, fa.codigo, fa.consecutivo, ff.tipo_familia, ff.numero_integrantes,
           ff.cuidador_principal, ff.zarit, ff.redes_apoyo, ff.sin_contacto_telefonico
      FROM aps.familia_ficha ff
      JOIN aps.familia fa ON fa.id = ff.familia_id
     WHERE ff.ficha_id = ANY($1::bigint[])
     ORDER BY ff.ficha_id, fa.consecutivo, ff.id
  `, [idsFicha])).rows;

  const idsFamilia = familias.map(function (x) { return String(x.id); });
  const puentesFamilia = await leerPuentes(cliente, PUENTES_FAMILIA, 'familia_ficha_id', idsFamilia);
  const anexoFamilia = await anexoBd.leerAnexo(cliente, motor, 'familia_ficha', idsFamilia);

  const integrantes = idsFamilia.length === 0 ? [] : (await cliente.query(`
    SELECT i.*, p.tipo_id, p.numero_id, p.primer_nombre, p.segundo_nombre,
           p.primer_apellido, p.segundo_apellido,
           to_char(p.fecha_nacimiento, 'YYYY-MM-DD') AS fecha_nacimiento_texto,
           p.sexo, p.nacionalidad, p.nacionalidad_otra
      FROM aps.integrante i
      JOIN aps.persona p ON p.id = i.persona_id
     WHERE i.familia_ficha_id = ANY($1::bigint[])
     ORDER BY i.familia_ficha_id, i.orden, i.id
  `, [idsFamilia])).rows;

  const idsIntegrante = integrantes.map(function (x) { return String(x.id); });
  const puentesIntegrante = await leerPuentes(cliente, PUENTES_INTEGRANTE, 'integrante_id', idsIntegrante);
  const anexoIntegrante = await anexoBd.leerAnexo(cliente, motor, 'integrante', idsIntegrante);

  const planesPorFicha = await leerPlanes(cliente, idsFicha);
  const familiasPorFicha = agruparPor(familias, 'ficha_id');
  const integrantesPorFamilia = agruparPor(integrantes, 'familia_ficha_id');

  const porId = new Map();
  filas.forEach(function (f) {
    const encuesta = {
      id: f.codigo,
      codigoFicha: f.codigo,
      fechaRegistro: f.capturada_en ? new Date(f.capturada_en).toISOString() : null,
      fechasModificacion: Array.isArray(f.fechas_modificacion) ? f.fechas_modificacion : [],

      consentimiento: siNo(f.consentimiento),
      situacionInminente: f.situacion_inminente,
      departamentoCodigo: f.departamento_codigo,
      municipioCodigo: f.municipio_codigo,
      uzpe: f.uzpe_codigo,
      areaUbicacion: f.area_ubicacion,
      territorio: f.territorio_codigo,
      microterritorio: f.microterritorio_codigo,
      divisionTerritorial: f.division_territorial,

      equipoSaludId: f.equipo_codigo,
      prestadorPrimario: f.prestador_codigo,
      responsableTipoId: f.responsable_tipo_id,
      responsableNumeroId: f.responsable_numero_id,
      perfilProfesional: f.perfil_profesional,
      perfilProfesionalOtro: f.perfil_otro,
      fechaDiligenciamiento: f.fecha_diligenciamiento,

      entornoAbordaje: f.entorno_abordaje,
      nombreInstitucion: f.nombre_institucion,
      /* 'Sin registrar' es el relleno que pone el guardado cuando no hubo a
         quién derivar RN-019: no es un nombre que deba volver al formulario. */
      cabezaFamilia: f.lider_entorno === 'Sin registrar' ? null : f.lider_entorno,
      jovenesEnPaz: siNo(f.jovenes_en_paz),

      direccion: f.direccion_normalizada,
      direccionComponentes: f.direccion_componentes || null,
      latitud: numero(f.latitud),
      longitud: numero(f.longitud),
      motivoSinGeorreferenciacion: f.geo_motivo_imposibilidad,
      ubicacionReferencia: f.punto_referencia,
      idHogar: f.hogar_codigo,

      estrato: f.estrato,
      hogaresEnVivienda: f.hogares_en_vivienda,
      personasEnVivienda: f.personas_en_vivienda,
      habitacionesVivienda: f.habitaciones_vivienda,
      elementosParaDormir: f.elementos_para_dormir,
      tipoVivienda: f.tipo_vivienda,
      materialTecho: f.material_techo,
      vectores: f.vectores,
      actividadEconomica: siNo(f.actividad_economica),
      perros: f.perros,
      perrosVacunados: f.perros_vacunados,
      gatos: f.gatos,
      gatosVacunados: f.gatos_vacunados,
      carnetAntirrabico: f.carnet_antirrabico,
      fuenteAgua: f.fuente_agua,
      disposicionExcretas: f.disposicion_excretas,
      aguasResiduales: f.aguas_residuales,
      residuosSolidos: f.residuos_solidos,

      visitaIncompleta: f.estado === 'incompleta_causa_externa',
      motivoVisitaIncompleta: f.motivo_cierre_incompleto,

      familias: []
    };

    aplicarPuentes(encuesta, PUENTES_VIVIENDA, puentesVivienda, f.id);

    /* Ítem 2 y 46 a 49: selección múltiple desde el anexo. Si una ficha no
       tuviera filas en el puente, vale la columna de siempre. */
    const convertidas = listas.get(String(f.id));
    Object.keys(convertidas).forEach(function (campo) {
      encuesta[campo] = convertidas[campo].length > 0 ? convertidas[campo] : anexoBd.comoLista(encuesta[campo]);
    });

    /* Variables del anexo técnico de la ficha, el hogar y la vivienda. */
    Object.assign(encuesta,
      anexoFicha.get(String(f.id)),
      anexoHogar.get(String(f.hogar_id)),
      anexoVivienda.get(String(f.id)));

    const planes = planesPorFicha.get(String(f.id)) || [];
    const planDe = function (ambito, llave, valor) {
      const encontrado = planes.find(function (p) {
        return p.ambito === ambito && String(p[llave]) === String(valor);
      });
      return encontrado ? encontrado.plan : null;
    };

    const metaFamilias = [];
    (familiasPorFicha.get(String(f.id)) || []).forEach(function (fila) {
      const familia = {
        idFamilia: fila.codigo,
        tipoFamilia: fila.tipo_familia,
        numeroIntegrantes: fila.numero_integrantes,
        cuidadorPrincipal: siNo(fila.cuidador_principal),
        zarit: fila.zarit,
        redesApoyo: fila.redes_apoyo,
        sinContactoTelefonico: fila.sin_contacto_telefonico === true,
        integrantes: []
      };
      aplicarPuentes(familia, PUENTES_FAMILIA, puentesFamilia, fila.id);
      Object.assign(familia, anexoFamilia.get(String(fila.id)));

      (integrantesPorFamilia.get(String(fila.id)) || []).forEach(function (i) {
        const integrante = integranteDesdeFila(i);
        aplicarPuentes(integrante, PUENTES_INTEGRANTE, puentesIntegrante, i.id);
        /* Ítem 102: respuesta única desde el anexo, aunque viva en un puente. */
        integrante.zonaEndemica = integrante.zonaEndemica.length ? integrante.zonaEndemica[0] : null;
        Object.assign(integrante, anexoIntegrante.get(String(i.id)));

        const planPersona = planDe('persona', 'integranteId', i.id);
        if (planPersona) integrante.planPersona = planPersona;

        familia.integrantes.push(integrante);
      });

      const planFamilia = planDe('familia', 'familiaFichaId', fila.id);
      if (planFamilia) familia.planFamilia = planFamilia;

      encuesta.familias.push(familia);
      metaFamilias.push({ consecutivo: fila.consecutivo });
    });

    const planVivienda = planDe('vivienda', 'ambito', 'vivienda');
    if (planVivienda) encuesta.planVivienda = planVivienda;

    /* Ítem 26: antes no se guardaba. Sin él RN-026 bloquea al volver a guardar;
       a falta del número digitado, el código de la primera familia. */
    encuesta.idFamilia = f.referencia_familia ||
      (encuesta.familias[0] ? encuesta.familias[0].idFamilia : null);

    porId.set(String(f.id), {
      id: String(f.id),
      encuesta: encuesta,
      meta: {
        estado: f.estado,
        consecutivoVivienda: f.consecutivo_sispro,
        personasPorHabitacion: numero(f.personas_por_habitacion),
        hacinamiento: f.hacinamiento,
        familias: metaFamilias
      }
    });
  });

  return ids.map(function (id) { return porId.get(id); }).filter(Boolean);
}

/* Devuelve la ficha como la guarda el formulario, o null si no existe. */
async function leerFichaCompleta(cliente, fichaId) {
  const leidas = await leerFichasCompletas(cliente, [fichaId]);
  return leidas.length > 0 ? leidas[0].encuesta : null;
}

module.exports = { leerFichaCompleta, leerFichasCompletas };
