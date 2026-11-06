/* =========================================================================
   Encuesta_APS — Buscador de barrios de Cali (ítem 9, RN-009)
   -------------------------------------------------------------------------
   El campo es de texto libre: las veredas, corregimientos y resguardos no están
   en el catálogo, y lo que se escriba se guarda tal cual. La lista sólo ayuda:
   elegir una opción deja en el campo el nombre del barrio, sin la comuna.

   El mecanismo está en buscador_lista.js. CAT_BARRIOS llega de la base y se
   reemplaza cuando responde, así que la búsqueda siempre lee el catálogo vigente.
   ========================================================================= */

/* «Barrio San Cayetano» es como suele decirse, y el catálogo dice «San Cayetano». */
const PALABRAS_VACIAS_BARRIO = PALABRAS_VACIAS_BUSQUEDA.concat(['barrio']);

function buscarBarrios(texto) {
  const indice = CAT_BARRIOS.map(function (barrio) {
    return {
      valor: barrio.nombre,
      comuna: barrio.comuna,
      palabras: palabrasDeBusqueda(barrio.nombre),
      largo: barrio.nombre.length
    };
  });
  return buscarEnIndice(indice, texto, { palabrasVacias: PALABRAS_VACIAS_BARRIO });
}

function pintarFilaDeBarrio(opcion, barrio) {
  const nombre = document.createElement('span');
  nombre.className = 'combo-cups__etiqueta';
  nombre.textContent = barrio.valor;
  const comuna = document.createElement('span');
  comuna.className = 'combo-buscador__nota';
  comuna.textContent = 'Comuna ' + barrio.comuna;
  opcion.appendChild(nombre);
  opcion.appendChild(comuna);
}

function inicializarBuscadorBarrio() {
  crearBuscadorConLista({
    selector: '#divisionTerritorial',
    idLista: 'listaBarrios',
    etiquetaLista: 'Barrios que coinciden con lo escrito',
    buscar: buscarBarrios,
    pintarFila: pintarFilaDeBarrio,
    esValorCompleto: function (texto) {
      return CAT_BARRIOS.some(function (barrio) { return barrio.nombre === texto; });
    },
    avisoSinResultados: 'No está en la lista de barrios. Si es una vereda, corregimiento o resguardo, déjelo como lo escribió.',
    avisoParcial: 'Ninguno coincide con todas las palabras. Estos se acercan:'
  });
}
