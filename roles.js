/* =========================================================
   Encuesta_APS — Roles y permisos
   ---------------------------------------------------------
   Una sola definición para el navegador (decide qué mostrar) y el servidor
   (decide qué aceptar). Si vivieran separadas, la interfaz podría ofrecer
   algo que la API rechaza, o al revés.

   El rol de un usuario es su perfil asistencial del ítem 14 (medicina,
   enfermería, auxiliar de enfermería, …), un rol de coordinación del EBS,
   «administrador» o «maestro». El instrumento no distingue permisos entre
   profesiones; lo que distingue es el nivel:

     profesional     captura fichas, las ve y evoluciona el plan de cuidado
                     de las de su equipo. Una ficha ya guardada no la corrige
                     sin autorización de la coordinación o del maestro.
     tecnico         lo mismo, pero evoluciona sólo el plan de sus fichas.
     coordinacion    la coordinadora del EBS y los líderes de zona: todo lo
                     de la captura, sobre cualquier ficha —verla, corregirla,
                     evolucionarla, autorizar a otros a corregirla—, el
                     reporte, y crear cuentas de personal asistencial. No
                     modifica cuentas ni restablece claves, y no elimina
                     fichas.
     administrador   no captura; administra usuarios, equipos y catálogos y
                     consulta cualquier ficha (RN-224.3: perfil institucional
                     expresamente autorizado).
     maestro         todo lo anterior junto, y es el único que elimina una
                     ficha de la base. Es la cuenta de quien responde por el
                     proyecto entero; debería haber una.

   «reporte.generar» es el archivo plano APS124CCFP para PISIS: trae los
   datos de todas las fichas del período, sensibles incluidos, así que sólo
   lo generan los perfiles institucionales y la coordinación del EBS.

   «productividad.ver» son los reportes de productividad: cuentas por EBS,
   comuna, persona y fecha, sin datos de la población. Los ven los mismos.

   «ficha.autorizar» (RN-228): una ficha guardada sólo se completa —con
   «Evolucionar plan»—. Corregirla, o cambiar lo registrado en su plan de
   cuidado, exige que la coordinación o el maestro lo autoricen para un
   usuario y esa ficha; la autorización sirve para un guardado.

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
  coordinador_ebs:     { etiqueta: 'Coordinación EBS',                          nivel: 'coordinacion' },
  lider_ebs:           { etiqueta: 'Líder de zona EBS',                         nivel: 'coordinacion' },
  administrador:       { etiqueta: 'Administrador',                             nivel: 'administrador' },
  maestro:             { etiqueta: 'Usuario maestro',                           nivel: 'maestro' }
};

/* «ficha.evolucionar.*»: completar el plan de cuidado pendiente de una ficha
   guardada (RN-228), sin tocar la visita. «ficha.corregir.*»: corregirla sin
   pedir autorización. Quien no puede corregirla la corrige con una
   autorización vigente (aps.permiso_plan), que da la coordinación o el
   maestro. «usuarios.*» se separa porque la coordinación crea cuentas pero
   no las modifica ni les restablece la clave. */
const PERMISOS_POR_NIVEL = {
  tecnico: [
    'ficha.crear',
    'ficha.ver.equipo',
    'ficha.evolucionar.propias',
    'catalogos.consultar'
  ],
  profesional: [
    'ficha.crear',
    'ficha.ver.equipo',
    'ficha.evolucionar.equipo',
    'catalogos.consultar'
  ],
  coordinacion: [
    'ficha.crear',
    'ficha.ver.todas',
    'ficha.evolucionar.todas',
    'ficha.corregir.todas',
    'ficha.autorizar',
    'plan.modificar_registrado',
    'catalogos.consultar',
    'usuarios.ver',
    'usuarios.crear',
    'auditoria.ver',
    'reporte.generar',
    'productividad.ver'
  ],
  administrador: [
    'ficha.ver.todas',
    'ficha.corregir.todas',
    'catalogos.consultar',
    'usuarios.ver',
    'usuarios.crear',
    'usuarios.modificar',
    'usuarios.restablecer',
    'equipos.gestionar',
    'auditoria.ver',
    'reporte.generar',
    'productividad.ver'
  ],
  maestro: [
    'ficha.crear',
    'ficha.ver.equipo',
    'ficha.ver.todas',
    'ficha.evolucionar.todas',
    'ficha.corregir.propias',
    'ficha.corregir.equipo',
    'ficha.corregir.todas',
    'ficha.autorizar',
    'plan.modificar_registrado',
    /* Sólo el maestro elimina una ficha de la base, con motivo y en la
       auditoría (RN-225). */
    'ficha.eliminar',
    'catalogos.consultar',
    'usuarios.ver',
    'usuarios.crear',
    'usuarios.modificar',
    'usuarios.restablecer',
    'equipos.gestionar',
    'auditoria.ver',
    'reporte.generar',
    'productividad.ver'
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

/* Quien captura fichas: firma los ítems 10 y 12-14 con su sesión. */
function esAsistencial(rol) {
  const nivel = nivelDe(rol);
  return nivel === 'profesional' || nivel === 'tecnico' || nivel === 'maestro' || nivel === 'coordinacion';
}

/* La cuenta nace con su Equipo Básico de Salud. La coordinación no pertenece
   a un EBS: lidera zonas, y cada zona agrupa varios EBS. */
function requiereEquipo(rol) {
  const nivel = nivelDe(rol);
  return nivel === 'profesional' || nivel === 'tecnico' || nivel === 'maestro';
}

/* Sin equipo propio, la coordinación indica en el ítem 10 el EBS de cada
   visita que diligencia (debe ser un EBS registrado). El resto firma el
   ítem 10 con el equipo de su cuenta. */
function eligeEquipoDeLaFicha(rol) {
  return nivelDe(rol) === 'coordinacion';
}

/* El perfil del ítem 14 con que firma: para el personal asistencial es su
   propio rol; el maestro y la coordinación lo eligen (u «Otro: su cargo»). */
function eligePerfil(rol) {
  const nivel = nivelDe(rol);
  return nivel === 'maestro' || nivel === 'coordinacion';
}

/* Qué roles puede asignar al crear una cuenta. La coordinación crea cuentas
   del personal asistencial, no de su mismo nivel ni de uno superior: no
   puede darle a nadie lo que ella no tiene (modificar cuentas, restablecer
   claves, eliminar fichas). */
function rolesQuePuedeCrear(rolActor) {
  const nivel = nivelDe(rolActor);
  return Object.keys(ROLES).filter(function (rol) {
    if (nivel === 'maestro') return true;
    if (nivel === 'administrador') return rol !== 'maestro';
    if (nivel === 'coordinacion') return ROLES[rol].nivel === 'profesional' || ROLES[rol].nivel === 'tecnico';
    return false;
  });
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

/* `ficha` trae equipoSaludId y responsableId de la fila existente; `usuario`
   trae rol, equipoSaludId y funcionarioId (en el navegador, el equipo va
   como código en los dos lados). */
function esDeSuEquipo(usuario, ficha) {
  return ficha.equipoSaludId !== null && ficha.equipoSaludId !== undefined &&
    ficha.equipoSaludId === usuario.equipoSaludId;
}

function esSuya(usuario, ficha) {
  return esDeSuEquipo(usuario, ficha) && ficha.responsableId === usuario.funcionarioId;
}

function puedeVerFicha(usuario, ficha) {
  const alcance = alcanceDeLectura(usuario.rol);
  return alcance === 'todas' || (alcance === 'equipo' && esDeSuEquipo(usuario, ficha));
}

/* Decide si un usuario puede reemplazar una ficha ya guardada sin pedir
   autorización. */
function puedeCorregir(usuario, ficha) {
  if (puede(usuario.rol, 'ficha.corregir.todas')) return true;
  if (puede(usuario.rol, 'ficha.corregir.equipo') && esDeSuEquipo(usuario, ficha)) return true;
  return puede(usuario.rol, 'ficha.corregir.propias') && esSuya(usuario, ficha);
}

/* RN-228 — Completar el plan de cuidado pendiente de una ficha guardada. */
function puedeEvolucionar(usuario, ficha) {
  if (puedeCorregir(usuario, ficha)) return true;
  if (puede(usuario.rol, 'ficha.evolucionar.todas')) return true;
  if (puede(usuario.rol, 'ficha.evolucionar.equipo') && esDeSuEquipo(usuario, ficha)) return true;
  return puede(usuario.rol, 'ficha.evolucionar.propias') && esSuya(usuario, ficha);
}

/* A quién se le puede dar una autorización sobre una ficha: a quien la ve
   en su historial, trabaja con fichas y le falta algo de lo que la
   autorización da —corregirla o cambiar lo registrado en su plan—. */
function puedeRecibirAutorizacion(usuario, ficha) {
  if (!puedeVerFicha(usuario, ficha)) return false;
  const corrige = puedeCorregir(usuario, ficha);
  if (!corrige && !puede(usuario.rol, 'ficha.crear')) return false;
  return !(corrige && puede(usuario.rol, 'plan.modificar_registrado'));
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    ROLES, PERMISOS_POR_NIVEL, esRolValido, nivelDe, etiquetaDeRol,
    esAsistencial, requiereEquipo, eligeEquipoDeLaFicha, eligePerfil, rolesQuePuedeCrear, permisosDe, puede,
    alcanceDeLectura, puedeVerFicha, puedeCorregir, puedeEvolucionar, puedeRecibirAutorizacion
  };
}
