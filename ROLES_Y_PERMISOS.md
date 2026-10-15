# Roles, permisos y acceso — Encuesta APS

Referencia del control de acceso de la aplicación. Complementa a
`REGLAS_DE_NEGOCIO.md` (RN‑223.6, RN‑224 y RN‑225) y al lineamiento de Equipos
Básicos de Salud 2026. La implementación vive en `roles.js` (matriz, compartida
por navegador y servidor), `api/_auth.js` (claves, sesiones, guardia) y
`sesion.js` (puerta, bloqueo por inactividad y firma del formulario).

## 1. Quién es un usuario

Un usuario es un **funcionario** (`aps.funcionario`: tipo y número de documento,
nombre, perfil profesional, equipo) con una cuenta de acceso (`aps.usuario`).
Inicia sesión con su **número de documento** —el mismo del ítem 13 del
instrumento— y una contraseña.

El **rol** es su perfil asistencial del ítem 14, un rol de coordinación del
EBS, «administrador» o «maestro»:

| Rol (`usuario.rol`) | Etiqueta | Nivel |
|---|---|---|
| `medicina` | Medicina | profesional |
| `enfermeria` | Enfermería (profesional) | profesional |
| `psicologia` | Psicología | profesional |
| `trabajo_social` | Trabajo social | profesional |
| `odontologia` | Odontología | profesional |
| `nutricion` | Nutrición y dietética | profesional |
| `fisioterapia` | Fisioterapia | profesional |
| `terapia_ocupacional` | Terapia ocupacional | profesional |
| `auxiliar_enfermeria` | Auxiliar de enfermería | técnico |
| `gestor_comunitario` | Gestor / Promotor comunitario en salud | técnico |
| `tecnico_saneamiento` | Técnico en salud pública / saneamiento | técnico |
| `otro` | Otro perfil del EBS (exige aclaración, RN‑014) | técnico |
| `coordinador_ebs` | Coordinación EBS | coordinación |
| `lider_ebs` | Líder de zona EBS | coordinación |
| `administrador` | Administrador | administrador |
| `maestro` | Usuario maestro | maestro |

El instrumento no distingue permisos entre profesiones; lo que distingue es el
**nivel**:

- **Profesional y técnico** (el personal asistencial): crean fichas, las ven y
  evolucionan su plan de cuidado —el profesional, el de las fichas de su
  equipo; el técnico, el de las suyas—. Una ficha **ya guardada no la
  corrigen** sin una autorización de la coordinación o del maestro, ni la
  propia. No ven usuarios ni el reporte.
- **Coordinación** (la coordinadora del EBS y los líderes de zona): todo lo de
  la captura sobre cualquier ficha —verla, corregirla, evolucionarla, cambiar
  lo registrado en su plan y autorizar a otros a corregirla—, el reporte SI‑APS
  y **crear** cuentas del personal asistencial. **No modifica** cuentas, **no
  restablece** claves y **no elimina** fichas. Su equipo es opcional: sin él
  no registra fichas nuevas. Firma el ítem 14 con el perfil que se le indique
  al crearla (si no, «Otro: su cargo»).
- **Administrador**: administra (cuentas, equipos, catálogos) y consulta y
  corrige cualquier ficha; no captura.
- **Maestro**: lo hace todo y es el **único que elimina una ficha** de la
  base. Es la cuenta de quien responde por el proyecto entero: debería existir
  una sola y su perfil del ítem 14 se indica al crearla (`--perfil
  enfermeria`; si no, «Otro: Usuario maestro»).

Cada cuenta guarda además, de forma opcional, el **cargo** o zona a cargo
(«Líder Zona Norte»), el **correo** y el **teléfono** de la persona. Son datos
de contacto: no van en la ficha ni en el reporte, y no sirven para iniciar
sesión.

## 2. Matriz de permisos

| Permiso | Técnico | Profesional | Coordinación | Administrador | Maestro |
|---|:-:|:-:|:-:|:-:|:-:|
| `ficha.crear` — registrar fichas nuevas | Sí | Sí | Sí | No | Sí |
| `ficha.ver.equipo` — historial e indicadores de su equipo | Sí | Sí | — | — | Sí |
| `ficha.ver.todas` — historial e indicadores globales | — | — | Sí | Sí | Sí |
| `ficha.evolucionar.propias` — completar el plan pendiente de las fichas que él mismo diligenció | Sí | — | — | — | — |
| `ficha.evolucionar.equipo` — completar el plan pendiente de las fichas de su equipo | — | Sí | — | — | — |
| `ficha.evolucionar.todas` — completar el plan pendiente de cualquier ficha | — | — | Sí | — | Sí |
| `ficha.corregir.todas` — corregir cualquier ficha guardada sin pedir autorización | — | — | Sí | Sí | Sí |
| `ficha.autorizar` — autorizar a una persona a corregir una ficha guardada, incluido lo registrado en su plan (RN‑228) | — | — | Sí | — | Sí |
| `plan.modificar_registrado` — cambiar lo registrado en un plan de cuidado sin autorización (RN‑228) | — | — | Sí | — | Sí |
| `ficha.eliminar` — eliminar una ficha de la base, con motivo (RN‑225) | — | — | — | — | Sí |
| `catalogos.consultar` — territorios, acciones, CUPS | Sí | Sí | Sí | Sí | Sí |
| `usuarios.ver` — la vista de usuarios | — | — | Sí | Sí | Sí |
| `usuarios.crear` — crear cuentas (la coordinación, sólo del personal asistencial) | — | — | Sí | Sí | Sí |
| `usuarios.modificar` — cambiar nombre, rol, equipo, contacto y estado | — | — | — | Sí | Sí |
| `usuarios.restablecer` — dar una contraseña temporal nueva | — | — | — | Sí | Sí |
| `equipos.gestionar` — equipos y su composición | — | — | — | Sí | Sí |
| `auditoria.ver` — `aud.evento`, `aud.acceso_sensible`, `aps.intento_acceso` | — | — | Sí | Sí | Sí |
| `reporte.generar` — archivo plano APS124CCFP para PISIS (RN‑227) | — | — | Sí | Sí | Sí |

El maestro tiene además `ficha.corregir.propias` y `ficha.corregir.equipo`,
que hoy no tiene ningún otro rol.

Consecuencias en la interfaz:

- Al **administrador** no se le muestra «Nueva Encuesta», el botón principal de
  Inicio ni «Sincronizar a la nube».
- Para los roles asistenciales los ítems **10, 12, 13 y 14** se rellenan desde la
  sesión y quedan fijos. El servidor los impone de todos modos: una ficha nueva
  se firma con el equipo y el responsable de quien la envía; al corregir una
  ficha existente se conservan el equipo y el responsable originales y la
  corrección queda en `aud.evento` a nombre de quien la hizo (RN‑225).
- El historial y el detalle sólo devuelven fichas del equipo del usuario
  (RN‑224.3). Una ficha ajena responde 404, no 403: el código de ficha no se
  confirma a quien no le corresponde.
- Cada consulta del detalle de una ficha queda en `aud.acceso_sensible`
  (RN‑224.2).
- El detalle (**Ver**) muestra cada familia de la vivienda con lo que identifica
  a sus integrantes —nombre, documento, fecha de nacimiento, sexo y rol—,
  también a quien puede ver la ficha pero no corregirla. Los grupos sensibles de
  RN‑224 (salud, etnia, orientación sexual, violencias) sólo llegan con la ficha
  completa de **Corregir**.
- **Corregir** una ficha que ya está en la base es de la coordinación, el
  administrador y el maestro. El personal asistencial la corrige sólo con una
  **autorización vigente** sobre esa ficha; sin ella el botón aparece
  deshabilitado y el servidor responde 403 `requiere_autorizacion`. Una ficha
  que todavía no sube (sigue sólo en el dispositivo) se corrige libremente:
  aún no está registrada. El reenvío automático de la captura original —cuando
  el dispositivo no alcanzó a recibir la respuesta— se acepta sin autorización:
  lo envía su mismo autor, sin la marca de corrección y con el mismo instante
  de diligenciamiento que quedó guardado. Corregir funciona desde cualquier
  dispositivo: si la ficha no está en el equipo, se trae completa de la base
  (`/api/ficha_completa`), que dice si es `corregible`. Fuera del alcance de
  lectura responde 404. Cada lectura queda en `aud.acceso_sensible` (grupo
  `ficha_completa`). Una ficha que ya está en la base se corrige aunque la
  visita tenga más de 30 días (RN‑016).
- **Evolucionar plan** aparece en el historial cuando el plan de cuidado de una
  ficha de la base está pendiente: para el profesional, en las fichas de su
  equipo; para el técnico, en las suyas; para la coordinación y el maestro, en
  todas. Sólo deja completar el plan: la visita queda intocable y el servidor
  escribe únicamente los planes (RN‑228).
- **Autorizar** (coordinación y maestro) aparece en las fichas de la base:
  elige a la persona —entre quienes ven la ficha en su historial y no pueden
  corregirla por sí mismos— y un motivo. La autorización le deja corregir la
  ficha, incluido lo registrado en su plan de cuidado, **en un guardado**; se
  puede revocar antes de usarla. Todo queda en `aps.permiso_plan` y en
  `aud.evento` (RN‑228).
- **Lo registrado en el plan de cuidado** sólo se completa, por cualquier vía
  (Evolucionar plan, Corregir o sincronizar), salvo para la coordinación, el
  maestro o quien tenga una autorización vigente.
- **Eliminar** sólo lo ve el maestro. Una ficha que sigue en el dispositivo se
  borra de ahí; una que ya está en la base se elimina de la base, para todos,
  con un **motivo obligatorio**. Se borran la ficha y lo que cuelga de ella
  (familias de la visita, integrantes, planes, alertas, autorizaciones); la
  vivienda y la familia como identidades se conservan, para que sus códigos y
  el NUV no se reutilicen. El borrado queda en `aud.evento` (tipo
  `eliminacion`) con el motivo y el resumen de la ficha (RN‑225).

La gestión de cuentas se hace desde la aplicación: el chip del usuario en la
cabecera despliega un menú con **Modificar usuarios** (administrador y
maestro) o **Crear usuarios** (coordinación), **Bloquear pantalla** y **Cerrar
sesión**. La vista de usuarios lista las cuentas con búsqueda y filtros —con su
cargo y contacto—, permite crear (muestra la clave temporal una sola vez) y,
con el permiso respectivo, modificar nombre, rol, equipo, contacto y estado, y
restablecer la clave. Para la coordinación cada fila dice «Sólo consulta».
Reglas que aplica `/api/usuarios` además de los permisos: cada rol crea sólo
los roles que `roles.rolesQuePuedeCrear` le deja (la coordinación, los del
personal asistencial; el administrador, todos menos maestro); nadie se
desactiva ni se cambia el rol a sí mismo; sólo un maestro crea, modifica o
restablece cuentas de maestro; cada acción queda en `aud.evento` a nombre de
quien la hizo. La línea de comandos (`npm run usuario:crear`) sigue disponible
para el primer administrador o maestro y usa el mismo módulo
(`api/_usuarios.js`).

El **Reporte SI-APS** (`reporte.generar`) se abre desde el mismo menú, para la
coordinación, el administrador y el maestro. Genera el archivo plano del anexo
técnico con los datos de todas las personas del período —violencias y salud
mental incluidas—, por eso no lo tiene el personal asistencial.
`/api/reporte_sispro` sólo acepta `POST` con sesión y cabecera anti‑CSRF (un
enlace o una imagen de otro sitio no pueden dispararlo), valida el período (un
año como máximo) y deja cada generación en `aud.evento` con el período, el
formato y el número de registros. El resumen previo a la descarga sólo trae
códigos de ficha, no datos personales.

## 3. Cómo se crean los usuarios

```bash
# Primer administrador (una sola vez)
npm run usuario:crear -- --documento 1144000000 --nombre "Nombre Apellido" --rol administrador

# Usuario maestro (todo: captura + administración); el equipo es el que firmará sus fichas
npm run usuario:crear -- --documento 1144000001 --nombre "Nombre Apellido" --rol maestro --equipo EBS001 --perfil enfermeria

# Coordinación del EBS (equipo opcional; cargo, correo y teléfono opcionales)
npm run usuario:crear -- --documento 1144000002 --nombre "Nombre Apellido" --rol coordinador_ebs --cargo "Coordinadora EBS" --correo nombre@dominio.com --telefono 3001234567
npm run usuario:crear -- --documento 1144000003 --nombre "Nombre Apellido" --rol lider_ebs --cargo "Líder Zona Norte"

# Integrante de un EBS (el equipo es obligatorio para roles asistenciales)
npm run usuario:crear -- --documento 1144012345 --nombre "María Pérez" --rol enfermeria --equipo EBS001

# Documento distinto de cédula
npm run usuario:crear -- --documento AB12345 --tipo CE --nombre "..." --rol auxiliar_enfermeria --equipo EBS001

# Restablecer la contraseña (cierra todas sus sesiones)
npm run usuario:crear -- --documento 1144012345 --restablecer
```

El comando imprime **una sola vez** una contraseña temporal. Se entrega en
persona; en el primer ingreso la aplicación exige reemplazarla por una propia.
No hay restablecimiento por correo: quien olvida su contraseña acude al
administrador.

Política de contraseñas (`api/_auth.js`, `requisitosIncumplidos`): mínimo 10
caracteres, al menos una letra y un número, no contiene el número de documento,
máximo 128, y al cambiarla debe ser distinta de la anterior.

## 4. Sesión y protecciones

| Medida | Detalle |
|---|---|
| Derivación de la clave | scrypt (N = 2¹⁵, r = 8, p = 1, 64 bytes) con sal de 16 bytes por usuario; comparación en tiempo constante. La clave nunca se guarda ni se registra. |
| Enumeración de cuentas | Mismo mensaje y mismo tiempo de respuesta para «documento inexistente» y «clave incorrecta» (se deriva contra un hash señuelo). |
| Fuerza bruta | 5 fallos seguidos bloquean la cuenta 15 minutos; más de 30 fallos desde una misma IP en 15 minutos responden 429. Ambos contadores viven en la base (`aps.usuario`, `aps.intento_acceso`), no en memoria: en Vercel cada petición puede caer en un proceso distinto. |
| Token de sesión | 32 bytes aleatorios; en la base sólo su SHA‑256 (`aps.sesion.id`). Cookie `aps_sesion` con `HttpOnly`, `SameSite=Strict`, `Path=/` y `Secure` fuera de localhost. |
| Vigencia | Tope absoluto 12 h; caduca a las 4 h sin uso de la API. Cerrar sesión y cambiar la contraseña revocan en la base (la segunda cierra además las otras sesiones del usuario). |
| Bloqueo por inactividad (RN‑223.6) | A los 15 minutos sin actividad la aplicación se cubre y pide la contraseña de nuevo; la ficha en curso no se pierde. |
| Sin red (RN‑223) | El perfil público (nombre, rol, equipo; nunca el token) queda en `localStorage` para abrir la aplicación sin señal; el servidor confirma o cierra la sesión cuando vuelve la red. |
| CSRF | Toda petición que muta exige la cabecera `X-Requested-With: fetch`; con `SameSite=Strict` la cookie no viaja desde otro origen. |
| Cabeceras | CSP restringida a los CDN que la aplicación usa, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy: same-origin`, HSTS en producción, `Cache-Control: no-store` en la API (`servidor.js` y `vercel.json`). |
| Publicación | `.vercelignore` deja fuera `bd/`, `pruebas/`, documentos y configuración de agentes; el servidor local tampoco los sirve. |
| Auditoría (RN‑225) | Creación y corrección de fichas en `aud.evento` con el funcionario, el dispositivo y las coordenadas; consultas del detalle en `aud.acceso_sensible`; todos los intentos de acceso en `aps.intento_acceso`. |

## 5. Límites conocidos

- Las fichas pendientes de sincronizar se guardan en el navegador bajo una sola
  clave por dispositivo, no por usuario: un dispositivo es de un equipo. Si dos
  personas de equipos distintos comparten un dispositivo, el historial local
  mezcla sus fichas hasta que se sincronizan.
- La asignación de **territorios** a un equipo (RN‑224.3 habla de territorios
  asignados) todavía no se modela; el alcance se aplica por equipo, que es la
  unidad que la ficha registra.
- El rol «consulta» (lectura anonimizada, RN‑224.4) y la gestión de equipos
  como entidad propia (`equipos.gestionar`) quedan para una siguiente entrega;
  el modelo ya los admite sin cambios de esquema.
