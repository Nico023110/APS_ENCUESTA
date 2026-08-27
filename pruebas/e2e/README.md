# Pruebas de navegador (Playwright)

Las pruebas de `pruebas/*.test.js` corren sobre JSDOM: leen el DOM, pero no
saben nada de pintado, desplazamiento, campos tapados ni permisos del
navegador. Estas otras abren Chromium de verdad contra `servidor.js` y
recorren el formulario como lo recorre quien encuesta en campo.

## Cómo se corren

| Orden | Qué hace | Dura |
| --- | --- | --- |
| `npm run e2e` | Abre la ventana y avanza despacio, para mirar el proceso. | ~3½ min |
| `npm run e2e:rapido` | Sin ventana, a toda velocidad. Para CI. | ~1 min |
| `npm run e2e:informe` | Abre el informe HTML de la última corrida. | — |

Dos perillas para el ritmo:

- `PW_LENTITUD` — pausa entre acciones (220 ms por defecto en la corrida
  lenta);
- `PW_TECLA` — pausa entre tecla y tecla al escribir (45 ms).

```bash
PW_LENTITUD=400 PW_TECLA=90 npm run e2e     # bash
$env:PW_LENTITUD=400; npm run e2e           # PowerShell
```

La corrida lenta usa `playwright.config.lento.js`, que hereda de
`playwright.config.js` y sólo cambia ventana y pausa. Está en un archivo
aparte porque Playwright recarga la configuración dentro del proceso de
trabajo, donde `process.argv` ya no conserva las banderas de la terminal: un
`slowMo` leído de argv se pierde y la corrida sale igual de rápida.

El servidor local se levanta solo (`webServer` en `playwright.config.js`) y se
reutiliza si ya estaba corriendo. La base sí tiene que estar en pie y con los
catálogos sembrados: `npm run bd:crear`.

## Qué recorre `encuesta_completa.spec.js`

Una ficha entera, en orden: consentimiento → información general → vivienda →
entorno → familia → **tres integrantes** → plan de cuidado → cierre →
sincronización. Son 188 campos.

Cada campo se llena con clic y **tecla por tecla** (`pressSequentially`),
nunca asignando `.value` ni de un golpe con `fill`. No es sólo para que se
vea: cada pulsación dispara los `input` que el formulario escucha para
recalcular edad, IMC y hacinamiento. Un `fill` los dispara una sola vez y
escondería un fallo de recálculo. Las fechas son la excepción —los campos
`type="date"` de Chromium se editan por segmentos y no admiten una cadena ISO
tecleada de corrido.

### Por qué tres integrantes y no uno

El formulario muestra u oculta catorce preguntas según la edad y el sexo. Con
un solo adulto esa lógica no se ejercita nunca. Las tres personas están
elegidas para cubrirla:

| Integrante | Edad | Qué ejercita |
| --- | --- | --- |
| Ana Gómez | 30 | Adulta con todos los campos: orientación, cintura, tensión, salud mental. Única con rol de responsable económico (RN-051). |
| Carlos Gómez | 35 | Hombre: el formulario le oculta la gestación (RN-085). |
| Sofía Gómez | 8 | Menor: sin orientación (<13), sin cintura ni tensión (<18), sin salud mental ni consumo (<14). Documento TI, no CC, según el catálogo por edad. |

Los campos condicionados se piden con la marca `SI_APLICA`: si la edad o el
sexo los esconden, se anotan como «no aplica» y no cuentan como fallo. La
corrida verde reporta exactamente 5 de esos.

La prueba **no se detiene en el primer tropiezo**. Anota lo que falla y sigue,
para que una sola corrida muestre todos los problemas en vez de obligar a
descubrirlos de a uno. El veredicto se decide al final, después de imprimir el
informe.

Falla si ocurre cualquiera de estas cosas:

- un campo no existe, está oculto, está deshabilitado o rechaza el valor;
- el navegador lanza una excepción o escribe un `console.error`;
- la aplicación hace una petición que falla;
- la ficha no cierra: quedan incumplimientos de reglas o impedimentos (RN-222);
- `/api/guardar_encuesta` no responde 200.

Los servicios externos que no responden (la geocodificación consulta
OpenStreetMap) se reportan aparte y **no** hacen fallar la prueba: son una
dependencia de red, no un defecto del formulario.

## Diferencias que ya destapó frente a la prueba sobre JSDOM

- **Campos condicionados.** `lactanciaExclusiva` sólo se muestra a menores de
  6 meses. La prueba sobre JSDOM la llenaba igual, porque allí «oculto» no
  significa nada. Aquí no se toca.
- **Los bloques de integrante se abren solos.** Al declarar el número de
  integrantes (ítem 51), `sincronizarIntegrantes` crea los bloques que
  faltan. No hay que pulsar «Agregar integrante»: hacerlo *además* de
  declarar el número deja bloques vacíos de más, y el cierre los denuncia
  como integrantes sin caracterizar (RN-029, RN-051).
- **Datos de demostración.** La aplicación siembra tres fichas de ejemplo la
  primera vez que se abre, y «Sincronizar a la Nube» las empuja todas. La API
  las rechaza con 400 porque están incompletas a propósito. La prueba las
  aparta antes de sincronizar para medir sólo la ficha que acaba de
  diligenciar.

## Qué queda después de correr

En `pruebas/e2e/resultados/` (ignorado por git):

- `video.webm` — el recorrido completo grabado, siempre;
- `cierre-de-la-ficha.png` — la pantalla al momento de guardar;
- `informe-del-diligenciamiento.txt` — el diario completo en JSON;
- `trace.zip` — **sólo cuando la prueba falla**. Se navega con
  `npx playwright show-trace <ruta>` y deja retroceder acción por acción con
  el DOM de cada momento. No se guarda en las corridas verdes porque pasa de
  los 140 MB.

Cada corrida deja una ficha nueva en la base, con código `F-PW-…`. Para
limpiarlas:

```sql
DELETE FROM aps.ficha  WHERE codigo LIKE 'F-PW-%';
DELETE FROM aps.hogar  WHERE codigo LIKE 'HG-PW-%';
```
