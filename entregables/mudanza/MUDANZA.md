# Mudanza de Vercel a ebs.saludladera.gov.co

Meta: el **martes 1 de diciembre de 2026** todos trabajan en `https://ebs.saludladera.gov.co`.

Lo que cada teléfono guarda —fichas sin subir, la copia para buscar sin señal, el acceso sin señal— queda atado a la dirección vieja (`aps-encuesta.vercel.app`) y **no pasa solo** a la nueva. Por eso nadie se cambia sin subir todo antes, y la copia final de Neon se saca después del corte.

## Lo que ya está listo (y apagado)

| Pieza | Qué hace |
|---|---|
| `mudanza.js` y `mudanza.json` | El aviso dentro de la app. Con `"activa": false` no se ve nada. Sólo aparece en la dirección vieja, nunca en la nueva. Prueba: `node pruebas/mudanza.test.js`. |
| `entregables/mudanza/instructivo_1_antes.png` y `instructivo_2_ya.png` | Imágenes para WhatsApp. Se vuelven a generar con `node entregables/mudanza/generar_instructivo.js` si cambian las fechas. |
| `entregables/mudanza/mensajes_whatsapp.txt` | Los tres mensajes: aviso, recordatorio y apertura. |
| `bd/fichas_despues_del_corte.js` | Cuenta lo que llegó a Neon después de la copia final. Sólo lectura. |
| `C:\APS_ENCUESTA_SERVIDOR` | La carpeta de instalación del servidor, `sacar_copia_neon.js` y `preparar_base.ps1 -Reemplazar`. |

**Importante:** el aviso sólo puede aparecer en los teléfonos que ya tengan la versión de la app con `mudanza.js`. Esa versión llega a cada teléfono la próxima vez que abre la app con señal. Por eso conviene subirla a Vercel **apagada** cuanto antes. Encenderla después es sólo cambiar `mudanza.json`, y eso sí llega en la siguiente apertura con señal, porque se pide a la red cada vez.

## Calendario propuesto

| Cuándo | Qué | Quién |
|---|---|---|
| Lun 23 nov | Subir a Vercel la app con el aviso **apagado**. | Desarrollo |
| Mar 24 nov | TI crea en el DNS interno `ebs.saludladera.gov.co → 192.168.0.213` y se prueba desde un teléfono en el wifi de la entidad y desde otro con datos móviles. | TI |
| Mar 24 nov | **Encender el aviso** (paso 1) y enviar el mensaje 1. | Coordinación y desarrollo |
| Jue 26 nov | Mensaje 2 (recordatorio). | Coordinación |
| Vie 27 nov, 4:00 p. m. | **Corte**, automático. En Vercel ya no se empiezan fichas; se puede terminar la que está en pantalla y subir lo pendiente. | Automático |
| Vie 27 nov, noche | **Copia final** y reemplazo de datos en el servidor (paso 2). | Desarrollo y Claude en el servidor |
| Sáb 28 nov, 6:00 a. m. | **Apertura**, automática. Vercel muestra el enlace a quien ya subió todo. Mensaje 3. | Automático y coordinación |
| Desde el lun 30 nov | Revisión diaria de lo que llega tarde (paso 3). | Desarrollo |
| Unas 2 semanas sin que llegue nada | Apagar Vercel y archivar Neon (paso 4). | Desarrollo |

Las horas del corte y de la apertura se cambian en `mudanza.json`.

## Qué ve cada persona en la dirección vieja

| Fase | En la app y el acceso |
|---|---|
| Apagado | Nada. |
| Aviso (antes del corte) | Un aviso azul claro: la fecha, la dirección nueva, «mismo usuario y contraseña» y «suba todo antes». Se cierra con «Entendido» y vuelve a salir al abrir la app. |
| Cerrada (corte → apertura) | Un bloque azul que no se cierra: «se está mudando», cuándo abre la nueva y cuántas fichas le faltan por subir, con el botón «Subir ahora». «Nueva encuesta» y «Empezar otra» quedan bloqueados, con explicación. |
| Mudada (desde la apertura) | Lo mismo. Cuando ya no le queda nada por subir: el enlace a la dirección nueva y los tres pasos: entrar, instalar allá y desinstalar esta. En Instalar: «no instale esta». |

## Paso 1 — Encender el aviso

1. En `mudanza.json`:
   - ponga `"activa": true`;
   - revise `corte` y `apertura` (hora de Colombia, terminan en `-05:00`);
   - `mensaje` vacío usa el texto automático; si escribe algo, reemplaza el texto del aviso.
2. Commit y push a `main`. Vercel publica solo.
3. Compruebe que `https://aps-encuesta.vercel.app/login` muestre el aviso.

## Paso 2 — Corte y copia final (viernes en la noche)

1. Espere a que suban los rezagados. En el equipo de desarrollo puede ver cuánto está llegando con `node bd/fichas_despues_del_corte.js --desde "2026-11-27 16:00"`.
2. Saque la copia final. Anote la hora que trae el nombre del archivo, `neon_AAAAMMDD_HHMM.dump`: es el «desde» del paso 3.

   ```
   cd C:\APS_ENCUESTA_SERVIDOR
   node despliegue\sacar_copia_neon.js --env C:\APS_ENCUESTA\.env.local
   ```
3. Copie el archivo a la máquina del servidor. En Claude, allá: «Reemplaza los datos con esta copia nueva». Corre `preparar_base.ps1 -Respaldo … -Reemplazar` y guarda antes la base que había.
4. Si la versión de la app cambió desde la instalación, actualícela también en el servidor (sección «Actualizar la aplicación» del `CLAUDE.md` de la carpeta de instalación).
5. Compruebe:
   - `comprobar.ps1 -Dominio ebs.saludladera.gov.co`;
   - entrar con un usuario real;
   - que el historial tenga las fichas de esa semana.

## Paso 3 — Lo que llega tarde (todos los días, unas dos semanas)

```
node bd/fichas_despues_del_corte.js --desde "AAAA-MM-DD HH:MM"
```

`--desde` es la hora de la copia final. El script dice cuántas fichas nuevas, segundas visitas y correcciones llegaron a Neon después de esa hora, y cuánta gente sigue entrando a Vercel. Si aparece algo, hay que pasarlo al servidor nuevo. La herramienta para eso se prepara cuando haga falta, con los casos reales a la vista.

## Paso 4 — Apagar Vercel

Cuando pasen unas dos semanas sin que llegue nada:

1. Saque una última copia de Neon y guárdela en `C:\respaldos_aps` del servidor.
2. En Vercel, mande toda la dirección vieja a la nueva (redirección en `vercel.json`) o pause el proyecto.
3. Después pause o borre Neon. Con la copia guardada no se pierde nada.

## Para TI

- **DNS interno.** Hoy, dentro de la entidad, `ebs.saludladera.gov.co` no resuelve. El DNS interno (192.168.0.1 y 192.168.0.2) es dueño de `saludladera.gov.co` y no tiene `ebs`; desde internet sí resuelve a 200.29.117.35. Los computadores que salen por el proxy entran, pero los teléfonos en el wifi de la entidad no. Hay que crear `ebs.saludladera.gov.co → 192.168.0.213`.
- **Lo que ya funciona** (verificado el 23 de noviembre desde internet): HTTPS válido, HSTS, archivos privados bloqueados y API respondiendo.
- **Respaldos.** Llevarse fuera de la máquina la copia diaria de `C:\respaldos_aps`.
- **Acceso a la máquina.** Entrar por VPN, nunca con el escritorio remoto abierto a internet.

## Preguntas que van a llegar

- **«¿Tengo que crear otra cuenta?»** No: mismo usuario y contraseña.
- **«Cambié mi contraseña hace poco y no me deja entrar.»** La base nueva es la copia del viernes en la noche. Una contraseña cambiada después de esa hora en Vercel no está allá: se restablece desde Usuarios.
- **«No me abre sin señal.»** La primera vez hay que entrar con señal en cada teléfono. Desde ahí funciona sin señal 30 días.
- **«No encuentro una ficha.»** Puede que se haya subido a Vercel después de la copia: aparece en el paso 3.
- **«En el wifi de la entidad no abre.»** Falta el DNS interno, que es tarea de TI. Mientras tanto, con datos móviles sí abre.
