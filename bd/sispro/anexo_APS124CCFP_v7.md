# GUÍA TÉCNICA Y DICCIONARIO DE DATOS PARA REPORTE DE INFORMACIÓN SI-APS
## Componente Poblacional – Fuente APS124CCFP (PISIS / SISPRO)

---

### METADATOS OFICIALES DEL DOCUMENTO
- **Entidad Responsable:** Ministerio de Salud y Protección Social de Colombia
- **Sistema Misional:** Sistema Integrado de Información de la Atención Primaria de Salud (SI-APS)
- **Plataforma de Recepción:** Plataforma de Intercambio de Información (PISIS) / Sistema Integral de Información de la Protección Social (SISPRO)
- **Proceso:** Ciclo de Vida y Reingeniería de Sistemas de Información
- **Código del Formato:** CVSF05
- **Versión del Formato:** 02
- **Versión del Anexo Técnico:** Versión 7. Junio 2026
- **Tema de Información:** Caracterización de Necesidades en Salud de la Población (Comunidad, Familia y Persona)

---

## GUÍA DE COMPRENSIÓN Y ARQUITECTURA PARA MODELOS DE IA

Esta sección está diseñada como una especificación técnica formal para que un sistema o agente de Inteligencia Artificial (IA) interprete, valide, transforme o genere archivos planos conformes con el estándar SI-APS del Ministerio de Salud de Colombia.

### 1. Modelo Relacional y Jerarquía de Datos
El archivo plano modela una estructura jerárquica de 3 niveles vinculada de forma relacional:

```
[ Registro Tipo 1: Control ] (1 único registro por archivo)
      │
      ├──> [ Registro Tipo 2: Hogar / Entorno / EBS / Vivienda / Familia ] (1..N registros)
      │         PK: Variable 124 (Número de Identificación de la Familia)
      │
      └───> [ Registro Tipo 3: Integrantes de la Familia y Estado de Salud ] (1..M registros)
                FK: Variable 117 (Número de Identificación de la Familia -> Relaciona con Tipo 2 Var 124)
                PK: Variable 118 (Identificador Único del Integrante = Var 117 + Var 6 TipoDoc + Var 7 NumDoc)
```

1. **Registro Tipo 1 (Control):** Metadatos del envío (entidad reportadora, período de corte y conteo total de registros de detalle).
2. **Registro Tipo 2 (Detalle del Entorno, EBS, Vivienda y Familia):** Registra las condiciones territoriales, datos del Equipo Básico de Salud (EBS), características físicas de la vivienda, servicios públicos, saneamiento ambiental, convivencia con animales y dinámica familiar.
   - **Clave Primaria:** Campo 124 (`ID_FAMILIA`), resultante de la concatenación de la Variable 123 + letra 'F' + consecutivo de 4 dígitos (ejemplo: `...F0001`).
3. **Registro Tipo 3 (Detalle de Integrantes y Condiciones de Salud):** Registra cada persona miembro de las familias del Tipo 2, sus datos sociodemográficos, aseguramiento, ciclo de vida, condiciones de vulnerabilidad, prácticas, hábitos, morbilidad, tamizajes y exposición a riesgos ocupacionales/ambientales (como asbesto).
   - **Clave Foránea:** Campo 117 (`ID_FAMILIA`), que enlaza exactamente con el Campo 124 del Registro Tipo 2.
   - **Clave Única:** Campo 118 (`ID_INTEGRANTE`), concatenación de Campo 117 + Campo 6 (Tipo Doc) + Campo 7 (Número Doc).

### 2. Reglas Técnicas Críticas para Generación de Archivos Planos
1. **Delimitador de Campos:** Carácter pipe (`|`). Ningún campo de texto puede incluir pipes.
2. **Fin de Registro:** Salto de línea estándar `ENTER` (`\r\n` o `\n`). No lleva delimitador especial al final ni pipe final antes del salto.
3. **Campos Vacíos / Nulos:** Si un campo opcional no aplica o no se reporta, se deja totalmente vacío entre dos pipes consecutivos (`||`). **NO** rellenar con ceros ni espacios.
4. **Codificación y Formato de Texto:** ANSI (texto plano con extensión `.txt`). Todo el contenido alfanumérico y los nombres deben grabarse en letras **MAYÚSCULAS**, sin tildes, sin caracteres especiales y **SIN comillas** (`""`).
5. **Formato de Fechas:** `AAAA-MM-DD` (ejemplo: `2026-06-30`). Excepto en el nombre del archivo donde es `AAAAMMDD` (sin guiones).
6. **Formato de Números:** Sin separadores de miles ni símbolos de moneda. Si admite decimales, el separador es el punto (`.`) (ejemplo: `-74.08175`).
7. **Cero vs Letra O:** Los códigos con ceros deben conservar estrictamente el número `0` y nunca sustituirse por la vocal `O`.
8. **Valores Multivalor (Múltiples Opciones):** Para campos de respuesta múltiple, las opciones seleccionadas se reportan como números separados por comas sin espacios (ejemplo: `1,3,6`).
9. **Firma Digital:** El archivo `.txt` debe ser firmado digitalmente mediante certificado digital emitido por una entidad de certificación abierta antes de ser subido a la plataforma PISIS.

---

## 1. ESTRUCTURA Y ESPECIFICACIÓN DEL ARCHIVO PLANO

### 1.1. Estándar del Nombre del Archivo
Las Instituciones Prestadoras de Servicios de Salud (IPS) y entidades territoriales deben nombrar el archivo cumpliendo la longitud fija estricta de **36 caracteres**:

**Sintaxis:**
`APS124CCFPAAAAMMDDZZ999999999999.TXT`

| Posición | Componente | Valores Permitidos | Descripción | Longitud Fija | Requerido |
| :---: | :--- | :--- | :--- | :---: | :---: |
| 1 - 3 | **Módulo de información** | `APS` | Atención Primaria en Salud. | 3 | SI |
| 4 - 6 | **Tipo de Fuente** | `124` | DTS Municipios, Departamentos, Distritos y E.S.E. Beneficiarias de Recursos. | 3 | SI |
| 7 - 10 | **Tema de información** | `CCFP` | Información de identificación de necesidades de la comunidad, familia, persona. | 4 | SI |
| 11 - 18 | **Fecha de Corte** | `AAAAMMDD` | Último día calendario del período reportado (sin separadores). Ejemplo: `20260731`. | 8 | SI |
| 19 - 20 | **Tipo de Identificación Entidad** | `ZZ` | Tipo de entidad reportadora:<br>• `NI`: Prestador de servicios de salud (IPS / ESE)<br>• `MU`: Municipio<br>• `DE`: Departamento<br>• `DI`: Distrito | 2 | SI |
| 21 - 32 | **Número Identificación Entidad** | `999999999999` | 12 dígitos completados con ceros a la izquierda si aplica:<br>• Si es `NI`: NIT sin dígito de verificación (ej: `000900123456`)<br>• Si es `MU`: Código DANE del municipio (ej: `000000025001`)<br>• Si es `DE`: Código DANE del departamento (ej: `000000000025`)<br>• Si es `DI`: Código DANE del distrito (ej: `000000011001`) | 12 | SI |
| 33 - 36 | **Extensión del archivo** | `.txt` / `.TXT` | Extensión del archivo plano. | 4 | SI |

**Ejemplo de Nombre Válido:**
`APS124CCFP20260630NI000900123456.TXT`

---

### 1.2. Tipos de Datos del Estándar

| Tipo | Sigla | Descripción y Reglas de Formato |
| :---: | :---: | :--- |
| **Alfanumérico** | `A` | Texto en letras mayúsculas y números. Sin caracteres especiales ni tildes. |
| **Numérico** | `N` | Enteros sin formato de miles ni decimales. |
| **Decimal** | `D` | Números con parte fraccionaria. Separador de decimales: punto (`.`). Admite signo negativo para coordenadas. |
| **Fecha** | `F` | Formato estándar `AAAA-MM-DD` (año 4 dígitos, mes 2 dígitos, día 2 dígitos, separados por guion). |
| **Texto Especial** | `T` | Cadenas de caracteres descriptivos. No debe contener comillas ni el carácter pipe (`\|`). |

---

### 1.3. Contenido General y Tipos de Registros

| Tipo de Registro | Denominación Oficial | Propósito Funcional | Obligatoriedad |
| :---: | :--- | :--- | :---: |
| **Tipo 1** | **Registro de Control** | Identificación de la entidad reportadora, período y total de registros de detalle contenidos. | Obligatorio |
| **Tipo 2** | **Registro de Detalle de Caracterización de Entorno, EBS, Vivienda y Familia** | Caracterización del entorno comunitario, datos de los Equipos Básicos de Salud (EBS), vivienda, saneamiento básico, riesgos ambientales, animales y estructura familiar. | Obligatorio |
| **Tipo 3** | **Registro de Detalle de Caracterización de Integrantes y Salud** | Identificación sociodemográfica de cada integrante, pertenencia étnica, nivel educativo, afiliación al SGSSS, condiciones de salud, tamizajes, salud mental y exposición a riesgos ocupacionales/asbesto. | Obligatorio |

---

## 2. DICCIONARIO DETALLADO: REGISTRO TIPO 1 – REGISTRO DE CONTROL

Es obligatorio y corresponde al primer registro (línea 1) del archivo plano.

### 2.1. Tabla Resumen de Campos – Tipo 1

| No. | Nombre del Campo | Longitud Máxima | Tipo | Requerido | Resumen de Valores / Formato |
| :---: | :--- | :---: | :---: | :---: | :--- |
| 0 | Tipo de registro | 1 | N | SI | 1: valor que significa que el registro es de control... |
| 1 | Tipo de Identificación de la entidad que reporta | 2 | A | SI | ZZ Si es una Entidad diferente a entidad territorial: se deb... |
| 2 | Número de identificación de la entidad que reporta | 12 | N | SI | Número de identificación de la entidad que envía los archivo... |
| 3 | Fecha inicial del período de la información reportada | 10 | F | SI | En formato AAAA-MM-DD. Debe corresponder a la fecha de inici... |
| 4 | Fecha final del período de la información reportada | 10 | F | SI | En formato AAAA-MM-DD. Debe corresponder a la fecha final de... |
| 5 | Número total de registros de detalle contenidos en el archivo | 10 | N | SI | Debe corresponder a la cantidad de registros tipo 2 y tipo 3... |

### 2.2. Especificaciones Campo por Campo – Tipo 1

#### Campo 0: Tipo de registro
- **Longitud Máxima:** `1`
- **Tipo de Dato:** `N`
- **Requerido:** `SI`
- **Descripción y Reglas de Validación:**
1: valor que significa que el registro es de control

#### Campo 1: Tipo de Identificación de la entidad que reporta
- **Longitud Máxima:** `2`
- **Tipo de Dato:** `A`
- **Requerido:** `SI`
- **Descripción y Reglas de Validación:**
ZZ
Si es una Entidad diferente a entidad territorial: se debe especificar
NI correspondiente al tipo de identificación NIT
En el caso de que las entidades territoriales reporten, se especifica
de la siguiente manera:
MU: Municipio
DE: Departamento
DI: Distrito

#### Campo 2: Número de identificación de la entidad que reporta
- **Longitud Máxima:** `12`
- **Tipo de Dato:** `N`
- **Requerido:** `SI`
- **Descripción y Reglas de Validación:**
Número de identificación de la entidad que envía los archivos, de
acuerdo con el tipo de identificación del campo anterior.
- Si es NI, ingresar número de NIT sin incluir el digito de
verificación para tipo de Identificación NI.
NOTA: En caso de que las entidades territoriales reporten, en este
campo va el código DANE.
- Si es DE en este campo va el código DANE del departamento.
Ejemplo: 25
- Si es DI en este campo va el código DANE del Distrito.
Ejemplo: 11001
- Si es MU en este campo va el código DANE del municipio.
Ejemplo: 25001

#### Campo 3: Fecha inicial del período de la información reportada
- **Longitud Máxima:** `10`
- **Tipo de Dato:** `F`
- **Requerido:** `SI`
- **Descripción y Reglas de Validación:**
En formato AAAA-MM-DD. Debe corresponder a la fecha de inicio
del período de información reportada.
Ejemplo Fecha Valida: 2016-02-01

#### Campo 4: Fecha final del período de la información reportada
- **Longitud Máxima:** `10`
- **Tipo de Dato:** `F`
- **Requerido:** `SI`
- **Descripción y Reglas de Validación:**
En formato AAAA-MM-DD. Debe corresponder a la fecha final del
periodo de información reportada y debe concordar con la fecha de
corte del nombre del archivo. Último día calendario del mes o
periodo que se está reportando.
Ejemplo Fecha Válida: 2026-12-31

#### Campo 5: Número total de registros de detalle contenidos en el archivo
- **Longitud Máxima:** `10`
- **Tipo de Dato:** `N`
- **Requerido:** `SI`
- **Descripción y Reglas de Validación:**
Debe corresponder a la cantidad de registros tipo 2 y tipo 3
contenidos en el archivo. Si existen más registros será la suma de
todos los registros.

---

## 3. DICCIONARIO DETALLADO: REGISTRO TIPO 2 – DETALLE DE IDENTIFICACIÓN DE NECESIDADES DEL ENTORNO, EBS, VIVIENDA Y FAMILIA

Mediante el Registro Tipo 2, las entidades reportan el detalle de la información general, identificación de las necesidades del entorno, detalle del personal de los Equipos Básicos de Salud (EBS), caracterización física de la vivienda, saneamiento, agua, residuos, zoonosis y estructura de la familia.

### 3.1. Tabla Resumen de Campos – Tipo 2 (125 Variables: 0 a 124)

| No. | Nombre del Campo | Long. Máx. | Tipo | Req. | Descripción / Valores Permitidos |
| :---: | :--- | :---: | :---: | :---: | :--- |
| 0 | Tipo de registro | 1 | N | SI | 2: valor que significa que el registro es de detalle de identific... |
| 1 | Consecutivo de registro | 10 | N | SI | Número consecutivo de registros de detalle dentro del archivo. In... |
| 2 | Consentimiento informado | 1 | N | SI | Corresponde al registro de autorización del consentimiento inform... |
| 3 | Departamento vivienda | 2 | A | SI | Es una variable de respuesta única. Corresponde al nombre del Dep... |
| 4 | Subregión vivienda | 3 | A | SI | De acuerdo con la distribución geográfica realizada por el depart... |
| 5 | Municipio vivienda | 5 | A | SI | Municipio: es la entidad territorial fundamental de la división p... |
| 6 | Territorio vivienda | 3 | A | SI | Corresponde al primer nivel de territorialización en que se subdi... |
| 7 | Microterritorio vivienda | 4 | A | SI | Corresponde al segundo nivel de territorialización en que se subd... |
| 8 | Tipo de ubicación vivienda | 1 | N | SI | Corresponde al tipo de ubicación. Es una variable de respuesta ún... |
| 9 | Nombre tipo de ubicación vivienda | 200 | T | SI | Corresponde al nombre del tipo de ubicación de la vivienda.... |
| 10 | Área de ubicación vivienda | 1 | N | SI | Corresponde al área de ubicación: Es una variable de respuesta ún... |
| 11 | Punto de referencia de la ubicación | 200 | T | SI | Descripción de la ubicación del hogar (cuando no se cuenta con no... |
| 12 | Geopunto longitud | 10 | D | SI | Coordenada de longitud en la ubicación geográfica. Ejemplo: 0.670... |
| 13 | Geopunto latitud | 10 | D | SI | Coordenada de latitud en la ubicación geográfica (se extrae de ca... |
| 14 | Dirección vivienda | 200 | T | SI | Texto con la dirección de la vivienda.... |
| 15 | Teléfono | 10 | N | NO | Número de teléfono de la vivienda... |
| 16 | Estrato socioeconómico vivienda | 1 | N | SI | Es una variable de respuesta única. Los valores permitidos se enc... |
| 17 | No. Familias vivienda | 2 | N | SI | Valor numérico. Corresponde al total de las familias en una vivie... |
| 18 | No. Personas vivienda | 3 | N | SI | Valor numérico. Corresponde al número de personas en la vivienda.... |
| 19 | No. Habitaciones vivienda | 2 | N | SI | Valor numérico. Corresponde al número de habitaciones en la vivie... |
| 20 | No. Personas por habitación | 3 | N | SI | Valor numérico. Corresponde al número de personas por habitación ... |
| 21 | Hacinamiento | 1 | N | SI | Es una variable de respuesta única. Los valores permitidos se enc... |
| 22 | Elementos para dormir en la vivienda | 2 | N | SI | Número de elementos como camas, colchones, colchonetas, hamacas, ... |
| 23 | Tipo de situación (situación que requiere atención inmediata y prioritaria). | 5 | A | SI | Corresponde al tipo de situación que encuentra el EBS en la vivie... |
| 24 | Observaciones situación | 200 | T | SI | Descripción de las observaciones de la situación atendida... |
| 25 | Número de identificación del Equipo Básico de Salud (EBS) | 10 | A | SI | El código del EBS debe corresponder con los códigos parametrizado... |
| 26 | NIT del prestador primario / Organismo de adscripción del EBS. | 9 | N | SI | Corresponde al Número del NIT, sin dígito de verificación, del pr... |
| 27 | Tipo de identificación del responsable de la visita | 2 | A | SI | Corresponde al listado desplegable de tipos de documento. Es una ... |
| 28 | Número de identificación del responsable de la visita | 20 | A | SI | Corresponde al número de identificación de la persona que diligen... |
| 29 | Perfil de quien realiza la visita | 200 | T | SI | Valor tipo texto. Corresponde al perfil académico de la persona q... |
| 30 | Fecha diligenciamiento de la ficha | 10 | F | SI | Fecha en formato AAAA-MM-DD Ejemplo fecha valida: 2026-12-11... |
| 31 | Tipo de vivienda | 2 | N | SI | Es una variable de respuesta única. Los valores permitidos se enc... |
| 32 | Escenarios de riesgo de accidente en la vivienda | 20 | A | SI | Permite reportar varias opciones de respuesta Los valores permiti... |
| 33 | Cerca de la vivienda hay | 56 | A | SI | Permite reportar varias opciones de respuesta. Identificación de ... |
| 34 | Ambientes de la vivienda con luz natural | 11 | N | SI | Variable numérica que de múltiple opción que indica los ambientes... |
| 35 | Ambientes de la vivienda con ventilación natural o artificial | 11 | N | SI | Variable numérica que de múltiple opción que indica los ambientes... |
| 36 | Elementos en la vivienda | 5 | N | SI | Variable de opción múltiple que indica que elementos hay en la vi... |
| 37 | Alumbrado predominante en la vivienda | 1 | N | SI | Variable de única opción que indica cual es tipo de alumbrado pre... |
| 38 | Acceso a la vivienda | 1 | N | SI | Variable de única opción. Los valores permitidos se encuentran en... |
| 39 | Otros accesos a la vivienda | 200 | T | NO | Definición de otros accesos que tiene la vivienda... |
| 40 | Material predominante techo | 2 | N | SI | Es una variable de única opción. Los valores permitidos se encuen... |
| 41 | Cocina separada de la vivienda | 1 | N | SI | Es una variable de respuesta única. Indica si la cocina se encuen... |
| 42 | Baño separado de la vivienda | 1 | N | SI | Es una variable de respuesta única. Indica si el baño se encuentr... |
| 43 | Dormitorios separados | 1 | N | SI | Es una variable de respuesta única. Indica si los dormitorios de ... |
| 44 | Medio de transporte habitual | 20 | N | SI | Variable de opción múltiple que indica los medios de transporte h... |
| 45 | Otros medios de transporte | 200 | T | NO | Otros medios de transporte de la familia, opción 10 de la variabl... |
| 46 | Seguridad en el desplazamiento | 13 | A | SI | Variable de opción múltiple que indica los elementos de seguridad... |
| 47 | Otros elementos de seguridad | 200 | T | NO | Otros elementos de seguridad durante el desplazamiento, habilitad... |
| 48 | Desplazamiento mayor a 30 minutos | 11 | N | SI | Variable de opción múltiple. Identificación de factores que gener... |
| 49 | Otros factores de tiempo de desplazamiento | 200 | T | NO | Otros factores que generan un desplazamiento mayor a 30 minutos, ... |
| 50 | ¿Se realiza actividad económica? | 1 | N | SI | Es una variable de respuesta única. Hace referencia a actividades... |
| 51 | ¿Área de trabajo independiente? | 1 | N | SI | Es una variable de respuesta única. Identifica si el área de trab... |
| 52 | ¿Familiar afectado por actividad económica? | 1 | N | SI | Es una variable de respuesta única. Identifica si uno de los miem... |
| 53 | Fuente principal de agua para consumo humano | 32 | A | SI | Permite reportar varias opciones de respuesta. Los valores permit... |
| 54 | Horas con suministro de agua | 1 | N | SI | Variable de única opción. Conocer cuantas horas al día se cuenta ... |
| 55 | Tanque de almacenamiento de agua | 1 | N | SI | Variable de única opción. Identificar si la vivienda cuenta con t... |
| 56 | Frecuencia de limpieza de tanque | 1 | N | SI | Variable de única opción. Identificación del tiempo de aseo del t... |
| 57 | Distancia entre tanque y el pozo o alcantarillado | 1 | N | SI | Variable de única opción. Identificación de la distancia entre el... |
| 58 | Sistema de disposición de excretas | 13 | A | SI | Permite reportar varias opciones de respuesta. Los valores permit... |
| 59 | Sistema de disposición de aguas residuales domésticas | 11 | A | SI | Permite reportar varias opciones de respuesta. Los valores permit... |
| 60 | Almacenamiento de residuos solidos | 9 | A | SI | Permite reportar varias opciones de respuesta. Identifica los alm... |
| 61 | Otros sistemas de almacenamiento de residuos solidos | 200 | T | NO | Otros sistemas de almacenamiento de residuos sólidos en la vivien... |
| 62 | Disposición final de los residuos sólidos ordinarios | 9 | A | SI | Permite reportar varias opciones de respuesta. Los valores permit... |
| 63 | ¿Conoce prácticas de reducción y separación de residuos? | 1 | N | SI | Es una variable de respuesta única. Hace referencia al conocimien... |
| 64 | ¿Realiza prácticas de reducción de residuos? | 1 | N | SI | Es una variable de respuesta única. Hace referencia a la práctica... |
| 65 | Como reduce la generación de residuos | 11 | A | SI | Variable de opción múltiple. Identificación de los métodos de red... |
| 66 | Otros prácticas de reducción de generación residuos | 200 | T | NO | Otras prácticas de reducción de generación residuos que se realiz... |
| 67 | ¿Realiza prácticas de aprovechamiento de residuos? | 1 | N | SI | Es una variable de respuesta única. Hace referencia a la validaci... |
| 68 | ¿Qué otras prácticas de aprovechamiento de residuos? | 200 | T | NO | Otras prácticas de aprovechamiento de residuos que se realizan de... |
| 69 | ¿Cómo realiza la disposición de residuos peligrosos? | 17 | A | SI | Variable de opción múltiple. Identificación métodos de disposició... |
| 70 | Otras prácticas de disposición de residuos peligrosos | 200 | T | NO | Otras prácticas de disposición de residuos peligrosos que se real... |
| 71 | ¿Realiza procesos de reducción y separación de residuos rurales? | 1 | N | SI | Es una variable de respuesta única. Hace referencia a la validaci... |
| 72 | ¿Qué prácticas de aprovechamiento de residuos rurales realiza? | 9 | N | SI | Variable de opción múltiple. Identificación de las prácticas de a... |
| 73 | Otras prácticas de aprovechamiento de residuos rurales | 200 | T | NO | Otras prácticas de aprovechamiento de residuos que se realizan de... |
| 74 | ¿Qué prácticas de separación de residuos rurales aplica? | 7 | A | SI | Variable de opción múltiple. Identificación de las prácticas de s... |
| 75 | Otras prácticas de aprovechamiento de residuos rurales | 200 | T | NO | Otras prácticas de aprovechamiento de residuos que se realizan de... |
| 76 | Limpieza de superficies | 1 | N | SI | Variable de única opción. Hace referencia a saber cómo se realiza... |
| 77 | Otras prácticas de Limpieza de superficies | 200 | T | NO | Otras prácticas de aprovechamiento de residuos que se realizan de... |
| 78 | Fuente de energía para cocinar | 15 | N | SI | Variable de única opción. Hace referencia a saber cómo se realiza... |
| 79 | Otras fuentes de energía para cocinar | 200 | T | NO | Otras prácticas de aprovechamiento de residuos que se realizan de... |
| 80 | Fuentes frecuentes de humo | 13 | N | SI | Variable de opción múltiple. Identificación de las fuentes frecue... |
| 81 | Otras fuentes frecuentes de humo | 200 | T | NO | Otras fuentes frecuentes de humo en el hogar, habilitado bajo la ... |
| 82 | Prácticas en la calidad del aire | 9 | N | SI | Variable de opción múltiple. Identificación de las fuentes frecue... |
| 83 | Tipo de estufa | 7 | N | SI | Variable de opción múltiple. Identificación de las fuentes frecue... |
| 84 | Criaderos que favorecen vectores de enfermedades | 1 | N | NO | Es una variable de respuesta única. Responde a la pregunta ¿Se ob... |
| 85 | Vectores transmisores de enfermedades | 23 | A | SI | Permite reportar varias opciones de respuesta. Los valores permit... |
| 86 | Otros vectores transmisores de enfermedades | 200 | T | NO | Otras prácticas de aprovechamiento de residuos que se realizan de... |
| 87 | Medidas para el control de vectores transmisores de enfermedades | 32 | A | SI | Permite reportar varias opciones de respuesta. Los valores permit... |
| 88 | Otras medidas para el control de vectores transmisores de enfermedades | 200 | T | NO | Otras prácticas de aprovechamiento de residuos que se realizan de... |
| 89 | Animales ponzoñosos en el hogar | 13 | A | SI | Permite reportar varias opciones de respuesta. Los valores permit... |
| 90 | Otros animales ponzoñosos en el hogar | 200 | T | NO | Otras prácticas de aprovechamiento de residuos que se realizan de... |
| 91 | Medidas para reducir riesgo de animales ponzoñosos en el hogar | 20 | A | SI | Permite reportar varias opciones de respuesta. Los valores permit... |
| 92 | Animales que conviven con la familia | 26 | A | SI | Permite reportar varias opciones de respuesta. Los valores permit... |
| 93 | Cantidad de perros en el hogar | 3 | N | SI | Cantidad de perros en la vivienda... |
| 94 | Cantidad de perros con vacuna antirrábica | 3 | N | SI | Cantidad de perros con vacuna antirrábica en la vivienda... |
| 95 | Cantidad de gatos en el hogar | 3 | N | SI | Cantidad de gatos en la vivienda... |
| 96 | Cantidad de gatos con vacuna antirrábica | 3 | N | SI | Cantidad de gatos con vacuna antirrábica en la vivienda... |
| 97 | Finalidad de tenencia de los animales en el hogar | 7 | A | SI | Permite reportar varias opciones de respuesta. Los valores permit... |
| 98 | Confinamiento de los animales | 5 | A | SI | Permite reportar varias opciones de respuesta. Los valores permit... |
| 99 | ¿Se desparasita a los animales domésticos? | 1 | N | SI | Es una variable de respuesta única.. Los valores permitidos se en... |
| 100 | Instalaciones seguras | 1 | N | SI | Es una variable de respuesta única. Identifica si las instalacion... |
| 101 | Excretas de los animales se recogen y disponen adecuadamente | 1 | N | SI | Es una variable de respuesta única. Valida si las excretas de los... |
| 102 | Vivienda con barreras para evitar contacto directo con los animales | 1 | N | SI | Es una variable de respuesta única. . Los valores permitidos se e... |
| 103 | Medidas para el control de vectores transmisoras de enfermedades | 1 | N | SI | Es una variable de respuesta única. Identifica las medidas para e... |
| 104 | Lugar donde adquiere productos químicos | 1 | N | SI | Es una variable de respuesta única. Identifica cual es el lugar d... |
| 105 | Disposición final de residuos químicos | 15 | A | SI | Permite reportar varias opciones de respuesta. Identifica cuales ... |
| 106 | Otras prácticas de disposición final de residuos químicos | 200 | T | NO | Otras prácticas de disposición final de residuos químicos que se ... |
| 107 | Seguimiento de instrucciones para manejo y almacenamiento de quimicos. | 1 | N | SI | Es una variable de respuesta única. Identifica si hay eguimiento ... |
| 108 | Productos en envase original y lugar asignado | 1 | N | SI | Es una variable de respuesta única. Identifica si los productos q... |
| 109 | Protección y ventilación al limpiar | 1 | N | SI | Es una variable de respuesta única. Identifica si se tiene ventil... |
| 110 | No. Personas | 2 | N | SI | Corresponde al número de personas que conforman la familia. Permi... |
| 111 | Alias Familia | 200 | T | SI | Corresponde al alias de la familia. Valor tipo texto.... |
| 112 | Tipo de familia | 1 | N | SI | Es una variable de respuesta única. Los valores permitidos se enc... |
| 113 | Apgar Familiar | 1 | N | SI | Corresponde al resultado obtenido luego de diligenciar el instrum... |
| 114 | ¿Cuidador principal? | 1 | N | SI | Es una variable de respuesta única y responde a la pregunta ¿En l... |
| 115 | Escala ZARIT | 3 | N | SI | Corresponde al resultado obtenido luego de diligenciar el instrum... |
| 116 | Familia con situaciones que generan riesgo para la salud física o mental | 50 | A | SI | Permite reportar varias opciones de respuesta. Los valores permit... |
| 117 | Prácticas que favorecen los vínculos familiares. | 11 | A | SI | Permite reportar varias opciones de respuesta. Los valores permit... |
| 118 | Redes de apoyo social | 1 | N | SI | Es una variable de respuesta única. Los valores permitidos se enc... |
| 119 | Prácticas para el cuidado de la salud y protección en el hogar. | 15 | A | SI | Permite reportar varias opciones de respuesta. Los valores permit... |
| 120 | Medidas ante enfermedades respiratorias | 1 | N | SI | Permite reportar varias opciones de respuesta. Identifica cuales ... |
| 121 | Otras medidas ante enfermedades respiratorias | 200 | T | NO | Variable tipo texto. Corresponde a la especificación de otras med... |
| 122 | Implementos de higiene personal compartidos | 1 | N | SI | Es una variable de respuesta única y responde a la pregunta. Vali... |
| 123 | Número de identificación de la vivienda | 26 | A | SI | Corresponde a la concatenación de las variables 3,4,5,6,7, seguid... |
| 124 | Número de identificación de la familia. | 31 | A | SI | Corresponde a la concatenación de las variables 123, seguido de l... |

### 3.2. Especificaciones Campo por Campo – Tipo 2

#### Campo 0: Tipo de registro
- **Longitud Máxima:** `1`
- **Tipo de Dato:** `N`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
2: valor que significa que el registro es de detalle de
identificación de las necesidades del entorno, el hogar y la
vivienda y personal de los EBS.

#### Campo 1: Consecutivo de registro
- **Longitud Máxima:** `10`
- **Tipo de Dato:** `N`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
Número consecutivo de registros de detalle dentro del
archivo. Inicia en 1 para el primer registro de detalle y va
incrementando de 1 en 1, hasta el final del archivo.

#### Campo 2: Consentimiento informado
- **Longitud Máxima:** `1`
- **Tipo de Dato:** `N`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
Corresponde al registro de autorización del consentimiento
informado. Es una variable de respuesta única. Los valores
permitidos se encuentran en la tabla de referencia LstSINO,
variable Extra I, disponible en: https://web.sispro.gov.co/.
_
Valores permitidos:
Código Descripción
1 SI
2 NO
Ejemplo: 1.
Nota: Si la respuesta es 1, se diligencian las variables de los
registros tipo 2, tipo 3 y tipo 4. Si la respuesta es 2 termina
el formulario.

#### Campo 3: Departamento vivienda
- **Longitud Máxima:** `2`
- **Tipo de Dato:** `A`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
Es una variable de respuesta única. Corresponde al nombre
del Departamento donde se aplica el instrumento de
identificación de necesidades con código DIVIPOLA del
DANE.
Los valores permitidos se encuentran en la tabla de
referencia Departamento, disponible en:
https://web.sispro.gov.co/.
Ejemplo: 54, 11, 05…

#### Campo 4: Subregión vivienda
- **Longitud Máxima:** `3`
- **Tipo de Dato:** `A`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
De acuerdo con la distribución geográfica realizada por el
departamento o distrito, digite el código de la Subregión (Regional
o Provincia, localidad) donde se encuentra. Tenga en cuenta que
la subregión corresponde a la unión de varios Municipios para el
caso del Departamento o de varios barrios para el caso de un
Distrito. No aplica para los Municipios.
El código de subregión debe corresponder con los códigos
parametrizados en el componente de gestión técnica de SI-APS
en https://web.sispro.gov.co/. Se toman los 3 primeros dígitos de
la adscripción territorial del campo subregión.
Ejemplo: 117 – SR00215- OCCIDENTE.
Se toma el numero 117 solamente

#### Campo 5: Municipio vivienda
- **Longitud Máxima:** `5`
- **Tipo de Dato:** `A`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
Municipio: es la entidad territorial fundamental de la división
político- administrativa del Estado, con autonomía política, fiscal y
administrativa dentro de los límites que le señalen la Constitución
y las leyes de la República
Área no municipalizada: corresponde a un centro poblado que,
junto a sus alrededores no pertenece a ninguno de los municipios
ya existentes.
Los valores permitidos se encuentran en la tabla de referencia
Municipio, disponible en https://web.sispro.gov.co/ .
Ejemplo: 54518, 11001, 05001…

#### Campo 6: Territorio vivienda
- **Longitud Máxima:** `3`
- **Tipo de Dato:** `A`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
Corresponde al primer nivel de territorialización en que se
subdivide un municipio o distrito, con base en la distribución
geográfica realizada. Estructurar un identificador de la siguiente
manera: TXX, donde XX corresponde a un consecutivo que inicia
en 01 y avanza en una unidad hasta cubrir la totalidad
Ejemplo: T01, T02, T03…
El valor T99 está reservado, en caso de que los territorios
superen el T98, se continuará con un consecutivo con la letra U,
así: U01, U02, U03… hasta tanto sea requerido; en el remoto
caso de que se supere el consecutivo con la letra U, se reiniciará
con la letra V.
El código de Territorio debe corresponder con los códigos
parametrizados en el componente de gestión técnica de SI-APS
en https://web.sispro.gov.co/. por parte de la Entidad Territorial.
En caso de que el municipio no tenga territorialización nivel 1
(subdivisiones) colocar valor: T99 que corresponde a “No Aplica”

#### Campo 7: Microterritorio vivienda
- **Longitud Máxima:** `4`
- **Tipo de Dato:** `A`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
Corresponde al segundo nivel de territorialización en que se
subdivide un municipio o distrito, con base en la distribución
geográfica realizada (subdivisión de la territorialización nivel 1-
territorio). Estructurar un identificador de la siguiente manera:
MTXX, donde XX corresponde a un consecutivo que inicia en 001
y avanza en una unidad hasta cubrir la totalidad.
Ejemplo: MT01, MT02, MT03…
El código de Microterritorio debe corresponder con los códigos
parametrizados en el componente de gestión técnica de SI-APS
en https://web.sispro.gov.co/.
En caso de que el municipio no tenga territorialización nivel 2
(subdivisiones del nivel 1) colocar valor: MT99 que corresponde a
“No aplica”

#### Campo 8: Tipo de ubicación vivienda
- **Longitud Máxima:** `1`
- **Tipo de Dato:** `N`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
Corresponde al tipo de ubicación. Es una variable de respuesta
única. Los valores permitidos son:
Valores permitidos:
Código Descripción
1 Corregimiento
2 Centro de poblado
3 Vereda
4 Localidad
5 Barrio
6 Resguardo indígena
Ejemplo: 3.

#### Campo 9: Nombre tipo de ubicación vivienda
- **Longitud Máxima:** `200`
- **Tipo de Dato:** `T`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
Corresponde al nombre del tipo de ubicación de la vivienda.

#### Campo 10: Área de ubicación vivienda
- **Longitud Máxima:** `1`
- **Tipo de Dato:** `N`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
Corresponde al área de ubicación:
Es una variable de respuesta única. Los valores permitidos son:
Valores permitidos:
Código Descripción
1 Urbana
2 Rural
Ejemplo: 2.

#### Campo 11: Punto de referencia de la ubicación
- **Longitud Máxima:** `200`
- **Tipo de Dato:** `T`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
Descripción de la ubicación del hogar (cuando no se cuenta con
nomenclatura, punto de referencia)

#### Campo 12: Geopunto longitud
- **Longitud Máxima:** `10`
- **Tipo de Dato:** `D`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
Coordenada de longitud en la ubicación geográfica.
Ejemplo: 0.670348
Valor numérico con decimales, separador punto. Acepta valores
negativos.

#### Campo 13: Geopunto latitud
- **Longitud Máxima:** `10`
- **Tipo de Dato:** `D`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
Coordenada de latitud en la ubicación geográfica (se extrae de
cartografía existente para el País WGS-84 en IGAC).
Ejemplo: -70.240149
Valor numérico con decimales, separador punto. Acepta valores
negativos.

#### Campo 14: Dirección vivienda
- **Longitud Máxima:** `200`
- **Tipo de Dato:** `T`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
Texto con la dirección de la vivienda.

#### Campo 15: Teléfono
- **Longitud Máxima:** `10`
- **Tipo de Dato:** `N`
- **Requerido:** `NO`
- **Descripción, Valores Permitidos y Reglas:**
Número de teléfono de la vivienda

#### Campo 16: Estrato socioeconómico vivienda
- **Longitud Máxima:** `1`
- **Tipo de Dato:** `N`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
Es una variable de respuesta única. Los valores permitidos se
encuentran en la tabla de referencia EstratoSocioeconomico,
disponible en: https://web.sispro.gov.co/
Valores permitidos:
Código Descripción
1 Bajo-bajo
2 Bajo
3 Medio-Bajo
4 Medio
5 Medio-Alto
6 Alto
Ejemplo: 1

#### Campo 17: No. Familias vivienda
- **Longitud Máxima:** `2`
- **Tipo de Dato:** `N`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
Valor numérico. Corresponde al total de las familias en una
vivienda.

#### Campo 18: No. Personas vivienda
- **Longitud Máxima:** `3`
- **Tipo de Dato:** `N`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
Valor numérico. Corresponde al número de personas en la
vivienda.

#### Campo 19: No. Habitaciones vivienda
- **Longitud Máxima:** `2`
- **Tipo de Dato:** `N`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
Valor numérico. Corresponde al número de habitaciones en la
vivienda.

#### Campo 20: No. Personas por habitación
- **Longitud Máxima:** `3`
- **Tipo de Dato:** `N`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
Valor numérico. Corresponde al número de personas por
habitación en la vivienda.

#### Campo 21: Hacinamiento
- **Longitud Máxima:** `1`
- **Tipo de Dato:** `N`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
Es una variable de respuesta única. Los valores permitidos se
encuentran en la tabla de referencia LstSINO, variable
Extra I, disponible en: https://web.sispro.gov.co
_
Valores permitidos:
Código Descripción
1 SI
2 NO
Ejemplo: 1.

#### Campo 22: Elementos para dormir en la vivienda
- **Longitud Máxima:** `2`
- **Tipo de Dato:** `N`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
Número de elementos como camas, colchones, colchonetas,
hamacas, camarotes o sofacamas que hay en la vivienda.

#### Campo 23: Tipo de situación (situación que requiere atención inmediata y prioritaria).
- **Longitud Máxima:** `5`
- **Tipo de Dato:** `A`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
Corresponde al tipo de situación que encuentra el EBS en la
vivienda. Permite reportar varias opciones de respuesta. Los
valores permitidos se encuentran en la tabla de referencia
APSTipoSituacion, disponible en: https://web.sispro.gov.co/
Valores permitidos:
Código Descripción
1 Física (urgencia vital)
2 Psicológica (urgencia vital en salud mental)
3 Situación de emergencia o desastre
4 No aplica.
Nota. Como es una respuesta de opción múltiple, se deberán
registrar los números correspondientes a las opciones
seleccionadas, separados por coma (,).
Ejemplo de respuesta válida: 1,2,3

#### Campo 24: Observaciones situación
- **Longitud Máxima:** `200`
- **Tipo de Dato:** `T`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
Descripción de las observaciones de la situación atendida

#### Campo 25: Número de identificación del Equipo Básico de Salud (EBS)
- **Longitud Máxima:** `10`
- **Tipo de Dato:** `A`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
El código del EBS debe corresponder con los códigos
parametrizados en el componente de gestión técnica de SI-APS.
Ejemplo: ESE-EBS001.

#### Campo 26: NIT del prestador primario / Organismo de adscripción del EBS.
- **Longitud Máxima:** `9`
- **Tipo de Dato:** `N`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
Corresponde al Número del NIT, sin dígito de verificación, del
prestador primario / Organismo de adscripción del EBS

#### Campo 27: Tipo de identificación del responsable de la visita
- **Longitud Máxima:** `2`
- **Tipo de Dato:** `A`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
Corresponde al listado desplegable de tipos de documento. Es
una variable de respuesta única. Los valores permitidos se
encuentran en la tabla de referencia APSTipoIdentificacion
disponible en https://web.sispro.gov.co
Valores permitidos:
Código Descripción
CC Cedula ciudadanía
CD Carné diplomático
CE Cédula extranjería
PT Permiso por protección temporal
Ejemplo: CC
Nota: Tener en cuenta que el responsable debe estar asociado a
un equipo activo en el SI-APS componente de Gestión Técnica.

#### Campo 28: Número de identificación del responsable de la visita
- **Longitud Máxima:** `20`
- **Tipo de Dato:** `A`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
Corresponde al número de identificación de la persona que
diligencia el instrumento. No se permiten puntos, comas o
guiones.

#### Campo 29: Perfil de quien realiza la visita
- **Longitud Máxima:** `200`
- **Tipo de Dato:** `T`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
Valor tipo texto. Corresponde al perfil académico de la persona
que diligencia el instrumento.

#### Campo 30: Fecha diligenciamiento de la ficha
- **Longitud Máxima:** `10`
- **Tipo de Dato:** `F`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
Fecha en formato AAAA-MM-DD
Ejemplo fecha valida: 2026-12-11

#### Campo 31: Tipo de vivienda
- **Longitud Máxima:** `2`
- **Tipo de Dato:** `N`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
Es una variable de respuesta única. Los valores permitidos se
encuentran en la tabla de referencia APSTipoVivienda,
disponible en: https://web.sispro.gov.co/
Valores permitidos:
Código Descripción
1 Casa
2 Apartamento
3 Tipo "Cuarto"
4 Vivienda tradicional Indígena
5 Vivienda tradicional étnica
6 Carpa
7 Contenedor
8 Embarcación
9 Vagón
10 Refugio Natural
11 Cueva
12 Puente
13 Otro
Ejemplo: 12.

#### Campo 32: Escenarios de riesgo de accidente en la vivienda
- **Longitud Máxima:** `20`
- **Tipo de Dato:** `A`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
Permite reportar varias opciones de respuesta
Los valores permitidos se encuentran en la tabla de referencia
APSRiesgoAccidente, disponible en: https://web.sispro.gov.co/
Valores permitidos:
Código Descripción
Objetos cortantes o punzantes al alcance de los
1
niños.
Sustancias químicas al alcance de los niños y/o
2 reenvasadas en envases de alimentos o
bebidas.
3 Medicamentos al alcance de los niños
Velas, velones, incienso encendido en la
4
vivienda.
Conexiones eléctricas en mal estado o
5
sobrecargadas.
Botones, canicas entre otros objetos pequeños
6 o con piezas que puedan desmontarse, al
alcance de los niños.
Pasillos obstruidos con juguetes, sillas u otros
7
objetos.
Superficies resbaladizas, suelos con agua,
8
grasas, aceites, entre otros.
Tanques o recipientes de almacenamiento de
9
agua sin tapa.
10 Escaleras sin protección.
11 Ninguno
Nota. Como es una respuesta de opción múltiple, se deberán
registrar los números correspondientes a las opciones
seleccionadas, separados por coma (,).
Ejemplo de respuesta válida: 1,4,10

#### Campo 33: Cerca de la vivienda hay
- **Longitud Máxima:** `56`
- **Tipo de Dato:** `A`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
Permite reportar varias opciones de respuesta. Identificación de lo
que observa cerca de la vivienda. Los valores permitidos se
encuentran en la tabla de referencia
APSObservaCercaVivienda, disponible en:
https://web.sispro.gov.co/.
Valores permitidos:
Código Descripción
1 Cultivos
2 Apriscos
3 Porquerizas
4 Galpones
5 Terrenos baldíos
Presencia de Plagas: roedores, cucarachas,
6
zancudos, moscas, etc.
7 Ruido o sonidos desagradables
8 Malos olores
9 Sitios satélites de disposición de excretas
10 Rellenos sanitarios/botaderos
Industrias contaminantes (del sector energético,
11 minero, transporte, construcción, manufacturera,
entre otros)
12 Contaminación visual
13 Río o quebrada
14 Planta de tratamiento de agua residual
15 Extracción minera
16 Canales de agua lluvia
17 Vías de alto tráfico vehicular
18 Quemas a cielo abierto
Aspersión o almacenamiento de agroquímicos u
19
otras sustancias químicas.
20 Fuentes de energía eléctrica de alta tensión.
Industrias de construcción, demolición, talleres u
otros que usen o dispongan de material de
asbesto (Realice la siguiente pregunta: ¿Alguna
vez usted o alguien de su familia ha trabajado o
21
vivido en un lugar dónde podría haber estado
expuesto al asbesto, como en industrias de
construcción, demolición, minería, talleres de
mecánica, etc.?)
22 Ninguno
23 Otro

Nota. Como es una respuesta de opción múltiple, se deberán registrar los números correspondientes a las opciones seleccionadas, separados por coma (,).

Ejemplo de respuesta válida: 1,8,15

#### Campo 34: Ambientes de la vivienda con luz natural
- **Longitud Máxima:** `11`
- **Tipo de Dato:** `N`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
Variable numérica que de múltiple opción que indica los
ambientes de la vivienda que cuentan con luz natural.
Los valores permitidos se encuentran en la tabla de referencia
APSAmbientesVivienda, disponible en:
https://web.sispro.gov.co/
Valores permitidos:
Código Descripción
1 Cocina
2 Dormitorio de adultos
3 Dormitorio de niños
4 Sala / Comedor
5 Sanitario
6 Zona de lavado de ropas
Nota. Como es una respuesta de opción múltiple, se deberán
registrar los números correspondientes a las opciones
seleccionadas, separados por coma (,).
Ejemplo de respuesta válida: 1,3,6

#### Campo 35: Ambientes de la vivienda con ventilación natural o artificial
- **Longitud Máxima:** `11`
- **Tipo de Dato:** `N`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
Variable numérica que de múltiple opción que indica los
ambientes de la vivienda que cuentan con ventilación natural y
artificial.
Los valores permitidos se encuentran en la tabla de referencia
APSAmbientesVivienda, disponible en:
https://web.sispro.gov.co/
Valores permitidos:
Código Descripción
1 Cocina
2 Dormitorio de adultos
3 Dormitorio de niños
4 Sala / Comedor
5 Sanitario
6 Zona de lavado de ropas
Nota. Como es una respuesta de opción múltiple, se deberán
registrar los números correspondientes a las opciones
seleccionadas, separados por coma (,).
Ejemplo de respuesta válida: 1,2,3

#### Campo 36: Elementos en la vivienda
- **Longitud Máxima:** `5`
- **Tipo de Dato:** `N`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
Variable de opción múltiple que indica que elementos hay en la
vivienda.
Los valores permitidos se encuentran en la tabla de referencia
APSElementosVivienda, disponible en:
https://web.sispro.gov.co/
Valores permitidos:
Código Descripción
1 Lavamanos
2 Lavaplatos
3 Lavadero de ropa
Nota. Como es una respuesta de opción múltiple, se deberán
registrar los números correspondientes a las opciones
seleccionadas, separados por coma (,).
Ejemplo de respuesta válida: 1,2,3

#### Campo 37: Alumbrado predominante en la vivienda
- **Longitud Máxima:** `1`
- **Tipo de Dato:** `N`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
Variable de única opción que indica cual es tipo de alumbrado
predominante en la vivienda.
Los valores permitidos se encuentran en la tabla de referencia
APSAlumbradoPredominante, disponible en:
https://web.sispro.gov.co/
Valores permitidos:
Código Descripción
1 Luz eléctrica
2 Kerosén, petróleo, gasolina
3 Velas
4 Energía solar
5 Planta de electricidad
Ejemplo de respuesta válida: 3

#### Campo 38: Acceso a la vivienda
- **Longitud Máxima:** `1`
- **Tipo de Dato:** `N`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
Variable de única opción.
Los valores permitidos se encuentran en la tabla de referencia
APSAccesoVivienda disponible en: https://web.sispro.gov.co
Valores permitidos:
Código Descripción
Medios de transporte (Buses, autos,
1
camiones, lanchas, etc.)
2 Centros sociales, culturales y/o recreacionales
3 Parques, y áreas deportivas
Iglesias, templos, espacios para cultos
4
religiosos
5 Instituciones educativas
6 Servicios de salud
7 Ninguna
Ejemplo de respuesta válida: 3

#### Campo 39: Otros accesos a la vivienda
- **Longitud Máxima:** `200`
- **Tipo de Dato:** `T`
- **Requerido:** `NO`
- **Descripción, Valores Permitidos y Reglas:**
Definición de otros accesos que tiene la vivienda

#### Campo 40: Material predominante techo
- **Longitud Máxima:** `2`
- **Tipo de Dato:** `N`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
Es una variable de única opción. Los valores permitidos se
encuentran en la siguiente tabla
Los valores permitidos se encuentran en la tabla de referencia
APSMaterialTecho, disponible en: https://web.sispro.gov.co/
Valores permitidos:
Código Descripción
1 Concreto
2 Tejas de barro
3 Fibrocemento sin asbesto
4 Fibrocemento con asbesto
5 Zinc
6 Teja o lámina de fibrocemento con asbesto
7 Palma o paja
8 Plástico
9 Desechos (cartón, lata, tela, sacos, etc)
10 Otro
Ejemplo de respuesta válida: 1

#### Campo 41: Cocina separada de la vivienda
- **Longitud Máxima:** `1`
- **Tipo de Dato:** `N`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
Es una variable de respuesta única. Indica si la cocina se
encuentra separada de otros espacios de la vivienda. Los valores
permitidos se encuentran en la tabla de referencia LstSINO,
variable Extra I, disponible en: https://web.sispro.gov.co/.
_
Valores permitidos:
Código Descripción
1 SI
2 NO
Ejemplo: 1

#### Campo 42: Baño separado de la vivienda
- **Longitud Máxima:** `1`
- **Tipo de Dato:** `N`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
Es una variable de respuesta única. Indica si el baño se
encuentra separado de otros espacios de la vivienda. Los valores
permitidos se encuentran en la tabla de referencia LstSINO,
variable Extra I, disponible en: https://web.sispro.gov.co/.
_
Valores permitidos:
Código Descripción
1 SI
2 NO
Ejemplo: 1

#### Campo 43: Dormitorios separados
- **Longitud Máxima:** `1`
- **Tipo de Dato:** `N`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
Es una variable de respuesta única. Indica si los dormitorios de la
vivienda están separados físicamente. Los valores permitidos se
encuentran en la tabla de referencia LstSINO, variable Extra I,
_
disponible en: https://web.sispro.gov.co/.
Valores permitidos:
Código Descripción
1 SI
2 NO
Ejemplo: 1

#### Campo 44: Medio de transporte habitual
- **Longitud Máxima:** `20`
- **Tipo de Dato:** `N`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
Variable de opción múltiple que indica los medios de transporte
habituales de la familia.
Los valores permitidos se encuentran en la tabla de referencia
APSMediosTransporte, disponible en: https://web.sispro.gov.co/
Valores permitidos:
Código Descripción
1 Vehículo particular
2 Servicio público
3 Motocicleta
4 Bicicleta
5 Caminando
6 Maquinaria agrícola o camión
7 Cable aéreo
8 Canoa, lancha, chalupa, piragua
9 Semovientes
10 Otro
Nota. Como es una respuesta de opción múltiple, se deberán
registrar los números correspondientes a las opciones
seleccionadas, separados por coma (,).
Ejemplo de respuesta válida: 1,2,3

#### Campo 45: Otros medios de transporte
- **Longitud Máxima:** `200`
- **Tipo de Dato:** `T`
- **Requerido:** `NO`
- **Descripción, Valores Permitidos y Reglas:**
Otros medios de transporte de la familia, opción 10 de la variable
44

#### Campo 46: Seguridad en el desplazamiento
- **Longitud Máxima:** `13`
- **Tipo de Dato:** `A`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
Variable de opción múltiple que indica los elementos de seguridad
que usa la familia al momento del desplazamiento.
Los valores permitidos se encuentran en la tabla de referencia
APSSeguridadDesplazamiento, disponible en:
https://web.sispro.gov.co/
Valores permitidos:
Código Descripción
1 Casco
2 Cinturón de seguridad
3 Sistema de retención infantil
4 Chaleco reflectivo
5 Chaleco salvavidas
6 Ninguno
7 Otro
Nota. Como es una respuesta de opción múltiple, se deberán
registrar los números correspondientes a las opciones
seleccionadas, separados por coma (,).
Ejemplo de respuesta válida: 1,2,3

#### Campo 47: Otros elementos de seguridad
- **Longitud Máxima:** `200`
- **Tipo de Dato:** `T`
- **Requerido:** `NO`
- **Descripción, Valores Permitidos y Reglas:**
Otros elementos de seguridad durante el desplazamiento,
habilitado bajo la opción 7 de la variable 46

#### Campo 48: Desplazamiento mayor a 30 minutos
- **Longitud Máxima:** `11`
- **Tipo de Dato:** `N`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
Variable de opción múltiple. Identificación de factores que
generan un desplazamiento mayor a 30 minutos.
Los valores permitidos se encuentran en la tabla de referencia
APSDesplazamientoMayor30Minutos, disponible en:
https://web.sispro.gov.co/
Valores permitidos:
Código Descripción
1 Estado de la infraestructura vial
2 Congestión vial
3 Disponibilidad de medios de transporte
4 Distancias a recorrer
5 Disponibilidad económica
6 Otro
Nota. Como es una respuesta de opción múltiple, se deberán
registrar los números correspondientes a las opciones
seleccionadas, separados por coma (,).
Ejemplo de respuesta válida: 1,2,3

#### Campo 49: Otros factores de tiempo de desplazamiento
- **Longitud Máxima:** `200`
- **Tipo de Dato:** `T`
- **Requerido:** `NO`
- **Descripción, Valores Permitidos y Reglas:**
Otros factores que generan un desplazamiento mayor a 30
minutos, habilitado bajo la opción 6 de la variable 48

#### Campo 50: ¿Se realiza actividad económica?
- **Longitud Máxima:** `1`
- **Tipo de Dato:** `N`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
Es una variable de respuesta única. Hace referencia a actividades
económicas dentro de la vivienda. Los valores permitidos se
encuentran en la tabla de referencia LstSINO, variable Extra I,
_
disponible en: https://web.sispro.gov.co/.
Valores permitidos:
Código Descripción
1 SI
2 NO
Ejemplo: 1

#### Campo 51: ¿Área de trabajo independiente?
- **Longitud Máxima:** `1`
- **Tipo de Dato:** `N`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
Es una variable de respuesta única. Identifica si el área de trabajo
es independiente a otras áreas de la vivienda. Los valores
permitidos se encuentran en la tabla de referencia LstSINO,
variable Extra I, disponible en: https://web.sispro.gov.co/.
_
Valores permitidos:
Código Descripción
1 SI
2 NO
Ejemplo: 1

#### Campo 52: ¿Familiar afectado por actividad económica?
- **Longitud Máxima:** `1`
- **Tipo de Dato:** `N`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
Es una variable de respuesta única. Identifica si uno de los
miembros de la familia se ha visto afectado por realizar la
actividad económica en la vivienda. Los valores permitidos se
encuentran en la tabla de referencia LstSINO, variable Extra I,
_
disponible en: https://web.sispro.gov.co/.
Valores permitidos:
Código Descripción
1 SI
2 NO
Ejemplo: 1

#### Campo 53: Fuente principal de agua para consumo humano
- **Longitud Máxima:** `32`
- **Tipo de Dato:** `A`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
Permite reportar varias opciones de respuesta. Los valores
permitidos se encuentran en la tabla de referencia
APSFuenteAgua, disponible en: https://web.sispro.gov.co/.
Valores permitidos:
Código Descripción
1 Acueducto administrado por empresa
prestadora (ESP)
2 Agua embotellada o en bolsa
3 Acueducto veredal o comunitario
4 Pila pública
5 Carro tanque
6 Abasto con distribución comunitaria
7 Pozo con bomba
8 Pozo sin bomba, aljibe, jagüey o barreno
9 Laguna o jagüey
10 Rio, quebrada
11 Manantial o nacimiento
12 Aguas lluvias
13 Aguatero
14 Otro
Nota. Como es una respuesta de opción múltiple, se deberán
registrar los números correspondientes a las opciones
seleccionadas, separados por coma (,).
Ejemplo de respuesta válida: 1,2,10

#### Campo 54: Horas con suministro de agua
- **Longitud Máxima:** `1`
- **Tipo de Dato:** `N`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
Variable de única opción. Conocer cuantas horas al día se cuenta
con suministro de agua en la vivienda.
Los valores permitidos se encuentran en la tabla de referencia
APSHorasSuministroAgua, disponible en:
https://web.sispro.gov.co/
Valores permitidos:
Código Descripción
1 24 horas
2 De 12 a 23 horas
3 Entre 4 y 12 horas
4 Menor a 4 horas
5 Se presentan días sin suministro.
Ejemplo de respuesta válida: 1

#### Campo 55: Tanque de almacenamiento de agua
- **Longitud Máxima:** `1`
- **Tipo de Dato:** `N`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
Variable de única opción. Identificar si la vivienda cuenta con
tanque de agua.
Los valores permitidos se encuentran en la tabla de referencia
APSTanqueAgua, disponible en: https://web.sispro.gov.co/
Valores permitidos:
Código Descripción
1 Aéreo
2 Superficial
3 Subterráneo
4 No tiene tanque de almacenamiento
Ejemplo de respuesta válida: 1

#### Campo 56: Frecuencia de limpieza de tanque
- **Longitud Máxima:** `1`
- **Tipo de Dato:** `N`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
Variable de única opción. Identificación del tiempo de aseo del
tanque de agua en la vivienda.
Los valores permitidos se encuentran en la tabla de referencia
APSFrecuenciaLimpiezaTanque, disponible en:
https://web.sispro.gov.co/
Valores permitidos:
Código Descripción
1 Después de cada uso
2 Semestral
3 No está lavado
4 No aplica
5 Otro
Ejemplo de respuesta válida: 1

#### Campo 57: Distancia entre tanque y el pozo o alcantarillado
- **Longitud Máxima:** `1`
- **Tipo de Dato:** `N`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
Variable de única opción. Identificación de la distancia entre el
tanque del agua y el pozo séptico o el alcantarillado.
Valores permitidos:
Código Descripción
1 Mas de 10 metros
2 Entre 5 y 9 metros
3 Menor a 5 metros
Ejemplo de respuesta válida: 1

#### Campo 58: Sistema de disposición de excretas
- **Longitud Máxima:** `13`
- **Tipo de Dato:** `A`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
Permite reportar varias opciones de respuesta. Los valores
permitidos se encuentran en la tabla de referencia APSExcreta,
disponible en: https://web.sispro.gov.co/.
Valores permitidos:
Código Descripción
1 Sanitario conectado al alcantarillado
2 Sanitario y letrina
3 Sanitario conectado a pozo séptico
4 Sanitario ecológico seco
5 Sanitario sin conexión
6 Sanitario con disposición a fuente hídrica
7 Campo abierto
Nota. Como es una respuesta de opción múltiple, se deberán
registrar los números correspondientes a las opciones
seleccionadas, separados por coma (,).
Ejemplo de respuesta válida: 1,2

#### Campo 59: Sistema de disposición de aguas residuales domésticas
- **Longitud Máxima:** `11`
- **Tipo de Dato:** `A`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
Permite reportar varias opciones de respuesta.
Los valores permitidos se encuentran en la tabla de referencia
APSSistemaAguaResidual, disponible en:
https://web.sispro.gov.co/.
Valores permitidos:
Código Descripción
1 Alcantarillado
2 Pozo séptico
3 Campo de oxidación
4 Biofiltro
5 Fuente hídrica
6 Campo abierto
Nota. Como es una respuesta de opción múltiple, se deberán
registrar los números correspondientes a las opciones
seleccionadas, separados por coma (,).
Ejemplo de respuesta válida: 1,6

#### Campo 60: Almacenamiento de residuos solidos
- **Longitud Máxima:** `9`
- **Tipo de Dato:** `A`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
Permite reportar varias opciones de respuesta. Identifica los
almacenamientos de residuos sólidos en la vivienda
Los valores permitidos se encuentran en la tabla de referencia
APSAlmacenamientoResiduosSolidos, disponible en:
https://web.sispro.gov.co/
Valores permitidos:
Código Descripción
1 Recipientes con tapa
2 Recipientes sin tapa
3 Directamente al suelo
4 Bolsas plásticas
5 Otras
Nota. Como es una respuesta de opción múltiple, se deberán
registrar los números correspondientes a las opciones
seleccionadas, separados por coma (,).
Ejemplo de respuesta válida: 1,3

#### Campo 61: Otros sistemas de almacenamiento de residuos solidos
- **Longitud Máxima:** `200`
- **Tipo de Dato:** `T`
- **Requerido:** `NO`
- **Descripción, Valores Permitidos y Reglas:**
Otros sistemas de almacenamiento de residuos sólidos en la
vivienda, habilitado bajo la opción 5 de la variable 60.

#### Campo 62: Disposición final de los residuos sólidos ordinarios
- **Longitud Máxima:** `9`
- **Tipo de Dato:** `A`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
Permite reportar varias opciones de respuesta. Los valores
permitidos se encuentran en la tabla de referencia
APSDisposicionResiduos, disponible en:
https://web.sispro.gov.co/.
Valores permitidos:
Código Descripción
1 Recolección por parte del servicio de aseo distrital
o municipal.
2 Enterramiento
3 Quema a campo abierto
4 Disposición en fuentes de agua cercana
5 Disposición a campo abierto
Nota. Como es una respuesta de opción múltiple, se deberán
registrar los números correspondientes a las opciones
seleccionadas, separados por coma (,).
Ejemplo de respuesta válida: 2,3,5

#### Campo 63: ¿Conoce prácticas de reducción y separación de residuos?
- **Longitud Máxima:** `1`
- **Tipo de Dato:** `N`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
Es una variable de respuesta única. Hace referencia al
conocimiento de prácticas de reducción y separación de residuos
dentro del hogar. Los valores permitidos se encuentran en la tabla
de referencia LstSINO, variable Extra I, disponible en:
_
https://web.sispro.gov.co/.
Valores permitidos:
Código Descripción
1 SI
2 NO
Ejemplo: 1

#### Campo 64: ¿Realiza prácticas de reducción de residuos?
- **Longitud Máxima:** `1`
- **Tipo de Dato:** `N`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
Es una variable de respuesta única. Hace referencia a la práctica
de reducción y separación de residuos dentro del hogar. Los
valores permitidos se encuentran en la tabla de referencia
LstSINO, variable Extra I, disponible en:
_
https://web.sispro.gov.co/.
Valores permitidos:
Código Descripción
1 SI
2 NO
Ejemplo: 1

#### Campo 65: Como reduce la generación de residuos
- **Longitud Máxima:** `11`
- **Tipo de Dato:** `A`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
Variable de opción múltiple. Identificación de los métodos de
reducción en la generación de residuos.
Los valores permitidos se encuentran en la tabla de referencia
APSReduccionGeneracionResiduos, disponible en:
https://web.sispro.gov.co/
Valores permitidos:
Código Descripción
1 Se evita el uso de productos de un solo uso como
botellas, vajillas y cubiertos desechables, entre
otros
2 Se reutilizan materiales que hayan cumplido su
primer ciclo, como el papel y el cartón
3 Eliminación o reutilización de aparatos eléctricos a
través de las empresas especializadas, como
computadores, cartuchos de impresoras, entre
otros.
4 Se evita el uso de ambientadores artificiales o
aerosoles
5 Se compra a granel usando los propios envases o
maletas para empacar
6 Otros
Nota. Como es una respuesta de opción múltiple, se deberán
registrar los números correspondientes a las opciones
seleccionadas, separados por coma (,).
Ejemplo de respuesta válida: 2,3,5

#### Campo 66: Otros prácticas de reducción de generación residuos
- **Longitud Máxima:** `200`
- **Tipo de Dato:** `T`
- **Requerido:** `NO`
- **Descripción, Valores Permitidos y Reglas:**
Otras prácticas de reducción de generación residuos que se
realizan dentro del hogar, habilitado bajo la opción 6 de la variable
65

#### Campo 67: ¿Realiza prácticas de aprovechamiento de residuos?
- **Longitud Máxima:** `1`
- **Tipo de Dato:** `N`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
Es una variable de respuesta única. Hace referencia a la
validación dentro del hogar si realizan prácticas de
aprovechamiento de residuos. Los valores permitidos se
encuentran en la tabla de referencia LstSINO, variable Extra I,
_
disponible en: https://web.sispro.gov.co/.
Valores permitidos:
Código Descripción
1 SI
2 NO
Ejemplo: 1

#### Campo 68: ¿Qué otras prácticas de aprovechamiento de residuos?
- **Longitud Máxima:** `200`
- **Tipo de Dato:** `T`
- **Requerido:** `NO`
- **Descripción, Valores Permitidos y Reglas:**
Otras prácticas de aprovechamiento de residuos que se realizan
dentro del hogar, habilitado bajo la opción 2 de la variable 67

#### Campo 69: ¿Cómo realiza la disposición de residuos peligrosos?
- **Longitud Máxima:** `17`
- **Tipo de Dato:** `A`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
Variable de opción múltiple. Identificación métodos de disposición
de residuos peligrosos que se realizan en la vivienda.
Los valores permitidos se encuentran en la tabla de referencia
APSDisposicionResiduosPeligrosos, disponible en:
https://web.sispro.gov.co/
Valores permitidos:
Código Descripción
1 Sitios autorizados para su recolección
2 Centros de acopio
3 Enterramiento
4 Quema a campo abierto
5 Disposición en fuentes de agua cercana
6 Disposición a campo abierto
7 En conjunto con los residuos ordinarios de la
vivienda
8 Recolectados por empresas especializadas
9 Otros
Nota. Como es una respuesta de opción múltiple, se deberán
registrar los números correspondientes a las opciones
seleccionadas, separados por coma (,).
Ejemplo de respuesta válida: 2,3,5

#### Campo 70: Otras prácticas de disposición de residuos peligrosos
- **Longitud Máxima:** `200`
- **Tipo de Dato:** `T`
- **Requerido:** `NO`
- **Descripción, Valores Permitidos y Reglas:**
Otras prácticas de disposición de residuos peligrosos que se
realizan dentro del hogar. Habilitado bajo la opción 9 de la
variable 69

#### Campo 71: ¿Realiza procesos de reducción y separación de residuos rurales?
- **Longitud Máxima:** `1`
- **Tipo de Dato:** `N`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
Es una variable de respuesta única. Hace referencia a la
validación dentro del hogar si realizan procesos de reducción y
separación de residuos. Los valores permitidos se encuentran en
la tabla de referencia LstSINO, variable Extra I, disponible en:
_
https://web.sispro.gov.co/.
Valores permitidos:
Código Descripción
1 SI
2 NO
Ejemplo: 1

#### Campo 72: ¿Qué prácticas de aprovechamiento de residuos rurales realiza?
- **Longitud Máxima:** `9`
- **Tipo de Dato:** `N`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
Variable de opción múltiple. Identificación de las prácticas de
aprovechamiento de residuos rurales que se realizan en la
vivienda.
Los valores permitidos se encuentran en la tabla de referencia
APSPracticaAprovechamientoResiduos, disponible en:
https://web.sispro.gov.co/
Valores permitidos:
Código Descripción
1 Compostaje
2 Lombricultivo
3 Biocombustible
4 Biofertilizante
5 Otros
Nota. Como es una respuesta de opción múltiple, se deberán
registrar los números correspondientes a las opciones
seleccionadas, separados por coma (,).
Ejemplo de respuesta válida: 2,3,5

#### Campo 73: Otras prácticas de aprovechamiento de residuos rurales
- **Longitud Máxima:** `200`
- **Tipo de Dato:** `T`
- **Requerido:** `NO`
- **Descripción, Valores Permitidos y Reglas:**
Otras prácticas de aprovechamiento de residuos que se realizan
dentro del hogar, habilitado bajo la opción 5 de la variable 72

#### Campo 74: ¿Qué prácticas de separación de residuos rurales aplica?
- **Longitud Máxima:** `7`
- **Tipo de Dato:** `A`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
Variable de opción múltiple. Identificación de las prácticas de
separación de residuos que se realizan en la vivienda.
Los valores permitidos se encuentran en la tabla de referencia
APSPracticasSeparacionResiduos, disponible en:
https://web.sispro.gov.co/
Valores permitidos:
Código Descripción
1 Separación de residuos no aprovechables
(Icopor, pañales, toallas higiénicas, cerámicas,
papel carbón, entre otros)
2 Separación de residuos orgánicos (residuos
de alimentos, restos vegetales de la poda y
jardinería, restos de la carpintería, entre otros)
3 Separación de residuos aprovechables (papel,
cartón, vidrio, plástico, tetrapack, metal)
4 Otros
Nota. Como es una respuesta de opción múltiple, se deberán
registrar los números correspondientes a las opciones
seleccionadas, separados por coma (,).
Ejemplo de respuesta válida: 2,3,5

#### Campo 75: Otras prácticas de aprovechamiento de residuos rurales
- **Longitud Máxima:** `200`
- **Tipo de Dato:** `T`
- **Requerido:** `NO`
- **Descripción, Valores Permitidos y Reglas:**
Otras prácticas de aprovechamiento de residuos que se realizan
dentro del hogar, habilitado bajo la opción 4 de la variable 74

#### Campo 76: Limpieza de superficies
- **Longitud Máxima:** `1`
- **Tipo de Dato:** `N`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
Variable de única opción. Hace referencia a saber cómo se
realiza la limpieza de superficies.
Los valores permitidos se encuentran en la tabla de referencia
APSLimpiezaSuperficies, disponible en:
https://web.sispro.gov.co/
Valores permitidos:
Código Descripción
1 Retiro de polvo
2 Retiro de polvo y limpieza con agua y jabón
3 Retiro de polvo y limpieza con agua y jabón y
desinfección
4 Otros
Ejemplo de respuesta válida: 1

#### Campo 77: Otras prácticas de Limpieza de superficies
- **Longitud Máxima:** `200`
- **Tipo de Dato:** `T`
- **Requerido:** `NO`
- **Descripción, Valores Permitidos y Reglas:**
Otras prácticas de aprovechamiento de residuos que se realizan
dentro del hogar, habilitado bajo la opción 4 de la variable 76

#### Campo 78: Fuente de energía para cocinar
- **Longitud Máxima:** `15`
- **Tipo de Dato:** `N`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
Variable de única opción. Hace referencia a saber cómo se
realiza la limpieza de superficies.
Los valores permitidos se encuentran en la tabla de referencia
APSFuenteEnergiaCocinar, disponible en:
https://web.sispro.gov.co/
Valores permitidos:
Código Descripción
1 Electricidad
2 Gas natural
3 Gas licuado del petróleo (Gas propano)
4 Leña, madera o carbón de leña
5 Petróleo, gasolina, kerosén, alcohol
6 Carbón mineral
7 Materiales de desecho
8 Otros
Nota. Como es una respuesta de opción múltiple, se deberán
registrar los números correspondientes a las opciones
seleccionadas, separados por coma (,).
Ejemplo de respuesta válida: 2,3,5

#### Campo 79: Otras fuentes de energía para cocinar
- **Longitud Máxima:** `200`
- **Tipo de Dato:** `T`
- **Requerido:** `NO`
- **Descripción, Valores Permitidos y Reglas:**
Otras prácticas de aprovechamiento de residuos que se realizan
dentro del hogar, habilitado bajo la opción 8 de la variable 78

#### Campo 80: Fuentes frecuentes de humo
- **Longitud Máxima:** `13`
- **Tipo de Dato:** `N`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
Variable de opción múltiple. Identificación de las fuentes
frecuentes de humo en el hogar.
Los valores permitidos se encuentran en la tabla de referencia
APSFuentesFrecuentesHumo, disponible en:
https://web.sispro.gov.co/
Valores permitidos:
Código Descripción
1 Cigarrillo o tabaco
2 Leña
3 Carbón
4 Quema de basura
5 Vapeadores
6 Narguilas
7 No aplica
8 Otros
Nota. Como es una respuesta de opción múltiple, se deberán
registrar los números correspondientes a las opciones
seleccionadas, separados por coma (,).
Ejemplo de respuesta válida: 2,3,5

#### Campo 81: Otras fuentes frecuentes de humo
- **Longitud Máxima:** `200`
- **Tipo de Dato:** `T`
- **Requerido:** `NO`
- **Descripción, Valores Permitidos y Reglas:**
Otras fuentes frecuentes de humo en el hogar, habilitado bajo la
opción 8 del numeral 80

#### Campo 82: Prácticas en la calidad del aire
- **Longitud Máxima:** `9`
- **Tipo de Dato:** `N`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
Variable de opción múltiple. Identificación de las fuentes
frecuentes de humo en el hogar.
Los valores permitidos se encuentran en la tabla de referencia
APSPracticasCalidadAire, disponible en:
https://web.sispro.gov.co/
Valores permitidos:
Código Descripción
1 Cocinar con carbón o leña
2 Fumadores activos en la vivienda
3 Encender el vehículo dentro de la vivienda en un
área donde no hay buena ventilación
4 Quema de basura afuera de la vivienda
5 Barrido de pisos con levantamiento de polvillo
Nota. Como es una respuesta de opción múltiple, se deberán
registrar los números correspondientes a las opciones
seleccionadas, separados por coma (,).
Ejemplo de respuesta válida: 2,3,5

#### Campo 83: Tipo de estufa
- **Longitud Máxima:** `7`
- **Tipo de Dato:** `N`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
Variable de opción múltiple. Identificación de las fuentes
frecuentes de humo en el hogar.
Los valores permitidos se encuentran en la tabla de referencia
APSTipoEstufa, disponible en: https://web.sispro.gov.co/
Valores permitidos:
Código Descripción
1 Eléctrica, de gas, petróleo, gasolina, kerosén,
alcohol con conexiones en buen estado, sin fugas,
buen estado de combustión, no hay riesgo
eléctrico
2 Eléctrica, de gas, petróleo, gasolina, kerosén,
alcohol, con conexiones en mal estado,
reparaciones defectuosas, mal estado de
combustión, hay riesgo eléctrico
3 De leña, madera, carbón de leña o carbón mineral
mejorada, con sistema de extracción de humo y
gases (Chimenea) y está ubicada fuera de la
vivienda; o está ubicada al interior de la vivienda, y
se encuentra en buen estado al no haber
presencia de manchas u otras señales
4 De leña, madera, carbón de leña o carbón mineral
ubicada dentro de la vivienda, con evidencia de
manchas en el lugar donde está ubicada la estufa
Nota. Como es una respuesta de opción múltiple, se deberán
registrar los números correspondientes a las opciones
seleccionadas, separados por coma (,).
Ejemplo de respuesta válida: 1,2

#### Campo 84: Criaderos que favorecen vectores de enfermedades
- **Longitud Máxima:** `1`
- **Tipo de Dato:** `N`
- **Requerido:** `NO`
- **Descripción, Valores Permitidos y Reglas:**
Es una variable de respuesta única. Responde a la pregunta ¿Se
observa cerca de la vivienda o dentro de ellas criaderos o
reservorios que pueden favorecer la presencia de vectores
transmisores de enfermedades?
Valores permitidos:
Código Descripción
1 SI
2 NO
3 NO APLICA
Ejemplo: 2.

#### Campo 85: Vectores transmisores de enfermedades
- **Longitud Máxima:** `23`
- **Tipo de Dato:** `A`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
Permite reportar varias opciones de respuesta. Los valores
permitidos se encuentran en la tabla de referencia
APSVectoresTrasmisoresEnfermedades, disponible en:
https://web.sispro.gov.co/
Valores permitidos:
Código Descripción
1 Zancudos
2 Cucarachas
3 Moscas
4 Mosquitos
5 Pulgas
6 Piojos
7 Garrapatas
8 Roedores
9 Chinches
10 Triatominos (Pito)
11 Otro
Nota. Como es una respuesta de opción múltiple, se deberán
registrar los números correspondientes a las opciones
seleccionadas, separados por coma (,).
Ejemplo de respuesta válida: 2,6,11.

#### Campo 86: Otros vectores transmisores de enfermedades
- **Longitud Máxima:** `200`
- **Tipo de Dato:** `T`
- **Requerido:** `NO`
- **Descripción, Valores Permitidos y Reglas:**
Otras prácticas de aprovechamiento de residuos que se realizan
dentro del hogar, habilitado bajo la opción 11 de la variable 85

#### Campo 87: Medidas para el control de vectores transmisores de enfermedades
- **Longitud Máxima:** `32`
- **Tipo de Dato:** `A`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
Permite reportar varias opciones de respuesta. Los valores
permitidos se encuentran en la tabla de referencia
APSControlVectoresTrasmisores, disponible en:
https://web.sispro.gov.co/
Valores permitidos:
Código Descripción
1 Manejo higiénico de los residuos sólidos
2 Evitar el uso de fuentes de luz blanca o brillante en
ambientes oscuros
3 Recolección de inservibles
4 Uso de toldillos
5 Uso de angeos y trampas caseras
6 Ordenamiento e higiene
7 Limpieza de malezas
8 Drenaje de zonas encharcadas
9 Protección de depósitos de agua de consumo
mientras no estén en uso
10 Retiro de recipientes que usualmente contienen o
acumulan agua
11 Reemplazo de techos en paja por techo de zinc
12 Reparaciones para eliminar sitios húmedos o poco
iluminados
13 Uso de pantalones y camisas manga larga de
colores claros
14 Otras
Nota. Como es una respuesta de opción múltiple, se deberán
registrar los números correspondientes a las opciones
seleccionadas, separados por coma (,).
Ejemplo de respuesta válida: 2,6,11.

#### Campo 88: Otras medidas para el control de vectores transmisores de enfermedades
- **Longitud Máxima:** `200`
- **Tipo de Dato:** `T`
- **Requerido:** `NO`
- **Descripción, Valores Permitidos y Reglas:**
Otras prácticas de aprovechamiento de residuos que se realizan
dentro del hogar, habilitado bajo la opción 14 de la variable 87

#### Campo 89: Animales ponzoñosos en el hogar
- **Longitud Máxima:** `13`
- **Tipo de Dato:** `A`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
Permite reportar varias opciones de respuesta. Los valores
permitidos se encuentran en la tabla de referencia
APSAnimalesPonsoniosos, disponible en:
https://web.sispro.gov.co/
Valores permitidos:
Código Descripción
1 Arañas
2 Escorpiones o alacranes
3 Serpientes o víboras
4 Abejas
5 Avispas
6 Orugas
7 No Aplica
8 Otro
Nota. Como es una respuesta de opción múltiple, se deberán
registrar los números correspondientes a las opciones
seleccionadas, separados por coma (,).
Ejemplo de respuesta válida: 2,6,11.

#### Campo 90: Otros animales ponzoñosos en el hogar
- **Longitud Máxima:** `200`
- **Tipo de Dato:** `T`
- **Requerido:** `NO`
- **Descripción, Valores Permitidos y Reglas:**
Otras prácticas de aprovechamiento de residuos que se realizan
dentro del hogar, habilitado bajo la opción 8 de la variable 89

#### Campo 91: Medidas para reducir riesgo de animales ponzoñosos en el hogar
- **Longitud Máxima:** `20`
- **Tipo de Dato:** `A`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
Permite reportar varias opciones de respuesta. Los valores
permitidos se encuentran en la tabla de referencia
APSMedidasControlAnimalesPonsoniosos, disponible en:
https://web.sispro.gov.co/
Valores permitidos:
Código Descripción
1 Sacudir la ropa y los zapatos antes de usarlos
2 No meter las manos en huecos de los árboles
3 Usar guantes de carnaza o tener precaución al
levantar piedras o rocas
4 Orden e higiene en las viviendas y el peridomicilio
5 No caminar junto al corte del monte en los caminos
de herradura
6 No caminar descalzo en el campo, usar botas de
caña alta
7 Evitar que los niños y niñas jueguen en zonas
boscosas
8 Transitar si es posible en compañía de perros
9 Evitar deambular de noche
10 No molestar panales de abejas o avispas
Nota. Como es una respuesta de opción múltiple, se deberán
registrar los números correspondientes a las opciones
seleccionadas, separados por coma (,).
Ejemplo de respuesta válida: 2,6,11.

#### Campo 92: Animales que conviven con la familia
- **Longitud Máxima:** `26`
- **Tipo de Dato:** `A`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
Permite reportar varias opciones de respuesta. Los valores
permitidos se encuentran en la tabla de referencia APSAnimales,
disponible en: https://web.sispro.gov.co/.
Valores permitidos:
Código Descripción
1 Perros
2 Gato
3 Porcinos
4 Bovinos: Búfalos, vacas, toros
5 Equinos: Asnos, mulas, caballos, burros
6 Ovinos/ caprino
7 Aves de producción
8 Aves ornamentales
9 Peces ornamentales, hámster
10 Cobayos, conejos
11 Animales silvestres
12 Otro
13 Ninguno
Nota. Como es una respuesta de opción múltiple, se deberán
registrar los números correspondientes a las opciones
seleccionadas, separados por coma (,).
Ejemplo de respuesta válida: 2,6,11.

#### Campo 93: Cantidad de perros en el hogar
- **Longitud Máxima:** `3`
- **Tipo de Dato:** `N`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
Cantidad de perros en la vivienda

#### Campo 94: Cantidad de perros con vacuna antirrábica
- **Longitud Máxima:** `3`
- **Tipo de Dato:** `N`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
Cantidad de perros con vacuna antirrábica en la vivienda

#### Campo 95: Cantidad de gatos en el hogar
- **Longitud Máxima:** `3`
- **Tipo de Dato:** `N`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
Cantidad de gatos en la vivienda

#### Campo 96: Cantidad de gatos con vacuna antirrábica
- **Longitud Máxima:** `3`
- **Tipo de Dato:** `N`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
Cantidad de gatos con vacuna antirrábica en la vivienda

#### Campo 97: Finalidad de tenencia de los animales en el hogar
- **Longitud Máxima:** `7`
- **Tipo de Dato:** `A`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
Permite reportar varias opciones de respuesta.
Los valores permitidos se encuentran en la tabla de referencia
APSFinalidadTenenciaAnimal, disponible en:
https://web.sispro.gov.co/
Valores permitidos:
Código Descripción
1 Compañía
2 Producción
3 Autoconsumo
4 Vigilancia
Nota. Como es una respuesta de opción múltiple, se deberán
registrar los números correspondientes a las opciones
seleccionadas, separados por coma (,).
Ejemplo de respuesta válida: 1,2

#### Campo 98: Confinamiento de los animales
- **Longitud Máxima:** `5`
- **Tipo de Dato:** `A`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
Permite reportar varias opciones de respuesta.
Los valores permitidos se encuentran en la tabla de referencia
APSConfinamientoAnimal, disponible en:
https://web.sispro.gov.co/
Valores permitidos:
Código Descripción
1 Totalmente confinados
2 Parcialmente confinados
3 Libres
Nota. Como es una respuesta de opción múltiple, se deberán
registrar los números correspondientes a las opciones
seleccionadas, separados por coma (,).
Ejemplo de respuesta válida: 1,2

#### Campo 99: ¿Se desparasita a los animales domésticos?
- **Longitud Máxima:** `1`
- **Tipo de Dato:** `N`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
Es una variable de respuesta única.. Los valores permitidos se
encuentran en la tabla de referencia LstSINO, variable
Extra I, disponible en: https://web.sispro.gov.co/.
_
Valores permitidos:
Código Descripción
1 SI
2 NO
Ejemplo: 1

#### Campo 100: Instalaciones seguras
- **Longitud Máxima:** `1`
- **Tipo de Dato:** `N`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
Es una variable de respuesta única. Identifica si las instalaciones
para animales son seguras Los valores permitidos se encuentran
en la tabla de referencia LstSINO, variable Extra I, disponible en:
_
https://web.sispro.gov.co/.
Valores permitidos:
Código Descripción
1 SI
2 NO
Ejemplo: 1

#### Campo 101: Excretas de los animales se recogen y disponen adecuadamente
- **Longitud Máxima:** `1`
- **Tipo de Dato:** `N`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
Es una variable de respuesta única. Valida si las excretas de los
animales domesticas, son recogidas y se disponen correctamente
de ellas. Los valores permitidos se encuentran en la tabla de
referencia LstSINO, variable Extra I, disponible en:
_
https://web.sispro.gov.co/.
Valores permitidos:
Código Descripción
1 SI
2 NO
Ejemplo: 1

#### Campo 102: Vivienda con barreras para evitar contacto directo con los animales
- **Longitud Máxima:** `1`
- **Tipo de Dato:** `N`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
Es una variable de respuesta única. . Los valores permitidos se
encuentran en la tabla de referencia LstSINO, variable Extra I,
_
disponible en: https://web.sispro.gov.co/.
Valores permitidos:
Código Descripción
1 SI
2 NO
Ejemplo: 1

#### Campo 103: Medidas para el control de vectores transmisoras de enfermedades
- **Longitud Máxima:** `1`
- **Tipo de Dato:** `N`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
Es una variable de respuesta única. Identifica las medidas para el
control de vectores que transmiten enfermedades
Valores permitidos:
Código Descripción
1 Manejo higiénico de los residuos sólidos
2 Evitar el uso de fuentes de luz blanca o brillante en
ambientes oscuros
Ejemplo: 1

#### Campo 104: Lugar donde adquiere productos químicos
- **Longitud Máxima:** `1`
- **Tipo de Dato:** `N`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
Es una variable de respuesta única. Identifica cual es el lugar
donde se adquieren los productos químicos de la vivienda.
Los valores permitidos se encuentran en la tabla de referencia
APSLugarAdquiereQuimicos, disponible en:
https://web.sispro.gov.co/
Valores permitidos:
Código Descripción
1 Tiendas de barrio
2 Almacenes de cadena
3 Establecimientos especificos de venta de
productos químicos
4 Establecimientos de venta a granel
Ejemplo: 1

#### Campo 105: Disposición final de residuos químicos
- **Longitud Máxima:** `15`
- **Tipo de Dato:** `A`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
Permite reportar varias opciones de respuesta. Identifica cuales
son las alternativas que se tiene para la disposición final de
residuos químicos.
Los valores permitidos se encuentran en la tabla de referencia
APSDisposicionFinalResiduosQuimicos, disponible en:
https://web.sispro.gov.co/
Valores permitidos:
Código Descripción
1 Se separan de los residuos ordinarios en la
vivienda para posterior aprovechamiento
2 En conjunto con los residuos ordinarios de la
vivienda
3 Quema a campo abierto
4 Disposición en fuentes de agua cercana
5 Disposición a campo abierto
6 Enterramiento
7 Se utilizan para contener bebidas, alimentos y
agua y para otros usos en el hogar
8 Otros
Nota. Como es una respuesta de opción múltiple, se deberán
registrar los números correspondientes a las opciones
seleccionadas, separados por coma (,).
Ejemplo de respuesta válida: 2,6,11.

#### Campo 106: Otras prácticas de disposición final de residuos químicos
- **Longitud Máxima:** `200`
- **Tipo de Dato:** `T`
- **Requerido:** `NO`
- **Descripción, Valores Permitidos y Reglas:**
Otras prácticas de disposición final de residuos químicos que se
realizan en la vivienda. Habilitado bajo la opción 8 de la variable
105

#### Campo 107: Seguimiento de instrucciones para manejo y almacenamiento de quimicos.
- **Longitud Máxima:** `1`
- **Tipo de Dato:** `N`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
Es una variable de respuesta única. Identifica si hay eguimiento
de las instrucciones del fabricante para el manjo y
almacenamiento de químicos dentro de la vivienda Los valores
permitidos se encuentran en la tabla de referencia LstSINO,
variable
Extra I, disponible en: https://web.sispro.gov.co/.
_
Valores permitidos:
Código Descripción
1 SI
2 NO
Ejemplo: 1

#### Campo 108: Productos en envase original y lugar asignado
- **Longitud Máxima:** `1`
- **Tipo de Dato:** `N`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
Es una variable de respuesta única. Identifica si los productos
químicos son almacenados en su empaque original y se
almacenan en un lugar adecuado Los valores permitidos se
encuentran en la tabla de referencia LstSINO, variable
Extra I, disponible en: https://web.sispro.gov.co/.
_
Valores permitidos:
Código Descripción
1 SI
2 NO
Ejemplo: 1

#### Campo 109: Protección y ventilación al limpiar
- **Longitud Máxima:** `1`
- **Tipo de Dato:** `N`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
Es una variable de respuesta única. Identifica si se tiene
ventilación y protección al momento de realizar la limpieza con
químicos dentro de la vivienda Los valores permitidos se
encuentran en la tabla de referencia LstSINO, variable
Extra I, disponible en: https://web.sispro.gov.co/.
_
Valores permitidos:
Código Descripción
1 SI
2 NO
Ejemplo: 1

#### Campo 110: No. Personas
- **Longitud Máxima:** `2`
- **Tipo de Dato:** `N`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
Corresponde al número de personas que conforman la familia.
Permite valor numérico. Debe coincidir a la cantidad de registros
de tipo 3.

#### Campo 111: Alias Familia
- **Longitud Máxima:** `200`
- **Tipo de Dato:** `T`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
Corresponde al alias de la familia. Valor tipo texto.

#### Campo 112: Tipo de familia
- **Longitud Máxima:** `1`
- **Tipo de Dato:** `N`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
Es una variable de respuesta única. Los valores permitidos se
encuentran en la tabla de referencia APSTipoFamilia, disponible
en: https://web.sispro.gov.co/.
Valores permitidos:
Código Descripción
1 Nuclear biparental
2 Nuclear monoparental
3 Extenso biparental
4 Extenso monoparental
5 Compuesto biparental
6 Compuesto monoparental
7 Unipersonal
Ejemplo: 7

#### Campo 113: Apgar Familiar
- **Longitud Máxima:** `1`
- **Tipo de Dato:** `N`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
Corresponde al resultado obtenido luego de diligenciar el
instrumento anexo Apgar familiar (funcionalidad de la familia). Es
una variable de respuesta única.
Es una variable de respuesta única. Los valores permitidos se
encuentran en la tabla de referencia APSAPGAR, disponible en:
https://web.sispro.gov.co/.
Valores permitidos:
Código Descripción
1 7 a 10 puntos. Alta funcionalidad
2 4 a 6 puntos. Funcionalidad moderada
3 0 a 3 puntos. Disfunción familiar.
Ejemplo: 2

#### Campo 114: ¿Cuidador principal?
- **Longitud Máxima:** `1`
- **Tipo de Dato:** `N`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
Es una variable de respuesta única y responde a la pregunta ¿En
la familia se identifica un cuidador principal de niños, niñas,
persona con discapacidad, adulto mayor o enfermedad?
Los valores permitidos se encuentran en la tabla de referencia
LstSINO, variable Extra I, disponible en:
_
https://web.sispro.gov.co/
Valores permitidos:
Código Descripción
1 SI
2 NO
Ejemplo: 1

#### Campo 115: Escala ZARIT
- **Longitud Máxima:** `3`
- **Tipo de Dato:** `N`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
Corresponde al resultado obtenido luego de diligenciar el
instrumento anexo escala ZARIT (determina si se requiere
intervención individual o familiar). Es una variable de respuesta
única. Los valores permitidos son entre 0 y 100.

#### Campo 116: Familia con situaciones que generan riesgo para la salud física o mental
- **Longitud Máxima:** `50`
- **Tipo de Dato:** `A`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
Permite reportar varias opciones de respuesta. Los valores
permitidos se encuentran en la tabla de referencia
APSRiesgoFisicoMental, disponible en:
https://web.sispro.gov.co/.
Valores permitidos:
Código Descripción
1 Inicio de la convivencia en pareja
2 Llegada de un nuevo integrante
3 Ingreso a estudiar
4 Pérdida del año escolar
5 Embarazo temprano o adolescente
6 Independencia de los hijos-hijas
7 Separación de pareja
8 Jubilación
9 Duelo
10 Desempleo o pérdida abrupta del trabajo
11 Pérdidas o crisis económicas
12 Enfermedad terminal o huérfana/ rara en alguno de
sus integrantes
13 Antecedentes de intento o muerte por suicidio en
alguno de sus integrantes
14 Accidente o situación que genera discapacidad
15 Muerte inesperada
16 Vivencia de alguna forma de violencia
17 Persona en situación de abandono
18 Migración
19 Consumo problemático de sustancias psicoactivas,
incluyendo alcohol
20 Trastorno de salud mental
21 Ninguna
Nota. Como es una respuesta de opción múltiple, se deberán
registrar los números correspondientes a las opciones
seleccionadas, separados por coma (,).
Ejemplo de respuesta válida: 2,3,5

#### Campo 117: Prácticas que favorecen los vínculos familiares.
- **Longitud Máxima:** `11`
- **Tipo de Dato:** `A`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
Permite reportar varias opciones de respuesta. Los valores
permitidos se encuentran en la tabla de referencia
APSPracticasVinculosFamiliares, disponible en:
https://web.sispro.gov.co/.
Valores permitidos:
Código Descripción
1 Cuando hay tensión o estrés en la familia lo
reconoce y encuentran la forma de manejarlas de
manera pacífica
2 Las decisiones familiares son concertadas
teniendo en cuenta a todos sus integrantes
3 La familia resuelve los conflictos buscando el
bienestar de todos sus integrantes
4 La comunicación en la familia está basada en la
escucha activa, el respeto y la negociación.
5 Si en la familia hay niños, niñas y adolescentes los
padres y cuidadores comparten, apoyan y
supervisan sus actividades con respeto y límites.
6 En familias con personas adultas mayores los
demás integrantes de la familia tienen en cuenta
sus intereses, opiniones y preferencias.
Nota. Como es una respuesta de opción múltiple, se deberán
registrar los números correspondientes a las opciones
seleccionadas, separados por coma (,).
Ejemplo de respuesta válida: 2,3,5

#### Campo 118: Redes de apoyo social
- **Longitud Máxima:** `1`
- **Tipo de Dato:** `N`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
Es una variable de respuesta única. Los valores permitidos se
encuentran en la tabla de referencia APSRedesApoyoSocial,
disponible en: https://web.sispro.gov.co/.
Valores permitidos:
Código Descripción
1 Cuenta con redes de apoyo sociales protectoras
para el cuidado de su salud
2 Cuenta con redes de apoyo sociales para el
cuidado de salud, pero podría ampliarlas para
fortalecerse
3 No identifica/ no cuenta con redes de apoyo
sociales protectoras.
Ejemplo: 2

#### Campo 119: Prácticas para el cuidado de la salud y protección en el hogar.
- **Longitud Máxima:** `15`
- **Tipo de Dato:** `A`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
Permite reportar varias opciones de respuesta. Los valores
permitidos se encuentran en la tabla de referencia
APSPracticasSaludHogar, disponible en:
https://web.sispro.gov.co/.
Valores permitidos:
Código Descripción
1 Tratamiento casero al agua antes del consumo
humano y almacenamiento adecuado
2 Facilita la circulación del aire en la vivienda a
través de la ventilación natural o artificial
3 Evita el consumo de tabaco, el encendido de
carros al interior de la vivienda y el uso de leña
para cocinar
4 Los residuos sólidos se almacenan en recipientes
con tapa, se separan en la fuente, no se queman,
no se tiran a campo abierto o en fuentes de agua
5 Los pisos y paredes de la vivienda están limpios
6 Usa toldillos, angeos y trampas caseras para la
protección contra vectores y roedores
7 Al interior de la vivienda o el peri-domicilio, jardín
o espacios de la vivienda como patio o azotea
están limpios.
8 El lugar donde se almacenan los productos
químicos para el uso en el hogar se encuentra
ventilado, cerrado y separado de comida,
alimentos para animales o medicamentos y fuera
del alcance de los niños, niñas y mascotas.
Nota. Como es una respuesta de opción múltiple, se deberán
registrar los números correspondientes a las opciones
seleccionadas, separados por coma (,).
Ejemplo de respuesta válida: 2,3,5

#### Campo 120: Medidas ante enfermedades respiratorias
- **Longitud Máxima:** `1`
- **Tipo de Dato:** `N`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
Permite reportar varias opciones de respuesta. Identifica cuales
son las medidas que se tienen en cuenta cuando hay
enfermedades respiratorias en el hogar
Es una variable de respuesta única. Los valores permitidos se
encuentran en la tabla de referencia
APSMedidasEnfermedadesRespiratorias, disponible en:
https://web.sispro.gov.co/.
Valores permitidos:
Código Descripción
1 Uso de tapabocas
2 Lavado frecuente de manos
3 Cubrir rostro al toser y estornudar
4 Ninguno
5 Otro
Ejemplo de respuesta válida: 2

#### Campo 121: Otras medidas ante enfermedades respiratorias
- **Longitud Máxima:** `200`
- **Tipo de Dato:** `T`
- **Requerido:** `NO`
- **Descripción, Valores Permitidos y Reglas:**
Variable tipo texto. Corresponde a la especificación de otras
medidas que se tienen en el hogar cuando se presentan
enfermedades respiratorias. Se habilita bajo la opción 5 de la
variable 120

#### Campo 122: Implementos de higiene personal compartidos
- **Longitud Máxima:** `1`
- **Tipo de Dato:** `N`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
Es una variable de respuesta única y responde a la pregunta.
Valida si los elementos de higiene personal son compartidos entre
los miembros de la familia.
Los valores permitidos se encuentran en la tabla de referencia
LstSINO, variable Extra I, disponible en:
_
https://web.sispro.gov.co/
Valores permitidos:
Código Descripción
1 SI
2 NO
Ejemplo: 1

#### Campo 123: Número de identificación de la vivienda
- **Longitud Máxima:** `26`
- **Tipo de Dato:** `A`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
Corresponde a la concatenación de las variables 3,4,5,6,7,
seguido de la letra H más un consecutivo de 4 dígitos. El número
consecutivo del hogar reinicia en 0001 para cada micro territorio.

#### Campo 124: Número de identificación de la familia.
- **Longitud Máxima:** `31`
- **Tipo de Dato:** `A`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
Corresponde a la concatenación de las variables 123, seguido de
la letra F más un consecutivo de 4 dígitos. El número consecutivo
reinicia en 0001 para una familia en un hogar diferente.

---

## 4. DICCIONARIO DETALLADO: REGISTRO TIPO 3 – CARACTERIZACIÓN DE LOS INTEGRANTES DE LA FAMILIA Y CONDICIONES DE SALUD

Mediante el Registro Tipo 3, las entidades reportan el detalle de la información de identificación de cada uno de los integrantes de la familia y sus situaciones o condiciones de salud.

### 4.1. Tabla Resumen de Campos – Tipo 3 (119 Variables: 0 a 118)

| No. | Nombre del Campo | Long. Máx. | Tipo | Req. | Descripción / Valores Permitidos |
| :---: | :--- | :---: | :---: | :---: | :--- |
| 0 | Tipo de registro | 1 | N | SI | 3: valor que significa que el registro es de detalle de la inform... |
| 1 | Consecutivo de registro | 10 | N | SI | Número consecutivo de registros de detalle dentro del archivo. In... |
| 2 | Primer Nombre | 60 | T | SI | Valor tipo texto... |
| 3 | Segundo Nombre | 60 | T | NO | Valor tipo texto... |
| 4 | Primer Apellido | 60 | T | SI | Valor tipo texto... |
| 5 | Segundo Apellido | 60 | T | NO | Valor tipo texto... |
| 6 | Tipo de identificación | 2 | A | SI | Corresponde al tipo de documento de identificación del integrante... |
| 7 | Número de identificación | 20 | A | SI | Corresponde al número de documento de identificación del integran... |
| 8 | Fecha de Nacimiento | 10 | F | SI | En formato AAAA-MM-DD. Corresponde a la fecha de nacimiento del i... |
| 9 | País de origen | 3 | N | SI | Es una variable de respuesta única. Corresponde al país de origen... |
| 10 | Estatus Migratorio | 1 | N | SI | Es una variable de respuesta única. Corresponde al estatus migrat... |
| 11 | Sexo al nacer | 1 | N | SI | Es una variable de respuesta única. Los valores permitidos se enc... |
| 12 | Género | 1 | N | SI | Es una variable de respuesta única. Indica el género de la person... |
| 13 | ¿Genero qué se identifica la persona? | 1 | N | SI | Es una variable de respuesta única. Indica como se identifica la ... |
| 14 | ¿Cuál es la orientación sexual? | 1 | N | SI | Es una variable de respuesta única. Valida como se identifica la ... |
| 15 | Teléfono principal | 20 | N | NO | Corresponde al teléfono principal del integrante de la familia. E... |
| 16 | Teléfono secundario | 20 | N | NO | Corresponde al teléfono secundario del integrante de la familia. ... |
| 17 | Rol dentro de la familia | 1 | N | SI | Es una variable de respuesta única. Los valores permitidos se enc... |
| 18 | Ocupación | 4 | N | SI | Es una variable de respuesta única. Los valores permitidos se enc... |
| 19 | Nivel Educativo | 2 | N | SI | Es una variable de respuesta única. Los valores permitidos se enc... |
| 20 | Régimen de afiliación | 1 | N | SI | Es una variable de respuesta única. Los valores permitidos se enc... |
| 21 | EAPB | 8 | N | NO | Corresponde a la Entidad Administradora de Planes de Beneficios. ... |
| 22 | ¿Es sujeto de protección constitucional o tiene alguna condición especial? | 32 | A | SI | Permite reportar varias opciones de respuesta Los valores permiti... |
| 23 | Modalidad Violencia | 200 | T | NO | Es una variable de respuesta única. Se habilita cuando se escoge ... |
| 24 | Pertenencia étnica | 2 | A | SI | Es una variable de respuesta única. Los valores permitidos se enc... |
| 25 | ¿A qué pueblo o comunidad étnica pertenece? | 60 | T | NO | Variable de texto. Indica el nombre de la comunidad que pertenece... |
| 26 | Prácticas de cuidado de la salud desde sus saberes ancestrales/tradicionales | 11 | A | SI | Permite reportar varias opciones de respuesta. Los valores permit... |
| 27 | Prácticas para el ejercicio y exigibilidad del derecho a la salud | 7 | A | SI | Permite reportar varias opciones de respuesta. Los valores permit... |
| 28 | ¿Realiza rutinariamente las siguientes prácticas para el cuidado y salud? | 15 | A | SI | Permite reportar varias opciones de respuesta. Los valores permit... |
| 29 | Atenciones pendientes de promoción y mantenimiento | 81 | A | SI | Permite reportar varias opciones de respuesta. Valida cuales son ... |
| 30 | ¿Es persona con discapacidad? | 13 | A | SI | Corresponde al reconocimiento de alguna discapacidad - Categorías... |
| 31 | Tiene certificación y registro de discapacidad (RLCPD) | 1 | N | SI | Es una variable de respuesta única. Valida si la persona tiene ce... |
| 32 | Intención reproductiva a corto plazo | 1 | N | SI | Es una variable de respuesta única y responde a la pregunta ¿La p... |
| 33 | Gestación actual confirmada | 1 | N | SI | Es una variable de respuesta única y responde a la pregunta. Vali... |
| 34 | Atenciones pendientes de la ruta materno perinatal | 15 | A | SI | Permite reportar varias opciones de respuesta. Los valores permit... |
| 35 | Motivo por el cual no ha recibido las atenciones de promoción y mantenimiento de la salud o materno perinatal | 32 | A | SI | Permite reportar varias opciones de respuesta Los valores permiti... |
| 36 | Menores de 6 meses ¿Recibe lactancia exclusiva? | 1 | N | SI | Es una variable de respuesta única. Aplica solo si es menor de 6 ... |
| 37 | Peso (en kilogramos) | 5 | D | SI | Número decimal de 3 enteros y 1 decimal... |
| 38 | Talla (en centímetros) | 5 | D | SI | Número decimal de 3 enteros y 1 decimal... |
| 39 | Mayores de 5 años. Resultado del IMC | 4 | D | SI | Número decimal de 2 enteros y 1 decimal... |
| 40 | Mayores de 18 años. Circunferencia de cintura (cm) | 3 | N | SI | Circunferencia de cintura (en centímetros). Solo personas mayores... |
| 41 | Hay signos físicos de desnutrición aguda en niños/as de 3 meses a 5 años | 13 | A | SI | Permite reportar varias opciones de respuesta. Los valores permit... |
| 42 | Clasificación antropométrica del estado nutricional según Peso para la Talla (P/T) o IMC para la edad (tener en cuenta el grupo de edad o si es gestante) | 2 | N | SI | Es una variable de respuesta única. Los valores permitidos se enc... |
| 43 | ¿Se lava las manos con agua y jabón? | 1 | N | SI | Es una variable de respuesta única y responde a la pregunta. Vali... |
| 44 | Tensión arterial (Sistólica) | 3 | N | SI | Campo numérico. Se diligencia si la persona es mayor de 18 años.... |
| 45 | Tensión arterial (Diastólica) | 3 | N | SI | Campo numérico. Se diligencia si la persona es mayor de 18 años.... |
| 46 | Clasificación Tensión arterial | 1 | N | SI | Es una variable de respuesta única. Los valores permitidos se enc... |
| 47 | Alguien de la familia acudió a urgencias | 20 | A | SI | Es una variable de respuesta única. Identifica si alguien de la f... |
| 48 | Enfermedades sufridas en el último mes | 47 | A | SI | Es una variable de respuesta única. Identifica si sufrió alguna e... |
| 49 | Otras enfermedades sufridas en el último mes | 200 | T | NO | Variable de texto. Otras enfermedades que sufrió la persona en el... |
| 50 | Que hizo si la persona presento alguna afección el último mes | 1 | N | SI | Es una variable de respuesta única. Valida que acciones tomó la p... |
| 51 | Otras enfermedades sufridas en el último mes | 200 | T | NO | Variable de texto. Otras acciones que tomó la persona en caso de ... |
| 52 | Mayores de 14 años. Durante las últimas dos semanas: | 5 | A | SI | Permite reportar varias opciones de respuesta. Los valores permit... |
| 53 | Para mayores de 14 años Como se ha sentido durante los últimos ocho días | 1 | N | SI | Variable de respuesta única. Valida como sea sentido la persona e... |
| 54 | Identifica riesgos para su salud física o mental | 50 | A | SI | Es una variable de opción múltiple. Identifica riesgos físicos o ... |
| 55 | ¿Situación de salud que limite sus actividades en la última semana? | 1 | N | SI | Es una variable de respuesta única. Valida si hay limitaciones en... |
| 56 | Tiene diagnóstico | 1 | N | SI | Es una variable de respuesta única y responde a la pregunta. Vali... |
| 57 | Tiene signos y síntomas compatibles sin diagnóstico | 1 | N | SI | Es una variable de respuesta única y responde a la pregunta. Vali... |
| 58 | ¿Presenta alguna condición de salud transmisible? | 32 | A | SI | Permite reportar varias opciones de respuesta. Los valores permit... |
| 59 | ¿Tiene alguna enfermedad no transmisible? | 35 | A | SI | Permite reportar varias opciones de respuesta. Los valores permit... |
| 60 | ¿Vive en zona endémica o presenta signos/síntomas? | 1 | N | SI | Es una variable de respuesta única. Los valores permitidos se enc... |
| 61 | Recibe atención y tratamiento actual | 1 | N | SI | Es una variable de respuesta única. Valida si se identificó algun... |
| 62 | Motivo(s) por el (los) cuales(es) no ha recibido la atención. | 32 | A | SI | Permite reportar varias opciones de respuesta. Los valores permit... |
| 63 | Mayores de 14 años. ¿Consume alguna sustancia psicoactiva? | 1 | N | SI | Es una variable de respuesta única. Los valores permitidos se enc... |
| 64 | ¿Consume tabaco? | 1 | N | SI | Es una variable de respuesta única. Identifica quienes son o fuer... |
| 65 | Consumo máximo de cigarrillos diario | 2 | N | NO | Es una variable de respuesta única. Valida la cantidad máxima del... |
| 66 | Años fumando | 2 | N | NO | Es una variable de respuesta única. Cuantos años duro la persona ... |
| 67 | Puntaje riesgo ASSIST | 2 | N | NO | Es una variable de respuesta única. Registra el valor de la prueb... |
| 68 | Puntaje riesgo AUDIT | 2 | N | NO | Es una variable de respuesta única. Registra el valor de la prueb... |
| 69 | Puntaje riesgo Carlos CRAFFT | 2 | N | NO | Es una variable de respuesta única. Registra el valor de la prueb... |
| 70 | Fecha de la última menstruación (FUM) | 10 | F | NO | En formato AAAA-MM-DD. Debe corresponder a la fecha de la última ... |
| 71 | Mujer en edad fértil | 1 | N | NO | Es una variable de respuesta única. Los valores permitidos se enc... |
| 72 | ¿Se encuentra en embarazo? | 1 | N | NO | Es una variable de respuesta única. Los valores permitidos se enc... |
| 73 | ¿Conoce los signos de alarma en el embarazo? | 1 | N | NO | Es una variable de respuesta única. Los valores permitidos se enc... |
| 74 | ¿Conoce sobre Interrupción Voluntaria del Embarazo? | 1 | N | NO | Es una variable de respuesta única. Los valores permitidos se enc... |
| 75 | ¿Inició atenciones prenatales? | 1 | N | NO | Es una variable de respuesta única. Los valores permitidos se enc... |
| 76 | ¿Inició oportunamente la atención prenatal? | 1 | N | NO | Es una variable de respuesta única. Los valores permitidos se enc... |
| 77 | ¿Tiene acceso a métodos anticonceptivos postparto? | 1 | N | NO | Es una variable de respuesta única. Los valores permitidos se enc... |
| 78 | Clasificación del riesgo gestacional | 1 | N | NO | Es una variable de respuesta única. Identifica la clasificación d... |
| 79 | Clasificación del riesgo de preeclampsia | 1 | N | NO | Es una variable de respuesta única. Identifica cual s la clasific... |
| 80 | Número de atenciones prenatales | 2 | N | NO | Número de atenciones prenatales que ha tenido hasta el momento... |
| 81 | Atención para el cuidado preconcepcional | 1 | N | NO | Es una variable de respuesta única. Valida si hay atención para e... |
| 82 | Atención para el cuidado prenatal – Controles prenatales | 1 | N | NO | Es una variable de respuesta única. Valida si hay atención para e... |
| 83 | Preparación para la maternidad y paternidad | 2 | N | NO | Número de sesiones de preparación para la maternidad y paternidad... |
| 84 | Fecha de atención del evento obstétrico | 10 | F | NO | En formato AAAA-MM-DD. Debe corresponder a la posible fecha de at... |
| 85 | Atención del puerperio en las primeras 48 horas | 1 | N | NO | Es una variable de respuesta única. Los valores permitidos se enc... |
| 86 | Consulta de seguimiento al puerperio entre el tercer y quinto día post parto | 1 | N | NO | Es una variable de respuesta única. Los valores permitidos se enc... |
| 87 | Apoyo a la lactancia materna | 1 | N | NO | Es una variable de respuesta única. Los valores permitidos se enc... |
| 88 | Atención durante las primeras 24 horas de vida al recién nacido | 1 | N | NO | Es una variable de respuesta única. Los valores permitidos se enc... |
| 89 | Control entre 3 y 5 días recién nacido | 1 | N | NO | Es una variable de respuesta única. Los valores permitidos se enc... |
| 90 | Vacunación del recién nacido | 1 | N | NO | Es una variable de respuesta única. Los valores permitidos se enc... |
| 91 | Provisión del método anticonceptivo post parto inmediato | 2 | N | NO | Es una variable de respuesta única. Identifica el tipo de método ... |
| 92 | ¿Cuenta con historial laboral? | 1 | N | NO | Es una variable de respuesta única. Los valores permitidos se enc... |
| 93 | Lugar de trabajo / Actividad específica (más reciente) | 200 | T | NO | Identifica el nombre del lugar del trabajo o Actividad especifica... |
| 94 | Nombre del Empleador | 200 | T | NO | Identifica el nombre del empleador cuando identifica el lugar del... |
| 95 | Periodo laboral (meses) | 2 | N | NO | Numero de meses que estuvo realizando la actividad laboral regist... |
| 96 | ¿Cuenta con más empleos previos al actual? | 1 | N | NO | Es una variable de respuesta única. Los valores permitidos se enc... |
| 97 | Lugar de trabajo / Actividad específica | 200 | T | NO | Identifica el nombre del lugar del trabajo o Actividad especifica... |
| 98 | Nombre del Empleador | 200 | T | NO | Identifica el nombre del empleador cuando identifica el lugar del... |
| 99 | Periodo laboral (meses) | 2 | N | NO | Numero de meses que estuvo realizando la actividad laboral regist... |
| 100 | Lugar de trabajo / Actividad específica | 200 | T | NO | Identifica el nombre del lugar del trabajo o Actividad especifica... |
| 101 | Nombre del Empleador | 200 | T | NO | Identifica el nombre del empleador cuando identifica el lugar del... |
| 102 | Periodo laboral (meses) | 2 | N | NO | Numero de meses que estuvo realizando la actividad laboral regist... |
| 103 | En alguno de los trabajos desempeñados, ¿ha realizado alguna actividad que involucre asbesto? | 1 | N | NO | Es una variable de respuesta única. Identifica si en algún trabaj... |
| 104 | En alguno de los trabajos desempeñados, ¿ha realizado alguna actividad relacionada con asbesto? | 1 | N | NO | Es una variable de respuesta única. Valida si en el trabajo la pe... |
| 105 | ¿Cuáles son las actividades realizadas relacionada con asbesto? | 135 | A | NO | Variable de múltiple respuesta. Identifica cuales de las siguient... |
| 106 | ¿Ha interactuado con materiales que tengan asbesto? | 1 | N | NO | Es una variable de respuesta única. Identifica si la persona ha i... |
| 107 | ¿Cuáles son los materiales con los que interactuó con presencia de asbesto? | 5 | A | NO | Variable de múltiple respuesta. Se habilita bajo la opción 1 de l... |
| 108 | ¿En qué modalidad de empleo se presentó mayormente la exposición? | 1 | N | NO | Es una variable de respuesta única. Identifica cual es la modalid... |
| 109 | En su hogar, ¿ha tenido alguna vez materiales que contengan asbesto? | 1 | N | NO | Es una variable de respuesta única. Identifica si en el hogar ha ... |
| 110 | ¿Cuáles son los elementos del hogar que tiene presencia de asbesto? | 20 | A | NO | Variable de múltiple respuesta. Se habilita bajo la opción 1 de l... |
| 111 | ¿En qué estado se encuentran los materiales que contienen asbesto en la vivienda? | 1 | N | NO | Es una variable de respuesta única. Valida cual es el estado en e... |
| 112 | En su hogar, ¿convive con alguien que haya trabajado con asbesto? | 1 | N | NO | Es una variable de respuesta única. Identifica si en la vivienda ... |
| 113 | ¿Ha realizado en su vivienda reparaciones con materiales que contengan asbesto? | 1 | N | NO | Es una variable de respuesta única. Identifica si en el hogar se ... |
| 114 | ¿Recuerda alguna actividad que haya implicado asbesto cerca de su hogar? | 1 | N | NO | Es una variable de respuesta única. Valida si la persona recuerda... |
| 115 | ¿Cuáles son las actividades que implicaron presencia de asbesto cerca de su hogar? | 1 | N | NO | Es una variable de respuesta única. Identifica cuales fueron las ... |
| 116 | ¿Ha tenido familiares con enfermedades relacionadas con asbesto? | 1 | N | NO | Es una variable de respuesta única. Valida si la persona ha tenid... |
| 117 | Número de Identificación de la Familia | 31 | A | SI | Corresponde al número de identificación de la familia en el campo... |
| 118 | Número de identificación único del integrante de la familia | 53 | A | SI | Corresponde a la concatenación de las variables 118 (Número de id... |

### 4.2. Especificaciones Campo por Campo – Tipo 3

#### Campo 0: Tipo de registro
- **Longitud Máxima:** `1`
- **Tipo de Dato:** `N`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
3: valor que significa que el registro es de detalle de la información
de Identificación de cada uno de los integrantes y situaciones o
condiciones de salud.

#### Campo 1: Consecutivo de registro
- **Longitud Máxima:** `10`
- **Tipo de Dato:** `N`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
Número consecutivo de registros de detalle dentro del archivo.
Inicia en 1 para el primer registro de integrante de la familia y va
incrementando de 1 en 1.

#### Campo 2: Primer Nombre
- **Longitud Máxima:** `60`
- **Tipo de Dato:** `T`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
Valor tipo texto

#### Campo 3: Segundo Nombre
- **Longitud Máxima:** `60`
- **Tipo de Dato:** `T`
- **Requerido:** `NO`
- **Descripción, Valores Permitidos y Reglas:**
Valor tipo texto

#### Campo 4: Primer Apellido
- **Longitud Máxima:** `60`
- **Tipo de Dato:** `T`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
Valor tipo texto

#### Campo 5: Segundo Apellido
- **Longitud Máxima:** `60`
- **Tipo de Dato:** `T`
- **Requerido:** `NO`
- **Descripción, Valores Permitidos y Reglas:**
Valor tipo texto

#### Campo 6: Tipo de identificación
- **Longitud Máxima:** `2`
- **Tipo de Dato:** `A`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
Corresponde al tipo de documento de identificación del integrante
de la familia. Los tipos de identificación permitidos se encuentran
en la tabla de referencia TipoIDAfiliado, disponible en
https://web.sispro.gov.co/

#### Campo 7: Número de identificación
- **Longitud Máxima:** `20`
- **Tipo de Dato:** `A`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
Corresponde al número de documento de identificación del
integrante de la familia. No se permiten puntos, comas o guiones

#### Campo 8: Fecha de Nacimiento
- **Longitud Máxima:** `10`
- **Tipo de Dato:** `F`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
En formato AAAA-MM-DD. Corresponde a la fecha de nacimiento
del integrante de la familia.
Ejemplo fecha valida: 2000-04-11

#### Campo 9: País de origen
- **Longitud Máxima:** `3`
- **Tipo de Dato:** `N`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
Es una variable de respuesta única. Corresponde al país de origen
del integrante de la familia. Los valores permitidos se encuentran
en la columna Codigo de la tabla de referencia Pais, disponible en
https://web.sispro.gov.co/
Ejemplo: 004 (Hace referencia a AFGANISTÁN).

#### Campo 10: Estatus Migratorio
- **Longitud Máxima:** `1`
- **Tipo de Dato:** `N`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
Es una variable de respuesta única. Corresponde al estatus
migratorio del integrante de la familia. Los valores permitidos son:
Valores permitidos:
Código Descripción
1 Regular
2 Sin autorización de permanencia
3 No aplica
Ejemplo: 1

#### Campo 11: Sexo al nacer
- **Longitud Máxima:** `1`
- **Tipo de Dato:** `N`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
Es una variable de respuesta única. Los valores permitidos se
encuentran en la tabla de referencia Sexo, variable Extra I,
_
disponible en: https://web.sispro.gov.co/
Valores permitidos:
Código Descripción
1 Hombre
2 Mujer
3 Indeterminado
Ejemplo: 2

#### Campo 12: Género
- **Longitud Máxima:** `1`
- **Tipo de Dato:** `N`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
Es una variable de respuesta única. Indica el género de la persona
Valores permitidos:
Código Descripción
1 Femenino
2 Masculino
Ejemplo: 1

#### Campo 13: ¿Genero qué se identifica la persona?
- **Longitud Máxima:** `1`
- **Tipo de Dato:** `N`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
Es una variable de respuesta única. Indica como se identifica la
persona.
Valores permitidos:
Código Descripción
1 Femenino
2 Masculino
3 Transexual
4 Transgénero
5 No responde
6 Otro
Ejemplo: 5

#### Campo 14: ¿Cuál es la orientación sexual?
- **Longitud Máxima:** `1`
- **Tipo de Dato:** `N`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
Es una variable de respuesta única. Valida como se identifica la
persona.
Valores permitidos:
Código Descripción
1 Heterosexual
2 Lesbiana
3 Gay
4 Bisexual
5 No responde
6 Otro
Ejemplo: 5

#### Campo 15: Teléfono principal
- **Longitud Máxima:** `20`
- **Tipo de Dato:** `N`
- **Requerido:** `NO`
- **Descripción, Valores Permitidos y Reglas:**
Corresponde al teléfono principal del integrante de la familia. Este
campo solo permite entre 10 y 20 números.

#### Campo 16: Teléfono secundario
- **Longitud Máxima:** `20`
- **Tipo de Dato:** `N`
- **Requerido:** `NO`
- **Descripción, Valores Permitidos y Reglas:**
Corresponde al teléfono secundario del integrante de la familia.
Este campo solo permite entre 10 y 20 números.

#### Campo 17: Rol dentro de la familia
- **Longitud Máxima:** `1`
- **Tipo de Dato:** `N`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
Es una variable de respuesta única.
Los valores permitidos se encuentran en la tabla de referencia
APSRolFamilia disponible en: https://web.sispro.gov.co/
Valores permitidos:
Código Descripción
1 Responsable económico de la familia
2 Cónyuge o compañero(a)
3 Hijo(a)
4 Hermano(a)
5 Padre o madre
6 Otros
Ejemplo: 5

#### Campo 18: Ocupación
- **Longitud Máxima:** `4`
- **Tipo de Dato:** `N`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
Es una variable de respuesta única. Los valores permitidos se
encuentran en la tabla de referencia Registro SGDCIUO, disponible
en: https://web.sispro.gov.co/
NOTA: Para el caso de las personas desempleadas o amas de
casa o con dedicación al hogar utilizar el código 9998 que hace
parte de la tabla de referencia.

#### Campo 19: Nivel Educativo
- **Longitud Máxima:** `2`
- **Tipo de Dato:** `N`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
Es una variable de respuesta única. Los valores permitidos se
encuentran en la tabla de referencia SGDNivEducativo, disponible
en https://web.sispro.gov.co/
Valores permitidos:
Código Descripción
1 Preescolar
2 Básica Primaria
3 Básica Secundaria
4 Media Académica o Clásica
5 Media Técnica (Bachillerato Técnico)
6 Normalista
7 Técnica Profesional
8 Tecnológica
9 Profesional Especialización
10 Especialización
11 Maestría
12 Doctorado
13 Ninguno
Ejemplo: 6

#### Campo 20: Régimen de afiliación
- **Longitud Máxima:** `1`
- **Tipo de Dato:** `N`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
Es una variable de respuesta única. Los valores permitidos se
encuentran en la tabla de referencia APSRegimenAfiliacion
disponible en: https://web.sispro.gov.co/.
Valores permitidos:
Código Descripción
1 Subsidiado
2 Contributivo
3 Especial
4 Excepción
5 No afiliado
Ejemplo: 5

#### Campo 21: EAPB
- **Longitud Máxima:** `8`
- **Tipo de Dato:** `N`
- **Requerido:** `NO`
- **Descripción, Valores Permitidos y Reglas:**
Corresponde a la Entidad Administradora de Planes de Beneficios.
Es una variable de respuesta única.
Los valores permitidos se encuentran disponibles en el campo
código de la tabla de referencia SGDCodigoEAPB, disponible en
https://web.sispro.gov.co/
Aplica si en la variable 20 el régimen de afiliación es diferente a “No
afiliado”.

#### Campo 22: ¿Es sujeto de protección constitucional o tiene alguna condición especial?
- **Longitud Máxima:** `32`
- **Tipo de Dato:** `A`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
Permite reportar varias opciones de respuesta
Los valores permitidos se encuentran en la tabla de referencia
APSGrupoPoblacionEspecial, disponible en:
https://web.sispro.gov.co/
Valores permitidos:
Código Descripción
1 Niñas, niños y adolescentes
2 Gestantes
3 Persona adulta mayor
4 Personas con orientación sexual diversa
5 Campesina o campesino
6 Migrantes
7 Madre cabeza de familia
8 Personas con enfermedades huérfanas
9 Víctima del conflicto armado
10 Víctima de violencia interpersonal
11 Persona privada de la libertad (medida domiciliaria)
Personas en el sistema de responsabilidad penal
12 adolescente
13 Ninguna
14 Persona con condición de discapacidad
15 Otro
Nota. Como es una respuesta de opción múltiple, se deberán
registrar los números correspondientes a las opciones
seleccionadas, separados por coma (,)
Ejemplo de respuesta válida: 2,4

#### Campo 23: Modalidad Violencia
- **Longitud Máxima:** `200`
- **Tipo de Dato:** `T`
- **Requerido:** `NO`
- **Descripción, Valores Permitidos y Reglas:**
Es una variable de respuesta única.
Se habilita cuando se escoge la opción 10 Víctima de violencia
interpersonal de la variable 22
Valores permitidos
Código Descripción
1 Física
2 Psicológica
3 Negligencia y abandono
4 Sexual
5 Patrimonial o económica
Ejemplo de respuesta válida: 2

#### Campo 24: Pertenencia étnica
- **Longitud Máxima:** `2`
- **Tipo de Dato:** `A`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
Es una variable de respuesta única. Los valores permitidos se
encuentran en la tabla de referencia MDECEtnia,
disponible en: https://web.sispro.gov.co/
Valores permitidos:
Código Descripción
01 Indígena
02 ROM (Gitanos)
03 Raizal (San Andrés y Providencia)
04 Palenquero de San Basilio de Palenque
05 Negro(a)
06 Afrocolombiano
07 Ninguna de las anteriores.
Ejemplo: 05.
Si la opción seleccionada es 01. Indígena, diligencia la variable 22.

#### Campo 25: ¿A qué pueblo o comunidad étnica pertenece?
- **Longitud Máxima:** `60`
- **Tipo de Dato:** `T`
- **Requerido:** `NO`
- **Descripción, Valores Permitidos y Reglas:**
Variable de texto. Indica el nombre de la comunidad que pertenece
a excepción de seleccionar la opción 07 en la variable 24

#### Campo 26: Prácticas de cuidado de la salud desde sus saberes ancestrales/tradicionales
- **Longitud Máxima:** `11`
- **Tipo de Dato:** `A`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
Permite reportar varias opciones de respuesta. Los valores
permitidos se encuentran en la tabla de referencia
APSPracticaSaberAncestral, disponible en:
https://web.sispro.gov.co/.
Valores permitidos:
Código Descripción
1 Prácticas para proteger ante posibles daños
(aseguranzas, rituales u otros)
2 Prácticas que acompañan en momentos de
transición (arrullos o cantos, rituales de paso u
otros)
3 Prácticas tradicionales para el cuidado de la salud
(baile o danza, música, uso de plantas, masajes u
otros)
4 Prácticas de armonización o para favorecer el
bienestar (rituales, consejería del sabedor/a,
pagamentos)
5 Acompañamiento de partera, sabedor o médico
tradicional en los procesos de salud enfermedad.
6 Prácticas de cuidado con el entorno, con los
alimentos u otros
7 Ninguna
Nota. Como es una respuesta de opción múltiple, se deberán
registrar los números correspondientes a las opciones
seleccionadas, separados por coma (,).
Ejemplo de respuesta válida: 2,3,5

#### Campo 27: Prácticas para el ejercicio y exigibilidad del derecho a la salud
- **Longitud Máxima:** `7`
- **Tipo de Dato:** `A`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
Permite reportar varias opciones de respuesta. Los valores
permitidos se encuentran en la tabla de referencia
APSPracticasDerechoSalud, disponible en:
https://web.sispro.gov.co/.
Valores permitidos:
Código Descripción
1 Conoce los derechos y deberes en salud
2 Tiene información sobre las atenciones y servicios
de salud a los cuales tiene derecho (Promoción,
prevención, atención, rehabilitación).
3 Conoce los lugares donde pueden prestar los
servicios de salud.
4 Conoce como resolver las dificultades que se le
presentan para acceder a la atención en salud.
5 No registra
6 Ninguna
Nota. Como es una respuesta de opción múltiple, se deberán
registrar los números correspondientes a las opciones
seleccionadas, separados por coma (,).
Ejemplo de respuesta válida: 2,3.

#### Campo 28: ¿Realiza rutinariamente las siguientes prácticas para el cuidado y salud?
- **Longitud Máxima:** `15`
- **Tipo de Dato:** `A`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
Permite reportar varias opciones de respuesta. Los valores
permitidos se encuentran en la tabla de referencia
APSPracticasCuidadoSalud, disponible en:
https://web.sispro.gov.co/
Valores permitidos:
Código Descripción
1 Consume alimentos en cantidad y calidad
suficiente todos los días.
2 Realiza actividad física, ejercicio o actividad
deportiva
3 Higiene oral diaria (cepillado mínimo 2 veces al día)
4 Lavado de manos antes de consumir alimentos o
después de entrar al baño, cambiar pañales, tener
contacto con animales, retirar secreciones nasales,
llegar de la calle, manipular sustancias químicas
5 Duerme lo suficiente para estar con energía
durante todo el día (entre 6 a 8 horas diarias)
6 Controla el tiempo de exposición a televisión,
videojuegos y celular (menos de 2 horas al día)
7 Realiza actividades en el tiempo libre o de ocio
8 Participa en actividades culturales, sociales,
alternativas o complementarias que aportan al
cuidado de la salud
9 Ninguna
Nota. Como es una respuesta de opción múltiple, se deberán
registrar los números correspondientes a las opciones
seleccionadas, separados por coma (,).
Ejemplo de respuesta válida: 1,3,7

#### Campo 29: Atenciones pendientes de promoción y mantenimiento
- **Longitud Máxima:** `81`
- **Tipo de Dato:** `A`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
Permite reportar varias opciones de respuesta. Valida cuales son
las atenciones pendientes de promoción y mantenimiento
Es una variable de respuesta única. Los valores permitidos se
encuentran en la tabla de referencia APSIntervencionPendiente,
disponible en: https://web.sispro.gov.co/.
Valores permitidos:
Código Descripción
1 Valoración Integral para la PYMS
Valoración integral en salud bucal por profesional
2
en odontología para la PYMS
3 Promoción y apoyo a lactancia materna
4 Aplicación de flúor
5 Profilaxis y remoción de placa bacteriana
6 Vacunación de acuerdo con el esquema
7 Fortificación casera con micronutrientes en polvo
8 Suplementación con micronutrientes
9 Desparasitación intestinal antihelmíntica
Tamizaje para anemia - Hemoglobina y hematocrito
10
(mujeres)
11 Asesoría en anticoncepción (planificación familiar)
12 Tamizaje de riesgo cardiovascular
13 Tamizaje para ITS
Tamizaje para cáncer de cuello uterino (mujeres de
14
20 a 28 años)
15 Tamizaje para cáncer de mama
16 Tamizaje para cáncer de próstata
17 Tamizaje para cáncer de colon y recto
18 Ninguno
Suministro de anticonceptivos (número de
19
unidades según lo definido en lineamiento)
20 Prueba rápida treponémica
21 Prueba rápida y asesoría pre y postest VIH
Prueba rápida para Hepatitis B (18 a 28 años) y C
22
(22 a 28 años)
Prueba de embarazo en caso de retraso menstrual
23
u otros síntomas o signos de sospecha
24 Colposcopia y biopsia cérvico uterina (Mujeres)
25 Educación para la salud
26 Atención para el cuidado preconcepcional

#### Campo 30: ¿Es persona con discapacidad?
- **Longitud Máxima:** `13`
- **Tipo de Dato:** `A`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
Corresponde al reconocimiento de alguna discapacidad -
Categorías del Registro para la Localización y Caracterización de
Personas con Discapacidad – RLCPD. Permite reportar varias
opciones de respuesta.
Los valores permitidos se encuentran en la tabla de referencia
CategoriaDiscapacidad, disponible en: https://web.sispro.gov.co/
Valores permitidos:
Código Descripción
1 Física
2 Auditiva
3 Visual
4 Sordoceguera
5 Intelectual
6 Psicosocial (mental)
7 Múltiple
8 Sin discapacidad
Nota. Como es una respuesta de opción múltiple, se deberán
registrar los números correspondientes a las opciones
seleccionadas, separados por coma (,).
Ejemplo de respuesta válida: 1,3,7

#### Campo 31: Tiene certificación y registro de discapacidad (RLCPD)
- **Longitud Máxima:** `1`
- **Tipo de Dato:** `N`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
Es una variable de respuesta única. Valida si la persona tiene
certificación y registro de discapacidad.
Valores permitidos:
Código Descripción
1 SI
2 NO
3 NO APLICA
Ejemplo: 2

#### Campo 32: Intención reproductiva a corto plazo
- **Longitud Máxima:** `1`
- **Tipo de Dato:** `N`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
Es una variable de respuesta única y responde a la pregunta ¿La
persona tiene intención de tener hijos ahora en el futuro?
Los valores permitidos se encuentran en la tabla de referencia
LstSINO, variable Extra I, disponible en: https://web.sispro.gov.co/
_
Valores permitidos:
Código Descripción
1 SI
2 NO
Ejemplo: 1

#### Campo 33: Gestación actual confirmada
- **Longitud Máxima:** `1`
- **Tipo de Dato:** `N`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
Es una variable de respuesta única y responde a la pregunta.
Valida si la mujer está en estado de gestación actual confirmada.
Los valores permitidos se encuentran en la tabla de referencia
LstSINO, variable Extra I, disponible en: https://web.sispro.gov.co/
_
Valores permitidos:
Código Descripción
1 SI
2 NO
Ejemplo: 1

#### Campo 34: Atenciones pendientes de la ruta materno perinatal
- **Longitud Máxima:** `15`
- **Tipo de Dato:** `A`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
Permite reportar varias opciones de respuesta. Los valores
permitidos se encuentran en la tabla de referencia
APSAtencionesPendientesRutaMaternoPerinatal, disponible en:
https://web.sispro.gov.co/
Valores permitidos:
Código Descripción
1 Atención para el cuidado preconcepcional
2 Interrupción Voluntaria del Embarazo – IVE
Atención para el cuidado prenatal – Controles
3 prenatales.
4 Preparación para la maternidad y paternidad
5 Atención del puerperio
Provisión del método anticonceptivo post parto
6 inmediato
7 Atención para el seguimiento del recién nacido
8 Educación para la salud
9 No aplica
10 Ninguna
Nota. Como es una respuesta de opción múltiple, se deberán
registrar los números correspondientes a las opciones
seleccionadas, separados por coma (,).
Ejemplo de respuesta válida: 1,3,5

#### Campo 35: Motivo por el cual no ha recibido las atenciones de promoción y mantenimiento de la salud o materno perinatal
- **Longitud Máxima:** `32`
- **Tipo de Dato:** `A`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
Permite reportar varias opciones de respuesta
Los valores permitidos se encuentran en la tabla de referencia
APSMotivoNoAtencionSalud, disponible en:
https://web.sispro.gov.co/
Valores permitidos:
Código Descripción
1 No afiliado
Desconocimiento del derecho a las
2 intervenciones
Desconocimiento que las intervenciones son
3 gratuitas
El servicio de salud está lejos del lugar de
4 residencia
No hay personal de salud en el centro de
5 salud cercano
6 Dificultades con trámites administrativos
7 No hay agenda para esta atención
8 No sabe cómo solicitar la cita
9 Horarios de atención restringidos
10 Largos tiempos de espera
No se siente cómodo(a) con el personal de
11 salud
Persona enferma que no puede acudir al
12 servicio
13 Falta de tiempo del cuidador
14 Falta de adecuación sociocultural del servicio.
15 Ninguna
Nota. Como es una respuesta de opción múltiple, se deberán
registrar los números correspondientes a las opciones
seleccionadas, separados por coma (,).
Ejemplo de respuesta válida: 3,7,9

#### Campo 36: Menores de 6 meses ¿Recibe lactancia exclusiva?
- **Longitud Máxima:** `1`
- **Tipo de Dato:** `N`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
Es una variable de respuesta única. Aplica solo si es menor de 6
meses.
Valores permitidos:
Código Descripción
1 SI
2 NO
3 NO APLICA
Ejemplo: 2

#### Campo 37: Peso (en kilogramos)
- **Longitud Máxima:** `5`
- **Tipo de Dato:** `D`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
Número decimal de 3 enteros y 1 decimal

#### Campo 38: Talla (en centímetros)
- **Longitud Máxima:** `5`
- **Tipo de Dato:** `D`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
Número decimal de 3 enteros y 1 decimal

#### Campo 39: Mayores de 5 años. Resultado del IMC
- **Longitud Máxima:** `4`
- **Tipo de Dato:** `D`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
Número decimal de 2 enteros y 1 decimal

#### Campo 40: Mayores de 18 años. Circunferencia de cintura (cm)
- **Longitud Máxima:** `3`
- **Tipo de Dato:** `N`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
Circunferencia de cintura (en centímetros). Solo personas mayores
de 18 años.

#### Campo 41: Hay signos físicos de desnutrición aguda en niños/as de 3 meses a 5 años
- **Longitud Máxima:** `13`
- **Tipo de Dato:** `A`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
Permite reportar varias opciones de respuesta. Los valores
permitidos se encuentran en la tabla de referencia
APSSignoDesnutricion, disponible en: https://web.sispro.gov.co/
Valores permitidos:
Código Descripción
1 Cabeza
2 Cara
3 Piel
4 Tórax y abdomen
5 Extremidades
6 Comportamiento
7 Edema
8 Ninguna
9 No aplica
Nota. Como es una respuesta de opción múltiple, se deberán
registrar los números correspondientes a las opciones
seleccionadas, separados por coma (,).
Ejemplo de respuesta válida: 3,7,9

#### Campo 42: Clasificación antropométrica del estado nutricional según Peso para la Talla (P/T) o IMC para la edad (tener en cuenta el grupo de edad o si es gestante)
- **Longitud Máxima:** `2`
- **Tipo de Dato:** `N`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
Es una variable de respuesta única. Los valores permitidos se
encuentran en la tabla de referencia APSDiagnosticoNutricion
disponible en: https://web.sispro.gov.co/.
Valores permitidos:
Código Descripción
1 Obesidad
2 Sobrepeso
3 Riesgo de sobrepeso
4 Peso adecuado para la talla o IMC adecuado
para la edad
5 Riesgo de desnutrición aguda (en < 5 años) o
riesgo de delgadez (en > de 4 años) o bajo
peso para la edad gestacional o delgadez (en
mayores de 17 años)
6 Desnutrición aguda moderada
7 Desnutrición aguda severa
8 Riesgo de delgadez
9 Delgadez
10 Bajo peso para la edad gestacional
11 Normal
Ejemplo: 7

#### Campo 43: ¿Se lava las manos con agua y jabón?
- **Longitud Máxima:** `1`
- **Tipo de Dato:** `N`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
Es una variable de respuesta única y responde a la pregunta.
Valida si se lava las manos. Los valores permitidos se encuentran
en la tabla de referencia LstSINO, variable Extra I, disponible en:
_
https://web.sispro.gov.co/
Valores permitidos:
Código Descripción
1 SI
2 NO
Ejemplo: 1

#### Campo 44: Tensión arterial (Sistólica)
- **Longitud Máxima:** `3`
- **Tipo de Dato:** `N`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
Campo numérico. Se diligencia si la persona es mayor de 18 años.

#### Campo 45: Tensión arterial (Diastólica)
- **Longitud Máxima:** `3`
- **Tipo de Dato:** `N`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
Campo numérico. Se diligencia si la persona es mayor de 18 años.

#### Campo 46: Clasificación Tensión arterial
- **Longitud Máxima:** `1`
- **Tipo de Dato:** `N`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
Es una variable de respuesta única. Los valores permitidos se
encuentran en la tabla de referencia APSTensionArterial
disponible en: https://web.sispro.gov.co
Valores permitidos:
Código Descripción
Crisis hipertensiva (sistólica más alta de 180 mm
1
Hg y/o diastólica más alta de 120 mm Hg)
Alta - Hipertensión nivel 2. (sistólica 140 mm Hg o
2
más alta o diastólica 90 o más alta 90 mm Hg)
Alta - Hipertensión nivel 1 (sistólica de 130 a 139
3
mm Hg o diastólica 80 a 89 mm Hg)
Elevada (sistólica de 120 a 129 mm Hg y diastólica
4
menos de 80 mm Hg)
Normal (sistólica menos de 120 mm Hg y diastólica
5
menos de 80 mm Hg)
6 No aplica
Ejemplo: 5

#### Campo 47: Alguien de la familia acudió a urgencias
- **Longitud Máxima:** `20`
- **Tipo de Dato:** `A`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
Es una variable de respuesta única. Identifica si alguien de la
familia asistió a urgencias por algún accidente en el hogar.
Los valores permitidos se encuentran en la tabla de referencia
APSCausasUrgenciasFamilia disponible en:
https://web.sispro.gov.co
Valores permitidos:
Código Descripción
1 Heridas por objetos cortopunzantes
2 Intoxicación
3 Quemadura
4 Electrocución
5 Asfixia respiratoria
6 Golpes y atrapamientos
7 Caída
8 Ahogamientos o sumersiones
9 Agresión animal
10 Caída de alturas
11 No aplica
Nota. Como es una respuesta de opción múltiple, se deberán
registrar los números correspondientes a las opciones
seleccionadas, separados por coma (,).
Ejemplo de respuesta válida: 1,3,5

#### Campo 48: Enfermedades sufridas en el último mes
- **Longitud Máxima:** `47`
- **Tipo de Dato:** `A`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
Es una variable de respuesta única. Identifica si sufrió alguna
enfermedad en el último mes.
Los valores permitidos se encuentran en la tabla de referencia
APSEnfermedadesUltimoMes disponible en:
https://web.sispro.gov.co
Valores permitidos:
Código Descripción
1 Diarrea o soltura de estómago
2 Tos, congestión y presencia de resfriado
3 Infección pulmonar
4 Intoxicación por sustancias químicas
5 Problemas de piel / alergias
6 Accidente en el hogar
7 Lesiones por artefactos explosivos
8 Siniestro vial
9 Cáncer
10 HTA
11 Diabetes
12 Obesidad
13 Enfermedad renal crónica
14 EPOC
15 Asma
16 Enfermedades huérfanas
17 Enfermedades bucales (caries, enfermedad
periodontal)
18 Enfermedades visuales y auditivas
19 Otra
Nota. Como es una respuesta de opción múltiple, se deberán
registrar los números correspondientes a las opciones
seleccionadas, separados por coma (,).
Ejemplo de respuesta válida: 1,3,5

#### Campo 49: Otras enfermedades sufridas en el último mes
- **Longitud Máxima:** `200`
- **Tipo de Dato:** `T`
- **Requerido:** `NO`
- **Descripción, Valores Permitidos y Reglas:**
Variable de texto. Otras enfermedades que sufrió la persona en el
último mes. Se habilita bajo la opción 19 de la variable 47

#### Campo 50: Que hizo si la persona presento alguna afección el último mes
- **Longitud Máxima:** `1`
- **Tipo de Dato:** `N`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
Es una variable de respuesta única. Valida que acciones tomó la
persona en caso de presentar afecciones en el último mes.
Los valores permitidos se encuentran en la tabla de referencia
APSAccionEnfermedadesUltimoMes disponible en:
https://web.sispro.gov.co
Valores permitidos:
Código Descripción
1 No acudió a ningún servicio de salud
2 Solicitó atención a través de la EPS y lo atendieron
3 Solicitó atención a través de la EPS y no lo
atendieron
4 Acudió a un servicio de salud particular pagado por
usted mismo
5 Acudió a algún tipo de atención alternativa
6 Acudió a la farmacia
7 Acudió a un curandero
8 Otro
Ejemplo: 5

#### Campo 51: Otras enfermedades sufridas en el último mes
- **Longitud Máxima:** `200`
- **Tipo de Dato:** `T`
- **Requerido:** `NO`
- **Descripción, Valores Permitidos y Reglas:**
Variable de texto. Otras acciones que tomó la persona en caso de
presentar afecciones en el último mes. Se habilita bajo la opción 8
en la variable 49

#### Campo 52: Mayores de 14 años. Durante las últimas dos semanas:
- **Longitud Máxima:** `5`
- **Tipo de Dato:** `A`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
Permite reportar varias opciones de respuesta. Los valores
permitidos se encuentran en la tabla de referencia
APSTrastornosAnimo disponible en: https://web.sispro.gov.co/.
Valores permitidos:
Código Descripción
1 Se ha sentido triste todos los días durante la
mayor parte del día
2 Ha perdido el interés en actividades que antes
disfrutaba
3 Se ha sentido inquieto(a) o nervioso(a) todos
los días durante la mayor parte del día
4 Ninguno
5 No aplica
Nota. Como es una respuesta de opción múltiple, se deberán
registrar los números correspondientes a las opciones
seleccionadas, separados por coma (,).
Ejemplo de respuesta válida: 1,3

#### Campo 53: Para mayores de 14 años Como se ha sentido durante los últimos ocho días
- **Longitud Máxima:** `1`
- **Tipo de Dato:** `N`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
Variable de respuesta única. Valida como sea sentido la persona
en los últimos 8 días. Aplica para personas mayores de 14 años.
Valores permitidos:
Código Descripción
1 Ha pensado en lastimarse o en no querer seguir
viviendo
2 Ninguno
3 No aplica
Ejemplo: 5

#### Campo 54: Identifica riesgos para su salud física o mental
- **Longitud Máxima:** `50`
- **Tipo de Dato:** `A`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
Es una variable de opción múltiple. Identifica riesgos físicos o
mentales que tiene el integrante de la familia.
Los valores permitidos se encuentran en la tabla de referencia
APSRiesgoFisicoMental disponible en: https://web.sispro.gov.co
Valores permitidos:
Código Descripción
1 Inicio de la convivencia en pareja
2 Llegada de un nuevo integrante
3 Ingreso a estudiar
4 Pérdida del año escolar
5 Embarazo temprano o adolescente
6 Independencia o salida del hogar paterno-materno
7 Separación de pareja
8 Jubilación
9 Duelo
10 Desempleo o pérdida abrupta del trabajo
11 Pérdidas o crisis económicas
12 Enfermedad terminal o huérfana/rara en alguno de
sus integrantes
13 Antecedentes de intento o muerte por suicidio en
alguno de sus integrantes
14 Accidente o situación que genera discapacidad
15 Muerte inesperada
16 Vivencia de alguna forma de violencia
17 Persona en situación de abandono
18 Migración
19 Consumo problemático de sustancias psicoactivas,
incluyendo alcohol
20 Trastorno de salud mental en algún integrante de la
familia
21 Ninguna
Nota. Como es una respuesta de opción múltiple, se deberán
registrar los números correspondientes a las opciones
seleccionadas, separados por coma (,).
Ejemplo de respuesta válida: 1,3,5

#### Campo 55: ¿Situación de salud que limite sus actividades en la última semana?
- **Longitud Máxima:** `1`
- **Tipo de Dato:** `N`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
Es una variable de respuesta única. Valida si hay limitaciones en
las actividades debido a situaciones de salud Los valores
permitidos se encuentran en la tabla de referencia LstSINO,
variable Extra I, disponible en: https://web.sispro.gov.co/
_
Valores permitidos:
Código Descripción
1 SI
2 NO
Ejemplo: 1

#### Campo 56: Tiene diagnóstico
- **Longitud Máxima:** `1`
- **Tipo de Dato:** `N`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
Es una variable de respuesta única y responde a la pregunta.
Valida si se lava las manos.
Los valores permitidos se encuentran en la tabla de referencia
LstSINO, variable Extra I, disponible en: https://web.sispro.gov.co/
_
Valores permitidos:
Código Descripción
1 SI
2 NO
Ejemplo: 1

#### Campo 57: Tiene signos y síntomas compatibles sin diagnóstico
- **Longitud Máxima:** `1`
- **Tipo de Dato:** `N`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
Es una variable de respuesta única y responde a la pregunta.
Valida si se lava las manos . Los valores permitidos se encuentran
en la tabla de referencia LstSINO, variable Extra I, disponible en:
_
https://web.sispro.gov.co/
Valores permitidos:
Código Descripción
1 SI
2 NO
Ejemplo: 1

#### Campo 58: ¿Presenta alguna condición de salud transmisible?
- **Longitud Máxima:** `32`
- **Tipo de Dato:** `A`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
Permite reportar varias opciones de respuesta.
Los valores permitidos se encuentran en la tabla de referencia
APSCondicionSalud disponible en: https://web.sispro.gov.co
Valores permitidos:
Código Descripción
1 Enfermedades prevalentes de la infancia
(Enfermedad Diarreica Aguda, Infección
Respiratoria Aguda)
2 Tuberculosis
3 Lepra
4 Rabia
5 Dengue
6 Chikungunya
7 Zika
8 Chagas
9 Leishmaniasis Visceral
10 Leishmaniasis Cutánea
11 Tungiasis
12 Enfermedades transmitidas por alimentos
(Cólera, hepatitis A, parasitosis intestinal)
13 Enfermedad respiratoria aguda (ERA)
14 Enfermedad diarreica aguda (EDA)
15 Ninguna
Nota. Como es una respuesta de opción múltiple, se deberán
registrar los números correspondientes a las opciones
seleccionadas, separados por coma (,).
Ejemplo de respuesta válida: 1,3,5

#### Campo 59: ¿Tiene alguna enfermedad no transmisible?
- **Longitud Máxima:** `35`
- **Tipo de Dato:** `A`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
Permite reportar varias opciones de respuesta.
Los valores permitidos se encuentran en la tabla de referencia
APSEnfermedadNoTrasmisible disponible en:
https://web.sispro.gov.co
Valores permitidos:
Código Descripción
1 Enfermedad obstétrica (trastornos hipertensivos,
hemorragias, sepsis, diabetes gestacional, otra)
2 Enfermedades cardiovasculares (Hipertensión,
enfermedad cardiaca)
3 Diabetes
4 Cáncer
5 EPOC, neumoconiosis (asbestosis, silicosis o
antracosis)
6 Enfermedades raras y huérfanas
7 Trastorno mental
8 Epilepsia
9 Secuelas de lesiones por causa externa (secuelas
de accidentes, agresiones físicas e intento de
suicidio)
10 Ninguna
11 Enfermedad de los pulmones
12 Enfermedades cerebrovasculares
13 Enfermedades osteoarticulares
14 Várices
15 Hipertensión arterial
16 Colesterol o triglicéridos altos
Nota. Como es una respuesta de opción múltiple, se deberán
registrar los números correspondientes a las opciones
seleccionadas, separados por coma (,).
Ejemplo de respuesta válida: 1,3,5

#### Campo 60: ¿Vive en zona endémica o presenta signos/síntomas?
- **Longitud Máxima:** `1`
- **Tipo de Dato:** `N`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
Es una variable de respuesta única. Los valores permitidos se
encuentran en la tabla de referencia
APSZonaEndemicaSignosSintomas disponible en:
https://web.sispro.gov.co/
Valores permitidos:
Código Descripción
1 Geohelmintiasis
2 Teniasis/cisticercosis
3 Tracoma
4 Escabiosis
5 Pian
6 Malaria
7 Ninguna
Ejemplo: 5

#### Campo 61: Recibe atención y tratamiento actual
- **Longitud Máxima:** `1`
- **Tipo de Dato:** `N`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
Es una variable de respuesta única. Valida si se identificó alguna
situación de salud y la persona recibe atención y tratamiento actual
Valores permitidos:
Código Descripción
1 SI
2 NO
3 NO APLICA
Ejemplo: 2

#### Campo 62: Motivo(s) por el (los) cuales(es) no ha recibido la atención.
- **Longitud Máxima:** `32`
- **Tipo de Dato:** `A`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
Permite reportar varias opciones de respuesta. Los valores
permitidos se encuentran en la tabla de referencia
APSMotivosNoAtencion disponible en: https://web.sispro.gov.co/.
Valores permitidos:
Código Descripción
1 Persona no afiliada
2 El servicio de salud está lejos del lugar de
residencia
3 Dificultades con trámites administrativos
4 “No hay agenda” para esta atención
5 No sabe cómo solicitar la cita
6 No puede pagar el copago
7 Horarios de atención restringidos
8 Largos tiempos de espera
9 No se siente cómodo(a) con el personal de
salud
10 Persona enferma que no puede acudir al
servicio
11 No tiene adherencia al tratamiento
12 No hay disponibilidad de medicamentos en el
centro de atención
13 Falta de tiempo del cuidador
14 Falta de adecuación sociocultural del servicio
15 No aplica
Nota. Como es una respuesta de opción múltiple, se deberán
registrar los números correspondientes a las opciones
seleccionadas, separados por coma (,).
Ejemplo de respuesta válida: 1,3,5

#### Campo 63: Mayores de 14 años. ¿Consume alguna sustancia psicoactiva?
- **Longitud Máxima:** `1`
- **Tipo de Dato:** `N`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
Es una variable de respuesta única. Los valores permitidos se
encuentran en la tabla de referencia LstSINO, variable Extra I,
_
disponible en: https://web.sispro.gov.co/
Valores permitidos:
Código Descripción
1 SI
2 NO
Ejemplo: 1

#### Campo 64: ¿Consume tabaco?
- **Longitud Máxima:** `1`
- **Tipo de Dato:** `N`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
Es una variable de respuesta única. Identifica quienes son o fueron
consumidores de tabaco
Valores permitidos:
Código Descripción
1 Fumador activo
2 Exfumador
3 No aplica
Ejemplo: 1

#### Campo 65: Consumo máximo de cigarrillos diario
- **Longitud Máxima:** `2`
- **Tipo de Dato:** `N`
- **Requerido:** `NO`
- **Descripción, Valores Permitidos y Reglas:**
Es una variable de respuesta única. Valida la cantidad máxima del
consumo de cigarrillos diarios en los últimos 15 años. Debe llenarse
bajo las opciones 1 y 2 de la variable 60
Ejemplo: 10

#### Campo 66: Años fumando
- **Longitud Máxima:** `2`
- **Tipo de Dato:** `N`
- **Requerido:** `NO`
- **Descripción, Valores Permitidos y Reglas:**
Es una variable de respuesta única. Cuantos años duro la persona
consumiendo tabaco. Debe llenarse bajo las opciones 1 y 2 de la
variable 60
Ejemplo: 10

#### Campo 67: Puntaje riesgo ASSIST
- **Longitud Máxima:** `2`
- **Tipo de Dato:** `N`
- **Requerido:** `NO`
- **Descripción, Valores Permitidos y Reglas:**
Es una variable de respuesta única. Registra el valor de la prueba
de ASSIST
Ejemplo: 10

#### Campo 68: Puntaje riesgo AUDIT
- **Longitud Máxima:** `2`
- **Tipo de Dato:** `N`
- **Requerido:** `NO`
- **Descripción, Valores Permitidos y Reglas:**
Es una variable de respuesta única. Registra el valor de la prueba
de AUDIT
Ejemplo: 10

#### Campo 69: Puntaje riesgo Carlos CRAFFT
- **Longitud Máxima:** `2`
- **Tipo de Dato:** `N`
- **Requerido:** `NO`
- **Descripción, Valores Permitidos y Reglas:**
Es una variable de respuesta única. Registra el valor de la prueba
de Carlos CRAFFT
Ejemplo: 10

#### Campo 70: Fecha de la última menstruación (FUM)
- **Longitud Máxima:** `10`
- **Tipo de Dato:** `F`
- **Requerido:** `NO`
- **Descripción, Valores Permitidos y Reglas:**
En formato AAAA-MM-DD. Debe corresponder a la fecha de la
última menstruación de la persona
Fecha Valida: 2016-02-01

#### Campo 71: Mujer en edad fértil
- **Longitud Máxima:** `1`
- **Tipo de Dato:** `N`
- **Requerido:** `NO`
- **Descripción, Valores Permitidos y Reglas:**
Es una variable de respuesta única. Los valores permitidos se
encuentran en la tabla de referencia LstSINO, variable Extra I,
_
disponible en: https://web.sispro.gov.co/
Valores permitidos:
Código Descripción
1 SI
2 NO
Ejemplo: 1

#### Campo 72: ¿Se encuentra en embarazo?
- **Longitud Máxima:** `1`
- **Tipo de Dato:** `N`
- **Requerido:** `NO`
- **Descripción, Valores Permitidos y Reglas:**
Es una variable de respuesta única. Los valores permitidos se
encuentran en la tabla de referencia LstSINO, variable Extra I,
_
disponible en: https://web.sispro.gov.co/
Valores permitidos:
Código Descripción
1 SI
2 NO
Ejemplo: 1

#### Campo 73: ¿Conoce los signos de alarma en el embarazo?
- **Longitud Máxima:** `1`
- **Tipo de Dato:** `N`
- **Requerido:** `NO`
- **Descripción, Valores Permitidos y Reglas:**
Es una variable de respuesta única. Los valores permitidos se
encuentran en la tabla de referencia LstSINO, variable Extra I,
_
disponible en: https://web.sispro.gov.co/
Valores permitidos:
Código Descripción
1 SI
2 NO
Ejemplo: 1

#### Campo 74: ¿Conoce sobre Interrupción Voluntaria del Embarazo?
- **Longitud Máxima:** `1`
- **Tipo de Dato:** `N`
- **Requerido:** `NO`
- **Descripción, Valores Permitidos y Reglas:**
Es una variable de respuesta única. Los valores permitidos se
encuentran en la tabla de referencia LstSINO, variable Extra I,
_
disponible en: https://web.sispro.gov.co/
Valores permitidos:
Código Descripción
1 SI
2 NO
Ejemplo: 1

#### Campo 75: ¿Inició atenciones prenatales?
- **Longitud Máxima:** `1`
- **Tipo de Dato:** `N`
- **Requerido:** `NO`
- **Descripción, Valores Permitidos y Reglas:**
Es una variable de respuesta única. Los valores permitidos se
encuentran en la tabla de referencia LstSINO, variable Extra I,
_
disponible en: https://web.sispro.gov.co/
Valores permitidos:
Código Descripción
1 SI
2 NO
Ejemplo: 1

#### Campo 76: ¿Inició oportunamente la atención prenatal?
- **Longitud Máxima:** `1`
- **Tipo de Dato:** `N`
- **Requerido:** `NO`
- **Descripción, Valores Permitidos y Reglas:**
Es una variable de respuesta única. Los valores permitidos se
encuentran en la tabla de referencia LstSINO, variable Extra I,
_
disponible en: https://web.sispro.gov.co/
Valores permitidos:
Código Descripción
1 SI
2 NO
Ejemplo: 1

#### Campo 77: ¿Tiene acceso a métodos anticonceptivos postparto?
- **Longitud Máxima:** `1`
- **Tipo de Dato:** `N`
- **Requerido:** `NO`
- **Descripción, Valores Permitidos y Reglas:**
Es una variable de respuesta única. Los valores permitidos se
encuentran en la tabla de referencia LstSINO, variable Extra I,
_
disponible en: https://web.sispro.gov.co/
Valores permitidos:
Código Descripción
1 SI
2 NO
Ejemplo: 1

#### Campo 78: Clasificación del riesgo gestacional
- **Longitud Máxima:** `1`
- **Tipo de Dato:** `N`
- **Requerido:** `NO`
- **Descripción, Valores Permitidos y Reglas:**
Es una variable de respuesta única. Identifica la clasificación del
riego gestacional de la mujer.
Valores permitidos:
Código Descripción
1 Alto riesgo
2 Bajo riesgo
3 Riesgo no evaluado
Ejemplo: 1

#### Campo 79: Clasificación del riesgo de preeclampsia
- **Longitud Máxima:** `1`
- **Tipo de Dato:** `N`
- **Requerido:** `NO`
- **Descripción, Valores Permitidos y Reglas:**
Es una variable de respuesta única. Identifica cual s la clasificación
del riesgo de preeclampsia que existe.
Valores permitidos:
Código Descripción
1 Alto riesgo
2 Bajo riesgo
Ejemplo: 1

#### Campo 80: Número de atenciones prenatales
- **Longitud Máxima:** `2`
- **Tipo de Dato:** `N`
- **Requerido:** `NO`
- **Descripción, Valores Permitidos y Reglas:**
Número de atenciones prenatales que ha tenido hasta el momento

#### Campo 81: Atención para el cuidado preconcepcional
- **Longitud Máxima:** `1`
- **Tipo de Dato:** `N`
- **Requerido:** `NO`
- **Descripción, Valores Permitidos y Reglas:**
Es una variable de respuesta única. Valida si hay atención para el
cuidado preconcepcional.
Valores permitidos:
Código Descripción
1 SI
2 NO
3 NO APLICA
Ejemplo: 2.

#### Campo 82: Atención para el cuidado prenatal – Controles prenatales
- **Longitud Máxima:** `1`
- **Tipo de Dato:** `N`
- **Requerido:** `NO`
- **Descripción, Valores Permitidos y Reglas:**
Es una variable de respuesta única. Valida si hay atención para el
cuidado prenatal específicamente enfocado al control prenatal
Valores permitidos:
Código Descripción
1 SI
2 NO
3 NO APLICA
Ejemplo: 2.

#### Campo 83: Preparación para la maternidad y paternidad
- **Longitud Máxima:** `2`
- **Tipo de Dato:** `N`
- **Requerido:** `NO`
- **Descripción, Valores Permitidos y Reglas:**
Número de sesiones de preparación para la maternidad y
paternidad ha tenido hasta el momento

#### Campo 84: Fecha de atención del evento obstétrico
- **Longitud Máxima:** `10`
- **Tipo de Dato:** `F`
- **Requerido:** `NO`
- **Descripción, Valores Permitidos y Reglas:**
En formato AAAA-MM-DD. Debe corresponder a la posible fecha
de atención del evento obstétrico
Fecha Valida: 2016-02-01

#### Campo 85: Atención del puerperio en las primeras 48 horas
- **Longitud Máxima:** `1`
- **Tipo de Dato:** `N`
- **Requerido:** `NO`
- **Descripción, Valores Permitidos y Reglas:**
Es una variable de respuesta única. Los valores permitidos se
encuentran en la tabla de referencia LstSINO, variable Extra I,
_
disponible en: https://web.sispro.gov.co/
Valores permitidos:
Código Descripción
1 SI
2 NO
Ejemplo: 1

#### Campo 86: Consulta de seguimiento al puerperio entre el tercer y quinto día post parto
- **Longitud Máxima:** `1`
- **Tipo de Dato:** `N`
- **Requerido:** `NO`
- **Descripción, Valores Permitidos y Reglas:**
Es una variable de respuesta única. Los valores permitidos se
encuentran en la tabla de referencia LstSINO, variable Extra I,
_
disponible en: https://web.sispro.gov.co/
Valores permitidos:
Código Descripción
1 SI
2 NO
Ejemplo: 1

#### Campo 87: Apoyo a la lactancia materna
- **Longitud Máxima:** `1`
- **Tipo de Dato:** `N`
- **Requerido:** `NO`
- **Descripción, Valores Permitidos y Reglas:**
Es una variable de respuesta única. Los valores permitidos se
encuentran en la tabla de referencia LstSINO, variable Extra I,
_
disponible en: https://web.sispro.gov.co/
Valores permitidos:
Código Descripción
1 SI
2 NO
Ejemplo: 1

#### Campo 88: Atención durante las primeras 24 horas de vida al recién nacido
- **Longitud Máxima:** `1`
- **Tipo de Dato:** `N`
- **Requerido:** `NO`
- **Descripción, Valores Permitidos y Reglas:**
Es una variable de respuesta única. Los valores permitidos se
encuentran en la tabla de referencia LstSINO, variable Extra I,
_
disponible en: https://web.sispro.gov.co/
Valores permitidos:
Código Descripción
1 SI
2 NO
Ejemplo: 1

#### Campo 89: Control entre 3 y 5 días recién nacido
- **Longitud Máxima:** `1`
- **Tipo de Dato:** `N`
- **Requerido:** `NO`
- **Descripción, Valores Permitidos y Reglas:**
Es una variable de respuesta única. Los valores permitidos se
encuentran en la tabla de referencia LstSINO, variable Extra I,
_
disponible en: https://web.sispro.gov.co/
Valores permitidos:
Código Descripción
1 SI
2 NO
Ejemplo: 1

#### Campo 90: Vacunación del recién nacido
- **Longitud Máxima:** `1`
- **Tipo de Dato:** `N`
- **Requerido:** `NO`
- **Descripción, Valores Permitidos y Reglas:**
Es una variable de respuesta única. Los valores permitidos se
encuentran en la tabla de referencia LstSINO, variable Extra I,
_
disponible en: https://web.sispro.gov.co/
Valores permitidos:
Código Descripción
1 SI
2 NO
Ejemplo: 1

#### Campo 91: Provisión del método anticonceptivo post parto inmediato
- **Longitud Máxima:** `2`
- **Tipo de Dato:** `N`
- **Requerido:** `NO`
- **Descripción, Valores Permitidos y Reglas:**
Es una variable de respuesta única. Identifica el tipo de método
anticonceptivo postparto usado. Los valores permitidos se
encuentran en la tabla de referencia
APSMetodosAnticonceptivos, variable Codigo, disponible en:
https://web.sispro.gov.co/.
Valores permitidos:
Código Descripción
1 Barrera - Preservativo
2 Hormonal mensual combinado
3 Hormonal mensual sólo progestágeno
4 Hormonal trimestral
5 Implante subdérmico
6 Dispositivo de liberación hormonal
7 Dispositivo intrauterino
8 Ninguno - no fue ofertado
9 Ninguno - no cumple con criterios de elegibilidad
para usar métodos
10 Ninguno - decisión de la persona
11 Otro
Ejemplo: 1

#### Campo 92: ¿Cuenta con historial laboral?
- **Longitud Máxima:** `1`
- **Tipo de Dato:** `N`
- **Requerido:** `NO`
- **Descripción, Valores Permitidos y Reglas:**
Es una variable de respuesta única. Los valores permitidos se
encuentran en la tabla de referencia LstSINO, variable Extra I,
_
disponible en: https://web.sispro.gov.co/
Valores permitidos:
Código Descripción
1 SI
2 NO
Ejemplo: 1

#### Campo 93: Lugar de trabajo / Actividad específica (más reciente)
- **Longitud Máxima:** `200`
- **Tipo de Dato:** `T`
- **Requerido:** `NO`
- **Descripción, Valores Permitidos y Reglas:**
Identifica el nombre del lugar del trabajo o Actividad especifica que
se hizo más reciente. Habilitado cuando responde Si, opción 1 en
la variable 92.

#### Campo 94: Nombre del Empleador
- **Longitud Máxima:** `200`
- **Tipo de Dato:** `T`
- **Requerido:** `NO`
- **Descripción, Valores Permitidos y Reglas:**
Identifica el nombre del empleador cuando identifica el lugar del
trabajo Habilitado cuando responde Si, opción 1 en la variable 92.

#### Campo 95: Periodo laboral (meses)
- **Longitud Máxima:** `2`
- **Tipo de Dato:** `N`
- **Requerido:** `NO`
- **Descripción, Valores Permitidos y Reglas:**
Numero de meses que estuvo realizando la actividad laboral
registrada en la variable 93.

#### Campo 96: ¿Cuenta con más empleos previos al actual?
- **Longitud Máxima:** `1`
- **Tipo de Dato:** `N`
- **Requerido:** `NO`
- **Descripción, Valores Permitidos y Reglas:**
Es una variable de respuesta única. Los valores permitidos se
encuentran en la tabla de referencia LstSINO, variable Extra I,
_
disponible en: https://web.sispro.gov.co/
Valores permitidos:
Código Descripción
1 SI
2 NO
Ejemplo: 1

#### Campo 97: Lugar de trabajo / Actividad específica
- **Longitud Máxima:** `200`
- **Tipo de Dato:** `T`
- **Requerido:** `NO`
- **Descripción, Valores Permitidos y Reglas:**
Identifica el nombre del lugar del trabajo o Actividad especifica que
se hizo más reciente. Habilitado cuando responde Si, opción 1 en
la variable 96.

#### Campo 98: Nombre del Empleador
- **Longitud Máxima:** `200`
- **Tipo de Dato:** `T`
- **Requerido:** `NO`
- **Descripción, Valores Permitidos y Reglas:**
Identifica el nombre del empleador cuando identifica el lugar del
trabajo. Habilitado cuando responde Si, opción 1 en la variable 96.

#### Campo 99: Periodo laboral (meses)
- **Longitud Máxima:** `2`
- **Tipo de Dato:** `N`
- **Requerido:** `NO`
- **Descripción, Valores Permitidos y Reglas:**
Numero de meses que estuvo realizando la actividad laboral
registrada en el campo 97

#### Campo 100: Lugar de trabajo / Actividad específica
- **Longitud Máxima:** `200`
- **Tipo de Dato:** `T`
- **Requerido:** `NO`
- **Descripción, Valores Permitidos y Reglas:**
Identifica el nombre del lugar del trabajo o Actividad especifica que
se hizo más reciente. Habilitado cuando responde Si, opción 1 en
la variable 96.

#### Campo 101: Nombre del Empleador
- **Longitud Máxima:** `200`
- **Tipo de Dato:** `T`
- **Requerido:** `NO`
- **Descripción, Valores Permitidos y Reglas:**
Identifica el nombre del empleador cuando identifica el lugar del
trabajo. Habilitado cuando responde Si, opción 1 en la variable 96.

#### Campo 102: Periodo laboral (meses)
- **Longitud Máxima:** `2`
- **Tipo de Dato:** `N`
- **Requerido:** `NO`
- **Descripción, Valores Permitidos y Reglas:**
Numero de meses que estuvo realizando la actividad laboral
registrada en la variable 100.

#### Campo 103: En alguno de los trabajos desempeñados, ¿ha realizado alguna actividad que involucre asbesto?
- **Longitud Máxima:** `1`
- **Tipo de Dato:** `N`
- **Requerido:** `NO`
- **Descripción, Valores Permitidos y Reglas:**
Es una variable de respuesta única. Identifica si en algún trabajo, la
persona ha realizado alguna actividad que involucre asbesto.
Valores permitidos:
Código Descripción
1 SI
2 NO
3 NO APLICA
Ejemplo: 2.

#### Campo 104: En alguno de los trabajos desempeñados, ¿ha realizado alguna actividad relacionada con asbesto?
- **Longitud Máxima:** `1`
- **Tipo de Dato:** `N`
- **Requerido:** `NO`
- **Descripción, Valores Permitidos y Reglas:**
Es una variable de respuesta única. Valida si en el trabajo la
persona ha desempeñado alguna actividad relacionada con
asbesto
Valores permitidos:
Código Descripción
1 SI
2 NO
3 NO APLICA
Ejemplo: 2.

#### Campo 105: ¿Cuáles son las actividades realizadas relacionada con asbesto?
- **Longitud Máxima:** `135`
- **Tipo de Dato:** `A`
- **Requerido:** `NO`
- **Descripción, Valores Permitidos y Reglas:**
Variable de múltiple respuesta. Identifica cuales de las siguientes
actividades relacionada con asbesto ha realizado la persona. Se
habilita bajo la opción 1 de la variable 104.
Los valores permitidos se encuentran en la tabla de referencia
APSActividadesAsbesto, variable Codigo, disponible en:
https://web.sispro.gov.co/.
Valores permitidos:
Código Descripción
Trabajadores de astilleros (construcción, reparación o
1
desguace de embarcaciones)
Trabajadores en almacenes que almacenan
2
materiales de construcción
Representantes de ventas que trabajan con
3
materiales que contienen asbesto
Fabricantes de materiales de fricción (frenos,
4
embragues)
5 Fabricantes de materiales de fibrocemento (uralita)
Fabricantes de productos textiles que contienen
6
asbesto
Reparadores de material de fricción (frenos,
7
embragues)
Agricultura (reparación o mantenimiento de vehículos
8
o maquinaria)
Trabajadores de aislamiento o revestimientos
9
aislantes
Albañiles (instalación de techos o cubiertas de
10
fibrocemento – placas o tejas)
11 Artistas gráficos
12 Artesanos y actividades manuales y técnicas
13 Bomberos
Carpinteros, encofradores, ensambladores o
14
ebanistas
Conductores que realizan mantenimiento de
15
vehículos
16 Electricistas
Trabajadores de la producción o mantenimiento de
17
vagones de tren o metro
Trabajadores de la producción o reparación de
18
estufas
19 Trabajadores de la producción de pintura
20 Fontaneros o inspectores de tuberías
21 Fundiciones
22 Trabajadores de la industria alimentaria y de bebidas (reparación o mantenimiento)
23 Trabajadores de cerámica (reparación o mantenimiento)
24 Trabajadores de la industria del plástico o del caucho (reparación o mantenimiento)
25 Trabajadores de la industria del vidrio
26 Instaladores de cocinas
27 Joyeros
28 Deshollinadores
29 Trabajadores de la rehabilitación, reparación o mantenimiento de edificios industriales
30 Trabajadores de la rehabilitación, reparación o mantenimiento de materiales de fibrocemento (uralita)
31 Mecánicos de automóviles
32 Mecánicos de ascensores
33 Mecánicos en la industria
34 Trabajadores en minas de asbesto
35 Estibadores
36 Pintores de edificios
37 Reparadores de maquinaria industrial
38 Trabajadores en la reparación o mantenimiento de redes municipales de distribución de agua
39 Reparadores de motores eléctricos
40 Reparadores y pintadores de carrocerías
41 Trabajadores de salas de calderas
42 Trabajadores en servicios de centrales de gas, nucleares y eléctricas
43 Servicio militar y fuerzas armadas (reparación o mantenimiento)
44 Soldadores (también fabricantes de latón y estaño)
45 Traperos
46 Techadores (instalación o reparación de techos o fachadas)
47 Técnicos de ventilación e instaladores de aire acondicionado
48 Trabajadores textiles (ropa resistente al calor)

Nota. Como es una respuesta de opción múltiple, se deberán registrar los números correspondientes a las opciones seleccionadas, separados por coma (,).

Ejemplo: 2,11,35

#### Campo 106: ¿Ha interactuado con materiales que tengan asbesto?
- **Longitud Máxima:** `1`
- **Tipo de Dato:** `N`
- **Requerido:** `NO`
- **Descripción, Valores Permitidos y Reglas:**
Es una variable de respuesta única. Identifica si la persona ha
interactuado con materiales que contienen asbesto en trabajos
desempeñados.
Valores permitidos:
Código Descripción
1 SI
2 NO
3 NO APLICA
Ejemplo: 2.

#### Campo 107: ¿Cuáles son los materiales con los que interactuó con presencia de asbesto?
- **Longitud Máxima:** `5`
- **Tipo de Dato:** `A`
- **Requerido:** `NO`
- **Descripción, Valores Permitidos y Reglas:**
Variable de múltiple respuesta. Se habilita bajo la opción 1 de la
variable 106.
Los valores permitidos se encuentran en la tabla de referencia
APSMaterialesAsbestoTrabajo, variable Codigo, disponible en:
https://web.sispro.gov.co/.
Valores permitidos:
Código Descripción
1 Fibrocemento (placas, tejas, tuberías, tanques,
bajantes)
2 Materiales de fricción (frenos, embragues, fricción
industrial)
3 Aislantes térmicos/industriales (mantas, juntas,
textiles resistentes al calor, calderas)
Ejemplo: 1

#### Campo 108: ¿En qué modalidad de empleo se presentó mayormente la exposición?
- **Longitud Máxima:** `1`
- **Tipo de Dato:** `N`
- **Requerido:** `NO`
- **Descripción, Valores Permitidos y Reglas:**
Es una variable de respuesta única. Identifica cual es la modalidad
de empleo que presento mayor exposición.
Valores permitidos:
Código Descripción
1 Formal
2 Informal
Ejemplo: 2.

#### Campo 109: En su hogar, ¿ha tenido alguna vez materiales que contengan asbesto?
- **Longitud Máxima:** `1`
- **Tipo de Dato:** `N`
- **Requerido:** `NO`
- **Descripción, Valores Permitidos y Reglas:**
Es una variable de respuesta única. Identifica si en el hogar ha
tenido algún material que contenga asbesto
Valores permitidos:
Código Descripción
1 SI
2 NO
3 NO APLICA
Ejemplo: 2.

#### Campo 110: ¿Cuáles son los elementos del hogar que tiene presencia de asbesto?
- **Longitud Máxima:** `20`
- **Tipo de Dato:** `A`
- **Requerido:** `NO`
- **Descripción, Valores Permitidos y Reglas:**
Variable de múltiple respuesta. Se habilita bajo la opción 1 de la
variable 109.
Los valores permitidos se encuentran en la tabla de referencia
APSMaterialesAsbestoHogar, variable codigo, disponible en:
https://web.sispro.gov.co/.
Valores permitidos:
Código Descripción
1 Estufas de placa térmica
2 Estufas de resistencia eléctrica
3 Cocinas con resistencias eléctricas
4 Calentadores eléctricos
5 Calentadores de gas butano
6 Fundas para tablas de planchar
7 Secadores de pelo, pies y manos
8 Tostadoras
9 Guantes de horno resistentes al calor
Protección térmica para muebles de fórmica debajo
10
de hornos
Nota. Como es una respuesta de opción múltiple, se deberán
registrar los números correspondientes a las opciones
seleccionadas, separados por coma (,).
Ejemplo: 1,5,9

#### Campo 111: ¿En qué estado se encuentran los materiales que contienen asbesto en la vivienda?
- **Longitud Máxima:** `1`
- **Tipo de Dato:** `N`
- **Requerido:** `NO`
- **Descripción, Valores Permitidos y Reglas:**
Es una variable de respuesta única. Valida cual es el estado en el
que se encuentran los materiales que contienen asbesto en la
vivienda.
Valores permitidos:
Código Descripción
1 Bueno
2 Malo
Ejemplo: 2.

#### Campo 112: En su hogar, ¿convive con alguien que haya trabajado con asbesto?
- **Longitud Máxima:** `1`
- **Tipo de Dato:** `N`
- **Requerido:** `NO`
- **Descripción, Valores Permitidos y Reglas:**
Es una variable de respuesta única. Identifica si en la vivienda hay
convivencia con una persona que haya tenido exposición con
asbesto en el trabajo
Valores permitidos:
Código Descripción
1 SI
2 NO
3 NO APLICA
Ejemplo: 2.

#### Campo 113: ¿Ha realizado en su vivienda reparaciones con materiales que contengan asbesto?
- **Longitud Máxima:** `1`
- **Tipo de Dato:** `N`
- **Requerido:** `NO`
- **Descripción, Valores Permitidos y Reglas:**
Es una variable de respuesta única. Identifica si en el hogar se han
realizado reparaciones con materiales que contengan asbesto
Valores permitidos:
Código Descripción
1 SI
2 NO
3 NO APLICA
Ejemplo: 2.

#### Campo 114: ¿Recuerda alguna actividad que haya implicado asbesto cerca de su hogar?
- **Longitud Máxima:** `1`
- **Tipo de Dato:** `N`
- **Requerido:** `NO`
- **Descripción, Valores Permitidos y Reglas:**
Es una variable de respuesta única. Valida si la persona recuerda o
identifica si alguna actividad que involucre asbesto se realizó cerca
del hogar
Valores permitidos:
Código Descripción
1 SI
2 NO
3 NO APLICA
Ejemplo: 2.

#### Campo 115: ¿Cuáles son las actividades que implicaron presencia de asbesto cerca de su hogar?
- **Longitud Máxima:** `1`
- **Tipo de Dato:** `N`
- **Requerido:** `NO`
- **Descripción, Valores Permitidos y Reglas:**
Es una variable de respuesta única. Identifica cuales fueron las
actividades que se realizaron cerca del hogar que haya involucrado
asbesto. Se habilita bajo la opción 1 de la variable 114
.
Los valores permitidos se encuentran en la tabla de referencia
APSActividadesPresenciaAsbestoHogar, variable codigo,
disponible en: https://web.sispro.gov.co/.
Valores permitidos:
Código Descripción
1 Trabajadores de astilleros (construcción,
reparación o desguace de embarcaciones)
2 Trabajadores en almacenes que almacenan
materiales de construcción
3 Representantes de ventas que trabajan con
materiales que contienen asbesto (frenos,
embragues, hilo, cuerda, cordón, tela, juntas,
cartón, juntas de cartón, etc.)
4 Fabricantes de materiales de fricción (frenos,
embragues)
5 Fabricantes de materiales de fibrocemento (uralita)
6 Fabricantes de productos textiles que contienen
asbesto (hilos, cuerdas, cordones, telas, juntas,
cartón, tela de asbesto)
7 Reparadores de material de fricción (frenos,
embragues)
Ejemplo: 2.

#### Campo 116: ¿Ha tenido familiares con enfermedades relacionadas con asbesto?
- **Longitud Máxima:** `1`
- **Tipo de Dato:** `N`
- **Requerido:** `NO`
- **Descripción, Valores Permitidos y Reglas:**
Es una variable de respuesta única. Valida si la persona ha tenido
familiares con enfermedades relacionadas al asbesto
Valores permitidos:
Código Descripción
1 SI
2 NO
3 NO APLICA
Ejemplo: 2.

#### Campo 117: Número de Identificación de la Familia
- **Longitud Máxima:** `31`
- **Tipo de Dato:** `A`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
Corresponde al número de identificación de la familia en el campo
124 de los registros de tipo 2.

#### Campo 118: Número de identificación único del integrante de la familia
- **Longitud Máxima:** `53`
- **Tipo de Dato:** `A`
- **Requerido:** `SI`
- **Descripción, Valores Permitidos y Reglas:**
Corresponde a la concatenación de las variables 118 (Número de
identificación de la familia) del Tipo 3, seguido de los campos 6
(Tipo de identificación del integrante) y 7 (Número de identificación
del integrante) del Tipo 3

---

## 5. CARACTERÍSTICAS TÉCNICAS DE LOS ARCHIVOS PLANOS

Los archivos deben ser de tipo texto plano y cumplir estrictamente con las siguientes especificaciones técnicas:

a. **Tipos de Datos del Anexo:**
   - `A`: Alfanumérico
   - `N`: Numérico
   - `D`: Decimal
   - `F`: Fecha
   - `T`: Texto con caracteres especiales

b. **Codificación:** Todos los datos deben ser grabados como texto en archivos planos de formato **ANSI**, con extensión `.txt`.

c. **Mayúsculas y Normalización:** Los nombres de archivos y los datos de los mismos deben ser grabados en letras **MAYÚSCULAS**, sin caracteres especiales y **sin tildes**.

d. **Separador de Campos:** El separador de campos debe ser exclusivamente el carácter **pipe (`|`)**. Los campos que corresponden a descripciones o texto no deben incluir el carácter pipe (`|`).

e. **Campos Opcionales Vacíos:** Cuando dentro de un archivo de datos se definan campos que no son obligatorios y que no sean reportados, este campo no llevará ningún valor; es decir, debe ir totalmente vacío y reportarse en el archivo entre dos pipes consecutivos (ejemplo: si entre el dato 1 y el dato 3 el dato 2 está vacío, se reportará `dato1||dato3`).

f. **Sin Comillas:** Ningún dato en el campo debe venir encerrado entre comillas (`""`) ni ningún otro carácter especial.

g. **Valores Numéricos y Decimales:** Los campos numéricos deben venir sin ningún formato de valor ni separación de miles. Para los campos en que se permitan valores decimales, se debe usar exclusivamente el punto (`.`) como separador de decimales.

h. **Formato de Fechas:** Los campos de tipo fecha deben venir en formato `AAAA-MM-DD`, incluyendo el carácter guion, a excepción de las fechas que forman parte del nombre de los archivos (`AAAAMMDD`).

i. **Longitud Máxima de Campos:** Las longitudes de campos definidas en los registros de control y detalle de este anexo técnico se deben entender como el tamaño máximo del campo; los datos pueden tener una longitud menor a dicho valor.

j. **Sin Justificación ni Rellenos:** Los valores registrados en los archivos planos no deben tener ninguna justificación; por lo tanto, no se les debe completar con ceros a la izquierda ni espacios, salvo que la especificación explícita del campo lo indique.

k. **Diferenciación Cero vs Letra O:** Cuando los códigos traen CEROS (`0`), estos no pueden ser remplazados por la vocal 'O', la cual es un carácter diferente a cero.

l. **Fin de Registro y Fin de Archivo:** Los archivos planos no deben traer ningún carácter especial de fin de archivo ni de final de registro. Se utiliza únicamente el salto de línea `ENTER` como fin de registro.

m. **Firma Digital Obligatoria:** Los archivos deben estar firmados digitalmente.

---

## 6. PLATAFORMA PARA EL ENVÍO DE ARCHIVOS (PISIS / SISPRO)

El Ministerio de Salud y Protección Social dispondrá de la **Plataforma de Intercambio de Información (PISIS)** del Sistema Integral de Información de la Protección Social (**SISPRO**), para que las entidades reporten la información desde sus instalaciones.

### 6.1. Procedimiento de Registro
1. **Registrar o Actualizar la Entidad:**
   - Enlace oficial: [Verificar Estado de Registro de Entidad](https://web.sispro.gov.co/Entidades/Cliente/VerificarEstadoRegistro)
2. **Registrar Usuarios Institucionales:** Se pueden registrar en línea o mediante anexo técnico por PISIS.
   - En línea: [Registro de Solicitudes de Usuario SISPRO](https://web.sispro.gov.co/Seguridad/Cliente/Web/RegistroSolicitudes.aspx)
   - Mediante Anexo Técnico `SEG500USIN` por PISIS: Procedimiento detallado en la Guía de Usuario de Seguridad disponible en [SISPRO Web](https://web.sispro.gov.co).

### 6.2. Proceso de Control de Calidad de los Datos
La plataforma PISIS recibe los archivos conformados según la estructura del presente Anexo Técnico y ejecuta un proceso secuencial de validación:
- **Primera Validación (Estructura y Sintaxis):** Corresponde a la revisión del estándar del nombre del archivo, cantidad de columnas por registro, tipos de datos, longitudes máximas y obligatoriedad de campos. Se informa de inmediato el estado de recepción al reportante.
- **Segunda Validación (Contenido y Calidad Misional):** Una vez superada exitosamente la primera validación, se ejecuta el control de calidad de reglas de negocio y consistencia de datos en el aplicativo misional SI-APS, informando el resultado al reportante.

> **Regla de Cumplimiento:** Se entiende cumplida la obligación de este reporte únicamente una vez la **segunda validación sea aprobada con éxito**.

### 6.3. Mesa de Ayuda y Soporte
- Datos de contacto y mesa técnica: [Mesa de Ayudas SISPRO](https://www.sispro.gov.co/ayudas/Pages/Ayudas.aspx)
- Preguntas frecuentes y documentación PISIS: [Soporte y FAQ PISIS](https://web.sispro.gov.co/WebPublico/Soporte/FAQ/FAQ.aspx)

### 6.4. Tratamiento y Seguridad de la Información
- **Régimen de Protección de Datos:** Las entidades reportantes son responsables del estricto cumplimiento del régimen de protección de datos personales de conformidad con la **Ley Estatutaria 1581 de 2012**, la **Ley 1712 de 2014**, el **Capítulo 25 del Título 2 del Libro 2 de la Parte 2 del Decreto 1074 de 2015**, y normas complementarias. Son garantes de la privacidad, confidencialidad, reserva y veracidad de los datos.
- **Seguridad y No Repudio:** Para garantizar la autenticidad, integridad y no repudio, los archivos planos deben remitirse **firmados digitalmente** utilizando un certificado digital emitido por una entidad de certificación abierta debidamente aprobada por el organismo competente.

---

## 7. PERIODO DE REPORTE Y PLAZOS DE ENVÍO

La información debe enviarse de conformidad con el cronograma y periodicidad establecidos por el Ministerio de Salud y Protección Social.

### 7.1. Calendario de Cortes y Plazos de Reporte

| Fecha de Corte de la Información a Reportar | Plazo para Enviar el Archivo Plano (Desde) | Plazo para Enviar el Archivo Plano (Hasta) |
| :---: | :---: | :---: |
| **2026-07-06** | 2026-07-07 | 2026-07-10 |
| **2026-07-14** *(martes por ser lunes festivo)* | 2026-07-15 | 2026-07-17 |
| **Y así sucesivamente:** | **Segundo día hábil de la semana** | **Último día hábil de la semana** |

- **Regla General:** Fecha de corte = Primer día hábil de la semana inmediatamente anterior. Período de reporte = Del segundo día hábil al último día hábil de la semana corriente.

---

## 8. CATÁLOGO CONSOLIDADO DE TABLAS DE REFERENCIA SISPRO

A continuación se consolidan todas las tablas maestras de referencia del SISPRO invocadas en el anexo técnico:

| Nombre de la Tabla en SISPRO | Variable(s) en Registro Tipo 2 | Variable(s) en Registro Tipo 3 | URL / Disponibilidad |
| :--- | :--- | :--- | :--- |
| `LstSINO` | 2, 64, 67, 74, 99, 101, 103, 107, 109, 114, 120 | 45, 46, 50, 52, 55, 60, 62, 70, 72, 74, 80, 81, 86, 91, 92, 96, 106, 111, 112, 114 | [web.sispro.gov.co](https://web.sispro.gov.co/) |
| `Departamento` | 3 | - | [web.sispro.gov.co](https://web.sispro.gov.co/) |
| `Municipio` | 5 | - | [web.sispro.gov.co](https://web.sispro.gov.co/) |
| `APSIdentificacionEBS` | 16 | - | [web.sispro.gov.co](https://web.sispro.gov.co/) |
| `APSTipoPerfil` | 19, 21, 23, 25, 27 | - | [web.sispro.gov.co](https://web.sispro.gov.co/) |
| `APSTipoVivienda` | 31 | - | [web.sispro.gov.co](https://web.sispro.gov.co/) |
| `APSRiesgoAccidente` | 32 | - | [web.sispro.gov.co](https://web.sispro.gov.co/) |
| `APSObservaCercaVivienda` | 33 | - | [web.sispro.gov.co](https://web.sispro.gov.co/) |
| `APSAmbientesVivienda` | 34, 35 | - | [web.sispro.gov.co](https://web.sispro.gov.co/) |
| `APSElementosVivienda` | 36 | - | [web.sispro.gov.co](https://web.sispro.gov.co/) |
| `APSMaterialPredominanteParedes` | 40 | - | [web.sispro.gov.co](https://web.sispro.gov.co/) |
| `APSMaterialPredominanteTecho` | 41 | - | [web.sispro.gov.co](https://web.sispro.gov.co/) |
| `APSMaterialPredominantePisos` | 42 | - | [web.sispro.gov.co](https://web.sispro.gov.co/) |
| `APSServiciosPublicosVivienda` | 46 | - | [web.sispro.gov.co](https://web.sispro.gov.co/) |
| `APSDesplazamientoMayor30Minutos` | 48 | - | [web.sispro.gov.co](https://web.sispro.gov.co/) |
| `APSFuenteAguaConsumo` | 53 | - | [web.sispro.gov.co](https://web.sispro.gov.co/) |
| `APSSistemaDisposicionExcretas` | 58 | - | [web.sispro.gov.co](https://web.sispro.gov.co/) |
| `APSAlmacenamientoAgua` | 60 | - | [web.sispro.gov.co](https://web.sispro.gov.co/) |
| `APSDisposicionResiduosSolidos` | 62 | - | [web.sispro.gov.co](https://web.sispro.gov.co/) |
| `APSFuenteEnergiaCocinar` | 78 | - | [web.sispro.gov.co](https://web.sispro.gov.co/) |
| `APSTipoEstufa` | 83 | - | [web.sispro.gov.co](https://web.sispro.gov.co/) |
| `APSCriaderosVectores` | 84 | - | [web.sispro.gov.co](https://web.sispro.gov.co/) |
| `APSAnimales` | 92 | - | [web.sispro.gov.co](https://web.sispro.gov.co/) |
| `APSTipoFamilia` | 112 | - | [web.sispro.gov.co](https://web.sispro.gov.co/) |
| `APSAPGAR` | 113 | - | [web.sispro.gov.co](https://web.sispro.gov.co/) |
| `APSRedesApoyoSocial` | 118 | - | [web.sispro.gov.co](https://web.sispro.gov.co/) |
| `Pais` | - | 9 | [web.sispro.gov.co](https://web.sispro.gov.co/) |
| `Sexo` | - | 11 | [web.sispro.gov.co](https://web.sispro.gov.co/) |
| `SGDCIUO` (Ocupaciones) | - | 18 | [web.sispro.gov.co](https://web.sispro.gov.co/) |
| `SGDNivEducativo` | - | 19 | [web.sispro.gov.co](https://web.sispro.gov.co/) |
| `APSRegimenAfiliacion` | - | 20 | [web.sispro.gov.co](https://web.sispro.gov.co/) |
| `SGDCodigoEAPB` | - | 21 | [web.sispro.gov.co](https://web.sispro.gov.co/) |
| `MDECEtnia` | - | 24 | [web.sispro.gov.co](https://web.sispro.gov.co/) |
| `APSIntervencionPendiente` | - | 36, 40, 44 | [web.sispro.gov.co](https://web.sispro.gov.co/) |
| `APSDiagnosticoNutricion` | - | 73 | [web.sispro.gov.co](https://web.sispro.gov.co/) |
| `APSTensionArterial` | - | 75 | [web.sispro.gov.co](https://web.sispro.gov.co/) |
| `APSActividadesAsbesto` | - | 105 | [web.sispro.gov.co](https://web.sispro.gov.co/) |
| `APSMaterialesAsbestoTrabajo` | - | 107 | [web.sispro.gov.co](https://web.sispro.gov.co/) |
| `APSModalidadEmpleoAsbesto` | - | 108 | [web.sispro.gov.co](https://web.sispro.gov.co/) |
| `APSElementosProteccionAsbesto` | - | 110 | [web.sispro.gov.co](https://web.sispro.gov.co/) |
| `APSActividadesPresenciaAsbestoHogar` | - | 115 | [web.sispro.gov.co](https://web.sispro.gov.co/) |

---
*Fin del Anexo Técnico CVSF05 Versión 02 - SI-APS MinSalud Colombia.*
