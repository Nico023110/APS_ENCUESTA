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

El **rol** es su perfil asistencial del ítem 14 o «administrador»:

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
| `administrador` | Administrador | administrador |
| `maestro` | Usuario maestro | maestro |

El instrumento no distingue permisos entre profesiones; lo que distingue es el
**nivel**: el profesional lidera el EBS y responde por el plan de cuidado; el
técnico captura; el administrador administra y no captura; el **maestro** lo
hace todo (captura, corrige y consulta cualquier ficha, y administra). Es la
cuenta de quien responde por el proyecto entero: debería existir una sola y su
perfil del ítem 14 se indica al crearla (`--perfil enfermeria`; si no, «Otro:
Usuario maestro»).

## 2. Matriz de permisos

| Permiso | Técnico | Profesional | Administrador | Maestro |
|---|:-:|:-:|:-:|:-:|
| `ficha.crear` — registrar fichas nuevas | Sí | Sí | No | Sí |
| `ficha.ver.equipo` — historial e indicadores de su equipo | Sí | Sí | — | Sí |
| `ficha.ver.todas` — historial e indicadores globales | — | — | Sí | Sí |
| `ficha.corregir.propias` — corregir las fichas que él mismo diligenció | Sí | Sí | — | Sí |
| `ficha.corregir.equipo` — corregir cualquier ficha de su equipo | — | Sí | — | Sí |
| `ficha.corregir.todas` — corregir cualquier ficha | — | — | Sí | Sí |
| `catalogos.consultar` — territorios, acciones, CUPS | Sí | Sí | Sí | Sí |
| `usuarios.gestionar` — crear, desactivar, restablecer claves | — | — | Sí | Sí |
| `equipos.gestionar` — equipos y su composición | — | — | Sí | Sí |
| `auditoria.ver` — `aud.evento`, `aud.acceso_sensible`, `aps.intento_acceso` | — | — | Sí | Sí |

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

Hoy la gestión de usuarios y equipos (`usuarios.gestionar`, `equipos.gestionar`)
se hace por línea de comandos; la pantalla de administración es la siguiente
entrega.

## 3. Cómo se crean los usuarios

```bash
# Primer administrador (una sola vez)
npm run usuario:crear -- --documento 1144000000 --nombre "Nombre Apellido" --rol administrador

# Usuario maestro (todo: captura + administración); el equipo es el que firmará sus fichas
npm run usuario:crear -- --documento 1144000001 --nombre "Nombre Apellido" --rol maestro --equipo EBS001 --perfil enfermeria

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
- El rol «consulta» (lectura anonimizada, RN‑224.4) y la pantalla de
  administración de usuarios quedan para la siguiente entrega; el modelo ya los
  admite sin cambios de esquema.
