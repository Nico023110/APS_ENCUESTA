/* =========================================================================
   Encuesta_APS — Buscador de ocupaciones CIUO (ítem 73, RN-073)
   -------------------------------------------------------------------------
   POR QUÉ NO ES UN <datalist>

   El campo usaba la lista nativa del navegador, y cada navegador la filtra a
   su manera: Chrome exige el texto tal cual, con tildes y en el mismo género
   —«mecanico», «enfermera» o «secretaria» no encontraban nada—, y otros sólo
   buscan por código. Las pocas palabras cotidianas que sí coincidían («hogar»,
   «ama de casa», «estudiante», «desempleado») llevaban a la misma opción, y un
   campo con 9998 sólo ofrecía 9998. A quien diligenciaba le parecía que no
   había otro código posible (reporte de usuario, 2026-11-05).

   Aquí la búsqueda es la misma en todos los equipos y sin señal: sin tildes,
   sin importar género ni plural, por partes de palabra y en cualquier orden.
   El campo sigue guardando sólo el código; el catálogo y lo que se reporta no
   cambian. El mecanismo de la lista está en buscador_lista.js.
   ========================================================================= */

/* Cómo se dice en la visita lo que la tabla oficial nombra de otra forma. Sólo
   ayudan a encontrar: lo que se muestra y se guarda es lo de la tabla. */
const PALABRAS_COTIDIANAS_OCUPACION = [
  [['9998'], 'pensionado'],
  [['9622'], 'oficios varios'],
  [['9111'], 'empleada domestica servicio domestico'],
  [['9112'], 'aseo limpieza'],
  [['8324'], 'taxista'],
  [['8321'], 'mototaxista motociclista'],
  [['8323', '8331', '8332'], 'chofer'],
  [['9621'], 'domiciliario'],
  [['5414'], 'vigilante celador vigilancia'],
  [['9611'], 'reciclador'],
  [['7126'], 'plomero'],
  [['5141'], 'estilista barbero'],
  [['5142'], 'manicurista estilista'],
  [['5311'], 'ninera'],
  [['2261'], 'dentista'],
  [['4321'], 'bodeguero almacenista'],
  [['3221'], 'auxiliar de enfermeria'],
  [['0310'], 'soldado'],
  [['6111', '6112', '6113', '6114'], 'campesino'],
  [['2310', '2320', '2330', '2341', '2342', '2352', '2353', '2354', '2355'], 'docente maestro']
];

/* «enfermera» debe encontrar «enfermería» y «secretaria», «secretarios»: se
   busca por la raíz, sin la terminación de género o plural. Lo corto se deja
   como está: mientras se escribe, «cas» todavía no es una palabra. */
function raizDeOcupacion(palabra) {
  return palabra.length > 4 ? palabra.replace(/(as|os|es|a|o|e|s)$/, '') : palabra;
}

let indiceDeOcupaciones = null;

function obtenerIndiceDeOcupaciones() {
  if (indiceDeOcupaciones) return indiceDeOcupaciones;
  indiceDeOcupaciones = CAT_OCUPACION_CIUO.map(function (ocupacion) {
    const cotidianas = PALABRAS_COTIDIANAS_OCUPACION
      .filter(function (par) { return par[0].indexOf(ocupacion.valor) !== -1; })
      .map(function (par) { return par[1]; })
      .join(' ');
    return {
      valor: ocupacion.valor,
      etiqueta: ocupacion.etiqueta,
      palabras: palabrasDeBusqueda(ocupacion.etiqueta + ' ' + cotidianas),
      largo: ocupacion.etiqueta.length
    };
  });
  return indiceDeOcupaciones;
}

/**
 * Busca por código (desde su inicio) o por palabras del nombre.
 * @returns {{filas:Array<{valor:string,etiqueta:string}>, total:number, parcial:boolean}}
 *          `parcial`: ninguna coincide con todo lo escrito; son las que más se acercan.
 */
function buscarOcupaciones(texto) {
  const indice = obtenerIndiceDeOcupaciones();
  const limpio = String(texto || '').trim();
  if (limpio === '') return { filas: [], total: 0, parcial: false };

  if (/^\d+$/.test(limpio)) {
    const porCodigo = indice.filter(function (o) { return o.valor.indexOf(limpio) === 0; });
    return { filas: porCodigo.slice(0, MAXIMO_FILAS_EN_LISTA), total: porCodigo.length, parcial: false };
  }
  return buscarEnIndice(indice, limpio, { raiz: raizDeOcupacion });
}

function esCodigoDeOcupacion(texto) {
  return CAT_OCUPACION_CIUO.some(function (o) { return o.valor === texto; });
}

function pintarFilaDeOcupacion(opcion, ocupacion) {
  const codigo = document.createElement('span');
  codigo.className = 'combo-cups__codigo';
  codigo.textContent = ocupacion.valor;
  const etiqueta = document.createElement('span');
  etiqueta.className = 'combo-cups__etiqueta';
  etiqueta.textContent = ocupacion.etiqueta;
  opcion.appendChild(codigo);
  opcion.appendChild(etiqueta);
}

/* Al salir: un nombre escrito completo que sólo puede ser una ocupación se
   resuelve solo, y el nombre que aparece debajo lo confirma. Si puede ser
   varias, queda como está y la validación pide elegir. */
function resolverOcupacionEscrita(campo, fijar) {
  const texto = campo.value.trim();
  if (campo.readOnly || campo.disabled || texto === '' || /^\d+$/.test(texto)) {
    if (texto !== campo.value) fijar(campo, texto);
    return;
  }
  if (esCodigoDeOcupacion(texto)) return;
  const resultado = buscarOcupaciones(texto);
  if (resultado.total === 1 && !resultado.parcial) fijar(campo, resultado.filas[0].valor);
}

function inicializarBuscadorOcupacion() {
  crearBuscadorConLista({
    selector: '[data-rol="ocupacion"]',
    idLista: 'listaOcupacion',
    etiquetaLista: 'Ocupaciones',
    buscar: buscarOcupaciones,
    /* Quien no sabe cómo la nombra la tabla también debe poder recorrerla. */
    todas: obtenerIndiceDeOcupaciones,
    avisoTodas: 'Todas las ocupaciones. Escriba el oficio o el código para acotar.',
    pintarFila: pintarFilaDeOcupacion,
    /* Un código completo no necesita lista: su nombre aparece debajo del campo. */
    esValorCompleto: esCodigoDeOcupacion,
    avisoSinResultados: 'No se encontró esa ocupación. Pruebe con otra palabra o con el código.',
    avisoParcial: 'Ninguna coincide con todas las palabras. Estas se acercan:',
    /* Con un código ya puesto, lo que se escriba lo reemplaza: quien vuelve al
       campo para cambiar 9998 no tiene que borrarlo primero. */
    alEnfocar: function (campo, abrir) {
      if (esCodigoDeOcupacion(campo.value.trim())) campo.select();
      abrir(campo);
    },
    alSalir: resolverOcupacionEscrita
  });
}
