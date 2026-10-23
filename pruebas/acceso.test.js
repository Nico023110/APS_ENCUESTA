/* =========================================================================
   Pruebas unitarias del acceso: derivación de claves, política, matriz de
   roles y lectura de cookies. No tocan la base ni el servidor.
       node pruebas/acceso.test.js
   ========================================================================= */

'use strict';

const path = require('path');
const auth = require(path.join(__dirname, '..', 'api', '_auth.js'));
const roles = require(path.join(__dirname, '..', 'roles.js'));

let pasadas = 0;
let fallidas = 0;

function verificar(nombre, condicion, detalle) {
  if (condicion) { pasadas++; console.log('  OK   ' + nombre); }
  else { fallidas++; console.log('  FALLA ' + nombre + (detalle ? '  -> ' + detalle : '')); }
}

async function principal() {
  console.log('\n=== 1. Claves: scrypt con sal propia ===');

  const hash1 = await auth.hashDeClave('ClaveSegura2026');
  const hash2 = await auth.hashDeClave('ClaveSegura2026');
  verificar('el hash lleva el formato scrypt$N$r$p$sal$hash', /^scrypt\$\d+\$\d+\$\d+\$[A-Za-z0-9_-]+\$[A-Za-z0-9_-]+$/.test(hash1), hash1.slice(0, 40));
  verificar('dos derivaciones de la misma clave difieren (sal distinta)', hash1 !== hash2);
  verificar('la clave correcta verifica', await auth.verificarClave('ClaveSegura2026', hash1));
  verificar('una clave distinta no verifica', !(await auth.verificarClave('ClaveSegura2027', hash1)));
  verificar('un hash corrupto no verifica ni revienta', !(await auth.verificarClave('ClaveSegura2026', 'basura')));
  verificar('la clave se normaliza (NFKC): «é» compuesta y descompuesta coinciden',
    await auth.verificarClave('Cláve2026segura', await auth.hashDeClave('Cláve2026segura')));

  console.log('\n=== 2. Política de contraseñas ===');

  verificar('menos de 10 caracteres se rechaza', auth.requisitosIncumplidos('Abc12345').length > 0);
  verificar('sin número se rechaza', auth.requisitosIncumplidos('SoloLetrasAqui').length > 0);
  verificar('sin letra se rechaza', auth.requisitosIncumplidos('12345678901').length > 0);
  verificar('con el documento dentro se rechaza', auth.requisitosIncumplidos('x1144012345y', '1144012345').length > 0);
  verificar('una clave que cumple pasa', auth.requisitosIncumplidos('Enfermeria2026', '1144012345').length === 0);

  console.log('\n=== 3. Roles y permisos ===');

  verificar('enfermería es nivel profesional', roles.nivelDe('enfermeria') === 'profesional');
  verificar('auxiliar de enfermería es nivel técnico', roles.nivelDe('auxiliar_enfermeria') === 'tecnico');
  verificar('un rol inventado no es válido', !roles.esRolValido('superusuario'));
  verificar('el administrador no crea fichas', !roles.puede('administrador', 'ficha.crear'));
  verificar('el administrador ve todas las fichas', roles.alcanceDeLectura('administrador') === 'todas');
  verificar('la auxiliar ve las de su equipo', roles.alcanceDeLectura('auxiliar_enfermeria') === 'equipo');
  verificar('el administrador crea, modifica y restablece cuentas',
    ['usuarios.ver', 'usuarios.crear', 'usuarios.modificar', 'usuarios.restablecer']
      .every(function (p) { return roles.puede('administrador', p); }));
  verificar('el maestro captura, ve todo y administra',
    roles.puede('maestro', 'ficha.crear') && roles.alcanceDeLectura('maestro') === 'todas' &&
    roles.puede('maestro', 'usuarios.modificar') && roles.puede('maestro', 'auditoria.ver'));
  verificar('el maestro cuenta como asistencial (firma los ítems 10 y 12-14)', roles.esAsistencial('maestro'));
  verificar('la profesional no ve ni gestiona usuarios',
    !roles.puede('medicina', 'usuarios.ver') && !roles.puede('medicina', 'usuarios.crear'));
  verificar('sólo el maestro elimina fichas',
    roles.puede('maestro', 'ficha.eliminar') &&
    ['coordinador_ebs', 'lider_ebs', 'administrador', 'enfermeria', 'auxiliar_enfermeria']
      .every(function (rol) { return !roles.puede(rol, 'ficha.eliminar'); }));

  console.log('\n=== 3b. Coordinación del EBS (coordinadora y líderes de zona) ===');
  verificar('coordinación y líder son el mismo nivel',
    roles.nivelDe('coordinador_ebs') === 'coordinacion' && roles.nivelDe('lider_ebs') === 'coordinacion');
  verificar('la coordinación captura y ve todas las fichas',
    roles.puede('lider_ebs', 'ficha.crear') && roles.alcanceDeLectura('lider_ebs') === 'todas');
  verificar('la coordinación autoriza correcciones, modifica lo registrado del plan y genera el reporte',
    roles.puede('lider_ebs', 'ficha.autorizar') && roles.puede('lider_ebs', 'plan.modificar_registrado') &&
    roles.puede('lider_ebs', 'reporte.generar'));
  verificar('la coordinación, el administrador y el maestro ven los reportes de productividad',
    ['coordinador_ebs', 'lider_ebs', 'administrador', 'maestro'].every(function (rol) {
      return roles.puede(rol, 'productividad.ver');
    }));
  verificar('el personal asistencial no los ve',
    ['medicina', 'enfermeria', 'psicologia', 'trabajo_social', 'auxiliar_enfermeria', 'gestor_comunitario', 'otro']
      .every(function (rol) { return !roles.puede(rol, 'productividad.ver'); }));
  verificar('la coordinación ve y crea cuentas',
    roles.puede('coordinador_ebs', 'usuarios.ver') && roles.puede('coordinador_ebs', 'usuarios.crear'));
  verificar('pero no modifica cuentas ni restablece claves',
    !roles.puede('coordinador_ebs', 'usuarios.modificar') && !roles.puede('coordinador_ebs', 'usuarios.restablecer'));
  verificar('la coordinación sólo crea cuentas del personal asistencial',
    roles.rolesQuePuedeCrear('lider_ebs').indexOf('enfermeria') !== -1 &&
    roles.rolesQuePuedeCrear('lider_ebs').indexOf('auxiliar_enfermeria') !== -1 &&
    ['lider_ebs', 'coordinador_ebs', 'administrador', 'maestro'].every(function (rol) {
      return roles.rolesQuePuedeCrear('lider_ebs').indexOf(rol) === -1;
    }));
  verificar('el administrador no crea maestros; el maestro crea cualquiera',
    roles.rolesQuePuedeCrear('administrador').indexOf('maestro') === -1 &&
    roles.rolesQuePuedeCrear('maestro').indexOf('maestro') !== -1);
  verificar('la coordinación no necesita equipo; el personal asistencial sí',
    !roles.requiereEquipo('lider_ebs') && roles.requiereEquipo('enfermeria') && roles.requiereEquipo('maestro'));
  verificar('la coordinación elige su perfil del ítem 14', roles.eligePerfil('lider_ebs') && !roles.eligePerfil('enfermeria'));
  verificar('la coordinación, sin EBS propio, indica el de cada visita; el personal asistencial no',
    roles.eligeEquipoDeLaFicha('coordinador_ebs') && roles.eligeEquipoDeLaFicha('lider_ebs') &&
    !roles.eligeEquipoDeLaFicha('enfermeria') && !roles.eligeEquipoDeLaFicha('maestro'));

  const profesional = { rol: 'enfermeria', equipoSaludId: 7, funcionarioId: 100 };
  const auxiliar = { rol: 'auxiliar_enfermeria', equipoSaludId: 7, funcionarioId: 101 };
  const otroEquipo = { rol: 'medicina', equipoSaludId: 8, funcionarioId: 102 };
  const admin = { rol: 'administrador', equipoSaludId: null, funcionarioId: 1 };
  const lider = { rol: 'lider_ebs', equipoSaludId: null, funcionarioId: 3 };
  const maestro = { rol: 'maestro', equipoSaludId: 7, funcionarioId: 2 };
  const fichaDeAuxiliar = { equipoSaludId: 7, responsableId: 101 };
  const fichaDeProfesional = { equipoSaludId: 7, responsableId: 100 };

  console.log('\n=== 3c. Corregir y evolucionar una ficha guardada (RN-228) ===');
  verificar('la profesional no corrige sin autorización, ni la suya', !roles.puedeCorregir(profesional, fichaDeProfesional));
  verificar('la auxiliar tampoco', !roles.puedeCorregir(auxiliar, fichaDeAuxiliar));
  verificar('la coordinación corrige cualquiera, de cualquier equipo', roles.puedeCorregir(lider, fichaDeAuxiliar));
  verificar('el administrador corrige cualquiera', roles.puedeCorregir(admin, fichaDeAuxiliar));
  verificar('la profesional evoluciona el plan de las fichas de su equipo', roles.puedeEvolucionar(profesional, fichaDeAuxiliar));
  verificar('la auxiliar evoluciona el plan de las suyas', roles.puedeEvolucionar(auxiliar, fichaDeAuxiliar));
  verificar('  pero no el de las de otra persona', !roles.puedeEvolucionar(auxiliar, fichaDeProfesional));
  verificar('otro equipo no evoluciona nada de este', !roles.puedeEvolucionar(otroEquipo, fichaDeAuxiliar));
  verificar('a la profesional y la auxiliar del equipo se les puede autorizar',
    roles.puedeRecibirAutorizacion(profesional, fichaDeAuxiliar) && roles.puedeRecibirAutorizacion(auxiliar, fichaDeProfesional));
  verificar('a otro equipo no: no ve la ficha', !roles.puedeRecibirAutorizacion(otroEquipo, fichaDeAuxiliar));
  verificar('a la coordinación y al maestro no: ya pueden todo',
    !roles.puedeRecibirAutorizacion(lider, fichaDeAuxiliar) && !roles.puedeRecibirAutorizacion(maestro, fichaDeAuxiliar));
  verificar('al administrador sí, para cambiar lo registrado del plan', roles.puedeRecibirAutorizacion(admin, fichaDeAuxiliar));

  console.log('\n=== 4. Cookies ===');

  const cookies = auth.leerCookies({ headers: { cookie: 'a=1; aps_sesion=abc%3D; otra=x' } });
  verificar('se lee la cookie de sesión decodificada', cookies.aps_sesion === 'abc=');
  verificar('sin cabecera cookie devuelve objeto vacío', Object.keys(auth.leerCookies({ headers: {} })).length === 0);

  console.log('\n---------------------------------------------');
  console.log('Pasadas: ' + pasadas + '   Fallidas: ' + fallidas);
  process.exit(fallidas > 0 ? 1 : 0);
}

principal().catch(function (error) {
  console.error(error);
  process.exit(1);
});
