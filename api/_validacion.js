/* =========================================================================
   Encuesta_APS — Validación del lado del servidor
   -------------------------------------------------------------------------
   El endpoint es la frontera de confianza: el navegador puede quedarse con
   una versión vieja de las reglas, y nada impide enviar un POST a mano. Lo
   que llega debe validarse aquí otra vez.

   POR QUÉ SE REUTILIZA reglas.js Y NO SE REESCRIBE

   `reglas.js` implementa las 162 reglas del instrumento y tiene 50 pruebas
   detrás. Reimplementarlas aquí crearía dos motores que se desincronizan:
   la regla se corrige en uno y el otro sigue aceptando el dato malo. El
   archivo está escrito para cargarse con <script>, sin exportaciones, pero
   se deja cargar en un contexto `vm` igual que hacen las pruebas.

   Quedan dos capas, y la división es deliberada:

     1. Reglas de negocio  -> reglas.js, el mismo motor que corre el navegador.
     2. Integridad de la base -> aquí. Son cosas que el motor no puede saber
        porque dependen del estado de la base: si el código de EAPB existe,
        si el microterritorio pertenece al territorio, si la UZPE está
        vigente. Sin esta capa esos errores llegan como excepciones de
        PostgreSQL con nombres de restricción internos.
   ========================================================================= */

'use strict';

const fs = require('fs');
const vm = require('vm');
const path = require('path');

const RAIZ = path.join(__dirname, '..');

/* ---------------------------------------------------------
   1. MOTOR DE REGLAS COMPARTIDO
   --------------------------------------------------------- */

let motor = null;

/* Se carga una vez por proceso. `catalogos.js` debe ir primero: `reglas.js`
   referencia sus constantes en el ámbito global. */
function obtenerMotor() {
  if (motor) return motor;

  const contexto = vm.createContext({ console: console });

  /* `direccion.js` entra porque el servidor recompone la dirección en vez de
     creer la que llega. Es texto puro, sin DOM, y sólo depende de catalogos.js. */
  ['catalogos.js', 'direccion.js', 'reglas.js'].forEach(function (archivo) {
    const fuente = fs.readFileSync(path.join(RAIZ, archivo), 'utf8');
    vm.runInContext(fuente, contexto, { filename: archivo });
  });

  if (typeof contexto.validarReglas !== 'function') {
    throw new Error('reglas.js no expuso validarReglas: revise que el archivo cargue completo.');
  }

  motor = contexto;
  return motor;
}

/* ---------------------------------------------------------
   2. CATÁLOGOS DE LA BASE
   --------------------------------------------------------- */

let catalogos = null;

/* Se leen una vez y se guardan en memoria: son catálogos, no transaccionales.
   Si se administra un catálogo en caliente hay que reiniciar el proceso. */
async function obtenerCatalogos(cliente) {
  if (catalogos) return catalogos;

  const [opciones, uzpe, eapb, territorios, micros, prestadores, ocupaciones] = await Promise.all([
    cliente.query('SELECT dominio_codigo, codigo FROM cat.opcion'),
    cliente.query('SELECT codigo FROM cat.uzpe WHERE vigente'),
    cliente.query('SELECT codigo, regimen FROM cat.eapb WHERE vigente'),
    cliente.query('SELECT codigo FROM cat.territorio'),
    cliente.query('SELECT territorio_codigo, codigo FROM cat.microterritorio'),
    cliente.query('SELECT codigo FROM cat.prestador WHERE vigente'),
    cliente.query('SELECT codigo FROM cat.ocupacion_ciuo')
  ]);

  const porDominio = new Map();
  opciones.rows.forEach(function (fila) {
    if (!porDominio.has(fila.dominio_codigo)) porDominio.set(fila.dominio_codigo, new Set());
    porDominio.get(fila.dominio_codigo).add(fila.codigo);
  });

  const regimenEapb = new Map();
  eapb.rows.forEach(function (fila) { regimenEapb.set(fila.codigo, fila.regimen); });

  catalogos = {
    opcion: porDominio,
    uzpe: new Set(uzpe.rows.map(function (f) { return f.codigo; })),
    eapb: new Set(eapb.rows.map(function (f) { return f.codigo; })),
    regimenEapb: regimenEapb,
    territorio: new Set(territorios.rows.map(function (f) { return f.codigo; })),
    /* Clave compuesta: el microterritorio sólo es válido dentro de su territorio. */
    microterritorio: new Set(micros.rows.map(function (f) {
      return f.territorio_codigo + '/' + f.codigo;
    })),
    prestador: new Set(prestadores.rows.map(function (f) { return f.codigo; })),
    ocupacion: new Set(ocupaciones.rows.map(function (f) { return f.codigo; }))
  };

  return catalogos;
}

/* Para las pruebas y para cuando se administre un catálogo sin reiniciar. */
function olvidarCatalogos() {
  catalogos = null;
}

/* ---------------------------------------------------------
   3. VALIDACIÓN DE INTEGRIDAD CONTRA LA BASE
   --------------------------------------------------------- */

function fallo(ruta, mensaje, recibido) {
  return {
    codigo: 'BD',
    ruta: ruta,
    campo: ruta.split('.').pop(),
    mensaje: mensaje,
    severidad: 'bloqueo',
    recibido: recibido === undefined ? null : recibido
  };
}

function vacio(valor) {
  return valor === null || valor === undefined || String(valor).trim() === '';
}

function texto(valor) {
  return vacio(valor) ? null : String(valor).trim();
}

/* Comprueba una opción contra el dominio del catálogo. Devuelve null si el
   valor está vacío: la obligatoriedad la decide reglas.js, no esta capa. */
function revisarOpcion(cat, dominio, valor, ruta) {
  if (vacio(valor)) return null;

  const permitidas = cat.opcion.get(dominio);
  if (!permitidas) return fallo(ruta, 'El dominio de catálogo ' + dominio + ' no existe en la base.', valor);
  if (permitidas.has(valor)) return null;

  return fallo(
    ruta,
    'El valor no pertenece al catálogo ' + dominio + '. Opciones válidas: ' +
      Array.from(permitidas).slice(0, 8).join(', ') + (permitidas.size > 8 ? '…' : ''),
    valor
  );
}

/* Campos de la ficha, la vivienda y el hogar que el esquema restringe a un
   dominio de catálogo. Refleja los CHECK cat.es_opcion(...) de 01_esquema.sql. */
const OPCIONES_FICHA = [
  ['situacionInminente', 'SITUACION_INMINENTE'],
  ['entornoAbordaje', 'ENTORNO'],
  ['areaUbicacion', 'AREA_UBICACION'],
  ['responsableTipoId', 'TIPO_ID_RESPONSABLE'],
  ['perfilProfesional', 'PERFIL_PROFESIONAL'],
  ['estrato', 'ESTRATO'],
  ['tipoVivienda', 'TIPO_VIVIENDA'],
  ['materialTecho', 'MATERIAL_TECHO'],
  ['vectores', 'SI_NO_NA'],
  ['carnetAntirrabico', 'SI_NO_NA'],
  ['fuenteAgua', 'FUENTE_AGUA'],
  ['disposicionExcretas', 'DISPOSICION_EXCRETAS'],
  ['aguasResiduales', 'AGUAS_RESIDUALES'],
  ['residuosSolidos', 'RESIDUOS_SOLIDOS']
];

const OPCIONES_LISTA_VIVIENDA = [
  ['riesgosAccidente', 'RIESGOS_ACCIDENTE'],
  ['factoresContaminacion', 'FACTORES_CONTAMINACION'],
  ['animales', 'ANIMALES']
];

const OPCIONES_FAMILIA = [
  ['tipoFamilia', 'TIPO_FAMILIA'],
  ['zarit', 'ZARIT'],
  ['redesApoyo', 'REDES_APOYO']
];

const OPCIONES_LISTA_FAMILIA = [
  ['situacionesRiesgo', 'SITUACIONES_RIESGO_FAMILIAR'],
  ['practicasVinculo', 'PRACTICAS_VINCULO'],
  ['practicasCuidadoHogar', 'PRACTICAS_CUIDADO_HOGAR']
];

/* Los nombres son los que emite el formulario (atributos name= de index.html)
   y los que consume reglas.js. Si aquí se escribe otro nombre, el campo se ve
   como vacío y la comprobación pasa sin validar nada: un falso negativo
   silencioso. La prueba `pruebas/validacion.test.js` los contrasta contra
   index.html para que no se desincronicen. */
const OPCIONES_INTEGRANTE = [
  ['tipoId', 'TIPO_ID_INTEGRANTE'],
  ['sexo', 'SEXO'],
  ['genero', 'GENERO'],
  ['autoidentificacionGenero', 'AUTOIDENTIFICACION_GENERO'],
  ['orientacionSexual', 'ORIENTACION_SEXUAL'],
  ['rolFamiliar', 'ROL_FAMILIAR'],
  ['nivelEducativo', 'NIVEL_EDUCATIVO'],
  ['regimenAfiliacion', 'REGIMEN_AFILIACION'],
  ['pertenenciaEtnica', 'PERTENENCIA_ETNICA'],
  ['clasificacionAntropometrica', 'CLASIFICACION_ANTROPOMETRICA'],
  ['clasificacionTension', 'CLASIFICACION_TENSION'],
  ['lactanciaExclusiva', 'SI_NO_NA'],
  ['consumoSpa', 'SI_NO_NA'],
  ['adherenciaTratamiento', 'SI_NO_NA'],
  ['certificacionRlcpd', 'SI_NO_NA']
];

const OPCIONES_LISTA_INTEGRANTE = [
  ['sujetoEspecialProteccion', 'SUJETO_ESPECIAL_PROTECCION'],
  ['modalidadViolencia', 'MODALIDAD_VIOLENCIA'],
  ['saberesAncestrales', 'SABERES_ANCESTRALES'],
  ['discapacidad', 'DISCAPACIDAD'],
  ['practicasCuidado', 'PRACTICAS_CUIDADO'],
  ['atencionesPendientesRpms', 'ATENCIONES_RPMS'],
  ['atencionesPendientesMaterno', 'ATENCIONES_MATERNO'],
  ['barrerasAcceso', 'BARRERAS_ACCESO'],
  ['conocimientoDerecho', 'CONOCIMIENTO_DERECHO'],
  ['signosDesnutricion', 'SIGNOS_DESNUTRICION'],
  ['enfermedadesNoTransmisibles', 'ENFERMEDADES_NO_TRANSMISIBLES'],
  ['condicionesTransmisibles', 'CONDICIONES_TRANSMISIBLES'],
  ['zonaEndemica', 'ZONA_ENDEMICA'],
  ['riesgosSaludMentalJoven', 'RIESGOS_SALUD_MENTAL_JOVEN'],
  ['sintomatologiaDepresiva', 'SINTOMATOLOGIA_DEPRESIVA'],
  ['motivoNoTratamiento', 'MOTIVO_NO_TRATAMIENTO']
];

function revisarListaOpciones(cat, dominio, valores, ruta, errores) {
  if (!Array.isArray(valores)) return;
  valores.forEach(function (valor, i) {
    const error = revisarOpcion(cat, dominio, valor, ruta + '[' + i + ']');
    if (error) errores.push(error);
  });
}

/* Valida lo que depende del estado de la base. Devuelve una lista de fallos
   con la misma forma que los incumplimientos de reglas.js, para que el
   cliente pueda tratarlos igual. */
async function validarIntegridad(cliente, encuesta) {
  const cat = await obtenerCatalogos(cliente);
  const errores = [];

  OPCIONES_FICHA.forEach(function (par) {
    const error = revisarOpcion(cat, par[1], encuesta[par[0]], par[0]);
    if (error) errores.push(error);
  });

  OPCIONES_LISTA_VIVIENDA.forEach(function (par) {
    revisarListaOpciones(cat, par[1], encuesta[par[0]], par[0], errores);
  });

  /* --- Saneamiento básico, ítems 39 a 49 ---
     `aps.vivienda` declara estas columnas NOT NULL, pero `seccionesPresentes`
     de reglas.js todavía trata el bloque como opcional: era un andamio para
     que las reglas no bloquearan antes de que la interfaz incorporara la
     sección. La interfaz ya la tiene (3.3 en index.html), así que una ficha
     sin saneamiento pasa el motor y la rechaza la base con un error de
     columna nula. Se comprueba aquí hasta que el andamio se retire. */
  [
    ['actividadEconomica', 'la actividad económica en la vivienda (ítem 39)'],
    ['carnetAntirrabico', 'el carné de vacunación antirrábica (ítem 43)'],
    ['fuenteAgua', 'la fuente de agua (ítem 46)'],
    ['disposicionExcretas', 'la disposición de excretas (ítem 47)'],
    ['aguasResiduales', 'el manejo de aguas residuales (ítem 48)'],
    ['residuosSolidos', 'el manejo de residuos sólidos (ítem 49)']
  ].forEach(function (par) {
    if (vacio(encuesta[par[0]])) {
      errores.push(fallo(par[0], 'Registre ' + par[1] + '.', null));
    }
  });

  /* --- UZPE (RN-004) --- */
  if (!vacio(encuesta.uzpe) && !cat.uzpe.has(encuesta.uzpe)) {
    errores.push(fallo(
      'uzpe',
      'La UZPE no existe o no está vigente. Vigentes: ' + Array.from(cat.uzpe).join(', ') + '.',
      encuesta.uzpe
    ));
  }

  /* --- Territorio y microterritorio (RN-007, RN-008) --- */
  if (!vacio(encuesta.territorio) && !cat.territorio.has(encuesta.territorio)) {
    errores.push(fallo('territorio', 'El territorio no existe en el catálogo.', encuesta.territorio));
  } else if (!vacio(encuesta.territorio) && !vacio(encuesta.microterritorio)) {
    const clave = encuesta.territorio + '/' + encuesta.microterritorio;
    if (!cat.microterritorio.has(clave)) {
      errores.push(fallo(
        'microterritorio',
        'El microterritorio no pertenece al territorio ' + encuesta.territorio + '.',
        encuesta.microterritorio
      ));
    }
  }

  /* --- Prestador primario (RN-011) --- */
  if (!vacio(encuesta.prestadorPrimario) && !cat.prestador.has(encuesta.prestadorPrimario)) {
    errores.push(fallo(
      'prestadorPrimario',
      'El prestador no existe o no está vigente en el catálogo.',
      encuesta.prestadorPrimario
    ));
  }

  /* --- Familias e integrantes --- */
  const familias = Array.isArray(encuesta.familias) ? encuesta.familias : [];

  familias.forEach(function (familia, fi) {
    const rutaF = 'familias[' + fi + ']';

    OPCIONES_FAMILIA.forEach(function (par) {
      const error = revisarOpcion(cat, par[1], familia[par[0]], rutaF + '.' + par[0]);
      if (error) errores.push(error);
    });

    OPCIONES_LISTA_FAMILIA.forEach(function (par) {
      revisarListaOpciones(cat, par[1], familia[par[0]], rutaF + '.' + par[0], errores);
    });

    const integrantes = Array.isArray(familia.integrantes) ? familia.integrantes : [];

    /* RN-063: tipo + número no se repiten dentro de la misma ficha. */
    const documentos = new Map();

    integrantes.forEach(function (integrante, ii) {
      const rutaI = rutaF + '.integrantes[' + ii + ']';

      OPCIONES_INTEGRANTE.forEach(function (par) {
        const error = revisarOpcion(cat, par[1], integrante[par[0]], rutaI + '.' + par[0]);
        if (error) errores.push(error);
      });

      OPCIONES_LISTA_INTEGRANTE.forEach(function (par) {
        revisarListaOpciones(cat, par[1], integrante[par[0]], rutaI + '.' + par[0], errores);
      });

      if (!vacio(integrante.tipoId) && !vacio(integrante.numeroId)) {
        const clave = integrante.tipoId + '-' + integrante.numeroId;
        if (documentos.has(clave)) {
          errores.push(fallo(
            rutaI + '.numeroId',
            'RN-063: documento repetido dentro de la ficha. Ya lo usa el integrante ' +
              (documentos.get(clave) + 1) + '.',
            integrante.numeroId
          ));
        } else {
          documentos.set(clave, ii);
        }
      }

      /* --- EAPB (RN-076) ---
         El esquema exige la equivalencia exacta que impone
         int_eapb_condicionada: hay EAPB si y sólo si hay afiliación. */
      const noAfiliado = integrante.regimenAfiliacion === 'no_afiliado';
      const sinEapb = vacio(integrante.eapb);

      if (noAfiliado && !sinEapb) {
        errores.push(fallo(
          rutaI + '.eapb',
          'RN-076: "No afiliado" no admite EAPB.',
          integrante.eapb
        ));
      }

      if (!noAfiliado && sinEapb && !vacio(integrante.regimenAfiliacion)) {
        errores.push(fallo(
          rutaI + '.eapb',
          'RN-076: la EAPB es obligatoria cuando el régimen no es "No afiliado".',
          null
        ));
      }

      if (!sinEapb && !cat.eapb.has(integrante.eapb)) {
        errores.push(fallo(
          rutaI + '.eapb',
          'La EAPB no existe o no está vigente en el catálogo.',
          integrante.eapb
        ));
      }

      if (!vacio(integrante.ocupacion) && !cat.ocupacion.has(integrante.ocupacion)) {
        errores.push(fallo(
          rutaI + '.ocupacion',
          'La ocupación no existe en el catálogo CIUO.',
          integrante.ocupacion
        ));
      }
    });
  });

  return errores;
}

/* ---------------------------------------------------------
   3.1 PLAN DE CUIDADO
   --------------------------------------------------------- */

/* Recorre los tres ámbitos del plan devolviendo [ruta, plan]. */
function planesDeLaFicha(encuesta) {
  const planes = [];

  if (encuesta.planVivienda) planes.push(['planVivienda', encuesta.planVivienda]);

  (Array.isArray(encuesta.familias) ? encuesta.familias : []).forEach(function (familia, fi) {
    if (familia.planFamilia) {
      planes.push(['familias[' + fi + '].planFamilia', familia.planFamilia]);
    }
    (Array.isArray(familia.integrantes) ? familia.integrantes : []).forEach(function (ing, ii) {
      if (ing.planPersona) {
        planes.push(['familias[' + fi + '].integrantes[' + ii + '].planPersona', ing.planPersona]);
      }
    });
  });

  return planes;
}

/* Las acciones y los seguimientos del plan tienen restricciones que el motor
   de reglas no puede comprobar porque dependen de la base o de una condición
   cruzada entre columnas. Sin esto llegan como excepciones de PostgreSQL. */
async function validarPlanes(cliente, encuesta, errores) {
  const planes = planesDeLaFicha(encuesta);
  if (planes.length === 0) return;

  /* Los códigos de acción son llave foránea contra cat.cups, que también
     alberga los NoCUPS. Se comprueban todos en una consulta. */
  const codigos = [];
  planes.forEach(function (par) {
    (Array.isArray(par[1].acciones) ? par[1].acciones : []).forEach(function (accion) {
      const codigo = accion && accion.codigoAccion ? String(accion.codigoAccion).trim() : '';
      if (codigo !== '' && codigos.indexOf(codigo) === -1) codigos.push(codigo);
    });
  });

  let existentes = new Set();
  if (codigos.length > 0) {
    const res = await cliente.query(
      'SELECT codigo FROM cat.cups WHERE codigo = ANY($1)', [codigos]
    );
    existentes = new Set(res.rows.map(function (f) { return f.codigo; }));
  }

  planes.forEach(function (par) {
    const ruta = par[0];
    const plan = par[1];

    (Array.isArray(plan.acciones) ? plan.acciones : []).forEach(function (accion, i) {
      const rutaA = ruta + '.acciones[' + i + ']';
      const codigo = texto(accion.codigoAccion);

      if (codigo !== null && !existentes.has(codigo)) {
        errores.push(fallo(
          rutaA + '.codigoAccion',
          'El código no existe en el catálogo CUPS ni en los NoCUPS. Los NoCUPS ' +
            'tienen la forma NC-AMB-01, NC-EDU-03, etc.',
          codigo
        ));
      }

      /* accion_derivada_destino: derivar sin decir a dónde deja la acción sin
         destinatario y RN-210 no puede hacerle seguimiento. */
      if (accion.tipoRespuesta === 'derivada' && vacio(accion.institucionDestino)) {
        errores.push(fallo(
          rutaA + '.institucionDestino',
          'Una acción derivada exige registrar la institución de destino.',
          null
        ));
      }
    });

    (Array.isArray(plan.seguimientos) ? plan.seguimientos : []).forEach(function (seg, i) {
      const rutaS = ruta + '.seguimientos[' + i + ']';

      /* seg1_nc_motivado / seg2_nc_motivado: "No cumple" sin motivo impide
         aplicar RN-226.4, que escala al gestor de la EAPB. */
      if (seg.seg1Estado === 'NC' && vacio(seg.seg1MotivoNc)) {
        errores.push(fallo(rutaS + '.seg1MotivoNc',
          'Un primer seguimiento "No cumple" exige registrar el motivo (RN-226.4).', null));
      }
      if (seg.seg2Estado === 'NC' && vacio(seg.seg2MotivoNc)) {
        errores.push(fallo(rutaS + '.seg2MotivoNc',
          'Un segundo seguimiento "No cumple" exige registrar el motivo (RN-226.4).', null));
      }
    });
  });
}

/* ---------------------------------------------------------
   4. ADVERTENCIAS
   --------------------------------------------------------- */

/* No bloquean: la sección 1.3 de las reglas reserva el bloqueo para lo que
   impide continuar. Se devuelven para que queden en la respuesta y en el log. */
async function evaluarAdvertenciasIntegridad(cliente, encuesta) {
  const cat = await obtenerCatalogos(cliente);
  const avisos = [];

  const familias = Array.isArray(encuesta.familias) ? encuesta.familias : [];

  familias.forEach(function (familia, fi) {
    (Array.isArray(familia.integrantes) ? familia.integrantes : []).forEach(function (integrante, ii) {
      const regimenEntidad = cat.regimenEapb.get(integrante.eapb);
      const regimenDeclarado = integrante.regimenAfiliacion;

      /* El catálogo dice en qué régimen opera la entidad. 'ambos' no discrimina,
         y los regímenes especial y de excepción no pasan por EAPB ordinaria. */
      if (!regimenEntidad || regimenEntidad === 'ambos') return;
      if (regimenDeclarado !== 'contributivo' && regimenDeclarado !== 'subsidiado') return;

      if (regimenEntidad !== regimenDeclarado) {
        avisos.push({
          codigo: 'RN-075',
          ruta: 'familias[' + fi + '].integrantes[' + ii + '].regimenAfiliacion',
          mensaje: 'La EAPB ' + integrante.eapb + ' figura en el catálogo como ' +
            regimenEntidad + ', pero se declaró régimen ' + regimenDeclarado + '.',
          severidad: 'advertencia'
        });
      }
    });
  });

  return avisos;
}

/* ---------------------------------------------------------
   5. ENTRADA ÚNICA
   --------------------------------------------------------- */

/* Reconstruye los campos derivados que el motor necesita y que no deben
   creerse tal como llegan.

   RN-021 valida `direccionNormalizada.completa`, un objeto que el navegador
   calcula al recoger el formulario pero que `construirEncuestaDesdeDatos`
   descarta antes de sincronizar —guarda sólo `direccion` y
   `direccionLegible`—. Sin recomponerlo, toda ficha real fallaría RN-021 en
   el servidor aunque su dirección esté completa.

   Y recomponerlo es además lo correcto: un `completa: true` que viene en el
   cuerpo de la petición no prueba nada, porque quien envía el POST lo
   escribe. Se recalcula desde los componentes, que son el dato de origen. */
function prepararFicha(m, encuesta) {
  if (!encuesta.direccionComponentes || typeof m.normalizarDireccion !== 'function') {
    return encuesta;
  }

  const copia = Object.assign({}, encuesta);
  const normalizada = m.normalizarDireccion(encuesta.direccionComponentes);

  copia.direccionNormalizada = normalizada;
  copia.direccion = normalizada.canonica || copia.direccion || null;
  copia.direccionLegible = normalizada.legible || copia.direccionLegible || null;

  return copia;
}

/* Devuelve { bloqueos, advertencias }. `bloqueos` vacío significa que la
   ficha puede escribirse. Se corren las reglas de negocio primero: si el
   dato ni siquiera cumple el instrumento, no tiene sentido preguntarle a la
   base si el código existe. */
async function validar(cliente, encuesta) {
  const bloqueos = [];
  const advertencias = [];

  if (!encuesta || typeof encuesta !== 'object' || Array.isArray(encuesta)) {
    return {
      bloqueos: [fallo('cuerpo', 'El cuerpo de la petición debe ser un objeto JSON con la ficha.', null)],
      advertencias: []
    };
  }

  const m = obtenerMotor();
  const ficha = prepararFicha(m, encuesta);

  /* Incumplimientos por campo. Traen `ruta`, que es lo que permite al
     formulario marcar el control exacto que falló. */
  const vistos = new Set();

  m.validarReglas(ficha).forEach(function (incumplimiento) {
    vistos.add(incumplimiento.codigo + '|' + incumplimiento.mensaje);
    if (incumplimiento.severidad === 'advertencia') advertencias.push(incumplimiento);
    else bloqueos.push(incumplimiento);
  });

  /* RN-222: la visita cerrada por causa externa se admite incompleta siempre
     que el motivo quede registrado, así que no se le exige el cierre.

     `validarCierre` reejecuta `validarReglas` por dentro y mezcla el
     resultado, de modo que sin deduplicar cada incumplimiento aparecería
     dos veces. Aquí sólo interesan los impedimentos que añade de su
     cosecha: consentimiento (RN-001), familias e integrantes declarados
     pero no caracterizados (RN-028, RN-051). */
  if (!encuesta.visitaIncompleta) {
    const cierre = m.validarCierre(ficha);

    (cierre.impedimentos || []).forEach(function (impedimento) {
      const clave = impedimento.codigo + '|' + impedimento.mensaje;
      if (vistos.has(clave)) return;
      vistos.add(clave);

      bloqueos.push({
        codigo: impedimento.codigo || 'RN-220',
        ruta: impedimento.ruta || 'cierre',
        campo: impedimento.ruta ? impedimento.ruta.split('.').pop() : 'cierre',
        mensaje: impedimento.mensaje,
        severidad: 'bloqueo',
        ambito: impedimento.bloque || 'cierre',
        referencia: impedimento.referencia || null
      });
    });
  }

  const integridad = await validarIntegridad(cliente, ficha);
  await validarPlanes(cliente, ficha, integridad);
  integridad.forEach(function (error) { bloqueos.push(error); });

  const avisos = await evaluarAdvertenciasIntegridad(cliente, ficha);
  avisos.forEach(function (aviso) { advertencias.push(aviso); });

  /* Las alertas se calculan aquí y no se toman del cuerpo de la petición.
     El navegador envía las suyas, pero llegan recortadas —pierden `ruta`, que
     es lo que dice a qué familia o integrante pertenece cada una— y además
     nada impide falsificarlas. Se recalculan con el mismo motor, sobre la
     ficha ya preparada. */
  const alertas = typeof m.evaluarAlertas === 'function' ? m.evaluarAlertas(ficha) : [];

  return {
    bloqueos: bloqueos,
    advertencias: advertencias,
    alertas: alertas,
    /* La ficha con los derivados recompuestos: es la que debe escribirse. */
    ficha: ficha
  };
}

module.exports = {
  validar,
  validarIntegridad,
  obtenerMotor,
  obtenerCatalogos,
  olvidarCatalogos
};
