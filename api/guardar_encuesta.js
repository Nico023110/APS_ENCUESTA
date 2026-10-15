/* =========================================================================
   Encuesta_APS — Guardado de una ficha
   -------------------------------------------------------------------------
   La ficha se valida entera antes de abrir la transacción y se escribe sin
   sustituir ningún dato ausente.

   POR QUÉ SE QUITARON LOS VALORES POR DEFECTO

   La versión anterior rellenaba lo que faltaba: equipo 'EQTEST', documento
   '99999999', territorio 'T48', sexo 'hombre', estrato 'bajo', y reescribía
   la fecha cuando el trigger de RN-016 la iba a rechazar. Con eso el POST
   nunca fallaba —que es justamente el problema—: escribía datos inventados
   indistinguibles de los reales en una base de caracterización poblacional.

   Dos casos eran algo peor que una pérdida de dato:

     - La UZPE elegida por el encuestador se reemplazaba por la primera del
       catálogo, así que el territorio quedaba mal atribuido.
     - Si no se resolvía la EAPB, se declaraba a la persona "no afiliada"
       para satisfacer la restricción int_eapb_condicionada. Eso fabrica una
       barrera de acceso que no existe y dispara RN-209.2.

   Ahora lo que falta se rechaza con 400 y el detalle del campo.
   ========================================================================= */

'use strict';

/* Indicadores para Node File Trace de Vercel: estos archivos se leen con
   fs.readFileSync dentro de _validacion.js. El tracer no siempre sigue
   require.resolve en módulos auxiliares (prefijo _), así que se repiten aquí
   en el entry point para garantizar que se incluyan en el bundle. */
require.resolve('../catalogos_sispro.js');
require.resolve('../catalogos.js');
require.resolve('../anexo.js');
require.resolve('../direccion.js');
require.resolve('../reglas.js');

const { obtenerPool } = require('./_db');
const { validar, obtenerMotor } = require('./_validacion');
const anexoBd = require('./_anexo_bd');
const { requerirSesion } = require('./_auth');
const { leerFichaCompleta } = require('./_ficha_completa');
const { cambiosEnPlanRegistrado, esDelPlan } = require('./_plan_bloqueo');
const roles = require('../roles.js');

/* Convierte a entero o devuelve null. No sustituye por 1: un conteo ausente
   no es un conteo de uno. */
function entero(valor) {
  if (valor === null || valor === undefined || valor === '') return null;
  const n = parseInt(valor, 10);
  return Number.isNaN(n) ? null : n;
}

function decimal(valor) {
  if (valor === null || valor === undefined || valor === '') return null;
  const n = parseFloat(String(valor).replace(',', '.'));
  return Number.isNaN(n) ? null : n;
}

/**
 * Instante en que se diligenció la ficha, con hora. Lo fija el dispositivo al
 * guardar (fechaRegistro): una visita tomada sin señal llega al servidor horas
 * o días después y esa demora no puede pasar por la hora de la visita. Un
 * valor ilegible, o de un reloj adelantado, no sirve de fecha de diligenciar:
 * se usa la hora del servidor. Cinco minutos de margen cubren la deriva entre
 * relojes.
 */
function momentoDeDiligenciamiento(valor) {
  const ahora = Date.now();
  const instante = typeof valor === 'string' ? Date.parse(valor) : NaN;
  if (!Number.isFinite(instante) || instante > ahora + 5 * 60 * 1000) return new Date(ahora);
  return new Date(instante);
}

function texto(valor) {
  if (valor === null || valor === undefined) return null;
  const t = String(valor).trim();
  return t === '' ? null : t;
}

/* El instrumento usa 'si'/'no'; la base usa boolean. */
function booleano(valor) {
  if (valor === true || valor === false) return valor;
  if (valor === 'si') return true;
  if (valor === 'no') return false;
  return null;
}

/* Ítem 21 por partes. Sin ellas, una ficha traída de la base para corregirla
   no pasa RN-021 al volver a guardarse: el servidor recompone la dirección
   desde sus componentes y no cree la que llega armada. Se guarda sólo lo que
   direccion.js conoce, con tope de largo: es un jsonb que viene del cliente. */
const CLAVES_DIRECCION = ['modo', 'viaTipo', 'viaNumero', 'viaLetra', 'viaLetraBis', 'viaCuadrante',
  'genNumero', 'genLetra', 'genCuadrante', 'placa', 'ruralViaTipo', 'ruralViaNombre', 'ruralKm',
  'ruralPredioTipo', 'ruralPredioNombre', 'ruralSector'];

function componentesDeDireccion(componentes) {
  if (!componentes || typeof componentes !== 'object' || Array.isArray(componentes)) return null;
  const salida = { viaBis: componentes.viaBis === true };
  CLAVES_DIRECCION.forEach(function (clave) {
    const valor = componentes[clave];
    if (valor !== undefined && valor !== null) salida[clave] = String(valor).slice(0, 80);
  });
  salida.complementos = (Array.isArray(componentes.complementos) ? componentes.complementos : [])
    .slice(0, 10)
    .map(function (c) {
      return { tipo: String((c && c.tipo) || '').slice(0, 40), valor: String((c && c.valor) || '').slice(0, 80) };
    });
  return JSON.stringify(salida);
}

/* =========================================================================
   TABLAS PUENTE DE SELECCIÓN MÚLTIPLE
   -------------------------------------------------------------------------
   Las 22 preguntas de selección múltiple del instrumento son 22 tablas, no
   arreglos ni cadenas separadas por comas. La razón está en las reglas de
   decisión: RN-207 distingue "un síntoma" de "dos o más", RN-208 cruza
   dengue con el ítem 37 y extiende la condición a todos los convivientes.
   Contar y cruzar exige filas.

   El marcador excluyente ("Ninguna", "Sin discapacidad") también se guarda:
   una fila 'ninguna' significa "se preguntó y no hay", que es distinto de
   no tener filas, que significa "no se preguntó".
   ========================================================================= */

const PUENTES_VIVIENDA = [
  { campo: 'riesgosAccidente', tabla: 'aps.vivienda_riesgo_accidente' },      // ítem 36
  { campo: 'factoresContaminacion', tabla: 'aps.vivienda_factor_contaminacion' }, // ítem 38
  { campo: 'animales', tabla: 'aps.vivienda_animal', otroCual: 'animalesOtro' }   // ítem 40
];

const PUENTES_FAMILIA = [
  { campo: 'situacionesRiesgo', tabla: 'aps.familia_situacion_riesgo' },         // ítem 54
  { campo: 'practicasVinculo', tabla: 'aps.familia_practica_vinculo' },          // ítem 55
  { campo: 'practicasCuidadoHogar', tabla: 'aps.familia_practica_cuidado_hogar' } // ítem 57
];

const PUENTES_INTEGRANTE = [
  { campo: 'sujetoEspecialProteccion', tabla: 'aps.integrante_sujeto_proteccion', otroCual: 'sujetoEspecialProteccionOtro' }, // 77
  { campo: 'modalidadViolencia', tabla: 'aps.integrante_modalidad_violencia' },              // ítem 78 (sensible)
  { campo: 'saberesAncestrales', tabla: 'aps.integrante_saber_ancestral' },                  // ítem 81
  { campo: 'discapacidad', tabla: 'aps.integrante_discapacidad' },                           // ítem 82
  { campo: 'practicasCuidado', tabla: 'aps.integrante_practica_cuidado' },                   // ítem 86
  { campo: 'atencionesPendientesRpms', tabla: 'aps.integrante_atencion_rpms' },              // ítem 87
  { campo: 'atencionesPendientesMaterno', tabla: 'aps.integrante_atencion_materno' },        // ítem 88
  { campo: 'barrerasAcceso', tabla: 'aps.integrante_barrera_acceso' },                       // ítem 89
  { campo: 'conocimientoDerecho', tabla: 'aps.integrante_conocimiento_derecho' },            // ítem 90
  { campo: 'signosDesnutricion', tabla: 'aps.integrante_signo_desnutricion' },               // ítem 97
  { campo: 'enfermedadesNoTransmisibles', tabla: 'aps.integrante_enfermedad_no_transmisible' }, // ítem 100
  { campo: 'condicionesTransmisibles', tabla: 'aps.integrante_condicion_transmisible' },     // ítem 101
  { campo: 'zonaEndemica', tabla: 'aps.integrante_zona_endemica', unica: true },             // ítem 102
  { campo: 'motivoNoTratamiento', tabla: 'aps.integrante_motivo_no_tratamiento' },           // ítem 104
  { campo: 'riesgosSaludMentalJoven', tabla: 'aps.integrante_riesgo_salud_mental' },         // ítem 105
  { campo: 'sintomatologiaDepresiva', tabla: 'aps.integrante_sintoma_depresivo' }            // ítem 106
];

/* Reemplaza el contenido de una tabla puente para un padre dado.

   Se borra y se vuelve a insertar, en vez de acumular con ON CONFLICT DO
   NOTHING, porque la sincronización reenvía cada ficha completa: si el
   encuestador desmarca "dengue" y vuelve a sincronizar, la fila tiene que
   desaparecer. Acumular dejaría un diagnóstico que ya se corrigió.

   Un campo ausente (undefined) no es lo mismo que una lista vacía: significa
   que la sección no se capturó, y entonces no se toca la tabla.

   Los nombres de tabla salen de las constantes de arriba, nunca del cuerpo
   de la petición: no hay concatenación de datos del usuario en el SQL. */
async function sincronizarPuente(cliente, definicion, columnaPadre, padreId, contenedor) {
  /* Ítem 102: el anexo lo volvió respuesta única, pero sigue en su puente;
     llega como texto y se escribe como lista de uno. */
  const valores = definicion.unica
    ? anexoBd.comoLista(contenedor[definicion.campo])
    : contenedor[definicion.campo];
  if (definicion.unica && contenedor[definicion.campo] === undefined) return 0;
  if (!Array.isArray(valores)) return 0;

  await cliente.query(
    'DELETE FROM ' + definicion.tabla + ' WHERE ' + columnaPadre + ' = $1',
    [padreId]
  );

  /* El aclaratorio de "Otro" es uno por pregunta, no uno por opción: el
     esquema exige que no esté vacío cuando el código es 'otro'. */
  const otroCual = definicion.otroCual ? texto(contenedor[definicion.otroCual]) : null;

  let escritas = 0;

  for (const valor of valores) {
    const codigo = texto(valor);
    if (codigo === null) continue;

    if (definicion.otroCual) {
      await cliente.query(
        'INSERT INTO ' + definicion.tabla + ' (' + columnaPadre + ', codigo, otro_cual) ' +
        'VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
        [padreId, codigo, codigo === 'otro' ? otroCual : null]
      );
    } else {
      await cliente.query(
        'INSERT INTO ' + definicion.tabla + ' (' + columnaPadre + ', codigo) ' +
        'VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [padreId, codigo]
      );
    }
    escritas++;
  }

  return escritas;
}

async function sincronizarPuentes(cliente, definiciones, columnaPadre, padreId, contenedor) {
  let total = 0;
  for (const definicion of definiciones) {
    total += await sincronizarPuente(cliente, definicion, columnaPadre, padreId, contenedor);
  }
  return total;
}

/* =========================================================================
   PLAN DE CUIDADO (ítems 111 a 140)
   -------------------------------------------------------------------------
   Un plan por ámbito, según la cardinalidad de RN-000: uno de vivienda por
   ficha, uno de familia por familia y uno de persona por integrante. Los
   índices únicos parciales del esquema lo hacen cumplir.

   Las llaves heredadas (código de EBS, de vivienda, de familia y documento
   del integrante) no se recalculan aquí: el motor ya bloqueó la ficha si no
   coinciden con su origen, así que lo que llega es lo que el encuestador vio.
   ========================================================================= */

/* Los ejecutores y responsables del plan son funcionarios del EBS. Se
   registran por documento igual que el responsable de la ficha. */
async function obtenerFuncionario(cliente, tipoId, numeroId) {
  const tipo = texto(tipoId);
  const numero = texto(numeroId);
  if (tipo === null || numero === null) return null;

  const res = await cliente.query(`
    INSERT INTO aps.funcionario (tipo_id, numero_id, nombre_completo, activo)
    VALUES ($1, $2, $3, true)
    ON CONFLICT (tipo_id, numero_id) DO UPDATE SET activo = true
    RETURNING id
  `, [tipo, numero, 'Integrante del EBS ' + numero]);

  return res.rows[0].id;
}

/* Escribe un plan y sus acciones y seguimientos. Devuelve cuántas filas dejó.

   Se borran las acciones y los seguimientos antes de reinsertar, por la misma
   razón que en las tablas puente: la sincronización reenvía la ficha entera y
   una acción retirada tiene que desaparecer. El plan en sí se conserva para
   no romper las referencias de aps.alerta_accion. */
async function guardarPlan(cliente, fichaId, ambito, plan, llaves) {
  if (!plan || typeof plan !== 'object') return 0;

  /* Sin llaves heredadas no hay plan que guardar: son NOT NULL y su ausencia
     significa que la sección no se diligenció. */
  if (texto(plan.codigoEbs) === null || texto(plan.codigoVivienda) === null) return 0;

  const valores = [
    fichaId,
    ambito,
    llaves.familiaFichaId || null,
    llaves.integranteId || null,
    texto(plan.codigoEbs),
    texto(plan.codigoVivienda),
    ambito === 'vivienda' ? null : texto(plan.codigoFamilia),
    ambito === 'persona' ? texto(plan.tipoIdIntegrante) : null,
    ambito === 'persona' ? texto(plan.numeroIdIntegrante) : null
  ];

  /* Reenviar la misma ficha tiene que reutilizar su plan, no crear otro.
     `ux_plan_vivienda`, `ux_plan_familia` y `ux_plan_persona` lo impiden, así
     que insertar a ciegas hacía fallar la transacción entera con un 500 en
     cuanto la ficha ya existía: al corregirla, o al reintentar una
     sincronización que había quedado a medias.

     Cada índice es parcial y con una llave distinta, de ahí que la búsqueda
     dependa del ámbito. Conservar el `id` importa además porque
     `aps.alerta_accion` lo referencia. */
  const busqueda = {
    vivienda: { columna: 'ficha_id', llave: fichaId },
    familia: { columna: 'familia_ficha_id', llave: llaves.familiaFichaId || null },
    persona: { columna: 'integrante_id', llave: llaves.integranteId || null }
  }[ambito];

  /* Cada consulta lleva sólo los parámetros que usa: pasarle de más deja a
     Postgres sin forma de inferir su tipo y la consulta ni siquiera prepara. */
  const previo = busqueda && busqueda.llave !== null
    ? await cliente.query(
      'SELECT id FROM aps.plan_cuidado WHERE ' + busqueda.columna + ' = $1 AND ambito = $2 LIMIT 1',
      [busqueda.llave, ambito])
    : { rows: [] };

  let planId;

  if (previo.rows.length > 0) {
    planId = previo.rows[0].id;
    /* `ambito` se reasigna a su mismo valor: no cambia nunca, pero dejar un
       parámetro sin usar impide a Postgres inferir su tipo y la consulta
       falla al prepararse. */
    await cliente.query(`
      UPDATE aps.plan_cuidado
         SET ficha_id = $1, ambito = $2, familia_ficha_id = $3, integrante_id = $4,
             codigo_ebs = $5, codigo_vivienda = $6, codigo_familia = $7,
             tipo_id_integrante = $8, numero_id_integrante = $9
       WHERE id = $10
    `, valores.concat([planId]));
  } else {
    const planRes = await cliente.query(`
      INSERT INTO aps.plan_cuidado (
        ficha_id, ambito, familia_ficha_id, integrante_id,
        codigo_ebs, codigo_vivienda, codigo_familia,
        tipo_id_integrante, numero_id_integrante
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      RETURNING id
    `, valores);
    planId = planRes.rows[0].id;
  }

  /* Se vacía el plan antes de reponerlo. La cabecera de esta función lo daba
     por hecho desde el principio, pero no estaba escrito: reenviar una ficha
     —al corregirla o al reintentar una sincronización— sumaba sus acciones a
     las que ya había en vez de reemplazarlas. Una ficha guardada tres veces
     terminaba con nueve acciones, y corregir el código de una dejaba conviviendo
     el viejo y el nuevo.

     `aps.alerta_accion` apunta a estas filas con ON DELETE CASCADE, así que el
     vínculo se deshace solo y se rehace al reinsertar. */
  await cliente.query('DELETE FROM aps.plan_accion      WHERE plan_id = $1', [planId]);
  await cliente.query('DELETE FROM aps.plan_seguimiento WHERE plan_id = $1', [planId]);

  let filas = 1;

  /* --- Acciones (ítems 113-115 / 123-125 / 135-136) --- */
  for (const accion of (Array.isArray(plan.acciones) ? plan.acciones : [])) {
    if (texto(accion.codigoAccion) === null) continue;

    const ejecutorId = await obtenerFuncionario(
      cliente, accion.ejecutorTipoId, accion.ejecutorNumeroId
    );
    if (ejecutorId === null) continue;

    await cliente.query(`
      INSERT INTO aps.plan_accion (
        plan_id, ejecutor_id, codigo_accion, procedimiento_realizado, tipo_respuesta,
        institucion_destino, fecha_cita
      ) VALUES ($1,$2,$3,$4,$5,$6,$7)
    `, [
      planId,
      ejecutorId,
      texto(accion.codigoAccion),
      /* Ítems 114 / 124 / 136a: el procedimiento en palabras del profesional.
         Complementa al código, no lo reemplaza —de él dependen la llave
         foránea a cat.cups y el cruce alerta ↔ acción de RN-220—. */
      texto(accion.procedimientoRealizado),
      texto(accion.tipoRespuesta),
      texto(accion.institucionDestino),
      texto(accion.fechaCita)
    ]);
    filas++;
  }

  /* --- Seguimientos (ítems 116-119 / 126-129 / 137-140) --- */
  for (const seg of (Array.isArray(plan.seguimientos) ? plan.seguimientos : [])) {
    if (texto(seg.accionConcertada) === null) continue;

    const responsableId = await obtenerFuncionario(
      cliente, seg.seguimientoTipoId, seg.seguimientoNumeroId
    );
    if (responsableId === null) continue;

    await cliente.query(`
      INSERT INTO aps.plan_seguimiento (
        plan_id, responsable_id, accion_concertada, fecha_concertacion,
        seg1_fecha, seg1_estado, seg1_motivo_nc,
        seg2_fecha, seg2_estado, seg2_motivo_nc
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
    `, [
      planId,
      responsableId,
      texto(seg.accionConcertada),
      /* El instrumento no pide fecha de concertación aparte: se concierta
         durante la visita, así que es la fecha de diligenciamiento. */
      llaves.fechaConcertacion,
      texto(seg.seg1Fecha),
      texto(seg.seg1Estado),
      texto(seg.seg1MotivoNc),
      texto(seg.seg2Fecha),
      texto(seg.seg2Estado),
      texto(seg.seg2MotivoNc)
    ]);
    filas++;
  }

  return filas;
}

/* =========================================================================
   ALERTAS (RN-200 a RN-212)
   -------------------------------------------------------------------------
   El propósito del instrumento es convertir el hallazgo en atención. Sin
   estas filas la ficha queda como una encuesta y no como una decisión.

   `vence_en`, `prioridad_base` y `bloquea_cierre` los calcula el disparador
   trg_alerta_prioridad a partir de la prioridad, así que no se envían.

   aps.alerta_accion queda fuera a propósito: vincular una alerta con la
   acción que la responde (RN-220) requiere que el encuestador lo indique, y
   el formulario todavía no tiene ese control.
   ========================================================================= */

/* La alerta trae su ámbito y una ruta como `familias[0].integrantes[1]`.
   La restricción alerta_ambito_coherente exige que los identificadores
   correspondan exactamente al ámbito, así que se resuelven desde la ruta. */
function resolverAmbitoAlerta(alerta, indices) {
  const ambito = alerta.plan || 'persona';

  if (ambito === 'vivienda') {
    return { ambito: 'vivienda', familiaFichaId: null, integranteId: null };
  }

  const ruta = String(alerta.ruta || '');
  const coincidencia = ruta.match(/^familias\[(\d+)\](?:\.integrantes\[(\d+)\])?/);
  if (!coincidencia) return null;

  const familiaFichaId = indices.familias[Number(coincidencia[1])];
  if (familiaFichaId === undefined) return null;

  if (ambito === 'familia') {
    return { ambito: 'familia', familiaFichaId: familiaFichaId, integranteId: null };
  }

  if (coincidencia[2] === undefined) return null;
  const porFamilia = indices.integrantes[Number(coincidencia[1])] || {};
  const integranteId = porFamilia[Number(coincidencia[2])];
  if (integranteId === undefined) return null;

  return { ambito: 'persona', familiaFichaId: familiaFichaId, integranteId: integranteId };
}

async function guardarAlertas(cliente, fichaId, alertas, indices) {
  /* Se reemplazan: al reenviar la ficha, las alertas son las que el motor
     deduce de los datos actuales, no la unión con las de la vez anterior. */
  await cliente.query('DELETE FROM aps.alerta WHERE ficha_id = $1', [fichaId]);

  let escritas = 0;
  const sinResolver = [];

  for (const alerta of (Array.isArray(alertas) ? alertas : [])) {
    const destino = resolverAmbitoAlerta(alerta, indices);

    if (!destino) {
      sinResolver.push(alerta.codigo + (alerta.ruta ? '@' + alerta.ruta : ''));
      continue;
    }

    await cliente.query(`
      INSERT INTO aps.alerta (
        ficha_id, regla_codigo, ambito, familia_ficha_id, integrante_id,
        prioridad, motivo
      ) VALUES ($1,$2,$3,$4,$5,$6,$7)
    `, [
      fichaId,
      alerta.codigo,
      destino.ambito,
      destino.familiaFichaId,
      destino.integranteId,
      alerta.prioridad,
      alerta.titulo
    ]);
    escritas++;
  }

  if (sinResolver.length > 0) {
    console.warn('  Alertas sin ámbito resoluble (no se guardaron): ' + sinResolver.join(', '));
  }

  return escritas;
}

/* Quién firma la ficha no lo decide el cuerpo de la petición sino la sesión.
   Ficha nueva: el equipo y el responsable (ítems 10, 12-14) son los del
   usuario que la envía. Ficha existente: se conservan los originales —quien
   corrige no pasa a ser el responsable de la captura— y la corrección queda
   en auditoría a nombre de quien la hizo. */
async function fichaExistente(cliente, codigo) {
  if (!codigo) return null;
  const r = await cliente.query(`
    SELECT f.id, f.equipo_salud_id, f.responsable_id, eq.codigo AS equipo_codigo,
           r.tipo_id, r.numero_id, r.nombre_completo, r.perfil_profesional, r.perfil_otro,
           f.hogar_id, h.codigo AS hogar_codigo, f.diligenciada_en
      FROM aps.ficha f
      JOIN aps.equipo_salud eq ON eq.id = f.equipo_salud_id
      JOIN aps.funcionario r   ON r.id = f.responsable_id
      JOIN aps.hogar h         ON h.id = f.hogar_id
     WHERE f.codigo = $1
  `, [codigo]);
  return r.rows[0] || null;
}

/* RN-228 — La autorización vigente que la coordinación o el maestro le dieron
   a este usuario para corregir esta ficha —incluido lo registrado en su plan
   de cuidado—, o null. */
async function autorizacionVigente(cliente, fichaId, usuarioId) {
  const r = await cliente.query(`
    SELECT id FROM aps.permiso_plan
     WHERE ficha_id = $1 AND usuario_id = $2 AND usado_en IS NULL AND revocado_en IS NULL
     LIMIT 1
  `, [fichaId, usuarioId]);
  return r.rows[0] || null;
}

/* RN-228 — Un dispositivo reenvía la ficha que capturó cuando no alcanzó a
   recibir la respuesta del primer envío (se cortó la red): para el servidor
   ya existe. No es una corrección —el formulario las marca con
   `esCorreccion`—: la envía su mismo autor y trae el mismo instante de
   diligenciamiento que quedó guardado. Se acepta sin autorización, como
   antes; lo registrado en el plan sigue protegido igual. */
function esReenvioDeLaCaptura(existente, cuerpo, usuario) {
  if (!existente || cuerpo.esCorreccion === true || cuerpo.soloPlan === true) return false;
  if (Number(existente.responsable_id) !== Number(usuario.funcionarioId)) return false;
  const enviado = typeof cuerpo.fechaRegistro === 'string' ? Date.parse(cuerpo.fechaRegistro) : NaN;
  return Number.isFinite(enviado) && existente.diligenciada_en instanceof Date &&
    existente.diligenciada_en.getTime() === enviado;
}

/* RN-225 / RN-228 — La autorización se gasta en la misma transacción que el
   guardado que la usó: si el guardado falla, sigue vigente. */
async function gastarAutorizacion(cliente, fichaId, usuario, encuesta, autorizacion) {
  await cliente.query('UPDATE aps.permiso_plan SET usado_en = now() WHERE id = $1', [autorizacion.id]);
  await cliente.query(`
    INSERT INTO aud.evento (ficha_id, entidad, entidad_id, tipo, campo, valor_nuevo, funcionario_id, dispositivo_id)
    VALUES ($1, 'ficha', $1, 'modificacion', 'autorizacion', $2, $3, $4)
  `, [fichaId, 'guardado con la autorización ' + autorizacion.id, usuario.funcionarioId, texto(encuesta.dispositivoId)]);
}

/* RN-225 / RN-228 — Queda en auditoría quién tocó el plan y cómo: si sólo
   completó lo que faltaba, o si cambió lo registrado —con qué autorización, o
   por su rol (maestro o coordinación del EBS)—. */
async function registrarCambioDelPlan(cliente, fichaId, usuario, encuesta, autorizacion, modificaRegistrado) {
  const detalle = !modificaRegistrado ? 'completado'
    : autorizacion ? 'registrado modificado con la autorización ' + autorizacion.id
      : usuario.rol === 'maestro' ? 'registrado modificado por el maestro'
        : 'registrado modificado por ' + roles.etiquetaDeRol(usuario.rol);
  await cliente.query(`
    INSERT INTO aud.evento (ficha_id, entidad, entidad_id, tipo, campo, valor_nuevo, funcionario_id, dispositivo_id)
    VALUES ($1, 'plan_cuidado', $1, 'modificacion', 'plan_cuidado', $2, $3, $4)
  `, [fichaId, detalle, usuario.funcionarioId, texto(encuesta.dispositivoId)]);
}

/* RN-228 — «Evolucionar el plan de cuidado» desde el historial: sólo se
   escriben los planes, sobre las familias e integrantes que ya están en la
   base. Lo registrado en la visita no se toca, llegue como llegue en el
   cuerpo; las llaves heredadas de cada plan salen de la base, no del cuerpo.
   Un plan de una familia o un integrante que no está registrado no tiene
   dónde colgar y se omite. */
async function guardarSoloPlanes(cliente, fichaId, encuesta) {
  const ficha = (await cliente.query(`
    SELECT to_char(f.fecha_diligenciamiento, 'YYYY-MM-DD') AS fecha, eq.codigo AS ebs, h.codigo AS vivienda
      FROM aps.ficha f
      JOIN aps.equipo_salud eq ON eq.id = f.equipo_salud_id
      JOIN aps.hogar h         ON h.id = f.hogar_id
     WHERE f.id = $1
  `, [fichaId])).rows[0];

  const familiasDb = (await cliente.query(`
    SELECT ff.id, fa.consecutivo, fa.codigo
      FROM aps.familia_ficha ff
      JOIN aps.familia fa ON fa.id = ff.familia_id
     WHERE ff.ficha_id = $1
  `, [fichaId])).rows;

  const integrantesDb = familiasDb.length === 0 ? [] : (await cliente.query(`
    SELECT i.id, i.familia_ficha_id, p.tipo_id, p.numero_id
      FROM aps.integrante i
      JOIN aps.persona p ON p.id = i.persona_id
     WHERE i.familia_ficha_id = ANY($1::bigint[])
  `, [familiasDb.map(function (f) { return f.id; })])).rows;

  function conLlaves(plan, extra) {
    return Object.assign({}, plan, { codigoEbs: ficha.ebs, codigoVivienda: ficha.vivienda }, extra || {});
  }

  let filas = 0;
  const familias = Array.isArray(encuesta.familias) ? encuesta.familias : [];

  for (let fi = 0; fi < familias.length; fi++) {
    const familia = familias[fi] || {};
    const registrada = familiasDb.find(function (f) { return Number(f.consecutivo) === fi + 1; });
    if (!registrada) continue;

    for (const integrante of (Array.isArray(familia.integrantes) ? familia.integrantes : [])) {
      if (!integrante || !integrante.planPersona) continue;
      const persona = integrantesDb.find(function (i) {
        return String(i.familia_ficha_id) === String(registrada.id) &&
          i.tipo_id === texto(integrante.tipoId) && i.numero_id === texto(integrante.numeroId);
      });
      if (!persona) continue;
      filas += await guardarPlan(cliente, fichaId, 'persona', conLlaves(integrante.planPersona, {
        codigoFamilia: registrada.codigo, tipoIdIntegrante: persona.tipo_id, numeroIdIntegrante: persona.numero_id
      }), { familiaFichaId: registrada.id, integranteId: persona.id, fechaConcertacion: ficha.fecha });
    }

    if (familia.planFamilia) {
      filas += await guardarPlan(cliente, fichaId, 'familia',
        conLlaves(familia.planFamilia, { codigoFamilia: registrada.codigo }),
        { familiaFichaId: registrada.id, fechaConcertacion: ficha.fecha });
    }
  }

  if (encuesta.planVivienda) {
    filas += await guardarPlan(cliente, fichaId, 'vivienda', conLlaves(encuesta.planVivienda),
      { fechaConcertacion: ficha.fecha });
  }

  return filas;
}

/* Una visita nueva no puede pisar la ficha de otra persona.

   `aps.ficha.codigo` es la llave de la visita en toda la base. El código que
   genera captura_local.js no se repite, pero quedan fichas con código digitado
   a mano («CF001», que la ficha técnica APS124CCFP reinicia con cada familia)
   y dispositivos que pueden restaurarse. Si un código llegaba repetido desde
   otro encuestador, el segundo guardado se tomaba como corrección del
   primero: reescribía la ficha ajena —su hogar, su vivienda, sus familias—
   sin avisar a nadie. Si el equipo era otro, el encuestador recibía un «no
   puede corregir esta ficha» que no entendía.

   Se distingue por la marca `esCorreccion` que pone el formulario y por quién
   la envía: una corrección pasa (la autorización decide si puede hacerla), y
   el responsable que reenvía su propia visita —un reintento de
   sincronización, o la señal que se cayó antes de recibir los códigos—
   también. El código de vivienda ya no sirve para distinguirlas: lo asigna
   el servidor (08_codigos_vivienda.sql) y una ficha anterior trae el que se
   digitó. */
function colisionDeCodigoDeFicha(existente, cuerpo, usuario) {
  if (!existente || cuerpo.esCorreccion === true) return null;
  if (usuario && Number(existente.responsable_id) === Number(usuario.funcionarioId)) return null;

  const codigo = texto(cuerpo.codigoFicha);
  return {
    codigo: 'RN-015',
    ruta: 'codigoFicha',
    campo: 'codigoFicha',
    severidad: 'bloqueo',
    mensaje: 'El código de ficha ' + codigo + ' ya está registrado por otro encuestador. ' +
      'No se guardó para no reemplazar esa ficha; comuníquelo al administrador.',
    recibido: codigo
  };
}

function fijarFirma(cuerpo, firma) {
  cuerpo.equipoSaludId = firma.equipoCodigo;
  cuerpo.responsableTipoId = firma.tipoId;
  cuerpo.responsableNumeroId = firma.numeroId;
  cuerpo.responsableNombre = firma.nombre;
  cuerpo.perfilProfesional = firma.perfil;
  cuerpo.perfilProfesionalOtro = firma.perfilOtro || null;

  /* RN-111 / RN-120 / RN-130: las llaves heredadas de los planes copian el
     ítem 10; si el equipo cambia aquí, cambian con él. */
  const planes = [cuerpo.planVivienda];
  (Array.isArray(cuerpo.familias) ? cuerpo.familias : []).forEach(function (familia) {
    planes.push(familia && familia.planFamilia);
    (Array.isArray(familia && familia.integrantes) ? familia.integrantes : []).forEach(function (integrante) {
      planes.push(integrante && integrante.planPersona);
    });
  });
  planes.forEach(function (plan) {
    if (plan && typeof plan === 'object' && plan.codigoEbs !== undefined) plan.codigoEbs = firma.equipoCodigo;
  });
}

/* =========================================================================
   Códigos de vivienda y familia (ítems 25 y 26) y NUV
   -------------------------------------------------------------------------
   No se digitan: los asigna el servidor al guardar, con la estructura del
   anexo técnico SI-APS (variables 123 y 124, ver 08_codigos_vivienda.sql):

     vivienda  T53MT03H0005        el consecutivo H reinicia por microterritorio
     familia   T53MT03H0005F0001   el consecutivo F reinicia en cada vivienda
     NUV       NUV0012             número único de vivienda, global, no se
                                   reinicia y no va en el archivo plano

   Se asignan aquí y no en el dispositivo: el consecutivo es de todo el
   microterritorio, y dos tabletas sin señal tomarían el mismo número. Una
   ficha guardada sin conexión los recibe al sincronizarse.
   ========================================================================= */
const DIGITOS_CONSECUTIVO = 4;

function consecutivoConCeros(n) {
  return String(n).padStart(DIGITOS_CONSECUTIVO, '0');
}

function codigoDeVivienda(territorio, microterritorio, consecutivo) {
  return territorio + microterritorio + 'H' + consecutivoConCeros(consecutivo);
}

function codigoDeFamilia(codigoVivienda, consecutivo) {
  return codigoVivienda + 'F' + consecutivoConCeros(consecutivo);
}

function textoNuv(nuv) {
  return nuv === null || nuv === undefined ? null : 'NUV' + consecutivoConCeros(nuv);
}

/* Máximo + 1 bajo un bloqueo consultivo de la transacción: quienes guardan a
   la vez en la misma serie esperan su turno, así el número no se repite ni
   deja huecos (una secuencia los dejaría con cada transacción revertida). */
async function siguienteNuv(cliente) {
  await cliente.query("SELECT pg_advisory_xact_lock(hashtext('hogar/nuv'))");
  const r = await cliente.query('SELECT coalesce(max(nuv), 0) + 1 AS n FROM aps.hogar');
  return Number(r.rows[0].n);
}

async function siguienteConsecutivoVivienda(cliente, territorio, microterritorio) {
  await cliente.query(
    "SELECT pg_advisory_xact_lock(hashtext('hogar/' || $1 || '/' || $2))", [territorio, microterritorio]);
  const r = await cliente.query(`
    SELECT coalesce(max(consecutivo_sispro), 0) + 1 AS n
      FROM aps.hogar
     WHERE territorio_codigo = $1 AND microterritorio_codigo = $2
  `, [territorio, microterritorio]);
  return Number(r.rows[0].n);
}

/* Las llaves heredadas de un plan (RN-112/121/122/131/132) copian los
   códigos que se acaban de asignar. Sólo se tocan las que el plan trae: un
   plan sin código de vivienda no se diligenció y no se guarda (guardarPlan). */
function fijarLlavesDelPlan(plan, codigoVivienda, codigoFamiliaDelPlan) {
  if (!plan || typeof plan !== 'object') return;
  if (plan.codigoVivienda !== undefined) plan.codigoVivienda = codigoVivienda;
  if (codigoFamiliaDelPlan !== undefined && plan.codigoFamilia !== undefined) plan.codigoFamilia = codigoFamiliaDelPlan;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const usuario = await requerirSesion(req, res);
  if (!usuario) return;

  if (!req.body || typeof req.body !== 'object') {
    return res.status(400).json({ error: 'La petición no trae una ficha' });
  }

  let cliente;

  try {
    cliente = await obtenerPool().connect();

    /* --- Autorización sobre la ficha concreta ------------------------------ */
    const existente = await fichaExistente(cliente, texto(req.body.codigoFicha));
    let tipoEvento;
    const soloPlan = req.body.soloPlan === true;
    /* RN-228: la autorización vigente con que este usuario vuelve a guardar
       la ficha, cuando su rol no le alcanza. Se gasta al guardar. */
    let autorizacion = null;

    const colision = colisionDeCodigoDeFicha(existente, req.body, usuario);
    if (colision) {
      console.error('  Ficha rechazada: ' + colision.recibido + ' ya pertenece a otra vivienda');
      return res.status(400).json({
        error: 'La ficha no cumple las reglas de negocio',
        total: 1,
        bloqueos: [colision],
        advertencias: []
      });
    }

    if (existente) {
      /* Una ficha guardada se vuelve a guardar sin pedir autorización sólo
         si el rol la corrige (coordinación, administrador, maestro), si se
         está evolucionando su plan dentro del alcance del rol, o si es el
         reenvío de la captura original. Si no, con una autorización vigente
         de la coordinación o del maestro (RN-228). */
      const fichaRef = { equipoSaludId: Number(existente.equipo_salud_id), responsableId: Number(existente.responsable_id) };
      const sinAutorizacion = roles.puedeCorregir(usuario, fichaRef) ||
        (soloPlan && roles.puedeEvolucionar(usuario, fichaRef)) ||
        esReenvioDeLaCaptura(existente, req.body, usuario);
      if (!sinAutorizacion) autorizacion = await autorizacionVigente(cliente, existente.id, usuario.id);
      if (!sinAutorizacion && !autorizacion) {
        const laVe = roles.puedeVerFicha(usuario, fichaRef);
        console.error('  ' + (soloPlan ? 'Evolución' : 'Corrección') + ' rechazada: ' + texto(req.body.codigoFicha) +
          (laVe ? ' sin autorización de ' : ' fuera del alcance de ') + usuario.documento + ' (' + usuario.rol + ')');
        return res.status(403).json({
          error: !laVe ? 'No puede corregir esta ficha: pertenece a otro equipo.'
            : soloPlan ? 'Su rol no permite evolucionar el plan de esta ficha: la diligenció otra persona.'
              : 'Esta ficha ya está guardada: para corregirla necesita la autorización de la coordinación del EBS ' +
                'o del usuario maestro.',
          codigo: laVe ? 'requiere_autorizacion' : 'sin_permiso'
        });
      }
      fijarFirma(req.body, {
        equipoCodigo: existente.equipo_codigo, tipoId: existente.tipo_id, numeroId: existente.numero_id,
        nombre: existente.nombre_completo, perfil: existente.perfil_profesional, perfilOtro: existente.perfil_otro
      });
      tipoEvento = 'modificacion';
    } else {
      if (!roles.puede(usuario.rol, 'ficha.crear')) {
        return res.status(403).json({ error: 'Su rol no permite registrar fichas nuevas.', codigo: 'sin_permiso' });
      }
      if (!usuario.equipoCodigo) {
        return res.status(403).json({ error: 'Su cuenta no tiene un Equipo Básico de Salud asignado. Solicítelo al administrador.',
          codigo: 'sin_equipo' });
      }
      fijarFirma(req.body, {
        equipoCodigo: usuario.equipoCodigo, tipoId: usuario.tipoId, numeroId: usuario.documento,
        nombre: usuario.nombre, perfil: usuario.perfilProfesional || usuario.rol, perfilOtro: usuario.perfilOtro
      });
      tipoEvento = 'creacion';
    }

    /* RN-228 — «Evolucionar el plan» sólo existe para una ficha ya guardada. */
    if (soloPlan && !existente) {
      return res.status(400).json({ error: 'Sólo se puede evolucionar el plan de cuidado de una ficha ya guardada.',
        codigo: 'sin_ficha' });
    }

    /* RN-228 — Lo registrado en el plan de cuidado sólo se completa. Cambiarlo
       o quitarlo exige una autorización vigente de la coordinación o del
       maestro para este usuario y esta ficha —se gasta al guardar— o un rol
       que lo modifique (coordinación y maestro). Vale para toda forma de
       volver a guardar una ficha existente: corregirla, evolucionar el plan o
       reenviarla al sincronizar. */
    let modificaPlanRegistrado = false;
    if (existente) {
      const cambios = cambiosEnPlanRegistrado(await leerFichaCompleta(cliente, existente.id), req.body);
      if (cambios.length > 0) {
        if (!roles.puede(usuario.rol, 'plan.modificar_registrado')) {
          autorizacion = autorizacion || await autorizacionVigente(cliente, existente.id, usuario.id);
          if (!autorizacion) {
            console.error('  Plan registrado protegido: ' + texto(req.body.codigoFicha) +
              ' — ' + cambios.length + ' cambio(s) sin autorización');
            return res.status(409).json({
              error: 'Lo ya registrado en el plan de cuidado no se puede cambiar sin autorización de la ' +
                'coordinación del EBS o del usuario maestro. Sólo puede completar lo que falta.',
              codigo: 'plan_registrado',
              total: cambios.length,
              bloqueos: cambios,
              advertencias: []
            });
          }
        }
        modificaPlanRegistrado = true;
      }
    }

    /* RN-016 limita a 30 días la antigüedad de una ficha que se registra; no
       impide corregir una que ya quedó registrada a tiempo. Lo decide la base
       —si el código ya existe—, nunca el cuerpo de la petición. */
    req.body.yaRegistradaEnLaBase = Boolean(existente);

    /* --- Validación previa -------------------------------------------------
       Se hace con una conexión del pool pero fuera de la transacción: si la
       ficha no pasa, no se abre transacción alguna. */
    const validacion = await validar(cliente, req.body);
    const { advertencias, alertas, planCuidado } = validacion;
    /* Al evolucionar el plan sólo cuentan sus propios bloqueos: el resto de
       la ficha ya está registrado y no se vuelve a escribir. */
    const bloqueos = soloPlan
      ? validacion.bloqueos.filter(function (b) { return esDelPlan(b.ruta); })
      : validacion.bloqueos;

    if (bloqueos.length > 0) {
      /* El detalle viaja en la respuesta, pero el rechazo sólo se veía
         abriendo la consola del navegador: en el servidor quedaba un «400» sin
         motivo. Se registra aquí para que el log diga por qué, que es lo
         primero que se mira cuando una sincronización no entra. */
      console.error('  Ficha rechazada: ' + (texto(req.body && req.body.codigoFicha) || '(sin código)') +
        ' — ' + bloqueos.length + ' bloqueo(s)');
      bloqueos.forEach(function (b) {
        console.error('    · ' + b.codigo + ' @ ' + b.ruta + ': ' + b.mensaje);
      });

      return res.status(400).json({
        error: 'La ficha no cumple las reglas de negocio',
        total: bloqueos.length,
        bloqueos: bloqueos,
        advertencias: advertencias
      });
    }

    /* Se escribe la ficha preparada, no el cuerpo crudo: trae la dirección
       recompuesta desde sus componentes. */
    const encuesta = validacion.ficha;
    await cliente.query('BEGIN');

    if (soloPlan) {
      const filasSoloPlan = await guardarSoloPlanes(cliente, existente.id, encuesta);
      await registrarCambioDelPlan(cliente, existente.id, usuario, encuesta, autorizacion, modificaPlanRegistrado);
      if (autorizacion) await gastarAutorizacion(cliente, existente.id, usuario, encuesta, autorizacion);
      await cliente.query('COMMIT');

      console.log('  Plan de cuidado evolucionado: ' + texto(encuesta.codigoFicha) + ' (id ' + existente.id +
        ') — ' + filasSoloPlan + ' fila(s) del plan' +
        (planCuidado && planCuidado.pendiente ? ' — sigue pendiente' : ''));

      return res.status(200).json({
        mensaje: 'Plan de cuidado guardado',
        fichaId: existente.id,
        codigo: texto(encuesta.codigoFicha),
        soloPlan: true,
        filasPlanCuidado: filasSoloPlan,
        advertencias: advertencias.filter(function (a) { return esDelPlan(a.ruta); }),
        planCuidado: planCuidado
      });
    }

    /* --- 1. Equipo de salud (RN-010) --- */
    const equipoRes = await cliente.query(`
      INSERT INTO aps.equipo_salud (codigo, activo)
      VALUES ($1, true)
      ON CONFLICT (codigo) DO UPDATE SET activo = true
      RETURNING id
    `, [texto(encuesta.equipoSaludId)]);
    const equipoId = equipoRes.rows[0].id;

    /* --- 2. Funcionario responsable (RN-012 a RN-014) ---
       La aclaración del perfil «Otro» va también en el INSERT: PostgreSQL
       revisa los CHECK sobre la fila propuesta antes de detectar el
       conflicto, así que sin ella func_perfil_otro rechaza la ficha aunque
       el funcionario ya tenga su aclaración guardada. */
    const funcionarioRes = await cliente.query(`
      INSERT INTO aps.funcionario (tipo_id, numero_id, nombre_completo, perfil_profesional, perfil_otro, activo)
      VALUES ($1, $2, $3, $4, $5, true)
      ON CONFLICT (tipo_id, numero_id) DO UPDATE
        SET nombre_completo = EXCLUDED.nombre_completo,
            perfil_profesional = EXCLUDED.perfil_profesional,
            perfil_otro = EXCLUDED.perfil_otro,
            activo = true
      RETURNING id
    `, [
      texto(encuesta.responsableTipoId),
      texto(encuesta.responsableNumeroId),
      texto(encuesta.responsableNombre) || texto(encuesta.cabezaFamilia),
      texto(encuesta.perfilProfesional),
      texto(encuesta.perfilProfesionalOtro)
    ]);
    const responsableId = funcionarioRes.rows[0].id;

    /* --- 3. Hogar (RN-025) y sus códigos ---
       Ficha nueva: vivienda nueva, con su NUV y su consecutivo dentro del
       microterritorio; el código del ítem 25 que llegue en el cuerpo no se
       toma. Corrección o reenvío: la vivienda es la de la ficha guardada y
       conserva sus códigos; sólo si cambió de microterritorio recibe el
       consecutivo siguiente del nuevo (la variable 123 reinicia por
       microterritorio). */
    const territorio = texto(encuesta.territorio);
    const microterritorio = texto(encuesta.microterritorio);
    const datosHogar = [
      texto(encuesta.municipioCodigo) || '76001',
      texto(encuesta.areaUbicacion),
      territorio,
      microterritorio,
      texto(encuesta.divisionTerritorial),
      texto(encuesta.direccion) || texto(encuesta.direccionLegible),
      decimal(encuesta.latitud),
      decimal(encuesta.longitud),
      texto(encuesta.ubicacionReferencia),
      decimal(encuesta.latitud) === null || decimal(encuesta.longitud) === null,
      componentesDeDireccion(encuesta.direccionComponentes),
      /* RN-022: sin coordenadas, el motivo es obligatorio en el formulario;
         antes se validaba y se descartaba. */
      texto(encuesta.motivoSinGeorreferenciacion)
    ];

    let hogarId;
    let nuv;
    let consecutivoVivienda;

    if (existente) {
      const actual = (await cliente.query(`
        SELECT id, nuv, territorio_codigo, microterritorio_codigo, consecutivo_sispro
          FROM aps.hogar WHERE id = $1 FOR UPDATE
      `, [existente.hogar_id])).rows[0];
      hogarId = actual.id;
      nuv = actual.nuv !== null ? Number(actual.nuv) : await siguienteNuv(cliente);
      const mismoMicroterritorio = actual.territorio_codigo === territorio &&
        actual.microterritorio_codigo === microterritorio;
      consecutivoVivienda = mismoMicroterritorio && actual.consecutivo_sispro !== null
        ? Number(actual.consecutivo_sispro)
        : await siguienteConsecutivoVivienda(cliente, territorio, microterritorio);
    } else {
      nuv = await siguienteNuv(cliente);
      consecutivoVivienda = await siguienteConsecutivoVivienda(cliente, territorio, microterritorio);
    }

    const codigoHogar = codigoDeVivienda(territorio, microterritorio, consecutivoVivienda);

    if (existente) {
      await cliente.query(`
        UPDATE aps.hogar SET
          municipio_codigo         = $5,
          area_ubicacion           = $6,
          territorio_codigo        = $7,
          microterritorio_codigo   = $8,
          division_territorial     = $9,
          direccion_normalizada    = $10,
          latitud                  = $11,
          longitud                 = $12,
          punto_referencia         = $13,
          geo_pendiente            = $14,
          direccion_componentes    = $15::jsonb,
          geo_motivo_imposibilidad = $16,
          codigo                   = $2,
          nuv                      = $3,
          consecutivo_sispro       = $4,
          actualizado_en           = now()
         WHERE id = $1
      `, [hogarId, codigoHogar, nuv, consecutivoVivienda].concat(datosHogar));
    } else {
      hogarId = (await cliente.query(`
        INSERT INTO aps.hogar (
          codigo, nuv, consecutivo_sispro,
          municipio_codigo, area_ubicacion, territorio_codigo,
          microterritorio_codigo, division_territorial, direccion_normalizada,
          latitud, longitud, punto_referencia, geo_pendiente,
          direccion_componentes, geo_motivo_imposibilidad
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb, $15)
        RETURNING id
      `, [codigoHogar, nuv, consecutivoVivienda].concat(datosHogar))).rows[0].id;
    }

    /* El resto de la ficha —ítem 26, familias y llaves de los planes— trabaja
       ya con los códigos asignados. */
    const familiasCuerpo = Array.isArray(encuesta.familias) ? encuesta.familias : [];
    encuesta.idHogar = codigoHogar;
    encuesta.nuv = textoNuv(nuv);
    encuesta.idFamilia = familiasCuerpo.length ? codigoDeFamilia(codigoHogar, 1) : null;

    /* El motor trae anexo.js cargado: con él se escriben las variables nuevas
       del anexo técnico y se decide cuáles aplican. */
    const motor = obtenerMotor();
    const lectorFicha = motor.lectorDeRespuestas([encuesta], { fechaFicha: texto(encuesta.fechaDiligenciamiento) });
    await anexoBd.escribirAnexo(cliente, motor, 'hogar', hogarId, encuesta, lectorFicha);

    /* --- 4. Ficha ---
       La fecha va tal como se capturó. Si incumple RN-016 el trigger la
       rechaza y el encuestador se entera; antes se reescribía en silencio. */
    const fichaRes = await cliente.query(`
      INSERT INTO aps.ficha (
        codigo, consentimiento, situacion_inminente, departamento_codigo, municipio_codigo,
        uzpe_codigo, prestador_codigo, hogar_id, equipo_salud_id, responsable_id,
        fecha_diligenciamiento, entorno_abordaje, nombre_institucion, lider_entorno,
        jovenes_en_paz, estado, cerrada_en, fechas_modificacion,
        motivo_cierre_incompleto, referencia_familia, diligenciada_en
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
      /* Reenviar la ficha tiene que actualizarla, no sólo sellarle la fecha.
         Antes aquí se actualizaba únicamente fechas_modificacion: corregir
         el entorno de abordaje, el responsable o la fecha de la visita
         respondía 200 y no cambiaba nada en la base. La ficha corregida se
         quedaba en el dispositivo y la base seguía con el dato malo. */
      ON CONFLICT (codigo) DO UPDATE SET
        consentimiento         = EXCLUDED.consentimiento,
        situacion_inminente    = EXCLUDED.situacion_inminente,
        departamento_codigo    = EXCLUDED.departamento_codigo,
        municipio_codigo       = EXCLUDED.municipio_codigo,
        uzpe_codigo            = EXCLUDED.uzpe_codigo,
        prestador_codigo       = EXCLUDED.prestador_codigo,
        hogar_id               = EXCLUDED.hogar_id,
        equipo_salud_id        = EXCLUDED.equipo_salud_id,
        responsable_id         = EXCLUDED.responsable_id,
        fecha_diligenciamiento = EXCLUDED.fecha_diligenciamiento,
        entorno_abordaje       = EXCLUDED.entorno_abordaje,
        nombre_institucion     = EXCLUDED.nombre_institucion,
        lider_entorno          = EXCLUDED.lider_entorno,
        jovenes_en_paz         = EXCLUDED.jovenes_en_paz,
        estado                 = EXCLUDED.estado,
        cerrada_en             = EXCLUDED.cerrada_en,
        fechas_modificacion    = EXCLUDED.fechas_modificacion,
        motivo_cierre_incompleto = EXCLUDED.motivo_cierre_incompleto,
        referencia_familia     = EXCLUDED.referencia_familia,
        /* El momento de diligenciamiento se fija una vez: reenviar o corregir la
           ficha no lo mueve. Una fila anterior a la columna lo trae vacío y lo
           toma de esta primera vez. */
        diligenciada_en        = COALESCE(aps.ficha.diligenciada_en, EXCLUDED.diligenciada_en)
      RETURNING id
    `, [
      texto(encuesta.codigoFicha),
      booleano(encuesta.consentimiento),
      /* Ítem 2: selección múltiple desde el anexo. La columna guarda la
         principal y la lista completa va a aps.ficha_situacion_inminente. */
      anexoBd.opcionPrincipal(motor, 'situacionInminente', encuesta.situacionInminente),
      texto(encuesta.departamentoCodigo) || '76',
      texto(encuesta.municipioCodigo) || '76001',
      texto(encuesta.uzpe),
      texto(encuesta.prestadorPrimario),
      hogarId,
      equipoId,
      responsableId,
      texto(encuesta.fechaDiligenciamiento),
      texto(encuesta.entornoAbordaje),
      texto(encuesta.nombreInstitucion),
      /* RN-019: en Hogar se deriva del responsable económico (ver liderDelEntorno
         en reglas.js); si la visita no alcanzó a caracterizar a nadie, la
         columna NOT NULL no puede quedar vacía. */
      texto(encuesta.cabezaFamilia) || 'Sin registrar',
      booleano(encuesta.jovenesEnPaz),
      /* RN-222: la visita cerrada por causa externa no entra al denominador
         de cobertura, y el enum de la base la distingue explícitamente. */
      encuesta.visitaIncompleta ? 'incompleta_causa_externa' : 'cerrada',
      new Date(),
      JSON.stringify(encuesta.fechasModificacion || []),
      /* RN-222: la restricción ficha_motivo_incompleta exige el motivo cuando
         la visita se cierra incompleta. No se escribía, y ese cierre fallaba
         con un 500 en la base aunque el formulario lo hubiera pedido. */
      encuesta.visitaIncompleta ? texto(encuesta.motivoVisitaIncompleta) : null,
      texto(encuesta.idFamilia),
      momentoDeDiligenciamiento(encuesta.fechaRegistro)
    ]);

    /* `DO UPDATE` siempre devuelve la fila, exista o no: el id sirve tanto
       para la ficha nueva como para la que se acaba de corregir. */
    const fichaId = fichaRes.rows[0].id;

    /* RN-225: quién creó o corrigió, con las coordenadas de la captura. */
    await cliente.query(`
      INSERT INTO aud.evento (ficha_id, entidad, entidad_id, tipo, funcionario_id, dispositivo_id, latitud, longitud)
      VALUES ($1, 'ficha', $1, $2, $3, $4, $5, $6)
    `, [fichaId, tipoEvento, usuario.funcionarioId, texto(encuesta.dispositivoId),
      decimal(encuesta.latitud), decimal(encuesta.longitud)]);

    await anexoBd.escribirListasConvertidas(cliente, 'ficha', fichaId, encuesta);
    await anexoBd.escribirAnexo(cliente, motor, 'ficha', fichaId, encuesta, lectorFicha);

    /* --- 5. Vivienda --- */
    await cliente.query(`
      INSERT INTO aps.vivienda (
        ficha_id, estrato, hogares_en_vivienda, personas_en_vivienda,
        habitaciones_vivienda, elementos_para_dormir, tipo_vivienda, material_techo,
        vectores, actividad_economica, perros, perros_vacunados, gatos, gatos_vacunados,
        carnet_antirrabico, fuente_agua, disposicion_excretas, aguas_residuales, residuos_solidos
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
      /* La vivienda se actualiza. Con DO NOTHING, corregir el estrato, el
         número de habitaciones o la fuente de agua se aceptaba con un 200 y
         la base conservaba el valor de la primera vez. */
      ON CONFLICT (ficha_id) DO UPDATE SET
        estrato               = EXCLUDED.estrato,
        hogares_en_vivienda   = EXCLUDED.hogares_en_vivienda,
        personas_en_vivienda  = EXCLUDED.personas_en_vivienda,
        habitaciones_vivienda = EXCLUDED.habitaciones_vivienda,
        elementos_para_dormir = EXCLUDED.elementos_para_dormir,
        tipo_vivienda         = EXCLUDED.tipo_vivienda,
        material_techo        = EXCLUDED.material_techo,
        vectores              = EXCLUDED.vectores,
        actividad_economica   = EXCLUDED.actividad_economica,
        perros                = EXCLUDED.perros,
        perros_vacunados      = EXCLUDED.perros_vacunados,
        gatos                 = EXCLUDED.gatos,
        gatos_vacunados       = EXCLUDED.gatos_vacunados,
        carnet_antirrabico    = EXCLUDED.carnet_antirrabico,
        fuente_agua           = EXCLUDED.fuente_agua,
        disposicion_excretas  = EXCLUDED.disposicion_excretas,
        aguas_residuales      = EXCLUDED.aguas_residuales,
        residuos_solidos      = EXCLUDED.residuos_solidos
    `, [
      /* personas_por_habitacion, hacinamiento y hacinamiento_critico no se
         envían: son columnas generadas (RN-032/033). La base las deriva de
         personas_en_vivienda y habitaciones_vivienda, y rechaza cualquier
         valor que se le pase. */
      fichaId,
      texto(encuesta.estrato),
      entero(encuesta.hogaresEnVivienda),
      entero(encuesta.personasEnVivienda),
      entero(encuesta.habitacionesVivienda),
      entero(encuesta.elementosParaDormir),
      texto(encuesta.tipoVivienda),
      texto(encuesta.materialTecho),
      texto(encuesta.vectores),
      booleano(encuesta.actividadEconomica),
      /* Los cuatro conteos son NOT NULL DEFAULT 0 en el esquema: un conteo
         ausente es cero, y eso lo declara la base. No es lo mismo que los
         valores por defecto que se quitaron de este archivo —aquellos
         inventaban identidad y clasificación donde no había dato—. */
      entero(encuesta.perros) || 0,
      entero(encuesta.perrosVacunados) || 0,
      entero(encuesta.gatos) || 0,
      entero(encuesta.gatosVacunados) || 0,
      texto(encuesta.carnetAntirrabico),
      /* Ítems 46 a 49: selección múltiple desde el anexo técnico. Las
         columnas NOT NULL guardan la primera opción; la lista, sus puentes. */
      anexoBd.opcionPrincipal(motor, 'fuenteAgua', encuesta.fuenteAgua),
      anexoBd.opcionPrincipal(motor, 'disposicionExcretas', encuesta.disposicionExcretas),
      anexoBd.opcionPrincipal(motor, 'aguasResiduales', encuesta.aguasResiduales),
      anexoBd.opcionPrincipal(motor, 'residuosSolidos', encuesta.residuosSolidos)
    ]);

    /* Ítems 36, 38 y 40. Las tablas puente cuelgan de vivienda(ficha_id). */
    let filasPuente = await sincronizarPuentes(
      cliente, PUENTES_VIVIENDA, 'ficha_id', fichaId, encuesta
    );
    filasPuente += await anexoBd.escribirListasConvertidas(cliente, 'vivienda', fichaId, encuesta);
    filasPuente += await anexoBd.escribirAnexo(cliente, motor, 'vivienda', fichaId, encuesta, lectorFicha);

    /* --- 6. Familias, personas e integrantes --- */
    const familias = Array.isArray(encuesta.familias) ? encuesta.familias : [];

    /* Los identificadores se guardan por índice para poder resolver después
       el ámbito de cada alerta y de cada plan (RN-220). */
    const indices = { familias: {}, integrantes: {} };
    let filasPlan = 0;

    for (let fi = 0; fi < familias.length; fi++) {
      const familia = familias[fi];

      /* 6a. Familia — identidad subordinada al hogar (RN-026).

         El código lo genera el sistema (ítem 26, sólo lectura): el de la
         vivienda más F y el consecutivo de la familia dentro de ella, que
         reinicia en F0001 en cada vivienda (anexo SI-APS, variable 124). La
         familia se reconoce por vivienda y consecutivo, así que reenviar o
         corregir la ficha la reutiliza; si la vivienda cambió de código, la
         familia lo toma también. */
      const familiaCodigo = codigoDeFamilia(codigoHogar, fi + 1);

      const familiaRes = await cliente.query(`
        INSERT INTO aps.familia (codigo, hogar_id, consecutivo)
        VALUES ($1, $2, $3)
        ON CONFLICT (hogar_id, consecutivo) DO UPDATE SET codigo = EXCLUDED.codigo
        RETURNING id
      `, [familiaCodigo, hogarId, fi + 1]);
      const familiaId = familiaRes.rows[0].id;

      familia.idFamilia = familiaCodigo;
      fijarLlavesDelPlan(familia.planFamilia, codigoHogar, familiaCodigo);
      (Array.isArray(familia.integrantes) ? familia.integrantes : []).forEach(function (integrante) {
        fijarLlavesDelPlan(integrante && integrante.planPersona, codigoHogar, familiaCodigo);
      });

      /* 6b. Caracterización de la familia en esta visita. */
      const familiaFichaRes = await cliente.query(`
        INSERT INTO aps.familia_ficha (
          ficha_id, familia_id, tipo_familia, numero_integrantes,
          cuidador_principal, zarit, redes_apoyo, sin_contacto_telefonico, hogar_numero
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        /* Igual que la vivienda: la caracterización de la familia se corrige,
           no se congela en la primera versión enviada. */
        ON CONFLICT (ficha_id, familia_id) DO UPDATE SET
          tipo_familia            = EXCLUDED.tipo_familia,
          numero_integrantes      = EXCLUDED.numero_integrantes,
          cuidador_principal      = EXCLUDED.cuidador_principal,
          zarit                   = EXCLUDED.zarit,
          redes_apoyo             = EXCLUDED.redes_apoyo,
          sin_contacto_telefonico = EXCLUDED.sin_contacto_telefonico,
          hogar_numero            = EXCLUDED.hogar_numero
        RETURNING id
      `, [
        fichaId,
        familiaId,
        texto(familia.tipoFamilia),
        entero(familia.numeroIntegrantes),
        booleano(familia.cuidadorPrincipal),
        /* RN-053: el Zarit sólo aplica si hay cuidador principal. */
        booleano(familia.cuidadorPrincipal) === true ? texto(familia.zarit) : null,
        texto(familia.redesApoyo),
        /* RN-070: la novedad "sin medio de contacto telefónico". */
        familia.sinContactoTelefonico === true || familia.sinContactoTelefonico === 'si',
        /* RN-028: el hogar de la vivienda al que pertenece; varias familias
           pueden compartirlo. Una ficha capturada antes de este campo no lo
           trae y se lee como un hogar por familia. */
        entero(familia.hogarNumero) || fi + 1
      ]);

      const familiaFichaId = familiaFichaRes.rows[0].id;

      indices.familias[fi] = familiaFichaId;
      indices.integrantes[fi] = {};

      /* Ítems 54, 55 y 57. */
      filasPuente += await sincronizarPuentes(
        cliente, PUENTES_FAMILIA, 'familia_ficha_id', familiaFichaId, familia
      );
      filasPuente += await anexoBd.escribirAnexo(cliente, motor, 'familia_ficha', familiaFichaId, familia,
        motor.lectorDeRespuestas([familia, encuesta], { fechaFicha: texto(encuesta.fechaDiligenciamiento) }));

      /* 6c. Integrantes. */
      const integrantes = Array.isArray(familia.integrantes) ? familia.integrantes : [];

      for (let ii = 0; ii < integrantes.length; ii++) {
        const integrante = integrantes[ii];

        /* 6c-i. Persona — identidad deduplicada por tipo + número (RN-063). */
        const personaRes = await cliente.query(`
          INSERT INTO aps.persona (
            tipo_id, numero_id, primer_nombre, segundo_nombre,
            primer_apellido, segundo_apellido, fecha_nacimiento, sexo,
            nacionalidad, nacionalidad_otra
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          ON CONFLICT (tipo_id, numero_id) DO UPDATE SET
            primer_nombre     = EXCLUDED.primer_nombre,
            segundo_nombre    = EXCLUDED.segundo_nombre,
            primer_apellido   = EXCLUDED.primer_apellido,
            segundo_apellido  = EXCLUDED.segundo_apellido,
            fecha_nacimiento  = EXCLUDED.fecha_nacimiento,
            sexo              = EXCLUDED.sexo,
            nacionalidad      = EXCLUDED.nacionalidad,
            nacionalidad_otra = EXCLUDED.nacionalidad_otra
          RETURNING id
        `, [
          texto(integrante.tipoId),
          texto(integrante.numeroId),
          texto(integrante.primerNombre),
          texto(integrante.segundoNombre),
          texto(integrante.primerApellido),
          texto(integrante.segundoApellido),
          texto(integrante.fechaNacimiento),
          texto(integrante.sexo),
          /* Ítem 65. Antes no se escribía y toda persona quedaba como 'CO' por
             defecto, que es justo lo contrario de lo que pide el seguimiento a
             población extranjera. «Otra» (OT) lleva el país escrito en 65.1. */
          texto(integrante.nacionalidad) || 'CO',
          texto(integrante.nacionalidad) === 'OT' ? texto(integrante.nacionalidadOtra) : null
        ]);
        const personaId = personaRes.rows[0].id;

        /* 6c-ii. Caracterización del integrante en esta visita.
           El régimen y la EAPB van tal como se capturaron: la validación ya
           comprobó la equivalencia que exige int_eapb_condicionada. */
        const integranteRes = await cliente.query(`
          INSERT INTO aps.integrante (
            familia_ficha_id, persona_id, orden,
            genero, autoidentificacion_genero, autoidentificacion_genero_otro,
            orientacion_sexual, orientacion_sexual_otro,
            telefono1, telefono2, rol_familiar,
            ocupacion_codigo, ocupacion_texto, nivel_educativo,
            regimen_afiliacion, eapb_codigo,
            pertenencia_etnica, pueblo_etnico, certificacion_rlcpd,
            intencion_reproductiva, gestacion_actual, lactancia_exclusiva,
            peso, talla, circunferencia_cintura, clasificacion_antropometrica,
            tension_sistolica, tension_diastolica, clasificacion_tension,
            adherencia_tratamiento, consumo_spa,
            puntaje_crafft, puntaje_audit, puntaje_assist,
            ideacion_suicida, limitacion_cotidiana
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,
                    $19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36)
          /* La caracterización clínica es justo lo que más se corrige —un peso
             mal tecleado, una tensión, el régimen de afiliación—. Con DO
             NOTHING la corrección se aceptaba con un 200 y la base seguía
             mostrando el dato viejo. */
          ON CONFLICT (familia_ficha_id, persona_id) DO UPDATE SET
            orden                          = EXCLUDED.orden,
            genero                         = EXCLUDED.genero,
            autoidentificacion_genero      = EXCLUDED.autoidentificacion_genero,
            autoidentificacion_genero_otro = EXCLUDED.autoidentificacion_genero_otro,
            orientacion_sexual             = EXCLUDED.orientacion_sexual,
            orientacion_sexual_otro        = EXCLUDED.orientacion_sexual_otro,
            telefono1                      = EXCLUDED.telefono1,
            telefono2                      = EXCLUDED.telefono2,
            rol_familiar                   = EXCLUDED.rol_familiar,
            ocupacion_codigo               = EXCLUDED.ocupacion_codigo,
            ocupacion_texto               = EXCLUDED.ocupacion_texto,
            nivel_educativo                = EXCLUDED.nivel_educativo,
            regimen_afiliacion             = EXCLUDED.regimen_afiliacion,
            eapb_codigo                    = EXCLUDED.eapb_codigo,
            pertenencia_etnica             = EXCLUDED.pertenencia_etnica,
            pueblo_etnico                  = EXCLUDED.pueblo_etnico,
            certificacion_rlcpd            = EXCLUDED.certificacion_rlcpd,
            intencion_reproductiva         = EXCLUDED.intencion_reproductiva,
            gestacion_actual               = EXCLUDED.gestacion_actual,
            lactancia_exclusiva            = EXCLUDED.lactancia_exclusiva,
            peso                           = EXCLUDED.peso,
            talla                          = EXCLUDED.talla,
            circunferencia_cintura         = EXCLUDED.circunferencia_cintura,
            clasificacion_antropometrica   = EXCLUDED.clasificacion_antropometrica,
            tension_sistolica              = EXCLUDED.tension_sistolica,
            tension_diastolica             = EXCLUDED.tension_diastolica,
            clasificacion_tension          = EXCLUDED.clasificacion_tension,
            adherencia_tratamiento         = EXCLUDED.adherencia_tratamiento,
            consumo_spa                    = EXCLUDED.consumo_spa,
            puntaje_crafft                 = EXCLUDED.puntaje_crafft,
            puntaje_audit                  = EXCLUDED.puntaje_audit,
            puntaje_assist                 = EXCLUDED.puntaje_assist,
            ideacion_suicida               = EXCLUDED.ideacion_suicida,
            limitacion_cotidiana           = EXCLUDED.limitacion_cotidiana
          RETURNING id
        `, [
          familiaFichaId,
          personaId,
          ii + 1,
          texto(integrante.genero),
          texto(integrante.autoidentificacionGenero),
          texto(integrante.autoidentificacionGeneroOtro),
          texto(integrante.orientacionSexual),
          texto(integrante.orientacionSexualOtro),
          texto(integrante.telefono1),
          texto(integrante.telefono2),
          texto(integrante.rolFamiliar),
          /* Ítem 73: código CIUO de la tabla de SISPRO (llave foránea a
             cat.ocupacion_ciuo). Lo que no sea un código —las fichas de
             cuando la ocupación era texto libre— va a ocupacion_texto. */
          motor.CAT_OCUPACION_CIUO.some(function (o) { return o.valor === texto(integrante.ocupacion); })
            ? texto(integrante.ocupacion) : null,
          motor.CAT_OCUPACION_CIUO.some(function (o) { return o.valor === texto(integrante.ocupacion); })
            ? null : texto(integrante.ocupacion),
          texto(integrante.nivelEducativo),
          texto(integrante.regimenAfiliacion),
          texto(integrante.eapb),
          texto(integrante.pertenenciaEtnica),
          texto(integrante.puebloEtnico),
          texto(integrante.certificacionRlcpd),
          booleano(integrante.intencionReproductiva),
          booleano(integrante.gestacionActual),
          texto(integrante.lactanciaExclusiva),
          decimal(integrante.peso),
          decimal(integrante.talla),
          decimal(integrante.circunferenciaCintura),
          /* El IMC no se envía: es columna generada. La base lo deriva de
             peso y talla, igual que el hacinamiento en vivienda (RN-095). */
          texto(integrante.clasificacionAntropometrica),
          entero(integrante.tensionSistolica),
          entero(integrante.tensionDiastolica),
          texto(integrante.clasificacionTension),
          texto(integrante.adherenciaTratamiento),
          texto(integrante.consumoSpa),
          entero(integrante.puntajeCrafft),
          entero(integrante.puntajeAudit),
          entero(integrante.puntajeAssist),
          /* La columna es booleana y el ítem 107 es un catálogo de tres
             opciones: sólo "ha pensado" marca riesgo (metadata.riesgo). */
          integrante.ideacionSuicida === undefined || integrante.ideacionSuicida === null
            ? null
            : integrante.ideacionSuicida === 'ha_pensado',
          booleano(integrante.limitacionCotidiana)
        ]);

        /* De este id cuelgan las 16 tablas puente del integrante. */
        const integranteId = integranteRes.rows[0].id;

        indices.integrantes[fi][ii] = integranteId;

        /* Ítems 77 a 106. */
        filasPuente += await sincronizarPuentes(
          cliente, PUENTES_INTEGRANTE, 'integrante_id', integranteId, integrante
        );

        /* Variables del anexo del integrante: su visibilidad depende de la
           edad, el sexo y la gestación, igual que en el formulario. */
        const contextoIntegrante = motor.contextoIntegrante(integrante, encuesta);
        filasPuente += await anexoBd.escribirAnexo(cliente, motor, 'integrante', integranteId, integrante,
          motor.lectorDeRespuestas([integrante, familia, encuesta], {
            edadMeses: contextoIntegrante.edadMeses, sexo: contextoIntegrante.sexo,
            gestante: contextoIntegrante.gestante, fechaFicha: texto(encuesta.fechaDiligenciamiento)
          }));

        /* Plan de cuidado de la persona (ítems 130 a 140). */
        filasPlan += await guardarPlan(cliente, fichaId, 'persona', integrante.planPersona, {
          familiaFichaId: familiaFichaId,
          integranteId: integranteId,
          fechaConcertacion: texto(encuesta.fechaDiligenciamiento)
        });
      }

      /* Plan de cuidado de la familia (ítems 120 a 129). */
      filasPlan += await guardarPlan(cliente, fichaId, 'familia', familia.planFamilia, {
        familiaFichaId: familiaFichaId,
        fechaConcertacion: texto(encuesta.fechaDiligenciamiento)
      });
    }

    /* --- 7. Plan de cuidado de la vivienda (ítems 111 a 119) --- */
    fijarLlavesDelPlan(encuesta.planVivienda, codigoHogar);
    filasPlan += await guardarPlan(cliente, fichaId, 'vivienda', encuesta.planVivienda, {
      fechaConcertacion: texto(encuesta.fechaDiligenciamiento)
    });

    /* --- 8. Alertas (RN-200 a RN-212) --- */
    const filasAlerta = await guardarAlertas(cliente, fichaId, alertas, indices);

    /* RN-228: el cambio a lo registrado del plan queda en la auditoría, y la
       corrección hecha con autorización la gasta. */
    if (modificaPlanRegistrado) {
      await registrarCambioDelPlan(cliente, fichaId, usuario, encuesta, autorizacion, true);
    }
    if (autorizacion) await gastarAutorizacion(cliente, fichaId, usuario, encuesta, autorizacion);

    await cliente.query('COMMIT');

    console.log('  Ficha guardada: ' + texto(encuesta.codigoFicha) +
      ' (id ' + fichaId + ') — ' + filasPuente + ' de selección múltiple, ' +
      filasPlan + ' del plan, ' + filasAlerta + ' alerta(s)' +
      (planCuidado && planCuidado.pendiente ? ' — plan de cuidado pendiente' : ''));

    res.status(200).json({
      mensaje: 'Ficha guardada',
      fichaId: fichaId,
      codigo: texto(encuesta.codigoFicha),
      filasSeleccionMultiple: filasPuente,
      filasPlanCuidado: filasPlan,
      alertas: filasAlerta,
      advertencias: advertencias,
      /* RN-220 (plan diferido): la ficha entró; esto dice si aún le falta el plan. */
      planCuidado: planCuidado,
      /* Los códigos asignados al guardar: el dispositivo los guarda en su
         copia de la ficha para mostrarlos y para corregirla después. */
      codigos: {
        nuv: encuesta.nuv,
        idHogar: codigoHogar,
        idFamilia: encuesta.idFamilia,
        familias: familias.map(function (familia) { return familia.idFamilia; })
      }
    });
  } catch (error) {
    if (cliente) {
      try { await cliente.query('ROLLBACK'); } catch (e) { /* la conexión ya pudo caerse */ }
    }

    console.error('  Error al guardar la ficha:', error.message);

    /* Un fallo de restricción que llegue hasta aquí es un hueco de la
       validación previa, no un error del encuestador: se registra como 500
       pero se nombra la restricción para poder cerrarlo. */
    res.status(500).json({
      error: 'No fue posible guardar la ficha',
      detalles: error.message,
      restriccion: error.constraint || null
    });
  } finally {
    if (cliente) cliente.release();
  }
};
