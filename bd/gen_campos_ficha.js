/* Genera api/_campos_ficha.js: las preguntas de la ficha en el orden del
   formulario, con su número de ítem, su etiqueta, su sección y el catálogo de
   sus respuestas. Lo usa la exportación a Excel (api/_excel_fichas.js) para
   que las columnas digan lo mismo que el instrumento.

   Fuente: index.html (bloques data-campo y grupos data-anexo-grupo), las
   llamadas llenarSelect/llenarGrupo* de app.js (catálogos que el HTML no
   declara) y PREGUNTAS_ANEXO de anexo.js.

       node bd/gen_campos_ficha.js               regenera el archivo
       node bd/gen_campos_ficha.js --comprobar   sólo dice si está al día

   No se edita a mano el resultado: se corrige el formulario y se regenera. */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const RAIZ = path.join(__dirname, '..');
const DESTINO = path.join(RAIZ, 'api', '_campos_ficha.js');

const html = fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(RAIZ, 'app.js'), 'utf8');
const inicioForm = html.indexOf('<form id="encuestaForm"');
const finForm = html.indexOf('</form>', inicioForm);
if (inicioForm === -1 || finForm === -1) throw new Error('No se encontró el formulario de la encuesta en index.html');
const form = html.slice(inicioForm, finForm);

/* Catálogos que app.js asigna por id o por nombre del campo, y los grupos de
   opciones que crea en un contenedor vacío (sus controles no están en el HTML). */
const catalogoPorControl = {};
const grupoPorContenedor = {};
for (const m of app.matchAll(/llenarSelect\('([^']+)',\s*(CAT_[A-Z0-9_]+)/g)) catalogoPorControl[m[1]] = m[2];
for (const m of app.matchAll(/llenarGrupo(Radio|Casillas)\('([^']+)',\s*'([^']+)',\s*(CAT_[A-Z0-9_]+)/g)) {
  catalogoPorControl[m[3]] = m[4];
  grupoPorContenedor[m[2]] = { nombre: m[3], catalogo: m[4], multiple: m[1] === 'Casillas' };
}

/* Preguntas del anexo, por grupo. */
const contexto = vm.createContext({ console });
['catalogos_sispro.js', 'catalogos.js', 'anexo.js'].forEach((f) => vm.runInContext(fs.readFileSync(path.join(RAIZ, f), 'utf8'), contexto));
const PREGUNTAS = vm.runInContext('PREGUNTAS_ANEXO', contexto);
const porGrupo = {};
PREGUNTAS.forEach((p) => { (porGrupo[p.grupo] = porGrupo[p.grupo] || []).push(p); });

/* Campos de la captura que no son respuestas del instrumento: piezas de la
   dirección (se exporta la dirección normalizada) y ayudas de pantalla. */
const EXCLUIDOS = new Set(['modoDireccion', 'viaTipo', 'viaNumero', 'viaLetra', 'viaLetraBis', 'viaCuadrante',
  'genNumero', 'genLetra', 'genCuadrante', 'placa', 'ruralViaTipo', 'ruralViaNombre', 'ruralPredioTipo',
  'ruralPredioNombre', 'complementos', 'buscadorDireccion']);

/* Campos cuyo control no dice su catálogo: la dirección se exporta como texto
   normalizado y la clasificación de la tensión se calcula en un campo oculto. */
const CATALOGO_FIJO = { direccion: null, clasificacionTension: 'CAT_CLASIFICACION_TENSION', consentimiento: 'CAT_SI_NO' };

/* Etiquetas del formulario demasiado largas para un título de columna (el
   ítem 1 es el párrafo legal del consentimiento) o que se confunden fuera
   de su bloque (el código CF no es el código de la ficha). */
const ETIQUETA_FIJA = {
  consentimiento: 'Consentimiento informado para el tratamiento de datos',
  situacionInminente: 'Situación que pone en peligro la vida de las personas',
  codigoCf: 'Código de la visita a la familia (CF)',
  idFamiliaBloque: 'N.° de ID de la familia',
  adherenciaTratamiento: 'Recibe atención y tratamiento actual (si hay alguna condición en los ítems 100 a 102)',
  riesgosSaludMentalJoven: 'Situaciones que identifica como riesgo para su salud física o mental'
};

const texto = (h) => h.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const NIVEL_ANEXO = { ficha: 'ficha', vivienda: 'ficha', familia: 'familia', integrante: 'integrante' };

const campos = { ficha: [], familia: [], integrante: [] };
const vistos = new Set();
let seccion = '';

/* Recorrido en orden: títulos de sección, bloques de pregunta y grupos del anexo. */
const TOKENS = /<h2[^>]*>([\s\S]*?)<\/h2>|<h3 class="subseccion-titulo"[^>]*>([\s\S]*?)<\/h3>|data-campo="([^"]+)"|data-anexo-grupo="([^"]+)"/g;
let m;
while ((m = TOKENS.exec(form)) !== null) {
  if (m[1] !== undefined || m[2] !== undefined) { seccion = texto(m[1] !== undefined ? m[1] : m[2]); continue; }

  if (m[4] !== undefined) {
    (porGrupo[m[4]] || []).forEach((p) => {
      const nivel = NIVEL_ANEXO[p.nivel];
      const clave = nivel + '|' + p.clave;
      if (!nivel || vistos.has(clave)) return;
      vistos.add(clave);
      campos[nivel].push({ campo: p.clave, item: 'A' + p.registro + '.' + p.variable, etiqueta: p.etiqueta,
        seccion: seccion, catalogo: p.catalogo || null, multiple: p.tipo === 'multiple', anexo: true });
    });
    delete porGrupo[m[4]];
    continue;
  }

  /* Bloque de una pregunta: hasta el siguiente data-campo. */
  const campo = m[3];
  const resto = form.slice(m.index);
  const siguiente = resto.slice(1).search(/data-campo="/);
  const bloque = siguiente === -1 ? resto : resto.slice(0, siguiente + 1);
  if (EXCLUIDOS.has(campo)) continue;
  /* El control de la pregunta: el que se llama como ella; si no, el primero
     con nombre; si no hay, el grupo de opciones que app.js llena en el bloque. */
  const etiquetas = [...bloque.matchAll(/<[a-z]+\b[^>]*>/g)].map((t) => t[0]);
  const conNombre = etiquetas.filter((t) => /(?:data-name|\bname)="[^"]+"/.test(t));
  const propio = conNombre.find((t) => new RegExp('(?:data-name|\\bname)="(?:[^"]*\\.)?' + campo + '"').test(t)) || conNombre[0];
  const contenedor = etiquetas.map((t) => (/\bid="([^"]+)"/.exec(t) || [])[1]).find((i) => i && grupoPorContenedor[i]);
  if (!propio && !contenedor) continue;
  const grupo = !propio && contenedor ? grupoPorContenedor[contenedor] : null;
  const nombre = propio ? /(?:data-name|\bname)="([^"]+)"/.exec(propio)[1] : grupo.nombre;
  if (/^plan/.test(nombre)) continue;                       // el plan va en sus propias hojas
  const nivel = /integrantes\[0\]\./.test(nombre) ? 'integrante' : /^familias\[0\]\./.test(nombre) ? 'familia' : 'ficha';
  const clave = nivel + '|' + campo;
  if (vistos.has(clave)) continue;

  const etiquetaHtml = /<label[^>]*>([\s\S]*?)<\/label>/.exec(bloque);
  if (!etiquetaHtml) continue;
  const item = (/<span class="item-num">\s*([0-9A-Z.]+?)\.?\s*<\/span>/.exec(etiquetaHtml[1]) || [])[1] || '';
  const etiqueta = ETIQUETA_FIJA[campo] || texto(etiquetaHtml[1].replace(/<span class="item-num">[\s\S]*?<\/span>/, ''))
    .replace(/\s*\*\s*$/, '').replace(/\s*:\s*$/, '').trim();
  if (!etiqueta) continue;
  const simple = nombre.replace(/^.*\./, '');
  const id = propio ? (/\bid="([^"]+)"/.exec(propio) || [])[1] : contenedor;
  const catalogo = Object.prototype.hasOwnProperty.call(CATALOGO_FIJO, campo) ? CATALOGO_FIJO[campo]
    : grupo ? grupo.catalogo
      : (/data-catalogo="([^"]+)"/.exec(propio) || [])[1] || catalogoPorControl[id] || catalogoPorControl[simple] || null;
  /* Un check-group con data-tipo="radio" es de respuesta única. */
  const multiple = grupo ? grupo.multiple : /class="check-group/.test(propio) && !/data-tipo="radio"/.test(propio);
  vistos.add(clave);
  campos[nivel].push({ campo, item, etiqueta, seccion, catalogo, multiple, anexo: false });
}

/* Grupos del anexo que el formulario no ubica: al final de su nivel. */
Object.keys(porGrupo).forEach((grupo) => porGrupo[grupo].forEach((p) => {
  const nivel = NIVEL_ANEXO[p.nivel];
  if (!nivel || vistos.has(nivel + '|' + p.clave)) return;
  vistos.add(nivel + '|' + p.clave);
  campos[nivel].push({ campo: p.clave, item: 'A' + p.registro + '.' + p.variable, etiqueta: p.etiqueta,
    seccion: 'Anexo SI-APS', catalogo: p.catalogo || null, multiple: p.tipo === 'multiple', anexo: true });
}));

const salida = `/* =========================================================================
   Preguntas de la ficha en el orden del formulario (exportación a Excel)
   -------------------------------------------------------------------------
   GENERADO por bd/gen_campos_ficha.js desde index.html, app.js y anexo.js.
   No se edita a mano: se corrige el formulario y se regenera.
   ========================================================================= */

'use strict';

const CAMPOS_FICHA = ${JSON.stringify(campos, null, 2).replace(/"([a-zA-Z]+)":/g, '$1:')};

module.exports = { CAMPOS_FICHA };
`;
if (process.argv.includes('--comprobar')) {
  const actual = fs.existsSync(DESTINO) ? fs.readFileSync(DESTINO, 'utf8').replace(/\r\n/g, '\n') : '';
  if (actual !== salida) {
    console.error('api/_campos_ficha.js no está al día con el formulario: ejecute node bd/gen_campos_ficha.js');
    process.exit(1);
  }
  console.log('api/_campos_ficha.js al día con el formulario');
  process.exit(0);
}
fs.writeFileSync(DESTINO, salida);
console.log('OK — ficha: ' + campos.ficha.length + ', familia: ' + campos.familia.length + ', integrante: ' + campos.integrante.length +
  ' preguntas\n     escrito en ' + DESTINO);
