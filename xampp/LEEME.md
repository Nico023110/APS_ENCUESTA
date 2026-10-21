# Encuesta_APS en XAMPP

Instalación local de la aplicación sobre XAMPP (Windows), como paso previo al
entorno institucional.

## Cómo queda

```
Navegador ──► Apache (XAMPP)  http://localhost:8090
                 │  HTML, JS, CSS y logos: los sirve Apache desde
                 │  C:\xampp\htdocs\aps_encuesta
                 │
                 └─ /api/*  ──► Node  127.0.0.1:3090  (servidor.js)
                                  │  tarea programada "APS_Encuesta_API",
                                  │  arranca sola con el equipo
                                  │
                                  └─► PostgreSQL 17  localhost:5432
                                      base aps_encuesta, rol aps_encuesta
```

**Por qué sigue habiendo Node.** El servidor valida cada ficha con el mismo
motor de reglas que corre el navegador (`reglas.js`, `catalogos.js`,
`anexo.js`, `direccion.js`, `catalogos_sispro.js`) y con él arma el reporte
SISPRO. Ese motor es JavaScript; pasarlo a PHP dejaría dos motores que habría
que mantener iguales a mano. Apache es la puerta de entrada y Node atiende
sólo `/api`, sin exponerse a la red (escucha en 127.0.0.1).

**Por qué PostgreSQL y no MySQL de XAMPP.** El esquema usa `jsonb`,
disparadores en PL/pgSQL, tres esquemas (`cat`, `aps`, `aud`) y búsqueda de
texto sin tildes (`unaccent`, `pg_trgm`). MariaDB no tiene equivalente
directo de casi nada de eso.

## Requisitos

| Programa | Versión probada | Nota |
|---|---|---|
| XAMPP | 8.0.30 (Apache 2.4.58) | Sólo se usa Apache. MySQL puede seguir apagado. |
| Node.js | 24 LTS | https://nodejs.org |
| PostgreSQL | 17 | Con `psql` en `C:\Program Files\PostgreSQL\17\bin` |

## Instalar (o actualizar)

Abra **PowerShell como administrador** en la raíz del repositorio y ejecute:

```powershell
powershell -ExecutionPolicy Bypass -File xampp\instalar.ps1
```

La primera vez pide:

1. La clave del superusuario `postgres`. Se usa una sola vez para crear el
   rol `aps_encuesta` y la base; no se guarda.
2. El documento y el nombre del primer **administrador**. El instalador
   imprime una clave temporal **una sola vez**: anótela. Con ese usuario se
   crean los demás desde la aplicación (menú del usuario → Modificar usuarios).

Luego abra http://localhost:8090. También funciona
http://localhost/aps_encuesta, que redirige ahí.

Para **actualizar** después de cambiar el código, vuelva a correr el mismo
comando: copia los archivos, aplica las migraciones pendientes
(`npm run bd:migrar`) y reinicia Apache y Node. No borra fichas ni usuarios y
conserva `.env.local`.

Parámetros opcionales: `-Xampp`, `-Destino`, `-Puerto` (8090), `-PuertoApi`
(3090), `-PgBin`, `-PgHost`, `-PgPuerto`, `-PgSuperusuario`, `-Base`,
`-RolBase`, `-SinReiniciarApache`.

## Qué cambia el instalador

| Dónde | Qué |
|---|---|
| `C:\xampp\htdocs\aps_encuesta` | Copia de la aplicación, `node_modules` de producción y `.env.local` con la conexión. |
| `C:\xampp\apache\conf\extra\httpd-aps-encuesta.conf` | El sitio (generado desde `xampp/httpd-aps-encuesta.conf`). |
| `C:\xampp\apache\conf\httpd.conf` | Activa `mod_proxy_http` y añade el `Include` al final. Respaldo en `httpd.conf.antes-aps-encuesta`. |
| Programador de tareas | Tarea `APS_Encuesta_API` (cuenta SYSTEM, al iniciar el equipo). |
| Servicios de Windows | Apache registrado como servicio `Apache2.4`, inicio automático. |
| PostgreSQL | Rol `aps_encuesta` (no superusuario), base `aps_encuesta`, extensiones `unaccent` y `pg_trgm`. |

La carpeta queda dentro de `htdocs`, pero el sitio por defecto de XAMPP
(puertos 80 y 443) la tiene **negada**: sólo el sitio del puerto 8090 la sirve,
y éste bloquea `bd/`, `node_modules/`, `.env.local`, `*.md`, `*.sql`, etc.

## Operación diaria

Apache queda como **servicio de Windows `Apache2.4`** con arranque automático:
en el Panel de control de XAMPP aparece con la casilla *Service* marcada. Para
detenerlo o iniciarlo desde el panel, abra el panel **como administrador**; o
use `Restart-Service Apache2.4` en una consola de administrador. No lo inicie
con el botón *Start* sin ser administrador: el servicio ya tiene los puertos.

MySQL de XAMPP puede seguir apagado: la aplicación usa PostgreSQL.

La API:

```powershell
Get-ScheduledTask APS_Encuesta_API          # estado
Stop-ScheduledTask APS_Encuesta_API         # detener
Start-ScheduledTask APS_Encuesta_API        # iniciar
```

Registros:

- API: `C:\xampp\htdocs\aps_encuesta\logs\api.log` (se rota a `api.log.1` al pasar 10 MB)
- Apache: `C:\xampp\apache\logs\aps-encuesta-error.log` y `aps-encuesta-access.log`

Si Node se cae, el supervisor (`xampp/servicio_api.js`) lo relanza solo.

Crear o restablecer usuarios por consola (desde `C:\xampp\htdocs\aps_encuesta`):

```powershell
node bd\crear_usuario.js --documento 1144012345 --restablecer
```

## Traer los datos que ya están en Neon (opcional)

La instalación arranca con la base vacía (sólo catálogos). Para traer las
fichas y usuarios de la nube, antes de usar la aplicación en local:

```powershell
$pg = 'C:\Program Files\PostgreSQL\17\bin'
# 1. Copia de Neon (cadena DATABASE_URL de Vercel)
& "$pg\pg_dump.exe" "postgresql://USUARIO:CLAVE@HOST.neon.tech/neondb?sslmode=require" `
    --format=custom --no-owner --no-acl --file aps_neon.dump

# 2. Detener la API y recrear la base vacía (como postgres)
Stop-ScheduledTask APS_Encuesta_API
& "$pg\psql.exe" -U postgres -c "DROP DATABASE aps_encuesta" -c "CREATE DATABASE aps_encuesta OWNER aps_encuesta ENCODING 'UTF8' TEMPLATE template0"
& "$pg\psql.exe" -U postgres -d aps_encuesta -c "CREATE EXTENSION unaccent; CREATE EXTENSION pg_trgm"

# 3. Restaurar con el rol de la aplicación como dueño
& "$pg\pg_restore.exe" -U postgres -d aps_encuesta --no-owner --role=aps_encuesta aps_neon.dump

# 4. Volver a correr el instalador: ve el esquema y aplica sólo migraciones
powershell -ExecutionPolicy Bypass -File xampp\instalar.ps1
```

Los avisos de `pg_restore` sobre extensiones que ya existen se pueden ignorar.

## Problemas frecuentes

- **"La API no respondió en el puerto 3090"**: revise `logs\api.log`. Lo más
  común es la conexión a PostgreSQL (servicio `postgresql-x64-17` detenido o
  `.env.local` con datos viejos).
- **Apache no arranca**: otro programa usa el puerto 8090 (use `-Puerto`) o la
  configuración tiene un error: `C:\xampp\apache\bin\httpd.exe -t`.
- **La base ya existía, creada con `postgres`** (por ejemplo con
  `npm run bd:crear`): el instalador lo detecta, pide la clave de `postgres`,
  hace un respaldo y traspasa esquemas, tablas, vistas, funciones y tipos al
  rol `aps_encuesta`. Los datos no cambian.
- **Respaldos**: antes de traspasar o migrar, el instalador guarda un
  `pg_dump` en `C:\xampp\aps_encuesta_respaldos\` (fuera de `htdocs`). Para
  volver a uno: `pg_restore -U postgres -d aps_encuesta --clean --if-exists --no-owner --role=aps_encuesta ARCHIVO.dump`.
- **Volver atrás en Apache**: restaure `httpd.conf.antes-aps-encuesta` sobre
  `httpd.conf` y reinicie Apache.

## Al pasar al servidor institucional

- Acceso desde otros equipos: abra el puerto 8090 en el firewall de Windows
  del servidor. Node no necesita abrirse: sólo le habla Apache.
- **HTTPS.** Desde otro equipo por `http://IP:8090` el navegador **bloquea la
  geolocalización** (sólo la permite en `https://` o en `localhost`). En el
  servidor institucional configure un certificado en Apache (`mod_ssl`) y
  cambie en `httpd-aps-encuesta.conf` la línea
  `RequestHeader set X-Forwarded-Proto "http"` por `"https"`: así la cookie
  de sesión sale con `Secure`.
- Si el servidor tiene otras rutas, use los parámetros `-Xampp`, `-Destino` y
  `-PgBin`.
