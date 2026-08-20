# REGLAS DE NEGOCIO – APS APP

**Instrumento fuente:** SI-APS – Formulario para identificación APS – Equipos Básicos de Salud
**Versión del instrumento:** v2 – 2025 (Ministerio de Salud y Protección Social)
**Ámbito de despliegue:** Santiago de Cali, Valle del Cauca
**Versión del documento:** 2.0
**Fecha:** 12 de agosto de 2026

---

## 1. Introducción

### 1.1 Propósito

Las reglas de negocio establecen las validaciones, restricciones y comportamientos obligatorios que debe cumplir la aplicación APS APP durante la captura, almacenamiento, análisis y sincronización de información, en el contexto de la salud familiar y comunitaria en Colombia.

Este documento cumple dos funciones distintas y complementarias:

1. **Reglas de captura (RN-000 a RN-140).** Gobiernan qué se puede registrar, en qué formato y bajo qué condiciones. Garantizan la calidad del dato.
2. **Reglas de decisión (RN-200 a RN-226).** Gobiernan qué debe ocurrir cuando el instrumento detecta un riesgo. Convierten el dato en atención en salud.

La caracterización poblacional no es un fin en sí misma: su propósito es identificar riesgos y desencadenar atenciones. Un instrumento que sólo captura información sin producir decisiones no cumple su objeto.

### 1.2 Marco normativo

| Norma | Materia |
|---|---|
| Ley 1581 de 2012 | Protección de datos personales |
| Decreto 1377 de 2013 | Reglamentario de protección de datos |
| Ley 1751 de 2015 | Estatutaria del derecho fundamental a la salud |
| Resolución 3280 de 2018 | RIAS – Promoción y Mantenimiento de la Salud y Materno Perinatal |
| Resolución 459 de 2012 | Protocolo de atención a víctimas de violencia sexual |
| Ley 1098 de 2006 | Código de Infancia y Adolescencia |
| Resolución 2626 de 2019 | Modelo de Acción Integral Territorial |
| Decreto 1011 de 2006 | Sistema Obligatorio de Garantía de Calidad |
| Protocolos INS – SIVIGILA | Notificación de eventos de interés en salud pública |

### 1.3 Convenciones del documento

| Marca | Significado |
|---|---|
| **Obligatorio** | El sistema impide avanzar sin el dato |
| **Condicionado** | Se habilita según la respuesta a otro ítem |
| **Calculado** | Derivado automáticamente, de sólo lectura |
| **Heredado** | Tomado de otro ítem de la misma ficha, de sólo lectura |
| **Bloqueo** | Impide continuar o sincronizar |
| **Advertencia** | Solicita confirmación pero permite continuar |
| 🔴 | Prioridad INMEDIATA |
| 🟠 | Prioridad PRIORITARIA |
| 🟡 | Prioridad REGULAR |

Cada regla referencia el **ítem** del formulario impreso que le da origen. Las reglas sin ítem asociado corresponden a requisitos transversales de arquitectura, seguridad o decisión clínica.

---

## 2. Bloque 0: Modelo estructural del instrumento

### RN-000 — Modelo de cardinalidad y repetición

El instrumento no es un formulario plano: es una estructura jerárquica de bloques repetibles. Toda implementación debe respetar la siguiente cardinalidad:

| Nivel | Ítems | Cardinalidad | Se repite por |
|---|---|---|---|
| Ficha / Entorno | 1 – 20 | **1 por visita** | — |
| Vivienda | 21 – 49 | **1 por ficha** | — |
| **Familia** | 50 – 57 | **N por vivienda** | Cada familia declarada en el ítem 28 |
| **Integrante** | 58 – 110 | **N por familia** | Cada integrante declarado en el ítem 51 |
| Plan — Vivienda | 111 – 119 | 1 por vivienda | — |
| Plan — Familia | 120 – 129 | N por vivienda | Cada familia |
| Plan — Persona | 130 – 140 | N por familia | Cada integrante intervenido |

Los bloques de Familia e Integrante son **repetibles y navegables de forma independiente**: el encuestador debe poder capturar, editar y revisar cada instancia por separado, y el sistema debe mostrar en todo momento el avance de la captura (por ejemplo, "Integrante 3 de 5"). Ninguna instancia puede sobrescribir a otra.

---

## 3. Bloque 1: Autorización y seguridad inicial

### RN-001 — Consentimiento informado

**Ítem 1.** Toda captura de datos requiere el consentimiento informado registrado obligatoriamente según la Ley 1581 de 2012 y el Decreto 1377 de 2013, mediante una opción binaria exclusiva ("SÍ" / "NO").

Si el usuario selecciona **"NO"**, el sistema bloquea la captura de datos subsiguiente por razones de protección de datos y cierra la ficha registrando únicamente la novedad de no aceptación, sin datos identificables. Ver RN-224.

### RN-002 — Identificación de situaciones inminentes que ponen en peligro la vida

**Ítem 2.** Al inicio de la interacción, el sistema exige clasificar el estado de riesgo inmediato del entorno o de los individuos bajo cuatro opciones mutuamente excluyentes: "Física (urgencia vital)", "Psicológica (urgencia vital en salud mental)", "Situación de emergencia o desastre" o "No aplica".

Si se selecciona cualquiera de las tres primeras, el sistema dispara una alerta visual de atención prioritaria y aplica el procedimiento de **RN-201**.

---

## 4. Bloque 2: Identificación geográfica y del equipo de salud

### RN-003 — Departamento

**Ítem 3.** Campo de selección obligatoria contra el catálogo DIVIPOLA del DANE. Para el despliegue actual queda **fijado y de sólo lectura** en `76 – Valle del Cauca`. El sistema almacena código y nombre por separado.

Si un futuro despliegue habilita otro departamento, la restricción se administra por **parámetro de configuración** y no por código fuente.

### RN-004 — Unidad Zonal de Planeación y Evaluación (UZPE)

**Ítem 4.** Campo de selección obligatoria del catálogo parametrizado de unidades zonales definidas por la Secretaría de Salud Pública Municipal. Su valor debe ser coherente con el municipio del ítem 5 y determina el agrupamiento territorial para los reportes de gestión del riesgo poblacional. No admite texto libre.

### RN-005 — Municipio / Área no municipalizada

**Ítem 5.** Campo de selección obligatoria del catálogo DIVIPOLA **filtrado por el departamento del ítem 3**. Para el despliegue actual queda fijado y de sólo lectura en `76001 – Santiago de Cali`.

El sistema debe rechazar cualquier municipio cuyo código no inicie con el código del departamento seleccionado (coherencia jerárquica DIVIPOLA).

### RN-006 — Área de ubicación de la vivienda

**Ítem 6.** Selección única y obligatoria del área geográfica de la vivienda bajo las categorías exclusivas: "Área Urbana", "Área rural" o "Centro poblado".

### RN-007 — Territorio

**Ítem 7.** Selección única obligatoria del catálogo parametrizado de territorios de salud (identificadores `T48` a `T84`, ver **Anexo A**).

El territorio seleccionado determina la lista de microterritorios habilitados en el ítem 8 y debe ser coherente con el área de ubicación del ítem 6: los territorios marcados como `Rural` en el catálogo sólo son seleccionables cuando el ítem 6 es "Área rural" o "Centro poblado".

### RN-008 — Microterritorio

**Ítem 8.** Selección única obligatoria, **dependiente y en cascada** del territorio del ítem 7. El sistema sólo habilita los microterritorios (`MT01`–`MT04`) asociados al territorio elegido según el **Anexo A**.

Si se modifica el territorio, el microterritorio previamente seleccionado se limpia automáticamente. El registro almacena el código del microterritorio y la **comuna asociada**, que se hereda como campo derivado de sólo lectura.

### RN-009 — División territorial menor

**Ítem 9.** Campo de texto alfanumérico libre y obligatorio que detalla la micro-localización de la vivienda dentro del microterritorio: Corregimiento, Centro poblado, Vereda, Localidad, Barrio o Resguardo Indígena.

Cuando el ítem 6 es "Área Urbana" el contenido esperado es barrio o localidad; cuando es "Área rural" o "Centro poblado", corregimiento, vereda o resguardo.

### RN-010 — Identificación del Equipo de Salud

**Ítem 10.** Campo alfanumérico obligatorio y único que identifica el código asignado al Equipo Básico de Salud (EBS) que realiza la caracterización. Formato: 3 a 20 caracteres alfanuméricos. Se hereda a los ítems 111, 120 y 130.

### RN-011 — Prestador primario / Organismo de adscripción

**Ítem 11.** Campo de texto o catálogo obligatorio para registrar la Institución Prestadora de Servicios de Salud (IPS) pública o entidad de adscripción legal a la que pertenece el EBS.

### RN-012 — Tipo de identificación del responsable

**Ítem 12.** Selección única y obligatoria del documento de identidad de quien aplica la ficha, restringido a: **CC** (Cédula de Ciudadanía), **CD** (Carné Diplomático), **CE** (Cédula de Extranjería) y **PT** (Permiso por Protección Temporal).

### RN-013 — Número de identificación del responsable

**Ítem 13.** Campo alfanumérico obligatorio, ligado al tipo de documento seleccionado, que identifica de forma unívoca al profesional o técnico a cargo de la recolección.

| Tipo | Formato |
|---|---|
| CC | 6 a 10 dígitos numéricos |
| CD, CE, PT | 5 a 16 caracteres alfanuméricos |

### RN-014 — Perfil profesional del responsable

**Ítem 14.** Campo de selección obligatoria para registrar la disciplina o rol formal en salud del encuestador (médico, enfermero, psicólogo, auxiliar de enfermería, gestor comunitario, entre otros). Si se selecciona "Otro", se exige el campo aclaratorio.

### RN-015 — Código de la ficha

**Ítem 15.** Identificador **alfanumérico único, generado automáticamente por el sistema y de sólo lectura**. Se compone de: código de municipio + código de EBS + consecutivo + fecha de captura.

Es la llave primaria de trazabilidad de la caracterización y no puede ser modificado ni reutilizado. En captura sin conexión, el código se genera localmente con un prefijo de dispositivo que garantice unicidad al sincronizar.

### RN-016 — Fecha de diligenciamiento de la ficha

**Ítem 16.** Campo tipo fecha obligatorio en formato `AAAA/MM/DD`, prediligenciado con la fecha del sistema.

- **No admite fechas futuras.**
- No admite fechas anteriores en más de **30 días** a la fecha de sincronización.
- Toda fecha de seguimiento del Plan de Cuidado (ítems 118, 119, 128, 129, 139, 140) debe ser cronológicamente igual o posterior a esta fecha.

### RN-017 — Entorno de identificación

**Ítem 17.** Campo de selección obligatoria para determinar el ámbito donde se realiza la identificación: "Hogar", "Comunitario", "Institucional", "Educativo" o "Laboral".

### RN-018 — Nombre de la institución o entidad

**Ítem 18.** Campo de texto alfanumérico **condicionado**, obligatorio únicamente si el entorno del ítem 17 corresponde a Institucional, Educativo, Laboral o Comunitario estructurado.

### RN-019 — Líder o representante del entorno

**Ítem 19.** Campo de texto obligatorio para capturar el nombre de la cabeza de familia, líder comunitario, rector o representante legal, según el tipo de entorno seleccionado.

### RN-020 — Programa Jóvenes en Paz

**Ítem 20.** Selección excluyente obligatoria ("Sí" / "No") para identificar si algún miembro que habita la vivienda se encuentra activo en dicho programa estatal de protección.

---

## 5. Bloque 3: Datos de la vivienda y caracterización del entorno

### RN-021 — Dirección

**Ítem 21.** Campo de texto alfanumérico obligatorio para registrar la dirección exacta de la vivienda, estructurada bajo nomenclatura urbana o rural. La captura se realiza por componentes y la regla se cumple cuando la nomenclatura queda completa y puede componerse la cadena normalizada.

### RN-022 — Coordenada geográfica de latitud

**Ítem 22.** Campo numérico decimal obligatorio, capturado automáticamente por el GPS del dispositivo y editable sólo por excepción justificada. Rango válido de captura: **−90 a 90**, con mínimo 6 decimales.

El sistema **advierte sin bloquear** cuando el valor quede fuera del recuadro municipal de Santiago de Cali: **3.24 a 3.56**, rango que comprende tanto la zona urbana como la totalidad del área rural, desde el límite sur en Pance y los Farallones hasta el límite norte en Golondrinas y Montebello.

Si el dispositivo no obtiene señal GPS —situación frecuente en zona de ladera y corregimientos—, la ficha puede continuar pero queda marcada como **georreferenciación pendiente** y no puede cerrarse hasta capturarla o registrar el motivo de imposibilidad.

### RN-023 — Coordenada geográfica de longitud

**Ítem 23.** Campo numérico decimal obligatorio con las mismas condiciones de captura de RN-022. Rango válido: **−180 a 180**, con mínimo 6 decimales.

El sistema advierte sin bloquear cuando el valor quede fuera del recuadro municipal: **−76.78 a −76.40**, que abarca desde el límite occidental en la cordillera (Kilómetro 18, El Saladito, Felidia, Pichindé) hasta el límite oriental sobre el río Cauca (Navarro, Cascajal).

Latitud y longitud deben registrarse siempre **como par**: no se admite una sin la otra.

> El recuadro municipal es un **parámetro de configuración**, no un valor fijo en código, para permitir su ajuste sin nueva versión de la aplicación.

### RN-024 — Punto de referencia

**Ítem 24.** Campo de texto alfanumérico obligatorio para consignar descripciones geográficas o hitos visuales que faciliten la localización exacta del hogar en territorio.

### RN-025 — Número de identificación del hogar

**Ítem 25.** **Llave alfanumérica única generada por el sistema**, de sólo lectura, que identifica de forma unívoca la unidad de vivienda física caracterizada.

Se conserva estable entre visitas: si el EBS regresa a la misma dirección georreferenciada, el sistema debe recuperar el hogar existente en lugar de crear uno nuevo. Es la llave que se hereda en los ítems 112, 121 y 131.

### RN-026 — Número de identificación de la familia

**Ítem 26.** **Llave alfanumérica única generada por el sistema**, de sólo lectura, subordinada al ID del hogar (RN-025). Una vivienda puede contener varias familias; cada una recibe su propio identificador.

Es la llave que se hereda en los ítems 122 y 132. La cantidad de identificadores de familia creados bajo un hogar debe coincidir exactamente con el valor del ítem 28.

### RN-027 — Estrato socioeconómico

**Ítem 27.** Selección única obligatoria estructurada en seis categorías ordinales excluyentes: "Bajo - Bajo", "Bajo", "Medio - Bajo", "Medio", "Medio - Alto" y "Alto".

### RN-028 — Número de hogares familiares en la vivienda

**Ítem 28.** Campo numérico entero obligatorio, **mayor o igual a 1**. Determina cuántos núcleos familiares independientes comparten la vivienda y, por tanto, cuántas fichas familiares (ítems 50–57) deben diligenciarse bajo el mismo ID de hogar.

El sistema no permite cerrar la caracterización de la vivienda mientras existan familias declaradas sin caracterizar.

### RN-029 — Número de personas en la vivienda

**Ítem 29.** Campo numérico entero obligatorio, **mayor a 0**. Debe ser **mayor o igual** a la suma de los integrantes declarados en el ítem 51 de todas las familias del hogar; si resulta menor, el sistema bloquea el avance por inconsistencia.

Valores superiores a 20 exigen confirmación explícita del encuestador.

### RN-030 — Número de habitaciones por vivienda

**Ítem 30.** Campo numérico entero obligatorio, **mayor a 0**, que cuenta exclusivamente los espacios usados para dormir, excluyendo cocina, baños, garajes y espacios de uso comercial. Es el denominador del cálculo de hacinamiento (RN-032).

### RN-031 — Elementos para dormir

**Ítem 31.** Campo numérico entero obligatorio, **mayor o igual a 0**, que suma camas, colchones, colchonetas, hamacas, camarotes y sofacamas disponibles en el hogar.

El sistema genera **alerta de riesgo por déficit de elementos para dormir** cuando el valor es menor que el número de personas de la vivienda (ítem 29) dividido en 2, por su asociación con hacinamiento crítico y transmisión de enfermedades respiratorias.

### RN-032 — Personas por habitación *(calculado)*

**Ítem 32.** Campo de **cálculo automático y de sólo lectura**:

```
Personas por habitación = Personas en la vivienda (ítem 29) / Habitaciones (ítem 30)
```

El resultado se expresa con un decimal y se recalcula automáticamente ante cualquier cambio en los ítems 29 o 30. No es editable por el encuestador.

### RN-033 — Hacinamiento *(calculado, con efecto en decisión)*

**Ítem 33.** Clasificación binaria ("Sí" / "No") **derivada automáticamente** de RN-032, según el criterio DANE:

| Personas por habitación | Hacinamiento | Efecto |
|---|---|---|
| ≤ 2.0 | No | Sin alerta |
| > 2.0 y ≤ 3.0 | **Sí** | Alerta 🟡 REGULAR |
| > 3.0 | **Sí (crítico)** | Alerta 🟠 PRIORITARIA |

El campo no es editable manualmente. Cuando el resultado es "Sí", el sistema activa de forma obligatoria la alerta de **riesgo de transmisión respiratoria (TB, ERA)** y exige al menos una acción de intervención en el Plan de Cuidado de la Vivienda (ítem 114). Ver **RN-211**.

### RN-034 — Tipo de vivienda

**Ítem 34.** Selección única obligatoria de la lista cerrada: "Casa", "Apartamento", "Tipo Cuarto", "Vivienda tradicional Indígena", "Carpa", "Vivienda tradicional étnica", "Contenedor", "Embarcación", "Vagón", "Refugio Natural", "Cueva" y "Puente".

### RN-035 — Material predominante del techo

**Ítem 35.** Selección única y obligatoria del material de cubierta entre: "Concreto", "Tejas de barro", "Fibrocemento sin asbesto", "Zinc", "Plástico", "Teja o lámina de fibrocemento con asbesto", "Palma o paja" o "Desechos (cartón, lata, etc.)".

La opción **con asbesto** activa alerta de riesgo ambiental conforme a RN-211.

### RN-036 — Escenarios de riesgo de accidente en la vivienda

**Ítem 36.** Campo de selección múltiple no excluyente. Si se selecciona **"Ninguno"**, se desmarcan automáticamente el resto de opciones de riesgo físico o locativo.

La presencia de riesgos eleva la prioridad únicamente cuando la ficha registra menores de 5 años o adultos mayores de 70 entre los integrantes (RN-211).

### RN-037 — Criaderos o reservorios de vectores

**Ítem 37.** Selección única obligatoria entre "Sí", "No" o "No aplica", para registrar factores de riesgo que favorezcan enfermedades de transmisión vectorial cercanas a la vivienda.

### RN-038 — Factores de contaminación y entorno peridomiciliario

**Ítem 38.** Selección múltiple de elementos circundantes que afectan la salud ambiental (porquerizas, cultivos, ruido, asbesto, industrias, extracción minera, entre otros). La selección de **"Ninguno"** anula las demás selecciones.

---

## 6. Bloque 4: Actividades económicas, zoonosis y saneamiento ambiental

### RN-039 — Actividad económica interna

**Ítem 39.** Opción binaria exclusiva ("Sí" / "No") para validar si se ejecutan microempresas, talleres, comercios u otras actividades productivas dentro del domicilio.

### RN-040 — Animales en la vivienda o entorno

**Ítem 40.** Selección múltiple de especies animales que conviven en el predio (perros, gatos, porcinos, bovinos, equinos, ovinos/caprinos, aves de producción, aves ornamentales, peces ornamentales, hámster, cobayos, conejos, animales silvestres, otro).

Si se selecciona **"Ninguno"**, se inactiva el resto. Si se selecciona **"Otro"**, se habilita un campo de texto aclaratorio.

### RN-041 — Número de perros en la vivienda

**Ítem 41.** Campo numérico entero **condicionado**, obligatorio y mayor a 0 únicamente si en el ítem 40 se marcó "Perros". Si no se marcó, el campo se inactiva y se almacena en 0.

Valores superiores a 10 exigen confirmación explícita y activan alerta de **posible tenencia irregular o criadero no declarado**, que debe verificarse contra el ítem 39.

### RN-042 — Cantidad de perros con vacuna antirrábica

**Ítem 42.** Campo numérico entero condicionado, obligatorio si el ítem 41 es mayor a 0. Su valor debe ser **mayor o igual a 0 y menor o igual al ítem 41**; el sistema rechaza cualquier valor superior por inconsistencia lógica.

Cuando el valor es **menor** que el ítem 41, el sistema calcula el déficit de cobertura y activa la alerta de **riesgo de rabia por canino no inmunizado**, que obliga a registrar acción de canalización a vacunación antirrábica en el Plan de Cuidado de la Vivienda (ítem 114).

### RN-043 — Número de gatos en la vivienda

**Ítem 43.** Campo numérico entero condicionado, obligatorio y mayor a 0 únicamente si en el ítem 40 se marcó "Gatos". Si no se marcó, se inactiva y se almacena en 0. Aplican las mismas condiciones de confirmación por valores atípicos de RN-041.

### RN-044 — Cantidad de gatos con vacuna antirrábica

**Ítem 44.** Campo numérico entero condicionado, obligatorio si el ítem 43 es mayor a 0. Su valor debe ser **mayor o igual a 0 y menor o igual al ítem 43**. Cuando es menor, activa la alerta de **riesgo de rabia por felino no inmunizado** con la misma obligación de canalización de RN-042.

### RN-045 — Vigencia del carné de vacunación antirrábica

**Ítem 45.** Selección única condicionada ("Sí" / "No" / "No aplica"). Se activa como **obligatoria** cuando la suma de los ítems 41 y 43 es mayor a 0; en caso contrario se autoasigna "No aplica" y queda de sólo lectura.

La pregunta valida específicamente que el carné tenga una **vigencia inferior a 3 años**, conforme al esquema nacional de vacunación antirrábica animal. Un carné con más de 3 años se registra como "No", aunque exista físicamente.

**Coherencia obligatoria:** si el ítem 42 es igual al ítem 41 y el ítem 44 es igual al ítem 43 (cobertura total declarada), la respuesta esperada es "Sí"; si el encuestador registra "No", el sistema solicita confirmación por contradicción entre la cobertura declarada y la vigencia del carné.

Toda respuesta "No" activa la alerta de **riesgo de rabia** y obliga a registrar la canalización correspondiente.

### RN-046 — Fuente de agua para consumo humano

**Ítem 46.** Selección única obligatoria del método principal de abasto de agua a partir de las trece opciones del instrumento: acueducto administrado por ESP, acueducto veredal o comunitario, pila pública, agua embotellada o en bolsa, carro tanque, abasto con distribución comunitaria, pozo con bomba, pozo sin bomba/aljibe/jagüey/barreno, laguna o jagüey, río o quebrada, manantial o nacimiento, aguas lluvias, aguatero.

Las fuentes no tratadas activan alerta de **agua no apta para consumo humano** conforme a RN-211.

### RN-047 — Sistema de disposición de excretas

**Ítem 47.** Selección única obligatoria: sanitario conectado al alcantarillado, sanitario y letrina, sanitario conectado a pozo séptico, sanitario ecológico seco, sanitario sin conexión, sanitario con disposición a fuente hídrica, o campo abierto.

### RN-048 — Disposición de aguas residuales domésticas

**Ítem 48.** Selección única obligatoria entre seis opciones: Alcantarillado, Pozo séptico, Campo de oxidación, Biofiltro, Fuente hídrica o Campo abierto.

### RN-049 — Disposición final de residuos sólidos

**Ítem 49.** Selección única obligatoria: recolección por servicio de aseo distrital o municipal, enterramiento, quema a campo abierto, disposición en fuentes de agua cercana, o disposición a campo abierto.

---

## 7. Bloque 5: Estructura, contexto familiar y cuidado del cuidador

### RN-050 — Tipo de familia

**Ítem 50.** Selección única obligatoria que clasifica la estructura del hogar: Nuclear biparental, Nuclear monoparental, Extenso biparental, Extenso monoparental, Compuesto biparental, Compuesto monoparental o Unipersonal.

### RN-051 — Número de integrantes de la familia

**Ítem 51.** Campo numérico entero obligatorio y **mayor a 0**, que declara cuántas personas conforman la familia.

**Este valor determina cuántas veces debe diligenciarse la sección 5 completa (ítems 58 a 110): una instancia por cada integrante, sin excepción.** El sistema genera automáticamente los formularios individuales correspondientes al valor declarado.

**Condiciones de integridad:**

1. El número de registros individuales creados debe ser **exactamente igual** al valor del ítem 51. Si el encuestador reduce el número, el sistema advierte qué registros se eliminarán; si lo aumenta, genera las instancias faltantes.
2. **Ningún integrante puede quedar incompleto.** Una instancia se considera completa cuando se han diligenciado todos los campos obligatorios *habilitados para ese individuo* según su edad y sexo. Un menor de 6 meses no responde tensión arterial y eso no lo hace incompleto; un adulto sin peso ni talla, sí.
3. Debe existir **exactamente un** integrante con rol "Responsable económico de la familia" (ítem 72) por cada familia.
4. La suma de los integrantes de todas las familias del hogar no puede superar el ítem 29 (RN-029).
5. La ficha **no puede cerrarse ni sincronizarse** mientras exista al menos un integrante declarado sin caracterizar (RN-222).

### RN-052 — Identificación de cuidador principal

**Ítem 52.** Opción excluyente obligatoria ("Sí" / "No") para determinar la presencia de un actor principal encargado de niños, niñas, personas con discapacidad, adulto mayor o persona enferma.

### RN-053 — Puntaje Escala de Zarit

**Ítem 53.** Campo condicionado y obligatorio únicamente si el ítem 52 fue "Sí". El sistema fuerza la selección exclusiva de una de las tres clasificaciones: "Ausencia de sobrecarga (≤ 46)", "Sobrecarga ligera (47–55)" o "Sobrecarga intensa (≥ 56)".

El resultado determina la conducta definida en **RN-212**.

### RN-054 — Situaciones familiares de riesgo en salud mental o física

**Ítem 54.** Selección múltiple de acontecimientos vitales estresantes o condiciones de vulnerabilidad: inicio de la convivencia en pareja, llegada de un nuevo integrante, ingreso a estudiar, pérdida del año escolar, embarazo temprano o adolescente, independencia de los hijos, separación, jubilación, duelo, desempleo o pérdida abrupta del trabajo, pérdidas o crisis económicas, muerte inesperada, migración, enfermedad terminal u orfandad, accidente o situación que genera discapacidad, antecedentes de intento o muerte por suicidio, vivencia de alguna forma de violencia, persona en situación de abandono, consumo problemático de SPA incluyendo alcohol, trastorno de salud mental.

Si no aplica ninguna, se selecciona la opción excluyente **"Ninguna"**.

Los ítems relacionados con violencia, suicidio y abandono activan las reglas de decisión **RN-202**, **RN-206** y **RN-212**.

---

## 8. Bloque 6: Prácticas protectoras y redes de apoyo

### RN-055 — Prácticas de vínculo familiar

**Ítem 55.** Selección múltiple de dinámicas saludables observables o referidas de convivencia interna (manejo pacífico de tensiones, decisiones concertadas, resolución de conflictos, comunicación basada en escucha activa, acompañamiento a niños y adolescentes, consideración de las personas mayores). No cuenta con opción de exclusión explícita.

La **ausencia total de prácticas protectoras** constituye factor de riesgo familiar y debe considerarse en la semaforización de RN-221.

### RN-056 — Redes de apoyo social

**Ítem 56.** Selección única obligatoria estructurada en tres niveles jerárquicos de percepción de soporte comunitario o institucional: cuenta con redes protectoras; cuenta con redes pero podría ampliarlas; no identifica o no cuenta con redes.

La tercera opción constituye determinante social de aislamiento y se cruza con el ítem 105.

### RN-057 — Prácticas de cuidado de la salud en el hogar

**Ítem 57.** Selección múltiple de conductas higiénicas, sanitarias y ambientales protectoras: tratamiento casero del agua, ventilación, evitar tabaco y leña, manejo de residuos sólidos, limpieza de pisos y paredes, uso de toldillos y trampas, limpieza del peridomicilio, almacenamiento seguro de productos químicos.

---

## 9. Bloque 7: Identificación individual de los integrantes de la familia

> Este bloque se repite por cada integrante declarado en el ítem 51 (RN-000, RN-051).

### RN-058 — Primer nombre

**Ítem 58.** Campo de texto obligatorio. Sólo permite caracteres alfabéticos y espacios.

### RN-059 — Segundo nombre

**Ítem 59.** Campo de texto alfabético opcional.

### RN-060 — Primer apellido

**Ítem 60.** Campo de texto alfabético obligatorio.

### RN-061 — Segundo apellido

**Ítem 61.** Campo de texto alfabético opcional.

### RN-062 — Tipo de identificación del integrante

**Ítem 62.** Selección obligatoria restrictiva del catálogo legal vigente en Colombia:

| Código | Documento |
|---|---|
| AS | Adulto sin Identificación |
| CC | Cédula de Ciudadanía |
| CD | Carné Diplomático |
| CE | Cédula de Extranjería |
| MS | Menor sin Identificación |
| NV | Certificado de Nacido Vivo |
| PE | Permiso Especial de Permanencia |
| PT | Permiso por Protección Temporal |
| RC | Registro Civil |
| TI | Tarjeta de Identidad |

### RN-063 — Número de identificación del integrante

**Ítem 63.** Campo alfanumérico obligatorio, **ligado al tipo de documento del ítem 62**:

| Tipo | Formato exigido |
|---|---|
| CC, TI | 6 a 10 dígitos numéricos |
| RC | 8 a 11 dígitos numéricos |
| CE, PE, PT, CD | 5 a 16 caracteres alfanuméricos |
| NV | Número de certificado de nacido vivo |
| MS, AS | Identificador temporal autogenerado por el sistema |

El número **debe ser único dentro de la ficha**: dos integrantes de la misma familia no pueden compartir tipo y número de documento.

Al sincronizar, la combinación **tipo + número** es la llave de deduplicación de personas entre visitas y entre hogares, de modo que una misma persona caracterizada dos veces no se contabilice como dos individuos en los indicadores poblacionales.

Los tipos **MS** y **AS** activan de forma obligatoria la alerta de **barrera de identificación**, que exige registrar en el Plan de Cuidado la canalización a Registraduría, por ser condición previa para la afiliación al SGSSS (ver RN-209).

### RN-064 — Fecha de nacimiento y edad calculada

**Ítem 64.** Campo tipo fecha obligatorio en formato `AAAA/MM/DD`. **No admite fechas futuras** ni fechas que impliquen una edad superior a 120 años.

A partir de ella el sistema calcula automáticamente un campo derivado de sólo lectura, **Edad**, expresado en **años, meses y días**, tomando como referencia la fecha de diligenciamiento del ítem 16. La precisión en meses y días es obligatoria porque de ella dependen dos reglas de habilitación fina: lactancia materna exclusiva en menores de 6 meses (RN-091) y signos de desnutrición aguda entre 3 meses y 5 años (RN-097).

> La edad calculada es la **única fuente válida** para habilitar o inhabilitar las preguntas condicionadas por edad. Ninguna de esas preguntas puede depender de una edad digitada manualmente.

**Coherencia obligatoria entre tipo de documento y edad:**

| Tipo | Documento | Edad esperada | Validación |
|---|---|---|---|
| **NV** | Certificado de Nacido Vivo | 0 a 1 año | Advertencia |
| **RC** | Registro Civil | 0 a 6 años | Advertencia |
| **TI** | Tarjeta de Identidad | 7 a 17 años | Advertencia |
| **CC** | Cédula de Ciudadanía | ≥ 18 años | Advertencia |
| **MS** | Menor sin Identificación | < 18 años | **Bloqueo** |
| **AS** | Adulto sin Identificación | ≥ 18 años | **Bloqueo** |
| **CE** | Cédula de Extranjería | Cualquier edad | Exige nacionalidad ≠ Colombia |
| **CD** | Carné Diplomático | Cualquier edad | Exige nacionalidad ≠ Colombia |
| **PE** | Permiso Especial de Permanencia | Cualquier edad | Exige nacionalidad ≠ Colombia |
| **PT** | Permiso por Protección Temporal | Cualquier edad | Exige nacionalidad ≠ Colombia |

**Criterio de severidad.** Las inconsistencias de NV, RC, TI y CC se resuelven con **advertencia y confirmación**, no con bloqueo, porque existen casos legítimos de trámite pendiente: un niño de 8 años que aún no ha tramitado la TI, o un joven de 18 que no ha renovado la CC, son situaciones frecuentes en territorio y no deben impedir la caracterización.

Las inconsistencias de **MS y AS sí bloquean**, porque el rango de edad forma parte de la definición misma del tipo.

Los tipos **PE y PT** activan automáticamente la alerta de **población migrante** (RN-065), por corresponder al Estatuto Temporal de Protección para Migrantes Venezolanos.

### RN-065 — Nacionalidad

**Ítem 65.** Selección única obligatoria del catálogo de países, prediligenciado en "Colombia". Cuando la nacionalidad es distinta de Colombia, el sistema debe:

1. Exigir coherencia con el tipo de documento del ítem 62 (se esperan CE, PE, PT o CD; el uso de CC o TI genera advertencia).
2. Activar la alerta de **población migrante**, que se cruza con el ítem 77 ("Migrantes") y con el régimen de afiliación del ítem 75, dado que la condición migratoria es la principal barrera de acceso efectivo a los servicios de salud.

### RN-066 — Sexo

**Ítem 66.** Selección única y obligatoria entre tres opciones excluyentes: **"Hombre", "Mujer" o "Intersexual (Indeterminado)"**.

Este campo, combinado con la edad calculada de RN-064, **determina la matriz de tamizajes exigibles del ítem 87** (tamizaje de cuello uterino, mama, próstata, anemia en mujeres) y habilita las preguntas de gestación de los ítems 84, 85 y 88.

> Es un campo distinto e independiente del género (ítem 67) y de la autoidentificación de género (ítem 68). El sistema no debe inferir ninguno de ellos a partir de este campo, ni usar el género para determinar tamizajes de base biológica.

### RN-067 — Género

**Ítem 67.** Selección exclusiva y obligatoria entre "Femenino" o "Masculino".

### RN-068 — Autoidentificación de género ampliada

**Ítem 68.** Selección obligatoria de autorreconocimiento: "Femenino", "Masculino", "Transexual", "Transgenero", "No responde" u "Otro". Si se escoge "Otro", el sistema exige diligenciar el campo "¿Cuál?".

### RN-069 — Orientación sexual

**Ítem 69.** Selección única obligatoria para personas dentro del rango de edad correspondiente: Heterosexual, Lesbiana, Gay, Bisexual, No responde u Otro (con campo obligatorio "¿Cuál?" si se selecciona).

Este dato es **sensible** y tiene tratamiento reforzado conforme a RN-224.

### RN-070 — Teléfono 1

**Ítem 70.** Campo numérico **obligatorio a nivel de familia**: al menos un integrante del núcleo debe registrar un número de contacto válido. Acepta 10 dígitos para telefonía móvil o 7 dígitos para fija; el sistema rechaza secuencias repetidas o consecutivas evidentemente falsas.

Sin un número de contacto válido en la familia, el sistema **no permite cerrar la ficha**, porque toda derivación registrada en el Plan de Cuidado y todo seguimiento de los ítems 118, 119, 128, 129, 139 y 140 dependen de la posibilidad de contactar al hogar.

Si el hogar carece de teléfono, debe registrarse explícitamente la novedad **"sin medio de contacto telefónico"**, lo que activa la alerta de **riesgo de pérdida de seguimiento**.

### RN-071 — Teléfono 2

**Ítem 71.** Campo numérico **opcional** de contacto alternativo, con las mismas validaciones de formato de RN-070. No puede ser idéntico al teléfono 1 del mismo integrante.

Se recomienda su diligenciamiento en hogares con alertas de prioridad INMEDIATA o PRIORITARIA, donde la continuidad del contacto es crítica.

### RN-072 — Rol dentro de la familia

**Ítem 72.** Selección única obligatoria para determinar el parentesco del individuo dentro de la unidad de análisis del hogar: Responsable económico de la familia, Cónyuge o compañero(a), Hijo(a), Hermano(a), Padre o madre, u Otros.

Debe existir exactamente un "Responsable económico" por familia (RN-051).

---

## 10. Bloque 8: Características socioeconómicas y de vulnerabilidad individual

### RN-073 — Ocupación

**Ítem 73.** Campo de texto o catálogo obligatorio para personas de **15 años o más**, que registra la actividad u oficio principal desempeñado. Para menores de 15 años se autoasigna "No aplica".

Se recomienda el uso del catálogo **CIUO** (Clasificación Internacional Uniforme de Ocupaciones) para permitir análisis de riesgo ocupacional.

El registro de una ocupación en personas **entre 15 y 17 años** debe cruzarse con el ítem 39 y activa la alerta de **posible trabajo infantil o adolescente**, que exige verificación de las condiciones de protección laboral conforme al Código de Infancia y Adolescencia.

Las ocupaciones asociadas a exposición a agroquímicos, minería, construcción o manejo de asbesto deben cruzarse con el ítem 38 para caracterizar riesgo ocupacional del hogar.

### RN-074 — Nivel educativo

**Ítem 74.** Selección única obligatoria para personas de **5 años o más**, con las trece categorías del formulario: Preescolar, Básica Primaria, Básica Secundaria, Media Académica o Clásica, Media Técnica, Normalista, Técnica Profesional, Tecnológica, Profesional, Especialización, Maestría, Doctorado, Técnica Laboral o Ninguno.

**Coherencia con la edad:** el sistema advierte cuando el nivel declarado es incompatible con la edad calculada (por ejemplo, "Profesional" en un menor de 17 años, o "Doctorado" antes de los 24).

La opción **"Ninguno" en personas entre 5 y 17 años** activa la alerta de **desescolarización**, determinante social de primer orden, y exige registrar la canalización a la Secretaría de Educación en el Plan de Cuidado de la Persona.

En personas de 18 años o más, "Ninguno" se registra como determinante social de **analfabetismo**, que condiciona la comprensión de instrucciones terapéuticas y debe considerarse al concertar las acciones de cuidado del ítem 138.

### RN-075 — Régimen de afiliación

**Ítem 75.** Selección única obligatoria ligada al SGSSS: "Subsidiado", "Contributivo", "Especial", "Excepción" o "No afiliado". La opción "No afiliado" activa **RN-209**.

### RN-076 — EAPB

**Ítem 76.** Campo de texto o catálogo dinámico obligatorio para registrar la Entidad Administradora de Planes de Beneficios a la que está afiliado el individuo. Se desactiva automáticamente y se autoasigna "No aplica" si en el ítem 75 se seleccionó "No afiliado".

### RN-077 — Sujeto de especial protección constitucional

**Ítem 77.** Selección múltiple aplicable para identificar vulnerabilidades específicas: Niñas, niños o adolescentes; Gestante; Persona adulta mayor; Personas con orientación sexual diversa; Campesina o campesino; Migrantes; Madre cabeza de familia; Personas con enfermedades huérfanas; Víctima del conflicto armado; Víctima de violencia de género e intrafamiliar; Víctima de violencia interpersonal; Persona privada de la libertad (medida domiciliaria); Personas en el sistema de responsabilidad penal adolescente; Otro (con campo "¿Cuál?" obligatorio).

Admite la opción excluyente **"Ninguna"**. Las opciones de violencia activan **RN-206**; "Gestante" activa **RN-205**; "Migrantes" se cruza con RN-065.

### RN-078 — Modalidad de la violencia

**Ítem 78.** Campo de selección múltiple **condicionado**, obligatorio únicamente si en el ítem 77 se marcó "Víctima de violencia de género e intrafamiliar". Opciones válidas: **Física, Psicológica, Negligencia y abandono, Sexual, Patrimonial o económica**.

> **Corrección documental.** El formulario impreso presenta la opción *"Negligencia y abandono" duplicada*. El sistema debe registrarla **una sola vez**; la duplicación es un defecto de diagramación del instrumento y debe reportarse al Ministerio para su corrección (ver **Anexo C**).

La selección de la modalidad **Sexual**, o de cualquier modalidad en un menor de 18 años, activa la alerta de **prioridad INMEDIATA** y desencadena las obligaciones de **RN-206**.

### RN-079 — Pertenencia étnica

**Ítem 79.** Selección única obligatoria: "Indígena", "Rrom (Gitanos)", "Negro", "Afrocolombiano", "Raizal (San Andrés y Providencia)", "Palenquero de San Basilio de Palenque" o "Ninguna".

### RN-080 — Pueblo o comunidad étnica

**Ítem 80.** Campo condicionado de texto o catálogo, de obligatorio diligenciamiento si la respuesta del ítem 79 fue diferente a "Ninguna".

---

## 11. Bloque 9: Situación de salud, acceso y prácticas de cuidado individual

### RN-081 — Prácticas de saberes ancestrales

**Ítem 81.** Selección múltiple de mecanismos culturales de salud tradicional indígena o afro: prácticas de protección ante posibles daños, prácticas de acompañamiento en momentos de transición, prácticas tradicionales para el cuidado de la salud, prácticas de armonización, acompañamiento de partera o sabedor, prácticas de cuidado con el entorno. Incluye la opción **"Ninguna"** como bandera de exclusión.

### RN-082 — Discapacidad reconocida

**Ítem 82.** Selección múltiple de tipos de discapacidad según baremo oficial: Física, Auditiva, Visual, Sordoceguera, Intelectual, Psicosocial (mental), Múltiple, o **"Sin discapacidad"** como opción excluyente.

### RN-083 — Certificación y registro de discapacidad (RLCPD)

**Ítem 83.** Campo condicionado. Si en el ítem 82 se seleccionó alguna discapacidad, se vuelve obligatoria la selección binaria ("Sí" / "No"). Si se marcó "Sin discapacidad", se autoasigna "No aplica".

La respuesta "No" activa alerta de **barrera de acceso a certificación de discapacidad** y obliga a canalización al RLCPD.

### RN-084 — Intención reproductiva a corto plazo

**Ítem 84.** Selección única binaria obligatoria ("Sí" / "No") para orientar servicios de planificación familiar o ruta materno-perinatal.

### RN-085 — Gestación actual confirmada

**Ítem 85.** Campo obligatorio para personas con capacidad de gestar. Selección binaria ("Sí" / "No"). Si se marca "Sí", el sistema activa obligatoriamente las alertas de la **Ruta Materno Perinatal** conforme a **RN-205**.

### RN-086 — Prácticas rutinarias de cuidado integral

**Ítem 86.** Selección múltiple de hábitos de vida saludable: alimentación en cantidad y calidad suficiente, actividad física, higiene oral diaria, lavado de manos, sueño suficiente (6 a 8 horas), control del tiempo de pantalla (menos de 2 horas al día), actividades en tiempo libre u ocio, participación en actividades culturales o sociales. Contiene la opción excluyente **"Ninguna"**.

### RN-087 — Atenciones pendientes de promoción y mantenimiento

**Ítem 87.** Selección múltiple obligatoria que registra los vacíos de atención del individuo frente a la Ruta de Promoción y Mantenimiento de la Salud (Resolución 3280 de 2018).

**El sistema debe habilitar únicamente las atenciones exigibles según la edad calculada (RN-064) y el sexo (RN-066)**, conforme a la siguiente matriz:

| Atención | Edad | Sexo |
|---|---|---|
| Valoración Integral para la PYMS | Todas | Ambos |
| Valoración integral en salud bucal por odontología | Todas | Ambos |
| Promoción y apoyo a lactancia materna | 0 a 2 años y gestantes | — |
| Aplicación de flúor | 1 a 17 años | Ambos |
| Profilaxis y remoción de placa bacteriana | ≥ 2 años | Ambos |
| Vacunación de acuerdo con el esquema | 0 a 17 años y gestantes; ≥ 60 años | Ambos |
| Fortificación casera con micronutrientes en polvo | 6 a 23 meses | Ambos |
| Suplementación con micronutrientes | 6 meses a 12 años y gestantes | — |
| Desparasitación intestinal antihelmíntica | 1 a 17 años | Ambos |
| Tamizaje para anemia (Hb y Hto) | 6 meses a 5 años; mujeres en edad fértil y gestantes | — |
| Asesoría en anticoncepción (planificación familiar) | ≥ 13 años | Ambos |
| Suministro de anticonceptivos | ≥ 13 años | Ambos |
| Tamizaje de riesgo cardiovascular | ≥ 18 años | Ambos |
| Prueba rápida treponémica | ≥ 13 años y gestantes | Ambos |
| Prueba rápida y asesoría pre y post test VIH | ≥ 13 años y gestantes | Ambos |
| Prueba rápida Hepatitis B (18–28) y C (22–28) | 18 a 28 años | Ambos |
| Prueba de embarazo por retraso menstrual | ≥ 10 años | **Mujer / Intersexual** |
| Tamizaje para cáncer de cuello uterino | 20 a 28 años | **Mujer / Intersexual** |
| Colposcopia y biopsia cérvico uterina | ≥ 20 años | **Mujer / Intersexual** |
| Tamizaje para cáncer de mama | ≥ 40 años | **Mujer / Intersexual** |
| Tamizaje para cáncer de próstata | ≥ 50 años | **Hombre / Intersexual** |
| Tamizaje para cáncer de colon y recto | ≥ 50 años | Ambos |
| Educación para la salud | Todas | Ambos |

Las atenciones no exigibles para el perfil del individuo **no se muestran**, evitando que se registren pendientes que no le corresponden. Si el individuo está al día en todas las atenciones habilitadas, se marca la opción excluyente **"Ninguna"**.

**Enfoque diferencial.** En personas **intersexuales** el sistema habilita los tamizajes de ambos sexos y deja al criterio del profesional la selección según los órganos presentes. El mismo criterio aplica a personas cuya autoidentificación de género (ítem 68) sea "Transexual" o "Transgenero": la decisión de tamizaje se fundamenta en el **órgano presente**, no en el sexo registrado al nacer ni en el género declarado.

Toda atención marcada como pendiente **obliga** a registrar la barrera correspondiente en el ítem 89 (RN-089) y al menos una acción de canalización en el Plan de Cuidado de la Persona (ítem 136).

### RN-088 — Atenciones pendientes de la ruta materno perinatal

**Ítem 88.** Campo condicionado, obligatorio si en el ítem 77 se seleccionó "Gestante" o si la gestación actual del ítem 85 fue marcada "Sí". Lista: atención para el cuidado preconcepcional, Interrupción Voluntaria del Embarazo (IVE), atención para el cuidado prenatal, preparación para la maternidad y paternidad, atención del puerperio, provisión del método anticonceptivo post parto inmediato, atención y seguimiento del recién nacido, educación para la salud. Si no aplica, se marca **"Ninguna"**.

### RN-089 — Barreras de acceso a RPMS o ruta materno perinatal

**Ítem 89.** Campo condicionado, obligatorio si en los ítems 87 u 88 se marcó alguna atención pendiente (distinta de "Ninguna"). Captura los motivos administrativos, geográficos, de información o culturales. Si no había pendientes, se marca "Ninguna".

La clasificación y gestión de la barrera se define en **RN-210**.

### RN-090 — Conocimiento del derecho a la salud

**Ítem 90.** Selección múltiple de los niveles de empoderamiento y conocimiento normativo del usuario respecto al SGSSS: conoce los derechos y deberes en salud; tiene información sobre las atenciones y servicios a los que tiene derecho; conoce los lugares donde pueden prestar los servicios de salud; conoce cómo resolver las dificultades de acceso.

La ausencia de conocimiento se cruza con el ítem 89 como barrera de información (RN-210).

### RN-091 — Lactancia materna exclusiva

**Ítem 91.** Campo condicionado por edad, obligatorio únicamente si el integrante es menor de **6 meses**. Opciones: "Sí" o "No". Para mayor edad se autoasigna "No aplica".

La respuesta "No" en un menor de 6 meses activa canalización a apoyo en lactancia materna (ítem 87).

### RN-092 — Peso

**Ítem 92.** Campo numérico obligatorio con decimales, expresado en **kilogramos (kg)**. Usado para las validaciones de estado nutricional de RN-095 y RN-096.

### RN-093 — Talla

**Ítem 93.** Campo numérico obligatorio, expresado en **centímetros (cm)**.

### RN-094 — Circunferencia de cintura

**Ítem 94.** Campo condicionado por edad, obligatorio únicamente para personas de **18 años o más**, registrado en centímetros. Para menores se autoasigna "No aplica".

### RN-095 — Resultado IMC *(calculado)*

**Ítem 95.** Campo de cálculo automático del Índice de Masa Corporal:

```
IMC = Peso (kg) / (Talla (cm) / 100)²
```

Este cálculo se ejecuta obligatoriamente en individuos **mayores de 5 años**. Se recalcula automáticamente ante cualquier cambio en los ítems 92 o 93.

### RN-096 — Clasificación antropométrica

**Ítem 96.** Selección obligatoria basada en las tablas del Ministerio de Salud, según indicador Peso para la Talla (P/T) o IMC para la edad, teniendo en cuenta el grupo de edad y la condición de gestación: Obesidad, Sobrepeso, Riesgo de Sobrepeso, Peso adecuado para la talla o IMC adecuado para la edad, Riesgo de Desnutrición Aguda (< 5 años) o Riesgo de delgadez (> 4 años), Desnutrición Aguda Moderada, Desnutrición Aguda Severa, Riesgo de Delgadez, Delgadez, Bajo Peso para la Edad Gestacional, Normal.

La clasificación determina la conducta definida en **RN-204**.

### RN-097 — Signos físicos de desnutrición aguda en la infancia

**Ítem 97.** Campo condicionado por edad, obligatorio únicamente para niños y niñas entre **3 meses y 5 años**. Permite selección múltiple de zonas con signos clínicos: Cabeza, Cara, Piel, Tórax y abdomen, Extremidades, Comportamiento, Edema. Si no hay signos: "Ninguna". Si no cumple edad: "No aplica".

La presencia de **edema** constituye signo de desnutrición aguda severa y activa prioridad INMEDIATA conforme a RN-204.

### RN-098 — Medición de tensión arterial

**Ítem 98.** Campo condicionado por edad, obligatorio de forma numérica (Sistólica / Diastólica, en mmHg) únicamente para personas de **18 años o más**. Para menores: "No aplica".

### RN-099 — Clasificación de tensión arterial (AHA 2024)

**Ítem 99.** Campo de asignación condicionado por el resultado del ítem 98. Clasifica de forma exclusiva:

| Clasificación | Criterio |
|---|---|
| Crisis hipertensiva | Sistólica > 180 mmHg y/o diastólica > 120 mmHg |
| Alta – Hipertensión nivel 2 | Sistólica ≥ 140 mmHg o diastólica ≥ 90 mmHg |
| Alta – Hipertensión nivel 1 | Sistólica 130–139 mmHg o diastólica 80–89 mmHg |
| Elevada | Sistólica 120–129 mmHg y diastólica < 80 mmHg |
| Normal | Sistólica < 120 mmHg y diastólica < 80 mmHg |

Para menores de 18 años: "No aplica". La conducta asociada se define en **RN-203**.

### RN-100 — Diagnóstico de enfermedades no transmisibles

**Ítem 100.** Selección múltiple de patologías crónicas diagnosticadas previamente: enfermedad obstétrica (trastornos hipertensivos, hemorragias, sepsis, diabetes gestacional, otra), enfermedades cardiovasculares (hipertensión, enfermedad cardiaca), diabetes, cáncer, EPOC, enfermedades raras y huérfanas, trastorno mental, epilepsia, secuelas de lesiones por causa externa. Si no padece ninguna: **"Ninguna"**.

### RN-101 — Situaciones o condiciones de salud transmisible

**Ítem 101.** Selección múltiple de eventos de interés en salud pública activos: enfermedades prevalentes de la infancia (EDA, ERA), tuberculosis, lepra, rabia, dengue, chikunguña, zika, chagas, leishmaniasis visceral, leishmaniasis cutánea, tungiasis, enfermedades transmitidas por alimentos (cólera, hepatitis A, parasitosis intestinal), enfermedad respiratoria aguda (ERA), enfermedad diarreica aguda (EDA). Si no presenta sintomatología: **"Ninguna"**.

La conducta y notificación se definen en **RN-208**.

### RN-102 — Zona endémica y sintomatología específica

**Ítem 102.** Selección múltiple de riesgos por vectores o parásitos ligados a la geografía: Geohelmintiasis, Teniasis/cisticercosis, Tracoma, Escabiosis, Pian, Malaria. En ausencia de síntomas: **"Ninguna"**.

### RN-103 — Adherencia a tratamiento de salud actual

**Ítem 103.** Campo condicionado. Si en los ítems 100, 101 o 102 se seleccionó alguna patología o condición activa (distinta de "Ninguna"), se activa de manera obligatoria con opciones: "Sí", "No" o "No aplica".

La respuesta "No" eleva un nivel la prioridad de las alertas clínicas concurrentes (RN-203, RN-207).

### RN-104 — Motivo de inasistencia o no tratamiento

**Ítem 104.** Campo condicionado, obligatorio si el ítem 103 fue "No". Almacena barreras específicas: persona no afiliada, servicio lejano, dificultades con trámites administrativos, "no hay agenda", no sabe cómo solicitar la cita, no puede pagar el copago, horarios restringidos, largos tiempos de espera, no se siente cómodo con el personal, persona enferma que no puede acudir, no tiene adherencia al tratamiento, no hay disponibilidad de medicamentos, falta de tiempo del cuidador, falta de adecuación sociocultural. Si el paciente recibe tratamiento: "No aplica".

La clasificación y gestión se definen en **RN-210**.

### RN-105 — Riesgos en salud mental de jóvenes y adolescentes

**Ítem 105.** Campo condicionado por edad, obligatorio exclusivamente para integrantes entre **14 y 28 años**. Evalúa situaciones estresantes específicas del ciclo vital: inicio de la convivencia en pareja, llegada de un nuevo integrante, ingreso a estudiar, pérdida del año escolar, embarazo temprano o adolescente, independencia o salida del hogar paterno-materno, separación de pareja, duelo, desempleo, pérdidas o crisis económicas, conflictos familiares, situación de abandono, ausencia de redes de apoyo, estigma y discriminación, conflictos relacionados con su orientación sexual, trastorno de salud mental en algún integrante de la familia. Opción excluyente: **"Ninguna"**.

### RN-106 — Tamizaje de sintomatología depresiva y ansiosa

**Ítem 106.** Campo condicionado por edad, obligatorio para personas de **14 años o más**. Permite selección múltiple de estados de ánimo alterados por más de dos semanas: se ha sentido triste todos los días la mayor parte del día; ha perdido el interés en actividades que antes disfrutaba; se ha sentido inquieto o nervioso todos los días la mayor parte del día. Si no presenta síntomas: "Ninguno". Para menores de 14: "No aplica".

La conducta se define en **RN-207**.

### RN-107 — Ideación o riesgo de suicidio

**Ítem 107.** Campo condicionado por edad, obligatorio para personas de **14 años o más**. Exige validación estricta sobre pensamientos de autolesión o de no querer seguir viviendo en los **últimos 8 días**. Si no hay riesgo: "Ninguno". Para menores de 14: "No aplica".

> Si se marca riesgo, se activa de forma obligatoria el protocolo prioritario de **RN-202**, que es la única regla del instrumento que **bloquea la sincronización** sin conducta registrada.

### RN-108 — Consumo de sustancias psicoactivas

**Ítem 108.** Selección única condicionada por edad, obligatoria para personas de **14 años o más**. Para menores de 14 se autoasigna "No aplica".

**El período de indagación varía según la edad**, conforme al enunciado del formulario:

| Edad | Período indagado |
|---|---|
| 14 a 17 años | Consumo **alguna vez en la vida** |
| 18 años o más | Consumo en los **últimos tres meses** |

La pregunta abarca sustancias psicoactivas **incluyendo alcohol y tabaco**. La respuesta "Sí" habilita el ítem 109 y exige la aplicación del instrumento de tamizaje correspondiente.

### RN-109 — Puntajes de riesgo de consumo

**Ítem 109.** Campos numéricos **no obligatorios**, habilitados únicamente cuando el ítem 108 es "Sí". El instrumento aplicable se determina por la edad:

| Instrumento | Población | Umbral de riesgo |
|---|---|---|
| **CRAFFT** | 14 a 17 años | ≥ 2 puntos: riesgo — requiere valoración especializada |
| **AUDIT** | ≥ 18 años, consumo de alcohol | ≥ 8: consumo de riesgo; ≥ 20: probable dependencia |
| **ASSIST** | ≥ 18 años, otras sustancias | 4 a 26: riesgo moderado; ≥ 27: riesgo alto |

Aunque el registro del puntaje no es obligatorio, **cuando se registra un puntaje que supera el umbral de riesgo la canalización sí lo es**: el sistema activa la alerta de **consumo problemático de SPA** y exige registrar la derivación a valoración por salud mental en el Plan de Cuidado de la Persona.

> El formulario nombra el instrumento como "Carlos CRAFFT"; la denominación técnica correcta es **CRAFFT**, y así debe figurar en el sistema (ver **Anexo C**).

### RN-110 — Limitación cotidiana reciente

**Ítem 110.** Selección única binaria obligatoria ("Sí" / "No") para validar si alguna situación de salud limitó las actividades cotidianas en la última semana.

---

## 12. Bloque 10: Plan de cuidado

> Esta sección se rige por el modelo de cardinalidad de RN-000 y por la obligación de trazabilidad de RN-220.

### 12.1 Cuidado de la vivienda

#### RN-111 — Código de EBS en Cuidado de la Vivienda

**Ítem 111.** Campo alfanumérico obligatorio de **sólo lectura, heredado automáticamente** del ítem 10 (RN-010). No es digitable por el encuestador.

Su presencia garantiza que toda intervención sobre la vivienda quede atribuida al equipo que realizó la caracterización, condición necesaria para la liquidación y auditoría de las acciones ejecutadas.

#### RN-112 — Código de vivienda en Cuidado de la Vivienda

**Ítem 112.** Llave relacional alfanumérica obligatoria de **sólo lectura, heredada automáticamente** del ítem 25 (RN-025). Vincula el plan de cuidado con la unidad de vivienda caracterizada. El sistema no permite registrar acciones de cuidado de la vivienda sin una vivienda previamente identificada.

#### RN-113 — Identificación del ejecutor en vivienda

**Ítem 113.** Entrada obligatoria del tipo (CC, DE, PT) y número de identificación del miembro del EBS que prescribe u opera la acción sobre el entorno de la vivienda.

#### RN-114 — Acción / Intervención en vivienda (CUPS / NoCUPS)

**Ítem 114.** Campo obligatorio para registrar los códigos de procedimientos en salud bajo la codificación oficial **CUPS**, o códigos internos aprobados (**NoCUPS**) de salud ambiental.

#### RN-115 — Tipo de respuesta en vivienda

**Ítem 115.** Selección única obligatoria para definir la naturaleza operativa: ejecutada en el momento (**"En sitio"**) o canalizada a otra institución (**"Derivada"**).

#### RN-116 — Identificación del seguimiento en vivienda

**Ítem 116.** Registro del tipo y número de documento del integrante del EBS encargado de verificar la evolución del acuerdo ambiental del hogar.

#### RN-117 — Acción de cuidado concertada para la vivienda

**Ítem 117.** Campo de texto obligatorio para documentar los compromisos de mejora locativa o de higiene acordados con la familia, junto con la fecha de concertación.

#### RN-118 — Primer seguimiento de vivienda

**Ítem 118.** Requiere obligatoriamente el ingreso de una fecha válida (`AAAA/MM/DD`) junto con el estado del compromiso: **C** (Cumple), **CP** (Cumple Parcial) o **NC** (No cumple). Ver **RN-226**.

#### RN-119 — Segundo seguimiento de vivienda

**Ítem 119.** Estructura idéntica y obligatoria para registrar la evolución posterior del entorno físico, en una fecha cronológicamente posterior a la del ítem 118. Ver **RN-226**.

### 12.2 Cuidado de la familia

#### RN-120 — Código de EBS en Cuidado de la Familia

**Ítem 120.** Campo alfanumérico obligatorio de sólo lectura, heredado del ítem 10, con las mismas condiciones de RN-111. Debe ser idéntico al valor de los ítems 111 y 130 dentro de la misma ficha.

#### RN-121 — Código de vivienda en Cuidado de la Familia

**Ítem 121.** Llave relacional obligatoria de sólo lectura, heredada del ítem 25, con las mismas condiciones de RN-112. Debe ser idéntica al valor de los ítems 112 y 131 dentro de la misma ficha.

#### RN-122 — Código de Familia / Hogar en Cuidado de la Familia

**Ítem 122.** Llave relacional alfanumérica obligatoria de **sólo lectura, heredada automáticamente** del ítem 26 (RN-026), subordinada al código de vivienda del ítem 121.

Cuando la vivienda alberga **más de una familia** (ítem 28 mayor a 1), el sistema exige un plan de cuidado familiar **independiente por cada familia registrada**. No se admite un único plan familiar que agrupe a varios núcleos que cohabitan, porque sus dinámicas relacionales (ítem 55), su estructura (ítem 50) y sus factores de riesgo (ítem 54) se caracterizaron por separado.

#### RN-123 — Identificación del ejecutor en familia

**Ítem 123.** Registro obligatorio del tipo y número de documento del profesional del EBS que asigna la intervención familiar.

#### RN-124 — Acción / Intervención familiar (CUPS / NoCUPS)

**Ítem 124.** Captura obligatoria de códigos CUPS o NoCUPS enfocados en dinámicas relacionales, comunitarias o de salud familiar.

#### RN-125 — Tipo de respuesta familiar

**Ítem 125.** Selección exclusiva entre "En sitio" o "Derivada" para determinar la resolución de la intervención del núcleo familiar.

#### RN-126 — Identificación del seguimiento familiar

**Ítem 126.** Registro de identificación del funcionario que verifica el acuerdo colectivo familiar.

#### RN-127 — Acción de cuidado concertada familiar

**Ítem 127.** Campo obligatorio de texto para detallar el plan de cuidado mutuo establecido con el núcleo doméstico, junto con la fecha de concertación.

#### RN-128 — Primer seguimiento familiar

**Ítem 128.** Captura obligatoria de la fecha de evaluación y el estado de cumplimiento: **C**, **CP** o **NC**. Ver **RN-226**.

#### RN-129 — Segundo seguimiento familiar

**Ítem 129.** Registro posterior obligatorio de verificación temporal, exigiendo fecha válida y estado de cumplimiento. Ver **RN-226**.

### 12.3 Cuidado de la persona

#### RN-130, RN-131 y RN-132 — Llaves relacionales del cuidado individual

**Ítems 130, 131 y 132.** Los tres códigos —EBS, vivienda y familia— son campos de **sólo lectura heredados** de los ítems 10, 25 y 26 respectivamente, y no llaves generadas de forma independiente.

**Regla de integridad transversal.** Dentro de una misma ficha:

- Los ítems **111, 120 y 130** deben contener el mismo valor.
- Los ítems **112, 121 y 131** deben contener el mismo valor.
- Los ítems **122 y 132** deben contener el mismo valor.

Cualquier divergencia constituye una inconsistencia que **bloquea la sincronización** de la ficha.

#### RN-133 — Tipo de identificación del integrante intervenido

**Ítem 133.** Campo de selección obligatoria cerrada (AS, CC, CD, CE, MS, NV, PE, PT, RC, TI) que debe **heredar o validar de forma exacta** el tipo registrado en el ítem 62 para ese integrante.

#### RN-134 — Número de identificación del integrante intervenido

**Ítem 134.** Campo alfanumérico obligatorio que debe coincidir con el documento registrado en el ítem 63 para el respectivo integrante.

> Los ítems 133 y 134 deben corresponder **exactamente** a un integrante ya registrado en la sección 5 bajo la familia del ítem 132. El sistema debe ofrecerlos como **selección desde la lista de integrantes capturados**, nunca como digitación libre, para impedir que se registre una intervención sobre una persona inexistente en la ficha.

#### RN-135 — Identificación del ejecutor de la intervención individual

**Ítem 135.** Campo obligatorio de tipo y número de identificación del miembro del EBS que asigna el procedimiento clínico o educativo individual.

#### RN-136a — Acción / Intervención individual (CUPS / NoCUPS)

**Ítem 136 (primera columna).** Campo de codificación obligatorio que cruza las alertas de atenciones pendientes detectadas con procedimientos estándar resueltos o programados.

#### RN-136b — Tipo de respuesta individual

**Ítem 136 (segunda columna).** Selección obligatoria y excluyente que define si la atención individual se realizó **"En sitio"** por el equipo o fue **"Derivada"** a la red prestadora (IPS Primaria o Especializada).

> **Corrección documental.** El formulario impreso numera con **136** dos columnas distintas de la subsección 6.3. Se trata de un error de diagramación; el sistema conserva la desagregación en RN-136a y RN-136b (ver **Anexo C**).

#### RN-137 — Identificación del seguimiento individual

**Ítem 137.** Registro de identificación del integrante del EBS asignado para verificar el proceso de restablecimiento o cuidado del individuo.

#### RN-138 — Acción de cuidado concertada individual

**Ítem 138.** Campo de texto obligatorio donde se describe de forma concisa el compromiso clínico o de autocuidado adquirido voluntariamente por la persona, junto con la fecha de concertación.

Debe considerar el nivel educativo del ítem 74: en personas con analfabetismo, la acción concertada debe formularse en términos verificables sin lectura.

#### RN-139 — Primer seguimiento individual

**Ítem 139.** Validación obligatoria que exige la fecha real de la primera visita de control y el estado del compromiso: **C**, **CP** o **NC**. Ver **RN-226**.

#### RN-140 — Segundo seguimiento individual

**Ítem 140.** Registro obligatorio de control final que documenta la fecha y el estado definitivo de la intervención individual, programado posteriormente al ítem 139. Ver **RN-226**.

---

## 13. Bloque 11: Reglas de decisión clínica y canalización

> Estas reglas no corresponden a un ítem específico del formulario: derivan de la lectura conjunta de varios ítems y determinan **qué debe hacer el EBS** ante cada hallazgo. Son las que convierten la caracterización en atención en salud.

### RN-200 — Niveles de prioridad y canalización *(marco)*

Todo hallazgo de riesgo detectado por las reglas RN-201 a RN-212 debe clasificarse en uno de tres niveles, que determinan el tiempo máximo de respuesta y la conducta del EBS:

| Nivel | Distintivo | Tiempo máximo | Conducta obligatoria |
|---|---|---|---|
| **INMEDIATA** | 🔴 Rojo | **En el momento de la visita** | Activación de ruta de urgencias, traslado o línea de emergencia. No admite diferimiento. |
| **PRIORITARIA** | 🟠 Naranja | **72 horas** | Derivación con cita asignada y verificación de asistencia en el primer seguimiento. |
| **REGULAR** | 🟡 Amarillo | **30 días** | Canalización a la ruta correspondiente y verificación en el segundo seguimiento. |

El nivel asignado se calcula automáticamente y **no es editable a la baja** por el encuestador. Cuando un individuo acumula varias alertas, prevalece el nivel más alto. Toda alerta debe quedar visible en el resumen de la ficha antes del cierre.

### RN-201 — 🔴 Urgencia vital detectada al inicio

Cuando el **ítem 2** registre "Física (urgencia vital)", "Psicológica (urgencia vital en salud mental)" o "Situación de emergencia o desastre", el sistema debe:

1. Asignar **prioridad INMEDIATA** y mostrar alerta bloqueante antes de continuar.
2. **Suspender la captura del instrumento.** La atención de la urgencia precede a la caracterización; no se pide al EBS terminar una encuesta frente a una persona en riesgo vital.
3. Exigir el registro de la conducta adoptada: activación de línea 123, traslado a urgencias o notificación a organismo de socorro.
4. Permitir reanudar la ficha posteriormente conservando lo capturado, con la novedad **"visita interrumpida por urgencia vital"**.

### RN-202 — 🔴 Riesgo de suicidio

Cuando el **ítem 107** registre "Ha pensado en lastimarse o en no querer seguir viviendo", el sistema debe:

1. Asignar **prioridad INMEDIATA**, sin excepción y sin considerar la edad.
2. Activar el protocolo de conducta ante riesgo suicida: no dejar a la persona sola, contactar la línea de salud mental y notificar al profesional del EBS presente en la visita.
3. Exigir derivación a **valoración por psicología o psiquiatría en el mismo día**, registrada en el Plan de Cuidado de la Persona (ítem 136) con respuesta "Derivada".
4. Exigir **notificación obligatoria a SIVIGILA** por intento o ideación suicida, evento de notificación individual inmediata.
5. Cruzar con el ítem 54 ("Antecedentes de intento o muerte por suicidio en algún integrante"): si coexisten, el nivel de riesgo familiar se eleva y la intervención se extiende al núcleo.

> Esta regla **no admite cierre de ficha sin acción registrada**. Es la única alerta del instrumento que bloquea la sincronización.

### RN-203 — 🔴 Crisis hipertensiva y riesgo cardiovascular

Con base en la clasificación del **ítem 99**:

| Clasificación | Prioridad | Conducta |
|---|---|---|
| Crisis hipertensiva | 🔴 INMEDIATA | Traslado o remisión a urgencias en el momento de la visita |
| Hipertensión nivel 2 | 🟠 PRIORITARIA | Consulta médica en 72 horas |
| Hipertensión nivel 1 | 🟡 REGULAR | Ruta de riesgo cardiovascular |
| Elevada | 🟡 REGULAR | Educación y control en 30 días |
| Normal | — | Sin alerta |

Toda clasificación distinta de "Normal" debe cruzarse con el ítem 100 (enfermedades no transmisibles) y el ítem 103 (adherencia): un hipertenso **ya diagnosticado y sin adherencia eleva su prioridad un nivel**.

### RN-204 — 🔴 Desnutrición aguda y riesgo nutricional

Con base en la clasificación antropométrica del **ítem 96** y los signos físicos del **ítem 97**:

| Hallazgo | Prioridad | Conducta |
|---|---|---|
| Desnutrición Aguda Severa | 🔴 INMEDIATA | Remisión el mismo día; en menores de 5 años, hospitalaria |
| Desnutrición Aguda Moderada | 🟠 PRIORITARIA | Valoración médica y nutricional en 72 horas |
| Riesgo de desnutrición aguda / Riesgo de delgadez | 🟡 REGULAR | Ruta materno-infantil, suplementación |
| Bajo peso para la edad gestacional | 🟠 PRIORITARIA | Ruta materno perinatal |
| Obesidad / Sobrepeso | 🟡 REGULAR | Ruta de riesgo cardiovascular |

**La presencia de cualquier signo físico del ítem 97** en un menor de 5 años eleva la prioridad a **INMEDIATA**, con independencia de la clasificación antropométrica. El **edema** es signo de desnutrición aguda severa y obliga a remisión hospitalaria inmediata.

Toda desnutrición aguda en menores de 5 años exige **notificación a SIVIGILA**.

### RN-205 — 🟠 Gestación y ruta materno perinatal

Cuando el **ítem 85** registre "Sí", o el ítem 77 marque "Gestante", el sistema debe:

1. Activar de forma obligatoria la **Ruta Integral de Atención Materno Perinatal** y habilitar el ítem 88.
2. Asignar **prioridad PRIORITARIA** como mínimo.
3. Exigir el diligenciamiento del ítem 88; toda atención pendiente allí obliga a canalización con cita asignada.
4. **Elevar a INMEDIATA** si concurre alguna de estas condiciones: gestante menor de 15 años, ausencia total de controles prenatales, hipertensión de cualquier nivel (ítem 99), desnutrición (ítem 96) o violencia registrada en el ítem 78.
5. Inhabilitar por incoherencia el registro de gestación en integrantes con sexo "Hombre" (ítem 66), salvo que la autoidentificación de género del ítem 68 sea "Transexual" o "Transgenero", caso en el cual se permite con confirmación explícita.

> **Toda gestante menor de 14 años** activa además la alerta de presunto delito sexual conforme a **RN-206**, por presunción legal de no consentimiento.

### RN-206 — 🔴 Violencias

Cuando el **ítem 77** registre "Víctima de violencia de género e intrafamiliar", "Víctima de violencia interpersonal" o "Víctima del conflicto armado", o el **ítem 54** registre "Vivencia de alguna forma de violencia":

1. Se habilita obligatoriamente el ítem 78 (modalidad).
2. Se asigna **prioridad PRIORITARIA** como mínimo, elevada a **INMEDIATA** cuando la modalidad sea **Sexual**, cuando la víctima sea **menor de 18 años**, o cuando la violencia sea actual y continuada.
3. Se activa la **Ruta de Atención Integral para Víctimas de Violencias de Género** (Resolución 459 de 2012), con atención en las primeras 72 horas.
4. Se exige **notificación a SIVIGILA** por violencia de género e intrafamiliar.
5. En menores de 18 años, se exige además el reporte al **ICBF** por presunta vulneración de derechos.
6. El sistema debe advertir al encuestador que **no debe indagar sobre la violencia en presencia del presunto agresor** y permitir diferir el registro a una entrevista privada.

### RN-207 — 🟠 Sintomatología depresiva y ansiosa

Cuando el **ítem 106** registre uno o más síntomas sostenidos por más de dos semanas:

| Hallazgo | Prioridad | Conducta |
|---|---|---|
| Un síntoma | 🟡 REGULAR | Canalización a valoración por psicología en 30 días |
| Dos o más síntomas | 🟠 PRIORITARIA | Valoración en 72 horas |
| Cualquier síntoma concurrente con ideación (ítem 107) | 🔴 INMEDIATA | Conforme a RN-202 |

Se cruza obligatoriamente con el ítem 105 (riesgos en salud mental de 14 a 28 años) y con el ítem 100 ("Trastorno mental" diagnosticado): un diagnóstico previo sin adherencia (ítem 103) eleva la prioridad un nivel.

### RN-208 — 🟠 Enfermedades transmisibles de notificación obligatoria

Cuando el **ítem 101** o el **ítem 102** registren un evento de interés en salud pública:

| Evento | Prioridad | Notificación SIVIGILA |
|---|---|---|
| Tuberculosis | 🟠 PRIORITARIA | Sí — estudio de contactos del hogar obligatorio |
| Lepra | 🟠 PRIORITARIA | Sí |
| Rabia | 🔴 INMEDIATA | Sí — inmediata |
| Dengue, Chikunguña, Zika | 🟠 PRIORITARIA | Sí |
| Malaria | 🟠 PRIORITARIA | Sí |
| Chagas | 🟠 PRIORITARIA | Sí |
| Leishmaniasis visceral | 🔴 INMEDIATA | Sí |
| Leishmaniasis cutánea | 🟠 PRIORITARIA | Sí |
| Cólera, hepatitis A, parasitosis intestinal | 🟠 PRIORITARIA | Sí |
| EDA / ERA en menores de 5 años | 🟠 PRIORITARIA | Según severidad |
| Geohelmintiasis, teniasis, tracoma, escabiosis, pian, tungiasis | 🟡 REGULAR | Según lineamiento |

**Regla de extensión familiar.** La detección de **tuberculosis** obliga a marcar a todos los integrantes de la vivienda como contactos y a generar acción de tamizaje para cada uno en el Plan de Cuidado de la Persona. Si además existe hacinamiento (RN-033), la prioridad de los contactos se eleva a PRIORITARIA.

La detección de **dengue, Zika o Chikunguña** se cruza con el ítem 37 (criaderos de vectores) y obliga a acción de control vectorial en el Plan de Cuidado de la Vivienda.

### RN-209 — 🟠 Ausencia de afiliación al SGSSS

Cuando el **ítem 75** registre "No afiliado", el sistema debe:

1. Asignar **prioridad PRIORITARIA**, por ser la barrera estructural que impide el acceso a todas las demás atenciones.
2. Inhabilitar el ítem 76 (EAPB) y autoasignarlo como "No aplica".
3. Exigir acción de **gestión de afiliación** en el Plan de Cuidado de la Persona, con verificación en el primer seguimiento.
4. **Elevar a INMEDIATA** cuando el no afiliado presente además cualquier alerta clínica de RN-202 a RN-208, porque la falta de afiliación no puede diferir una atención urgente: en ese caso debe registrarse la atención inicial de urgencias, obligatoria por ley con independencia del aseguramiento.
5. Cruzar con RN-063: si la persona carece de documento (MS o AS), la gestión de afiliación se condiciona a la canalización previa a Registraduría.

### RN-210 — 🟠 Barreras de acceso efectivo

Cuando el **ítem 89** o el **ítem 104** registren un motivo distinto de "Ninguna" / "No aplica", el sistema clasifica la barrera y asigna la gestión responsable:

| Tipo de barrera | Ejemplos (ítems 89 y 104) | Gestión | Prioridad |
|---|---|---|---|
| **Administrativa** | Trámites, "no hay agenda", no sabe solicitar cita, copago, medicamentos no disponibles | Gestión ante EAPB | 🟠 |
| **Geográfica** | Servicio lejano, sin personal en centro cercano | Extramural o telesalud | 🟡 |
| **De información** | Desconoce el derecho, desconoce la gratuidad | Educación en salud | 🟡 |
| **Cultural o de trato** | No se siente cómodo con el personal, falta de adecuación sociocultural | Enfoque diferencial | 🟡 |
| **Del cuidador o dependencia** | Persona enferma que no puede acudir, falta de tiempo del cuidador | Atención domiciliaria | 🟠 |
| **De aseguramiento** | No afiliado | Conforme a RN-209 | 🟠 |

Toda barrera de tipo administrativo o de aseguramiento obliga a registrar la gestión ante la EAPB con número de radicado, cuando exista.

### RN-211 — 🟠 Riesgo del entorno y la vivienda

El sistema consolida los hallazgos del entorno físico y asigna prioridad al **Plan de Cuidado de la Vivienda**:

| Hallazgo | Ítems | Prioridad |
|---|---|---|
| Hacinamiento crítico (> 3 personas/habitación) | 32, 33 | 🟠 |
| Hacinamiento (> 2 personas/habitación) | 32, 33 | 🟡 |
| Agua no apta para consumo humano | 46 | 🟠 |
| Disposición de excretas a campo abierto o fuente hídrica | 47 | 🟠 |
| Aguas residuales a campo abierto o fuente hídrica | 48 | 🟡 |
| Residuos sólidos quemados, enterrados o a campo abierto | 49 | 🟡 |
| Criaderos de vectores | 37 | 🟠 |
| Techo de desechos, palma o paja | 35 | 🟡 |
| Techo con **asbesto** | 35 | 🟠 |
| Riesgos de accidente con menores de 5 años o adultos > 70 años | 36 | 🟠 |
| Caninos o felinos sin vacuna antirrábica vigente | 42, 44, 45 | 🟡 |
| Déficit de elementos para dormir | 31 | 🟡 |

**Regla de concurrencia.** Cuando el hogar acumule **tres o más hallazgos** de esta tabla, la vivienda se clasifica como **entorno de alto riesgo sanitario**, la prioridad global asciende a PRIORITARIA y se programa visita de seguimiento obligatoria dentro de los 30 días.

La presencia de riesgos de accidente (ítem 36) sólo eleva la prioridad cuando la ficha registra **menores de 5 años o adultos mayores de 70** entre los integrantes, dado que el riesgo locativo se materializa principalmente en esos grupos.

### RN-212 — 🟡 Sobrecarga del cuidador y dependencia

Cuando el **ítem 52** registre la existencia de un cuidador principal, el resultado de la escala Zarit del **ítem 53** determina:

| Resultado Zarit | Prioridad | Conducta |
|---|---|---|
| Ausencia de sobrecarga (≤ 46) | — | Educación en autocuidado del cuidador |
| Sobrecarga ligera (47–55) | 🟡 REGULAR | Canalización a apoyo psicosocial |
| Sobrecarga intensa (≥ 56) | 🟠 PRIORITARIA | Valoración por psicología y evaluación de relevo del cuidado |

La sobrecarga intensa se eleva a **INMEDIATA** cuando concurre con sintomatología depresiva del cuidador (ítem 106) o con ideación suicida (ítem 107), conforme a RN-202.

**Regla de protección de la persona cuidada.** La sobrecarga intensa constituye factor de riesgo de negligencia y maltrato. Cuando coexista con el registro de "Persona en situación de abandono" o "Negligencia y abandono" en los ítems 54 o 78, se activa la ruta de violencias de **RN-206**.

---

## 14. Bloque 12: Cierre, integridad y trazabilidad

### RN-220 — Trazabilidad obligatoria entre alerta y acción

**Toda alerta activada por las reglas RN-201 a RN-212 debe generar al menos una acción registrada en el Plan de Cuidado (sección 6)**, en el nivel que le corresponda:

| Origen de la alerta | Plan que recibe la acción | Ítems |
|---|---|---|
| Entorno y vivienda (RN-211) | Cuidado de la Vivienda | 114 – 119 |
| Estructura y dinámica familiar (RN-212, ítem 54) | Cuidado de la Familia | 124 – 129 |
| Individuo (RN-202 a RN-210) | Cuidado de la Persona | 136 – 140 |

El sistema debe mantener un **vínculo explícito y auditable** entre cada alerta y la acción que la resuelve, de modo que sea posible responder, para cualquier ficha, la pregunta: *¿qué se hizo frente a este hallazgo?*

Ninguna alerta puede quedar sin acción. Cuando el EBS considere que un hallazgo no requiere intervención, debe registrarlo de forma expresa como **"No procede"** con justificación escrita — el silencio no es una opción válida de cierre.

> Se recomienda monitorear en los reportes de supervisión la frecuencia de uso de la opción "No procede", para detectar su uso rutinario como mecanismo de evasión.

Las acciones se codifican en **CUPS** cuando corresponden a procedimientos del plan de beneficios, y en **NoCUPS** cuando son acciones educativas, de gestión o de salud ambiental sin código CUPS asignado.

### RN-221 — Semaforización del riesgo familiar

Al finalizar la caracterización, el sistema calcula y muestra una **clasificación de riesgo consolidada por familia**, resultado de la agregación de todas las alertas de sus integrantes y de su vivienda:

| Clasificación | Criterio | Consecuencia operativa |
|---|---|---|
| 🔴 **Riesgo alto** | Al menos una alerta INMEDIATA, o tres o más alertas PRIORITARIAS | Seguimiento en 30 días; asignación a gestor de caso |
| 🟠 **Riesgo medio** | Entre una y dos alertas PRIORITARIAS | Seguimiento en 90 días |
| 🟡 **Riesgo bajo** | Sólo alertas REGULARES | Seguimiento en 180 días |
| 🟢 **Sin riesgo identificado** | Ninguna alerta activa | Nueva caracterización anual |

Esta clasificación es el insumo para la **priorización de la agenda del EBS**: determina el orden de las visitas de seguimiento y la asignación de cupos de atención domiciliaria. Es un campo calculado, de sólo lectura, y se recalcula ante cualquier modificación de la ficha.

### RN-222 — Validación de completitud para el cierre

El sistema **no permite cerrar una ficha** mientras exista alguna de las siguientes condiciones:

1. Consentimiento informado no registrado (RN-001).
2. Campos obligatorios sin diligenciar en el nivel de vivienda o entorno.
3. Familias declaradas en el ítem 28 sin caracterizar.
4. Integrantes declarados en el ítem 51 sin caracterizar, o con instancias incompletas (RN-051).
5. Alertas de prioridad INMEDIATA sin conducta registrada (RN-220).
6. Georreferenciación pendiente sin motivo de imposibilidad registrado (RN-022).
7. Ausencia de medio de contacto en la familia sin la novedad correspondiente (RN-070).
8. Inconsistencia de llaves relacionales del Plan de Cuidado (RN-130 / RN-131 / RN-132).

El sistema debe presentar un **resumen de validación previo al cierre** que liste los incumplimientos agrupados por bloque, indicando el ítem y la regla incumplida, y permitiendo navegar directamente al campo. No se admite un mensaje genérico de error.

**Excepción de campo.** Una visita puede cerrarse como **"incompleta por causa externa"** —rechazo del informante, ausencia de los integrantes, condición de inseguridad en el territorio o urgencia vital conforme a RN-201— siempre que se registre el motivo. Estas fichas se sincronizan marcadas como incompletas, **no ingresan al denominador de cobertura** y quedan en cola para nueva visita.

### RN-223 — Sincronización y operación sin conexión

La aplicación debe operar **de forma autónoma sin conexión a internet**, condición indispensable para la caracterización en zona rural dispersa y ladera.

1. Toda la información se almacena localmente **cifrada** hasta su sincronización.
2. La sincronización se ejecuta al recuperar conectividad, con reintentos automáticos y sin intervención del usuario.
3. Ninguna ficha se elimina del dispositivo hasta confirmar su recepción exitosa en el servidor.
4. Ante conflicto entre una ficha local y una del servidor, **prevalece la de fecha de captura más reciente**, conservando la anterior en el histórico. Bajo ninguna circunstancia se sobrescribe información sin dejar traza.
5. Las alertas de prioridad INMEDIATA (RN-201 a RN-204, RN-206) deben notificarse por el canal disponible más rápido **sin esperar la sincronización completa** de la ficha.
6. El dispositivo debe **bloquearse automáticamente por inactividad** y exigir autenticación del responsable para reanudar.

### RN-224 — Protección de datos y confidencialidad

Conforme a la Ley 1581 de 2012, el Decreto 1377 de 2013 y la Ley 1751 de 2015:

1. Sin el consentimiento del ítem 1 **no puede almacenarse ningún dato personal**. La negativa cierra la ficha registrando únicamente la novedad de no aceptación, sin datos identificables.
2. Los datos de salud, orientación sexual, identidad de género, pertenencia étnica y condición de víctima son **datos sensibles** y tienen tratamiento reforzado: se cifran en reposo y en tránsito, y su consulta queda registrada en auditoría.
3. El acceso a la información se limita al EBS responsable de la caracterización y a los perfiles institucionales expresamente autorizados. Ningún miembro del equipo accede a fichas de territorios que no le fueron asignados.
4. **Está prohibida la exportación de datos identificables** a archivos locales, hojas de cálculo o mensajería. Los reportes analíticos se generan anonimizados o seudonimizados.
5. El titular puede ejercer sus derechos de conocer, actualizar, rectificar y suprimir sus datos; el sistema debe registrar y trazar estas solicitudes.
6. La información sobre violencias (ítems 77 y 78) y salud mental (ítems 105 a 109) tiene **restricción adicional de visibilidad**: no se muestra en pantallas compartidas ni en presencia de terceros, conforme a la advertencia de RN-206.

### RN-225 — Auditoría y trazabilidad de la ficha

El sistema debe conservar un **registro de auditoría inalterable** de toda la vida de la ficha, con: identificación del responsable (ítems 12 y 13), fecha y hora de cada evento, valor anterior y nuevo en cada modificación, y coordenadas del dispositivo al momento de la captura.

**Eventos de registro obligatorio:** creación, modificación de cualquier campo, activación de alerta, registro de conducta ante alerta, cierre, sincronización, consulta de datos sensibles y ejercicio de derechos del titular.

> **Ninguna ficha cerrada y sincronizada puede modificarse ni eliminarse.** Las correcciones se realizan mediante una nueva versión que conserva íntegro el histórico, dado que la ficha soporta decisiones clínicas y puede ser requerida como prueba en procesos de auditoría, vigilancia epidemiológica o investigación de eventos adversos.

### RN-226 — Seguimientos del Plan de Cuidado

Los seguimientos de los ítems **118, 119, 128, 129, 139 y 140** se rigen por:

1. La fecha del **primer seguimiento** debe ser posterior a la fecha de diligenciamiento (ítem 16) y **no exceder el plazo del nivel de prioridad** asignado por RN-200: 48 horas para INMEDIATA, 72 horas para PRIORITARIA, 30 días para REGULAR.
2. La fecha del **segundo seguimiento** debe ser cronológicamente posterior a la del primero.
3. El estado se registra como **C** (Cumple), **CP** (Cumple Parcial) o **NC** (No cumple), en selección única obligatoria por cada acción concertada.
4. Un estado **NC en el primer seguimiento** obliga a registrar el motivo y a programar el segundo seguimiento; **NC en el segundo** obliga a reformular la acción concertada o a escalar el caso al gestor de la EAPB.
5. Un estado **NC sobre una acción derivada de alerta INMEDIATA o PRIORITARIA** eleva la clasificación de riesgo familiar de RN-221 y **reactiva la alerta original**: el incumplimiento de una atención urgente no puede darse por cerrado.
6. El sistema debe generar **notificación automática al EBS** cuando un seguimiento programado esté próximo a vencer o vencido.

---

## 15. Notas sobre aplicación de las reglas

- Todas las reglas deben validarse antes de permitir el cierre o sincronización de una visita (RN-222).
- El sistema debe mantener un registro de auditoría de todas las transacciones y cambios realizados (RN-225).
- Los campos condicionados deben habilitarse o deshabilitarse automáticamente según la lógica especificada, sin intervención del usuario.
- Las opciones excluyentes ("Ninguna", "Ninguno", "No aplica") deben desmarcar automáticamente el resto de opciones de su grupo.
- Los valores calculados (edad, IMC, personas por habitación, hacinamiento, semaforización) deben actualizarse automáticamente cuando cambien los valores base, y no son editables manualmente.
- Las reglas de decisión (RN-200 a RN-212) se evalúan de forma continua durante la captura, no sólo al cierre, para que el EBS pueda actuar durante la visita.
- Los catálogos parametrizados (territorios, EAPB, UZPE, ocupaciones CIUO, CUPS) deben administrarse por configuración y ser actualizables sin nueva versión de la aplicación.

---

## Anexo A — Catálogo de territorios y microterritorios

Catálogo parametrizado que soporta las reglas **RN-007** (Territorio, ítem 7) y **RN-008** (Microterritorio, ítem 8). La selección del microterritorio se filtra en cascada a partir del territorio elegido. El campo `comuna` se hereda como dato derivado de sólo lectura.

```json
{
  "T48": [
    { "codigo": "MT01", "nombre": "San Cayetano", "comuna": "3" },
    { "codigo": "MT02", "nombre": "Libertadores", "comuna": "3" },
    { "codigo": "MT03", "nombre": "Nacional", "comuna": "3" },
    { "codigo": "MT04", "nombre": "La Chanca", "comuna": "3" }
  ],
  "T49": [
    { "codigo": "MT01", "nombre": "Terrón Cabecera", "comuna": "1" },
    { "codigo": "MT02", "nombre": "Malvinas", "comuna": "1" },
    { "codigo": "MT03", "nombre": "Portada", "comuna": "1" },
    { "codigo": "MT04", "nombre": "Palermo", "comuna": "1" }
  ],
  "T50": [
    { "codigo": "MT01", "nombre": "Legua", "comuna": "1.1" },
    { "codigo": "MT02", "nombre": "Vista Hermosa", "comuna": "1.1" },
    { "codigo": "MT03", "nombre": "Patio Bonito", "comuna": "1.1" },
    { "codigo": "MT04", "nombre": "Aguacatal", "comuna": "1.1" }
  ],
  "T51": [
    { "codigo": "MT01", "nombre": "Los Comedores", "comuna": "18" },
    { "codigo": "MT02", "nombre": "Cuatro Esquinas", "comuna": "18" },
    { "codigo": "MT03", "nombre": "La Esperanza", "comuna": "18" },
    { "codigo": "MT04", "nombre": "Cesoles", "comuna": "18" }
  ],
  "T52": [
    { "codigo": "MT01", "nombre": "Oasis", "comuna": "18.1" },
    { "codigo": "MT02", "nombre": "Las Minas", "comuna": "18.1" },
    { "codigo": "MT03", "nombre": "La Cañada", "comuna": "18.1" },
    { "codigo": "MT04", "nombre": "La Piedra Brisas de la Chorrera", "comuna": "18.1" }
  ],
  "T53": [
    { "codigo": "MT01", "nombre": "Belèn", "comuna": "20" },
    { "codigo": "MT02", "nombre": "Corea", "comuna": "20" },
    { "codigo": "MT03", "nombre": "Siloé", "comuna": "20" },
    { "codigo": "MT04", "nombre": "Quebrada Isabel Pérez", "comuna": "20" }
  ],
  "T54": [
    { "codigo": "MT01", "nombre": "Cortijo", "comuna": "20.1" },
    { "codigo": "MT02", "nombre": "Lleras Camargo", "comuna": "20.1" },
    { "codigo": "MT03", "nombre": "Brisas de Mayo", "comuna": "20.1" },
    { "codigo": "MT04", "nombre": "Pueblo Joven", "comuna": "20.1" }
  ],
  "T55": [
    { "codigo": "MT01", "nombre": "Brisas de Montebello", "comuna": "Rural" },
    { "codigo": "MT02", "nombre": "Montecitos", "comuna": "Rural" },
    { "codigo": "MT03", "nombre": "Arrayanes", "comuna": "Rural" },
    { "codigo": "MT04", "nombre": "La Piscina", "comuna": "Rural" }
  ],
  "T56": [
    { "codigo": "MT01", "nombre": "Colinas", "comuna": "Rural" },
    { "codigo": "MT02", "nombre": "Centro Puesto de Salud", "comuna": "Rural" },
    { "codigo": "MT03", "nombre": "Hora Cero", "comuna": "Rural" },
    { "codigo": "MT04", "nombre": "Las Guacas 107", "comuna": "Rural" }
  ],
  "T57": [
    { "codigo": "MT01", "nombre": "Campo Alegre Cabecera", "comuna": "Rural" },
    { "codigo": "MT02", "nombre": "Campo Alegre Berlyn", "comuna": "Rural" },
    { "codigo": "MT03", "nombre": "Centro sector 4 y 5", "comuna": "Rural" },
    { "codigo": "MT04", "nombre": "Estadero Mi Rey", "comuna": "Rural" }
  ],
  "T58": [
    { "codigo": "MT01", "nombre": "Cabecera", "comuna": "Rural" },
    { "codigo": "MT02", "nombre": "Normandía los Mangos", "comuna": "Rural" },
    { "codigo": "MT03", "nombre": "Normandía las Minas", "comuna": "Rural" },
    { "codigo": "MT04", "nombre": "El Filo", "comuna": "Rural" }
  ],
  "T59": [
    { "codigo": "MT01", "nombre": "La María", "comuna": "Rural" },
    { "codigo": "MT02", "nombre": "La Fragua", "comuna": "Rural" },
    { "codigo": "MT03", "nombre": "Entre Ríos", "comuna": "Rural" },
    { "codigo": "MT04", "nombre": "San Isidro", "comuna": "Rural" }
  ],
  "T60": [
    { "codigo": "MT01", "nombre": "Cabecera Alta", "comuna": "Rural" },
    { "codigo": "MT02", "nombre": "Vergel", "comuna": "Rural" },
    { "codigo": "MT03", "nombre": "Lomitas", "comuna": "Rural" },
    { "codigo": "MT04", "nombre": "Villa del Rosario", "comuna": "Rural" }
  ],
  "T61": [
    { "codigo": "MT01", "nombre": "Cabecera Baja", "comuna": "Rural" },
    { "codigo": "MT02", "nombre": "Vista Hermosa", "comuna": "Rural" },
    { "codigo": "MT03", "nombre": "La Virgen", "comuna": "Rural" },
    { "codigo": "MT04", "nombre": "Tres Cruces", "comuna": "Rural" }
  ],
  "T62": [
    { "codigo": "MT01", "nombre": "Las Palmas", "comuna": "Rural" },
    { "codigo": "MT02", "nombre": "Las Brisas", "comuna": "Rural" },
    { "codigo": "MT03", "nombre": "Las Victorias", "comuna": "Rural" },
    { "codigo": "MT04", "nombre": "Las Granjas", "comuna": "Rural" }
  ],
  "T63": [
    { "codigo": "MT01", "nombre": "Montañitas parte Alta", "comuna": "Rural" },
    { "codigo": "MT02", "nombre": "El Filo", "comuna": "Rural" },
    { "codigo": "MT03", "nombre": "Los Limones", "comuna": "Rural" },
    { "codigo": "MT04", "nombre": "Montañitas parte Baja", "comuna": "Rural" }
  ],
  "T64": [
    { "codigo": "MT01", "nombre": "Laureles", "comuna": "Rural" },
    { "codigo": "MT02", "nombre": "Alto Aguacatal Cabecera", "comuna": "Rural" },
    { "codigo": "MT03", "nombre": "El Silencio", "comuna": "Rural" },
    { "codigo": "MT04", "nombre": "Alto Aguacatal", "comuna": "Rural" }
  ],
  "T65": [
    { "codigo": "MT01", "nombre": "Kilómetro 18", "comuna": "Rural" },
    { "codigo": "MT02", "nombre": "San Miguel Alto", "comuna": "Rural" },
    { "codigo": "MT03", "nombre": "San Miguel Bajo", "comuna": "Rural" },
    { "codigo": "MT04", "nombre": "Las Peñas", "comuna": "Rural" }
  ],
  "T66": [
    { "codigo": "MT01", "nombre": "Cerezo", "comuna": "Rural" },
    { "codigo": "MT02", "nombre": "Palomar", "comuna": "Rural" },
    { "codigo": "MT03", "nombre": "San Miguel", "comuna": "Rural" },
    { "codigo": "MT04", "nombre": "Las Nieves Altas", "comuna": "Rural" }
  ],
  "T67": [
    { "codigo": "MT01", "nombre": "San Pablo", "comuna": "Rural" },
    { "codigo": "MT02", "nombre": "San Antonio", "comuna": "Rural" },
    { "codigo": "MT03", "nombre": "Las Nieves Bajas", "comuna": "Rural" },
    { "codigo": "MT04", "nombre": "Cabecera", "comuna": "Rural" }
  ],
  "T68": [
    { "codigo": "MT01", "nombre": "La Esperanza", "comuna": "Rural" },
    { "codigo": "MT02", "nombre": "La Ascensión", "comuna": "Rural" },
    { "codigo": "MT03", "nombre": "El Diamante", "comuna": "Rural" },
    { "codigo": "MT04", "nombre": "La Soledad", "comuna": "Rural" }
  ],
  "T69": [
    { "codigo": "MT01", "nombre": "Cabecera", "comuna": "Rural" },
    { "codigo": "MT02", "nombre": "Las Nieves", "comuna": "Rural" },
    { "codigo": "MT03", "nombre": "Santa Elena Baja", "comuna": "Rural" },
    { "codigo": "MT04", "nombre": "Santa Elena Alta", "comuna": "Rural" }
  ],
  "T70": [
    { "codigo": "MT01", "nombre": "Paujil parte Baja", "comuna": "Rural" },
    { "codigo": "MT02", "nombre": "Paujil parte Alta", "comuna": "Rural" },
    { "codigo": "MT03", "nombre": "Cabecera", "comuna": "Rural" },
    { "codigo": "MT04", "nombre": "El Bosque", "comuna": "Rural" }
  ],
  "T71": [
    { "codigo": "MT01", "nombre": "El Porvenir", "comuna": "Rural" },
    { "codigo": "MT02", "nombre": "La Vega", "comuna": "Rural" },
    { "codigo": "MT03", "nombre": "Fincas los Sierra", "comuna": "Rural" },
    { "codigo": "MT04", "nombre": "El Pato", "comuna": "Rural" }
  ],
  "T72": [
    { "codigo": "MT01", "nombre": "Loma de la Cajita", "comuna": "Rural" },
    { "codigo": "MT02", "nombre": "El Castillo", "comuna": "Rural" },
    { "codigo": "MT03", "nombre": "La Esmeralda", "comuna": "Rural" },
    { "codigo": "MT04", "nombre": "Cabecera", "comuna": "Rural" }
  ],
  "T73": [
    { "codigo": "MT01", "nombre": "Peñas", "comuna": "Rural" },
    { "codigo": "MT02", "nombre": "Plan de Vivienda", "comuna": "Rural" },
    { "codigo": "MT03", "nombre": "Casa Blanca", "comuna": "Rural" },
    { "codigo": "MT04", "nombre": "Cabecera Baja Andes", "comuna": "Rural" }
  ],
  "T74": [
    { "codigo": "MT01", "nombre": "Cabecera Alta", "comuna": "Rural" },
    { "codigo": "MT02", "nombre": "Yanaconas", "comuna": "Rural" },
    { "codigo": "MT03", "nombre": "La Emisora", "comuna": "Rural" },
    { "codigo": "MT04", "nombre": "Atenas", "comuna": "Rural" }
  ],
  "T75": [
    { "codigo": "MT01", "nombre": "Los Cristales", "comuna": "Rural" },
    { "codigo": "MT02", "nombre": "Pueblo Nuevo", "comuna": "Rural" },
    { "codigo": "MT03", "nombre": "Quebrada Honda", "comuna": "Rural" },
    { "codigo": "MT04", "nombre": "La Reforma", "comuna": "Rural" }
  ],
  "T76": [
    { "codigo": "MT01", "nombre": "Cabecera", "comuna": "Rural" },
    { "codigo": "MT02", "nombre": "El Otoño", "comuna": "Rural" },
    { "codigo": "MT03", "nombre": "Sirena - Sector Arrayanes", "comuna": "Rural" },
    { "codigo": "MT04", "nombre": "Sirena Santa Barbara", "comuna": "Rural" }
  ],
  "T77": [
    { "codigo": "MT01", "nombre": "El Crucero Sector Alto", "comuna": "Rural" },
    { "codigo": "MT02", "nombre": "El Crucero Sector Bajo", "comuna": "Rural" },
    { "codigo": "MT03", "nombre": "El Rosario parte Alta", "comuna": "Rural" },
    { "codigo": "MT04", "nombre": "El Rosario parte Baja", "comuna": "Rural" }
  ],
  "T78": [
    { "codigo": "MT01", "nombre": "Cabecera parte Baja", "comuna": "Rural" },
    { "codigo": "MT02", "nombre": "Cabecera Sector Oasis", "comuna": "Rural" },
    { "codigo": "MT03", "nombre": "Cabecera sector Areneros", "comuna": "Rural" },
    { "codigo": "MT04", "nombre": "Cabecera", "comuna": "Rural" }
  ],
  "T79": [
    { "codigo": "MT01", "nombre": "Cascajal Sector Guayacal", "comuna": "Rural" },
    { "codigo": "MT02", "nombre": "Cascajal Sector Flamenco", "comuna": "Rural" },
    { "codigo": "MT03", "nombre": "Cauca Viejo", "comuna": "Rural" },
    { "codigo": "MT04", "nombre": "Cascajal Cabecera", "comuna": "Rural" }
  ],
  "T80": [
    { "codigo": "MT01", "nombre": "La Pailita 1", "comuna": "Rural" },
    { "codigo": "MT02", "nombre": "Morgan", "comuna": "Rural" },
    { "codigo": "MT03", "nombre": "La Pailita 2", "comuna": "Rural" },
    { "codigo": "MT04", "nombre": "Morgan parte Alta", "comuna": "Rural" }
  ],
  "T81": [
    { "codigo": "MT01", "nombre": "Cabecera", "comuna": "Rural" },
    { "codigo": "MT02", "nombre": "El Carmen", "comuna": "Rural" },
    { "codigo": "MT03", "nombre": "Sector Edén Alto", "comuna": "Rural" },
    { "codigo": "MT04", "nombre": "Sector Edén Bajo", "comuna": "Rural" }
  ],
  "T82": [
    { "codigo": "MT01", "nombre": "Fonda", "comuna": "Rural" },
    { "codigo": "MT02", "nombre": "Fonda Sector la Rochela", "comuna": "Rural" },
    { "codigo": "MT03", "nombre": "Fonda Sector Bocatoma", "comuna": "Rural" },
    { "codigo": "MT04", "nombre": "Dosquebradas", "comuna": "Rural" }
  ],
  "T83": [
    { "codigo": "MT01", "nombre": "La Cabecera", "comuna": "Rural" },
    { "codigo": "MT02", "nombre": "San Francisco", "comuna": "Rural" },
    { "codigo": "MT03", "nombre": "Alto San Pablo", "comuna": "Rural" },
    { "codigo": "MT04", "nombre": "Pico de Águila", "comuna": "Rural" }
  ],
  "T84": [
    { "codigo": "MT01", "nombre": "San Pablo", "comuna": "Rural" },
    { "codigo": "MT02", "nombre": "La Vorágine", "comuna": "Rural" },
    { "codigo": "MT03", "nombre": "El Porvenir", "comuna": "Rural" },
    { "codigo": "MT04", "nombre": "Peón", "comuna": "Rural" }
  ]
}
```

---

## Anexo B — Matriz de trazabilidad ítem → regla

| Ítems | Sección del formulario | Reglas |
|---|---|---|
| 1 | Tratamiento y uso de datos | RN-001, RN-224 |
| 2 | Situaciones inminentes | RN-002, RN-201 |
| 3 – 9 | Datos generales del entorno | RN-003 a RN-009 |
| 10 – 16 | Equipo de salud y ficha | RN-010 a RN-016 |
| 17 – 20 | Datos de abordaje | RN-017 a RN-020 |
| 21 – 33 | Datos generales de la vivienda | RN-021 a RN-033 |
| 34 – 38 | Condiciones del entorno y la vivienda | RN-034 a RN-038, RN-211 |
| 39 – 45 | Oficios, zoonosis y peridomicilio | RN-039 a RN-045, RN-211 |
| 46 – 49 | Agua y saneamiento básico | RN-046 a RN-049, RN-211 |
| 50 – 54 | Estructura y contexto familiar | RN-050 a RN-054, RN-212 |
| 55 – 57 | Prácticas protectoras familiares | RN-055 a RN-057 |
| 58 – 72 | Identificación de integrantes | RN-058 a RN-072 |
| 73 – 80 | Características socioeconómicas | RN-073 a RN-080, RN-206, RN-209 |
| 81 – 90 | Situación de salud y acceso | RN-081 a RN-090, RN-205, RN-210 |
| 91 – 99 | Antropometría y signos vitales | RN-091 a RN-099, RN-203, RN-204 |
| 100 – 104 | Morbilidad y adherencia | RN-100 a RN-104, RN-208, RN-210 |
| 105 – 110 | Salud mental y consumo de SPA | RN-105 a RN-110, RN-202, RN-207 |
| 111 – 119 | Plan de cuidado — Vivienda | RN-111 a RN-119, RN-220, RN-226 |
| 120 – 129 | Plan de cuidado — Familia | RN-120 a RN-129, RN-220, RN-226 |
| 130 – 140 | Plan de cuidado — Persona | RN-130 a RN-140, RN-220, RN-226 |
| — | Cardinalidad y estructura | RN-000, RN-051 |
| — | Decisión clínica y canalización | RN-200 a RN-212 |
| — | Cierre, integridad y seguridad | RN-220 a RN-226 |

---

## Anexo C — Observaciones al instrumento reportables al MSPS

Durante la elaboración de estas reglas se identificaron tres inconsistencias en el formulario impreso *SI-APS – Poblacional instrumento identificación v2 – 2025*. Se recomienda su reporte al Ministerio de Salud y Protección Social para corrección en la próxima versión:

| # | Ítem | Observación | Tratamiento en el sistema |
|---|---|---|---|
| 1 | **78** | La opción *"Negligencia y abandono"* aparece **duplicada** en la lista de modalidades de violencia. | Se registra una sola vez (RN-078). |
| 2 | **136** | El número **136** se asigna a **dos columnas distintas** de la subsección 6.3: "Acción / Intervención (CUPS / NoCUPS)" y "Respuesta". | Se desagrega en RN-136a y RN-136b. |
| 3 | **109** | El instrumento de tamizaje se nombra *"Carlos CRAFFT"*; la denominación técnica correcta es **CRAFFT**. | Se usa la denominación correcta (RN-109). |

---

## Control de versiones

| Versión | Fecha | Cambios |
|---|---|---|
| 1.0 | — | Documento inicial con 105 reglas de captura (RN-001 a RN-140, con vacíos). |
| **2.0** | **12/08/2026** | Cobertura completa de los 140 ítems del instrumento. Se agregan 32 reglas de captura faltantes; se corrigen 12 reglas existentes; se incorporan las familias nuevas **RN-200 a RN-212** (decisión clínica y canalización) y **RN-220 a RN-226** (cierre, integridad, seguridad y seguimiento); se agrega **RN-000** (modelo de cardinalidad). El catálogo de territorios se traslada al **Anexo A**. Se incorporan los anexos B y C. |

### Resumen de la versión 2.0

| Concepto | Cantidad |
|---|---|
| Ítems del instrumento cubiertos | **140 de 140** |
| Reglas de captura (RN-000 a RN-140) | 142 |
| Reglas de decisión clínica (RN-200 a RN-212) | 13 |
| Reglas de cierre e integridad (RN-220 a RN-226) | 7 |
| **Total de reglas** | **162** |
| Reglas nuevas en esta versión | 44 |
| Reglas corregidas en esta versión | 20 |
