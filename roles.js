/* =========================================================
   Encuesta_APS — Roles y permisos
   ---------------------------------------------------------
   Una sola definición para el navegador (decide qué mostrar) y el servidor
   (decide qué aceptar). Si vivieran separadas, la interfaz podría ofrecer
   algo que la API rechaza, o al revés.

   El rol de un usuario es su perfil asistencial del ítem 14 (medicina,
   enfermería, auxiliar de enfermería, …) o «administrador». El instrumento
   no distingue permisos entre profesiones; lo que distingue es el nivel:

     profesional     lidera el EBS: captura y corrige cualquier ficha de su
                     equipo, porque responde por el plan de cuidado.
     tecnico         captura y corrige las fichas que él mismo diligenció.
     administrador   no captura; administra usuarios, equipos y catálogos y
                     consulta cualquier ficha (RN-224.3: perfil institucional
                     expresamente autorizado).
     maestro         todo lo anterior junto: captura, corrige y consulta
                     cualquier ficha y administra. Es la cuenta de quien
                     responde por el proyecto entero; debería haber una.

   «reporte.generar» es el archivo plano APS124CCFP para PISIS: trae los
   datos de todas las fichas del período, sensibles incluidos, así que sólo
   lo generan los perfiles institucionales (administrador y maestro).

   Los permisos son cadenas «recurso.accion[.alcance]». Ver
   ROLES_Y_PERMISOS.md para la matriz completa y su justificación.
   ========================================================= */

'use strict';

const ROLES = {
  medicina:            { etiqueta: 'Medicina',                                  nivel: 'profesional' },
  enfermeria:          { etiqueta: 'Enfermería (profesional)',                  nivel: 'profesional' },
  psicologia:          { etiqueta: 'Psicología',                                nivel: 'profesional' },
  trabajo_social:      { etiqueta: 'Trabajo social',                            nivel: 'profesional' },
  odontologia:         { etiqueta: 'Odontología',                               nivel: 'profesional' },
  nutricion:           { etiqueta: 'Nutrición y dietética',                     nivel: 'profesional' },
  fisioterapia:        { etiqueta: 'Fisioterapia',                              nivel: 'profesional' },
  terapia_ocupacional: { etiqueta: 'Terapia ocupacional',                       nivel: 'profesional' },
  auxiliar_enfermeria: { etiqueta: 'Auxiliar de enfermería',                    nivel: 'tecnico' },
  gestor_comunitario:  { etiqueta: 'Gestor / Promotor comunitario en salud',    nivel: 'tecnico' },
  tecnico_saneamiento: { etiqueta: 'Técnico en salud pública / saneamiento',    nivel: 'tecnico' },
  otro:                { etiqueta: 'Otro perfil del EBS',                       nivel: 'tecnico' },
  administrador:       { etiqueta: 'Administrador',                             nivel: 'administrador' },
  maestro:             { etiqueta: 'Usuario maestro',                           nivel: 'maestro' }
};

const PERMISOS_POR_NIVEL = {
  tecnico: [
    'ficha.crear',
    'ficha.ver.equipo',
    'ficha.corregir.propias',
    'catalogos.consultar'
  ],
  profesional: [
    'ficha.crear',
    'ficha.ver.equipo',
    'ficha.corregir.propias',
    'ficha.corregir.equipo',
    'catalogos.consultar'
  ],
  administrador: [
    'ficha.ver.todas',
    'ficha.corregir.todas',
    'catalogos.consultar',
    'usuarios.gestionar',
    'equipos.gestionar',
    'auditoria.ver',
    'reporte.generar'
  ],
  maestro: [
    'ficha.crear',
    'ficha.ver.equipo',
    'ficha.ver.todas',
    'ficha.corregir.propias',
    'ficha.corregir.equipo',
    'ficha.corregir.todas',
    'catalogos.consultar',
    'usuarios.gestionar',
    'equipos.gestionar',
    'auditoria.ver',
    'reporte.generar'
  ]
};

function esRolValido(rol) {
  return Object.prototype.hasOwnProperty.call(ROLES, rol);
}

function nivelDe(rol) {
  return esRolValido(rol) ? ROLES[rol].nivel : null;
}

function etiquetaDeRol(rol) {
  return esRolValido(rol) ? ROLES[rol].etiqueta : String(rol || '');
}

/* Quien captura fichas: necesita equipo y firma los ítems 10 y 12-14. */
function esAsistencial(rol) {
  const nivel = nivelDe(rol);
  return nivel === 'profesional' || nivel === 'tecnico' || nivel === 'maestro';
}

function permisosDe(rol) {
  const nivel = nivelDe(rol);
  return nivel ? PERMISOS_POR_NIVEL[nivel].slice() : [];
}

function puede(rol, permiso) {
  return permisosDe(rol).indexOf(permiso) !== -1;
}

/* Alcance de lectura sobre fichas: «todas», «equipo» o ninguno. */
function alcanceDeLectura(rol) {
  if (puede(rol, 'ficha.ver.todas')) return 'todas';
  if (puede(rol, 'ficha.ver.equipo')) return 'equipo';
  return null;
}

/* Decide si un usuario puede reemplazar una ficha ya guardada. `ficha` trae
   equipoSaludId y responsableId de la fila existente; `usuario` trae rol,
   equipoSaludId y funcionarioId. */
function puedeCorregir(usuario, ficha) {
  if (puede(usuario.rol, 'ficha.corregir.todas')) return true;
  const mismoEquipo = ficha.equipoSaludId !== null && ficha.equipoSaludId === usuario.equipoSaludId;
  if (puede(usuario.rol, 'ficha.corregir.equipo') && mismoEquipo) return true;
  if (puede(usuario.rol, 'ficha.corregir.propias') && mismoEquipo &&
      ficha.responsableId === usuario.funcionarioId) return true;
  return false;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    ROLES, PERMISOS_POR_NIVEL, esRolValido, nivelDe, etiquetaDeRol,
    esAsistencial, permisosDe, puede, alcanceDeLectura, puedeCorregir
  };
}
