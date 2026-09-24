/* =========================================================
   Encuesta_APS — Reporte SI-APS (vista «Reporte SI-APS»)
   ---------------------------------------------------------
   Genera el archivo plano APS124CCFP del anexo técnico para PISIS. Sólo la
   ven quienes tienen reporte.generar (administrador y maestro); se abre
   desde el menú del chip de usuario (sesion.js).

   Dos pasos, los dos contra /api/reporte_sispro (POST):
     Revisar            el resumen: cuántos registros saldrían y qué
                        variables quedan vacías o sin código, con los
                        códigos de ficha a corregir. No trae datos personales.
     Descargar archivo  el .TXT, que luego se firma digitalmente fuera de la
                        aplicación y se carga en PISIS.

   Todo lo que viene del servidor se pinta con textContent.
   ========================================================= */

(function () {
  'use strict';

  if (typeof SESION === 'undefined') return;

  const $ = function (id) { return document.getElementById(id); };

  function avisar(texto, tipo) {
    if (typeof Swal !== 'undefined') {
      Swal.fire({
        toast: true, position: 'top-end', icon: tipo || 'info', title: texto,
        showConfirmButton: false, timer: 2800, timerProgressBar: true,
        background: '#ffffff', color: '#0b1220'
      });
    } else if (typeof mostrarNotificacion === 'function') {
      mostrarNotificacion(texto, tipo || 'info');
    }
  }

  function fechaIso(fecha) {
    return fecha.getFullYear() + '-' + String(fecha.getMonth() + 1).padStart(2, '0') + '-' +
      String(fecha.getDate()).padStart(2, '0');
  }

  /* El reporte es mensual: por defecto, el mes anterior completo. */
  function mesAnterior() {
    const hoy = new Date();
    return {
      desde: fechaIso(new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1)),
      hasta: fechaIso(new Date(hoy.getFullYear(), hoy.getMonth(), 0))
    };
  }

  function periodo() {
    return { desde: $('reporteDesde').value, hasta: $('reporteHasta').value };
  }

  function mostrarError(texto) {
    $('reporteError').textContent = texto;
    $('reporteError').hidden = !texto;
  }

  function validarPeriodo() {
    const p = periodo();
    if (!p.desde || !p.hasta) return 'Indique las dos fechas del período.';
    if (p.desde > p.hasta) return 'La fecha inicial es posterior a la final.';
    return null;
  }

  function ocupado(activo) {
    ['btnReporteRevisar', 'btnReporteDescargar', 'reporteDesde', 'reporteHasta'].forEach(function (id) {
      $(id).disabled = activo;
    });
    $('formReporte').setAttribute('aria-busy', activo ? 'true' : 'false');
  }

  async function pedir(formato) {
    const p = periodo();
    return fetch('/api/reporte_sispro', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ desde: p.desde, hasta: p.hasta, formato: formato })
    });
  }

  async function errorDe(respuesta) {
    const cuerpo = await respuesta.json().catch(function () { return {}; });
    return cuerpo.error || ('HTTP ' + respuesta.status);
  }

  /* ---------------------------------------------------------
     Resumen
     --------------------------------------------------------- */

  function elemento(etiqueta, clase, texto) {
    const el = document.createElement(etiqueta);
    if (clase) el.className = clase;
    if (texto !== undefined && texto !== null) el.textContent = texto;
    return el;
  }

  function cifra(valor, etiqueta) {
    const caja = elemento('div', 'reporte__cifra');
    caja.appendChild(elemento('span', 'reporte__cifra-valor', String(valor)));
    caja.appendChild(elemento('span', 'reporte__cifra-etiqueta', etiqueta));
    return caja;
  }

  function pintarResumen(r) {
    const destino = $('reporteResultado');
    destino.innerHTML = '';

    const archivo = elemento('p', 'reporte__archivo');
    archivo.appendChild(elemento('i', 'ph ph-file-text'));
    archivo.appendChild(elemento('span', 'mono', r.nombreArchivo));
    destino.appendChild(archivo);

    const cifras = elemento('div', 'reporte__cifras');
    cifras.appendChild(cifra(r.fichas.incluidas, 'fichas incluidas'));
    cifras.appendChild(cifra(r.registros.tipo2, 'familias (registro tipo 2)'));
    cifras.appendChild(cifra(r.registros.tipo3, 'integrantes (registro tipo 3)'));
    cifras.appendChild(cifra(r.incidencias.total, 'incidencias'));
    destino.appendChild(cifras);

    const excluidas = [];
    if (r.fichas.sinConsentimiento) excluidas.push(r.fichas.sinConsentimiento + ' sin consentimiento');
    if (r.fichas.noCerradas) excluidas.push(r.fichas.noCerradas + ' sin cerrar o con visita incompleta');
    if (r.fichas.visitasAnterioresDelMismoHogar) {
      excluidas.push(r.fichas.visitasAnterioresDelMismoHogar + ' visitas anteriores de un hogar que se volvió a visitar');
    }
    if (excluidas.length) {
      destino.appendChild(elemento('p', 'field-hint', 'No entran: ' + excluidas.join('; ') + '.'));
    }

    (r.avisos || []).forEach(function (texto) {
      const aviso = elemento('div', 'reporte__aviso');
      aviso.appendChild(elemento('i', 'ph ph-warning'));
      aviso.appendChild(elemento('span', null, texto));
      destino.appendChild(aviso);
    });

    const detalle = r.incidencias.detalle || [];
    if (detalle.length === 0) {
      destino.appendChild(elemento('p', 'reporte__ok', 'Todas las variables obligatorias tienen dato y código del anexo.'));
    } else {
      destino.appendChild(elemento('h3', 'reporte__subtitulo', 'Qué corregir antes de enviar'));
      const envoltura = elemento('div', 'table-wrapper');
      const tabla = elemento('table', 'data-table reporte__tabla');
      const cabecera = elemento('tr');
      ['Registro', 'Variable', 'Problema', 'Casos', 'Fichas (ejemplos)'].forEach(function (t) {
        cabecera.appendChild(elemento('th', null, t));
      });
      const thead = elemento('thead');
      thead.appendChild(cabecera);
      tabla.appendChild(thead);
      const cuerpo = elemento('tbody');
      detalle.forEach(function (x) {
        const fila = elemento('tr');
        fila.appendChild(elemento('td', null, 'Tipo ' + x.tipoRegistro));
        const variable = elemento('td');
        variable.appendChild(elemento('strong', null, String(x.variable) + '. '));
        variable.appendChild(document.createTextNode(x.nombre));
        fila.appendChild(variable);
        fila.appendChild(elemento('td', null, x.problema));
        fila.appendChild(elemento('td', 'reporte__casos', String(x.cantidad)));
        fila.appendChild(elemento('td', 'mono', (x.fichas || []).join(', ')));
        cuerpo.appendChild(fila);
      });
      tabla.appendChild(cuerpo);
      envoltura.appendChild(tabla);
      destino.appendChild(envoltura);
    }

    destino.appendChild(elemento('p', 'field-hint reporte__firma',
      'Antes de cargarlo en PISIS, el archivo debe firmarse digitalmente con el certificado de la entidad.'));
    destino.hidden = false;
  }

  async function revisar(evento) {
    if (evento) evento.preventDefault();
    const problema = validarPeriodo();
    if (problema) { mostrarError(problema); return; }
    mostrarError('');
    ocupado(true);
    try {
      const respuesta = await pedir('resumen');
      if (!respuesta.ok) throw new Error(await errorDe(respuesta));
      pintarResumen(await respuesta.json());
    } catch (error) {
      $('reporteResultado').hidden = true;
      mostrarError('No fue posible revisar el reporte: ' + error.message);
    } finally {
      ocupado(false);
    }
  }

  async function descargar() {
    const problema = validarPeriodo();
    if (problema) { mostrarError(problema); return; }
    mostrarError('');
    ocupado(true);
    try {
      const respuesta = await pedir('archivo');
      if (!respuesta.ok) throw new Error(await errorDe(respuesta));
      const nombre = respuesta.headers.get('X-Nombre-Archivo') || 'APS124CCFP.TXT';
      const url = URL.createObjectURL(await respuesta.blob());
      const enlace = document.createElement('a');
      enlace.href = url;
      enlace.download = nombre;
      document.body.appendChild(enlace);
      enlace.click();
      enlace.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
      avisar('Archivo ' + nombre + ' descargado', 'success');
    } catch (error) {
      mostrarError('No fue posible generar el archivo: ' + error.message);
    } finally {
      ocupado(false);
    }
  }

  function abrirVista() {
    if (!SESION.puede('reporte.generar')) return;
    cambiarVista('reporte');
  }

  document.addEventListener('DOMContentLoaded', function () {
    if (!SESION.puede('reporte.generar')) return;
    const p = mesAnterior();
    $('reporteDesde').value = p.desde;
    $('reporteHasta').value = p.hasta;
    $('formReporte').addEventListener('submit', revisar);
    $('btnReporteDescargar').addEventListener('click', descargar);
  });

  window.REPORTE_SISPRO = { abrir: abrirVista };
})();
