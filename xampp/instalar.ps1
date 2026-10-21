<#
=========================================================================
 Encuesta_APS — Instalación en XAMPP (Windows)
 -------------------------------------------------------------------------
 Deja la aplicación funcionando en http://localhost:8090 con:

   Apache (XAMPP)  -> sirve HTML/JS/CSS y reenvía /api a Node
   Node            -> servidor.js en 127.0.0.1:3090, como tarea programada
                      que arranca con el equipo (cuenta SYSTEM)
   PostgreSQL      -> base "aps_encuesta" con un rol propio, no superusuario

 Es idempotente: volver a correrlo actualiza los archivos, aplica las
 migraciones pendientes y reinicia Apache y Node. No borra fichas.

 Uso (PowerShell COMO ADMINISTRADOR, desde la raíz del repositorio):

   powershell -ExecutionPolicy Bypass -File xampp\instalar.ps1

 La primera vez pide la clave del superusuario de PostgreSQL (sólo para
 crear el rol y la base; no se guarda) y los datos del primer
 administrador. La clave del rol de la aplicación se genera y queda sólo
 en .env.local de la carpeta instalada.
=========================================================================
#>

#Requires -Version 5.1
[CmdletBinding()]
param(
  [string]$Xampp = 'C:\xampp',
  [string]$Destino = '',
  [int]$Puerto = 8090,
  [int]$PuertoApi = 3090,
  [string]$PgBin = 'C:\Program Files\PostgreSQL\17\bin',
  [string]$PgHost = 'localhost',
  [int]$PgPuerto = 5432,
  [string]$PgSuperusuario = 'postgres',
  [string]$Base = 'aps_encuesta',
  [string]$RolBase = 'aps_encuesta',
  [string]$NombreTarea = 'APS_Encuesta_API',
  [switch]$SinReiniciarApache
)

$ErrorActionPreference = 'Stop'

$Origen = Split-Path -Parent $PSScriptRoot
if (-not $Destino) { $Destino = Join-Path $Xampp 'htdocs\aps_encuesta' }

function Paso([string]$texto) { Write-Host ''; Write-Host "== $texto" -ForegroundColor Cyan }
function Ok([string]$texto) { Write-Host "   $texto" -ForegroundColor Green }
function Aviso([string]$texto) { Write-Host "   $texto" -ForegroundColor Yellow }
function Fallo([string]$texto) { throw $texto }

function Sin-Bom([string]$ruta, [string]$contenido) {
  [IO.File]::WriteAllText($ruta, $contenido, (New-Object Text.UTF8Encoding $false))
}

# En PowerShell 5.1, con ErrorActionPreference=Stop, cualquier línea que un
# programa escriba en stderr bajo 2>&1 se vuelve un error fatal, aunque el
# programa termine bien (psql escribe ahí sus NOTICE; httpd -t, "Syntax OK").
# Se corre con Continue y se decide por el código de salida.
function Nativo([scriptblock]$bloque) {
  $antes = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try { return @(& $bloque 2>&1 | ForEach-Object { "$_" }) }
  finally { $ErrorActionPreference = $antes }
}

# -------------------------------------------------------------------------
#  0. Requisitos
# -------------------------------------------------------------------------
Paso 'Revisando requisitos'

$esAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
  [Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $esAdmin) {
  Fallo 'Ejecute PowerShell como administrador: hace falta para registrar el arranque automatico de la API.'
}

$node = (Get-Command node.exe -ErrorAction SilentlyContinue)
if (-not $node) { Fallo 'No se encontro Node.js (node.exe). Instalelo desde https://nodejs.org (version LTS).' }
$node = $node.Source
$npm = (Get-Command npm.cmd -ErrorAction SilentlyContinue)
if (-not $npm) { Fallo 'No se encontro npm.cmd (viene con Node.js).' }
$npm = $npm.Source

$psql = Join-Path $PgBin 'psql.exe'
if (-not (Test-Path $psql)) { Fallo "No se encontro psql en $PgBin. Indique la carpeta con -PgBin." }
# crear_bd.js invoca "psql" por nombre.
$env:PATH = "$PgBin;$env:PATH"

$httpd = Join-Path $Xampp 'apache\bin\httpd.exe'
$httpdConf = Join-Path $Xampp 'apache\conf\httpd.conf'
if (-not (Test-Path $httpd)) { Fallo "No se encontro Apache de XAMPP en $Xampp. Indique la carpeta con -Xampp." }

if (-not (Test-Path (Join-Path $Origen 'servidor.js'))) { Fallo "No parece la raiz del proyecto: $Origen" }

Ok "Node     $node ($(& $node --version))"
Ok "psql     $psql"
Ok "Apache   $httpd"
Ok "Origen   $Origen"
Ok "Destino  $Destino"

# -------------------------------------------------------------------------
#  1. Archivos
# -------------------------------------------------------------------------
Paso "Copiando la aplicacion a $Destino"

if ((Test-Path $Destino) -and (Get-ChildItem $Destino -Force | Select-Object -First 1)) {
  $pkg = Join-Path $Destino 'package.json'
  if (-not (Test-Path $pkg) -or -not ((Get-Content $pkg -Raw) -match '"name"\s*:\s*"aps_encuesta"')) {
    Fallo "$Destino ya existe y no es una instalacion de Encuesta_APS. Muevala o use -Destino."
  }
}

# Detener la API antes de copiar: node.exe bloquea los archivos que usa.
$tarea = Get-ScheduledTask -TaskName $NombreTarea -ErrorAction SilentlyContinue
if ($tarea) { Stop-ScheduledTask -TaskName $NombreTarea -ErrorAction SilentlyContinue }

# /MIR deja el destino igual al origen. Lo excluido ni se copia ni se borra
# en el destino: .env.local, logs y node_modules se conservan.
& robocopy.exe $Origen $Destino /MIR /NFL /NDL /NJH /NJS /NP /R:2 /W:2 `
  /XD .git node_modules pruebas .claude .codex .impeccable .agents .vercel logs `
  /XF .env .env.local *.pdf *.docx *.xlsx | Out-Null
if ($LASTEXITCODE -ge 8) { Fallo "robocopy fallo con codigo $LASTEXITCODE" }
Ok 'Archivos copiados'

Paso 'Instalando dependencias de Node (sin las de pruebas)'
# La sesión de administrador puede usar otro perfil de npm (otra caché, otro
# proxy) y quedarse sin red. Por eso: si node_modules ya corresponde al
# package-lock.json no se toca; si hay que instalar se prefiere la caché, y
# si npm falla se copian las dependencias ya instaladas en el repositorio.
$huellaLock = (Get-FileHash (Join-Path $Destino 'package-lock.json') -Algorithm SHA256).Hash
$marca = Join-Path $Destino 'node_modules\.aps-lock-sha256'
if ((Test-Path $marca) -and ((Get-Content $marca -Raw).Trim() -eq $huellaLock)) {
  Ok 'Dependencias al dia (package-lock.json sin cambios)'
} else {
  Push-Location $Destino
  try {
    & $npm ci --omit=dev --no-audit --no-fund --prefer-offline
    $npmOk = ($LASTEXITCODE -eq 0)
  } finally { Pop-Location }

  if (-not $npmOk) {
    $modulosOrigen = Join-Path $Origen 'node_modules'
    $lockOrigen = (Get-FileHash (Join-Path $Origen 'package-lock.json') -Algorithm SHA256).Hash
    if ((Test-Path (Join-Path $modulosOrigen 'pg')) -and (Test-Path (Join-Path $modulosOrigen 'dotenv')) -and $lockOrigen -eq $huellaLock) {
      Aviso 'npm no pudo descargar; se copian las dependencias instaladas en el repositorio.'
      & robocopy.exe $modulosOrigen (Join-Path $Destino 'node_modules') /MIR /NFL /NDL /NJH /NJS /NP /R:2 /W:2 | Out-Null
      if ($LASTEXITCODE -ge 8) { Fallo "robocopy de node_modules fallo con codigo $LASTEXITCODE" }
    } else {
      Fallo "npm ci fallo. Ejecute 'npm ci --omit=dev' en $Origen (sin administrador) y vuelva a correr el instalador."
    }
  }
  Sin-Bom $marca $huellaLock
  Ok 'Dependencias instaladas'
}

# -------------------------------------------------------------------------
#  2. Base de datos
# -------------------------------------------------------------------------
Paso 'Base de datos PostgreSQL'

$envLocal = Join-Path $Destino '.env.local'

$pgDump = Join-Path $PgBin 'pg_dump.exe'
# Fuera de htdocs: un respaldo lleva todas las fichas y no debe quedar al
# alcance de Apache.
$dirRespaldos = Join-Path $Xampp 'aps_encuesta_respaldos'

function Psql-Super([string]$baseDestino, [string]$sql) {
  $tmp = [IO.Path]::GetTempFileName()
  try {
    # Sin los NOTICE de "ya existe, omitiendo": no son errores y ensucian.
    Sin-Bom $tmp ("SET client_min_messages = warning;`n" + $sql)
    $r = Nativo { & $psql -h $PgHost -p $PgPuerto -U $PgSuperusuario -d $baseDestino -w -X -q -t -A -v ON_ERROR_STOP=1 -f $tmp }
    if ($LASTEXITCODE -ne 0) { Fallo "psql: $($r -join ' ')" }
    return (($r | Where-Object { $_ -notmatch '^(NOTICE|AVISO):' }) -join "`n").Trim()
  } finally { Remove-Item $tmp -ErrorAction SilentlyContinue }
}

function Pedir-ClaveSuper {
  if ($env:PGPASSWORD) { return }
  $segura = Read-Host "   Clave del usuario '$PgSuperusuario' de PostgreSQL ($PgHost`:$PgPuerto)" -AsSecureString
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($segura)
  $env:PGPASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
}

# pg_dump en formato custom (se restaura con pg_restore). $conexion es la URL
# del rol de la aplicación, o vacía para usar el superusuario.
function Respaldar([string]$conexion, [string]$motivo) {
  New-Item -ItemType Directory -Force $dirRespaldos | Out-Null
  $archivo = Join-Path $dirRespaldos ("{0}_{1}_{2}.dump" -f $Base, (Get-Date -Format 'yyyyMMdd_HHmmss'), $motivo)
  if ($conexion) {
    $r = Nativo { & $pgDump $conexion -w --format=custom --file $archivo }
  } else {
    $r = Nativo { & $pgDump -h $PgHost -p $PgPuerto -U $PgSuperusuario -w --format=custom --file $archivo $Base }
  }
  if ($LASTEXITCODE -ne 0) { Fallo "pg_dump fallo, no se toca la base: $($r -join ' ')" }
  Ok "Respaldo: $archivo"
}

# Una base creada antes con otro usuario (p. ej. "npm run bd:crear" como
# postgres) deja esquemas, tablas, funciones y tipos con ese dueño, y el rol
# de la aplicación no los puede leer. Se traspasa todo al rol sin tocar los
# datos. Las secuencias de columnas serial/identity y los índices siguen a su
# tabla; los objetos de las extensiones (unaccent, pg_trgm) se dejan como están.
$sqlTraspaso = @"
DO `$`$
DECLARE
  r record;
  rol regrole := '$RolBase'::regrole;
BEGIN
  FOR r IN SELECT nspname FROM pg_namespace
            WHERE nspname IN ('cat', 'aps', 'aud') AND nspowner <> rol LOOP
    EXECUTE format('ALTER SCHEMA %I OWNER TO %s', r.nspname, rol);
  END LOOP;

  FOR r IN SELECT c.oid::regclass AS obj, c.relkind
             FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname IN ('cat', 'aps', 'aud', 'public')
              AND c.relkind IN ('r', 'p', 'v', 'm', 'f', 'S')
              AND c.relowner <> rol
              AND NOT EXISTS (SELECT 1 FROM pg_depend d
                               WHERE d.classid = 'pg_class'::regclass AND d.objid = c.oid
                                 AND (d.deptype = 'e' OR (c.relkind = 'S' AND d.deptype IN ('a', 'i'))))
  LOOP
    EXECUTE format(CASE r.relkind
                     WHEN 'v' THEN 'ALTER VIEW %s OWNER TO %s'
                     WHEN 'm' THEN 'ALTER MATERIALIZED VIEW %s OWNER TO %s'
                     WHEN 'f' THEN 'ALTER FOREIGN TABLE %s OWNER TO %s'
                     WHEN 'S' THEN 'ALTER SEQUENCE %s OWNER TO %s'
                     ELSE 'ALTER TABLE %s OWNER TO %s' END, r.obj, rol);
  END LOOP;

  FOR r IN SELECT p.oid::regprocedure AS obj, p.prokind
             FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname IN ('cat', 'aps', 'aud', 'public')
              AND p.proowner <> rol
              AND NOT EXISTS (SELECT 1 FROM pg_depend d
                               WHERE d.classid = 'pg_proc'::regclass AND d.objid = p.oid AND d.deptype = 'e')
  LOOP
    EXECUTE format(CASE r.prokind WHEN 'a' THEN 'ALTER AGGREGATE %s OWNER TO %s'
                                  ELSE 'ALTER ROUTINE %s OWNER TO %s' END, r.obj, rol);
  END LOOP;

  -- Tipos propios: enum, dominio, compuesto suelto. Se excluyen las filas de
  -- tabla (siguen a la tabla) y los arreglos (siguen a su tipo base).
  FOR r IN SELECT t.oid::regtype AS obj, t.typtype
             FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
            WHERE n.nspname IN ('cat', 'aps', 'aud', 'public')
              AND t.typowner <> rol
              AND t.typcategory <> 'A'
              AND (t.typrelid = 0 OR (SELECT c.relkind FROM pg_class c WHERE c.oid = t.typrelid) = 'c')
              AND NOT EXISTS (SELECT 1 FROM pg_depend d
                               WHERE d.classid = 'pg_type'::regclass AND d.objid = t.oid AND d.deptype = 'e')
  LOOP
    EXECUTE format(CASE r.typtype WHEN 'd' THEN 'ALTER DOMAIN %s OWNER TO %s'
                                  ELSE 'ALTER TYPE %s OWNER TO %s' END, r.obj, rol);
  END LOOP;

  FOR r IN SELECT c.oid::regconfig AS obj
             FROM pg_ts_config c JOIN pg_namespace n ON n.oid = c.cfgnamespace
            WHERE n.nspname IN ('cat', 'aps', 'aud', 'public') AND c.cfgowner <> rol LOOP
    EXECUTE format('ALTER TEXT SEARCH CONFIGURATION %s OWNER TO %s', r.obj, rol);
  END LOOP;
END
`$`$;
"@

if (-not (Test-Path $envLocal)) {
  Pedir-ClaveSuper

  try {
    # Clave del rol de la aplicación: alfanumérica para que no haya que
    # escaparla ni en SQL ni en la URL de conexión.
    $alfabeto = [char[]]'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
    $bytes = New-Object byte[] 32
    [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    $claveApp = -join ($bytes | ForEach-Object { $alfabeto[$_ % $alfabeto.Length] })

    Psql-Super 'postgres' @"
DO `$`$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '$RolBase') THEN
    ALTER ROLE "$RolBase" LOGIN PASSWORD '$claveApp';
  ELSE
    CREATE ROLE "$RolBase" LOGIN PASSWORD '$claveApp';
  END IF;
END
`$`$;
"@ | Out-Null
    Ok "Rol $RolBase listo"

    $existe = Psql-Super 'postgres' "SELECT 1 FROM pg_database WHERE datname = '$Base';"
    if ($existe -eq '1') {
      Aviso "La base $Base ya existia: se conservan sus datos y pasa a ser del rol $RolBase."
      Psql-Super 'postgres' "ALTER DATABASE `"$Base`" OWNER TO `"$RolBase`";" | Out-Null
    } else {
      Psql-Super 'postgres' "CREATE DATABASE `"$Base`" OWNER `"$RolBase`" ENCODING 'UTF8' TEMPLATE template0;" | Out-Null
      Ok "Base $Base creada"
    }

    # Las extensiones se crean como superusuario; el resto de los scripts
    # corre con el rol de la aplicación, que es dueño de la base.
    Psql-Super $Base 'CREATE EXTENSION IF NOT EXISTS unaccent; CREATE EXTENSION IF NOT EXISTS pg_trgm;' | Out-Null
    Ok 'Extensiones unaccent y pg_trgm'
  } finally {
    # La clave se conserva en la sesión por si hace falta el traspaso de
    # abajo; se borra al terminar esa sección.
  }

  Sin-Bom $envLocal @"
# Generado por xampp/instalar.ps1. Contiene la clave de la base: no lo copie
# a otro equipo ni lo suba al repositorio.
DATABASE_URL=postgresql://$RolBase`:$claveApp@$PgHost`:$PgPuerto/$Base
PUERTO=$PuertoApi
HOST=127.0.0.1
"@
  Ok '.env.local creado'
} else {
  Ok '.env.local ya existe: se conserva la conexion configurada'
  # Puerto y host de la API deben coincidir con el proxy de Apache.
  $lineas = @(Get-Content $envLocal | Where-Object { $_ -notmatch '^\s*(PUERTO|HOST)\s*=' })
  $lineas += "PUERTO=$PuertoApi"
  $lineas += 'HOST=127.0.0.1'
  Sin-Bom $envLocal (($lineas -join "`r`n") + "`r`n")
}

$cadena = ((Get-Content $envLocal | Where-Object { $_ -match '^\s*DATABASE_URL\s*=' } | Select-Object -First 1) -replace '^\s*DATABASE_URL\s*=\s*', '').Trim()
if (-not $cadena) { Fallo "No hay DATABASE_URL en $envLocal" }

function Psql-App([string]$sql) {
  $r = Nativo { & $psql $cadena -w -X -q -t -A -c $sql }
  if ($LASTEXITCODE -ne 0) { Fallo "psql: $($r -join ' ')" }
  return (($r | Where-Object { $_ -notmatch '^(NOTICE|AVISO):' }) -join "`n").Trim()
}

# Se mira el catálogo y no las tablas: el catálogo se lee sin permisos sobre
# los esquemas, que es justo lo que puede faltar.
$ajenos = Psql-App @"
SELECT (SELECT count(*) FROM pg_namespace WHERE nspname IN ('cat','aps','aud') AND nspowner <> current_user::regrole)
     + (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname IN ('cat','aps','aud') AND c.relkind IN ('r','p','v','m') AND c.relowner <> current_user::regrole);
"@
try {
  if ($ajenos -ne '0') {
    Aviso "La base tiene $ajenos objetos de otro usuario (se creo antes con '$PgSuperusuario')."
    Aviso 'Se respaldan y se traspasan al rol de la aplicacion; los datos no cambian.'
    Pedir-ClaveSuper
    Respaldar '' 'antes-de-traspaso'
    Psql-Super $Base $sqlTraspaso | Out-Null
    Ok "Objetos traspasados al rol $RolBase"
  }
} finally {
  Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
}

# aps.ficha y no aps.usuario: las bases de versiones anteriores tienen fichas
# pero no usuarios (los crea 06_migraciones.sql), y correr 01_esquema.sql
# sobre ellas falla en el primer CREATE.
$conEsquema = Psql-App "SELECT to_regclass('aps.ficha') IS NOT NULL;"
if ($conEsquema -eq 't') { Respaldar $cadena 'antes-de-migrar' }
Push-Location $Destino
try {
  if ($conEsquema -eq 't') {
    Ok 'La base ya tiene el esquema: se aplican solo las migraciones'
    & $node bd\crear_bd.js --migrar
  } else {
    & $node bd\crear_bd.js
  }
  if ($LASTEXITCODE -ne 0) { Fallo 'La creacion de la base fallo (ver arriba).' }
} finally { Pop-Location }

$usuarios = Psql-App 'SELECT count(*) FROM aps.usuario;'
if ($usuarios -eq '0') {
  Paso 'Primer usuario (administrador)'
  Write-Host '   Con este usuario se crean los demas desde la aplicacion (menu del usuario).'
  do { $documento = (Read-Host '   Documento (5 a 16 letras o numeros)').Trim() } until ($documento -match '^[A-Za-z0-9]{5,16}$')
  do { $nombre = (Read-Host '   Nombre completo').Trim() } until ($nombre.Length -ge 3)
  Push-Location $Destino
  try {
    & $node bd\crear_usuario.js --documento $documento --nombre $nombre --rol administrador
    if ($LASTEXITCODE -ne 0) { Fallo 'No se pudo crear el usuario.' }
  } finally { Pop-Location }
  Aviso 'Anote la clave temporal de arriba: no se vuelve a mostrar.'
} else {
  Ok "La base ya tiene $usuarios usuario(s); no se crea ninguno."
  Write-Host '   Si no conoce la clave de alguno, restablezcala con:'
  Write-Host "     cd $Destino; node bd\crear_usuario.js --documento DOCUMENTO --restablecer"
  Psql-App "SELECT '     ' || rpad(u.documento, 16) || rpad(u.rol, 22) || f.nombre_completo FROM aps.usuario u JOIN aps.funcionario f ON f.id = u.funcionario_id ORDER BY u.rol, u.documento;" |
    ForEach-Object { Write-Host $_ }
}

# -------------------------------------------------------------------------
#  3. Apache
# -------------------------------------------------------------------------
Paso 'Configurando Apache'

$confDestino = Join-Path $Xampp 'apache\conf\extra\httpd-aps-encuesta.conf'
$plantilla = Get-Content (Join-Path $Origen 'xampp\httpd-aps-encuesta.conf') -Raw -Encoding UTF8
$conf = $plantilla.Replace('__APS_DIR__', ($Destino -replace '\\', '/')).
  Replace('__APS_PUERTO__', [string]$Puerto).
  Replace('__APS_API__', [string]$PuertoApi)
Sin-Bom $confDestino $conf

$ansi = [Text.Encoding]::Default
$original = [IO.File]::ReadAllText($httpdConf, $ansi)
$respaldo = "$httpdConf.antes-aps-encuesta"
if (-not (Test-Path $respaldo)) {
  [IO.File]::WriteAllText($respaldo, $original, $ansi)
  Ok "Respaldo de httpd.conf en $respaldo"
}

$nuevo = $original
foreach ($modulo in 'proxy_module', 'proxy_http_module', 'headers_module', 'rewrite_module', 'filter_module', 'deflate_module') {
  $nuevo = [regex]::Replace($nuevo, "(?m)^\s*#\s*(LoadModule\s+$modulo\s)", '$1')
}
$include = 'Include conf/extra/httpd-aps-encuesta.conf'
if ($nuevo -notmatch [regex]::Escape($include)) {
  $nuevo = $nuevo.TrimEnd() + "`r`n`r`n# Encuesta_APS (xampp/instalar.ps1)`r`n$include`r`n"
}
if ($nuevo -ne $original) { [IO.File]::WriteAllText($httpdConf, $nuevo, $ansi) }

$prueba = Nativo { & $httpd -t }
if ($LASTEXITCODE -ne 0) {
  [IO.File]::WriteAllText($httpdConf, $original, $ansi)
  Fallo "La configuracion de Apache no es valida (se restauro httpd.conf): $($prueba -join ' ')"
}
Ok 'Configuracion valida (httpd -t)'

# Apache queda como servicio de Windows "Apache2.4", el nombre que reconoce el
# Panel de control de XAMPP (casilla "Service"). Así arranca con el equipo,
# igual que la API; arrancado desde el panel, tras un reinicio la aplicación
# quedaba sin Apache hasta que alguien lo abriera. Además el panel ve y
# controla el servicio, mientras que un httpd lanzado como administrador fuera
# del panel le aparece apagado y con los puertos "ocupados".
$NombreServicio = 'Apache2.4'
if (-not $SinReiniciarApache) {
  $servicio = Get-Service -Name $NombreServicio -ErrorAction SilentlyContinue
  if (-not $servicio) {
    # Cualquier httpd suelto (del panel o de una instalación anterior) tiene
    # tomados los puertos y el servicio no podría arrancar.
    if (Get-Process httpd -ErrorAction SilentlyContinue) {
      Get-Process httpd | Stop-Process -Force
      Start-Sleep -Seconds 2
    }
    Remove-Item (Join-Path $Xampp 'apache\logs\httpd.pid') -ErrorAction SilentlyContinue
    $r = Nativo { & $httpd -k install -n $NombreServicio }
    if ($LASTEXITCODE -ne 0) { Fallo "No se pudo registrar Apache como servicio: $($r -join ' ')" }
    Set-Service -Name $NombreServicio -StartupType Automatic
    Start-Service -Name $NombreServicio
    Ok "Apache registrado como servicio '$NombreServicio' (arranca con el equipo)"
  } else {
    Set-Service -Name $NombreServicio -StartupType Automatic
    Restart-Service -Name $NombreServicio
    Ok "Servicio '$NombreServicio' reiniciado"
  }
  Start-Sleep -Seconds 2
  if ((Get-Service -Name $NombreServicio).Status -ne 'Running') {
    Fallo "Apache no arranco. Revise $Xampp\apache\logs\error.log"
  }
} else {
  Aviso "Reinicie el servicio '$NombreServicio' (o Apache en el Panel de XAMPP) para aplicar los cambios."
}

# -------------------------------------------------------------------------
#  4. API (Node) como tarea programada
# -------------------------------------------------------------------------
Paso "Registrando la API como tarea programada '$NombreTarea'"

if (Get-ScheduledTask -TaskName $NombreTarea -ErrorAction SilentlyContinue) {
  Stop-ScheduledTask -TaskName $NombreTarea -ErrorAction SilentlyContinue
  Unregister-ScheduledTask -TaskName $NombreTarea -Confirm:$false
}
# Un Node que haya quedado vivo en el puerto impediría el arranque.
Get-NetTCPConnection -LocalPort $PuertoApi -State Listen -ErrorAction SilentlyContinue | ForEach-Object {
  $p = Get-Process -Id $_.OwningProcess -ErrorAction SilentlyContinue
  if ($p -and $p.ProcessName -eq 'node') { Stop-Process -Id $p.Id -Force }
}

$accion = New-ScheduledTaskAction -Execute $node -Argument 'xampp\servicio_api.js' -WorkingDirectory $Destino
$disparador = New-ScheduledTaskTrigger -AtStartup
$principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
$ajustes = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable `
  -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -MultipleInstances IgnoreNew
Register-ScheduledTask -TaskName $NombreTarea -Action $accion -Trigger $disparador -Principal $principal -Settings $ajustes `
  -Description 'Encuesta_APS: API Node detras de Apache (XAMPP). Ver xampp/LEEME.md' | Out-Null
Start-ScheduledTask -TaskName $NombreTarea
Ok 'Tarea registrada e iniciada (arranca sola al encender el equipo)'

# -------------------------------------------------------------------------
#  5. Comprobación
# -------------------------------------------------------------------------
Paso 'Comprobando'

# HttpWebRequest y no Invoke-WebRequest: en 5.1 éste no deja leer un 302
# sin seguirlo, y la redirección del puerto 80 es justo lo que se prueba.
function Estado([string]$url) {
  try {
    $peticion = [Net.HttpWebRequest]::Create($url)
    $peticion.AllowAutoRedirect = $false
    $peticion.Timeout = 10000
    $respuesta = $peticion.GetResponse()
    $codigo = [int]$respuesta.StatusCode
    $respuesta.Close()
    return $codigo
  } catch {
    $e = $_.Exception
    while ($e -and -not ($e -is [Net.WebException])) { $e = $e.InnerException }
    if ($e -and $e.Response) {
      $codigo = [int]$e.Response.StatusCode
      $e.Response.Close()
      return $codigo
    }
    return 0
  }
}

$listo = $false
for ($i = 0; $i -lt 30 -and -not $listo; $i++) {
  Start-Sleep -Seconds 1
  $listo = (Estado "http://127.0.0.1:$PuertoApi/api/sesion") -ne 0
}
if (-not $listo) { Fallo "La API no respondio en el puerto $PuertoApi. Revise $Destino\logs\api.log" }

$pruebas = @(
  @{ Url = "http://localhost:$Puerto/";            Espera = @(200);      Que = 'Pagina principal' },
  @{ Url = "http://localhost:$Puerto/login";       Espera = @(200);      Que = 'Pantalla de ingreso' },
  @{ Url = "http://localhost:$Puerto/api/sesion";  Espera = @(200, 401); Que = 'API a traves de Apache' },
  @{ Url = "http://localhost:$Puerto/.env.local";  Espera = @(403, 404); Que = '.env.local protegido' },
  @{ Url = "http://localhost:$Puerto/bd/01_esquema.sql"; Espera = @(403, 404); Que = 'bd/ protegido' },
  @{ Url = "http://localhost/aps_encuesta/.env.local"; Espera = @(302); Que = 'Puerto 80 redirige al sitio' }
)
$fallas = 0
foreach ($p in $pruebas) {
  $codigo = Estado $p.Url
  if ($p.Espera -contains $codigo) { Ok ("{0,-28} {1}  ({2})" -f $p.Que, $codigo, $p.Url) }
  else { Aviso ("{0,-28} {1}  ({2}) esperado {3}" -f $p.Que, $codigo, $p.Url, ($p.Espera -join '/')); $fallas++ }
}

Write-Host ''
if ($fallas -eq 0) {
  Write-Host "Listo. Abra http://localhost:$Puerto" -ForegroundColor Green
} else {
  Write-Host "Instalado con $fallas comprobacion(es) fallida(s). Revise xampp/LEEME.md." -ForegroundColor Yellow
}
