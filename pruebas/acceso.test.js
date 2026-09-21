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
  verificar('el administrador gestiona usuarios', roles.puede('administrador', 'usuarios.gestionar'));
  verificar('el maestro captura, ve todo y administra',
    roles.puede('maestro', 'ficha.crear') && roles.alcanceDeLectura('maestro') === 'todas' &&
    roles.puede('maestro', 'usuarios.gestionar') && roles.puede('maestro', 'auditoria.ver'));
  verificar('el maestro cuenta como asistencial (firma los ítems 10 y 12-14)', roles.esAsistencial('maestro'));
  verificar('la profesional no gestiona usuarios', !roles.puede('medicina', 'usuarios.gestionar'));

  const profesional = { rol: 'enfermeria', equipoSaludId: 7, funcionarioId: 100 };
  const auxiliar = { rol: 'auxiliar_enfermeria', equipoSaludId: 7, funcionarioId: 101 };
  const otroEquipo = { rol: 'medicina', equipoSaludId: 8, funcionarioId: 102 };
  const admin = { rol: 'administrador', equipoSaludId: null, funcionarioId: 1 };
  const fichaDeAuxiliar = { equipoSaludId: 7, responsableId: 101 };
  const fichaDeProfesional = { equipoSaludId: 7, responsableId: 100 };

  verificar('la profesional corrige la ficha de la auxiliar de su equipo', roles.puedeCorregir(profesional, fichaDeAuxiliar));
  verificar('la auxiliar corrige su propia ficha', roles.puedeCorregir(auxiliar, fichaDeAuxiliar));
  verificar('la auxiliar no corrige la de la profesional', !roles.puedeCorregir(auxiliar, fichaDeProfesional));
  verificar('otro equipo no corrige nada de este', !roles.puedeCorregir(otroEquipo, fichaDeAuxiliar));
  verificar('el administrador corrige cualquiera', roles.puedeCorregir(admin, fichaDeAuxiliar));

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
