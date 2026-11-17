/* =========================================================
   Encuesta_APS — Gestión de usuarios (vista «Usuarios»)
   ---------------------------------------------------------
   La ven quienes tienen usuarios.ver: administrador, maestro y la
   coordinación del EBS. Modificar y restablecer la clave sólo se ofrecen con
   su permiso (usuarios.modificar, usuarios.restablecer): la coordinación
   crea cuentas del personal asistencial pero no las cambia. Se abre desde el
   menú del chip de usuario (sesion.js). Habla con /api/usuarios, que aplica
   todas las reglas: aquí sólo se pinta y se recoge el formulario. Depende de
   app.js (cambiarVista, mostrarNotificacion) y de roles.js (ROLES,
   rolesQuePuedeCrear, requiereEquipo, eligePerfil) para las listas.
   ========================================================= */

(function () {
  'use strict';

  if (typeof ROLES === 'undefined' || typeof SESION === 'undefined') return;

  const TIPOS_DOCUMENTO = [
    { valor: 'CC', etiqueta: 'CC. Cédula de Ciudadanía' },
    { valor: 'CD', etiqueta: 'CD. Carné Diplomático' },
    { valor: 'CE', etiqueta: 'CE. Cédula de Extranjería' },
    { valor: 'PT', etiqueta: 'PT. Permiso por Protección Temporal' }
  ];

  let usuarios = [];
  let editando = null;   // fila en edición, o null si se está creando

  const $ = function (id) { return document.getElementById(id); };

  /* Avisos breves en esquina, no un diálogo: la confirmación de guardar no
     exige decisión y el formulario (o la clave temporal) ya está a la vista. */
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

  function textoSeguro(valor) {
    return String(valor === null || valor === undefined ? '' : valor)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* Cada rol asigna sólo los roles que roles.js le deja (el administrador no
     da el de maestro; la coordinación, sólo los del personal asistencial).
     El servidor lo impone; aquí sólo se retiran de la lista. */
  function rolesAsignables() {
    return rolesQuePuedeCrear(SESION.usuario().rol);
  }

  function llenarSelect(select, opciones, conVacio) {
    select.innerHTML = '';
    if (conVacio) {
      const vacia = document.createElement('option');
      vacia.value = '';
      vacia.textContent = conVacio;
      select.appendChild(vacia);
    }
    opciones.forEach(function (op) {
      const el = document.createElement('option');
      el.value = op.valor;
      el.textContent = op.etiqueta;
      select.appendChild(el);
    });
  }

  /* ---------------------------------------------------------
     Lista
     --------------------------------------------------------- */

  const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

  function formatearFechaHora(valor) {
    if (!valor) return null;
    const fecha = new Date(valor);
    if (isNaN(fecha.getTime())) return null;
    return fecha.getDate() + ' ' + MESES[fecha.getMonth()] + ' ' + fecha.getFullYear() + ', ' +
      fecha.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' });
  }

  /* El nombre llega en mayúsculas sostenidas, como en el documento. En la
     lista se muestra como nombre propio («Ana María de la Cruz»), que se lee
     más rápido; la búsqueda sigue usando el valor original. */
  const PARTICULAS = ['de', 'del', 'la', 'las', 'los', 'y', 'e'];
  function nombrePropio(texto) {
    return String(texto || '').toLocaleLowerCase('es-CO').split(/\s+/).filter(Boolean).map(function (p, i) {
      if (i > 0 && PARTICULAS.indexOf(p) !== -1) return p;
      return p.charAt(0).toLocaleUpperCase('es-CO') + p.slice(1);
    }).join(' ');
  }

  function iniciales(texto) {
    const partes = String(texto || '').trim().split(/\s+/).filter(function (p) {
      return PARTICULAS.indexOf(p.toLocaleLowerCase('es-CO')) === -1;
    });
    return ((partes[0] || '').charAt(0) + (partes[1] || '').charAt(0)).toLocaleUpperCase('es-CO') || '·';
  }

  function estadoDe(u) {
    if (!u.activo) return 'inactiva';
    if (u.bloqueadoHasta && new Date(u.bloqueadoHasta) > new Date()) return 'bloqueada';
    if (u.debeCambiarClave) return 'clave';
    return 'activa';
  }

  function badgeEstado(u) {
    const estado = estadoDe(u);
    if (estado === 'inactiva') return '<span class="badge badge--danger">Desactivada</span>';
    if (estado === 'bloqueada') return '<span class="badge badge--warning">Bloqueada</span>';
    if (estado === 'clave') return '<span class="badge badge--warning">Clave temporal</span>';
    return '<span class="badge badge--success">Activa</span>';
  }

  /* Bajo el estado, el último ingreso: «Nunca ha entrado» es lo que la
     coordinación quiere ver de una cuenta con clave temporal. */
  function celdaEstado(u) {
    const cuando = formatearFechaHora(u.ultimoAccesoEn);
    return badgeEstado(u) +
      '<span class="usuarios__acceso' + (cuando ? '' : ' usuarios__acceso--nunca') + '">' +
        (cuando ? 'Último acceso: ' + textoSeguro(cuando) : 'Nunca ha entrado') + '</span>';
  }

  /* Cuántas cuentas hay en la lista filtrada y en qué estado. */
  function pintarResumen(lista) {
    const destino = $('usuariosResumen');
    if (!destino) return;
    if (usuarios.length === 0) { destino.textContent = ''; return; }
    const cuenta = { activa: 0, clave: 0, bloqueada: 0, inactiva: 0 };
    lista.forEach(function (u) { cuenta[estadoDe(u)]++; });
    const partes = [];
    /* Cada cifra con su punto en una sola pieza: al partirse la línea no
       queda un punto suelto al final del renglón. */
    if (cuenta.activa) partes.push('<span class="usuarios__punto usuarios__punto--ok"></span>' + cuenta.activa + (cuenta.activa === 1 ? ' activa' : ' activas'));
    if (cuenta.clave) partes.push('<span class="usuarios__punto usuarios__punto--aviso"></span>' + cuenta.clave + ' con clave temporal');
    if (cuenta.bloqueada) partes.push('<span class="usuarios__punto usuarios__punto--aviso"></span>' + cuenta.bloqueada + (cuenta.bloqueada === 1 ? ' bloqueada' : ' bloqueadas'));
    if (cuenta.inactiva) partes.push('<span class="usuarios__punto usuarios__punto--alerta"></span>' + cuenta.inactiva + (cuenta.inactiva === 1 ? ' desactivada' : ' desactivadas'));
    destino.innerHTML = '<strong>' + lista.length + (lista.length === 1 ? ' cuenta' : ' cuentas') +
      (lista.length !== usuarios.length ? ' de ' + usuarios.length : '') + '</strong>' +
      partes.map(function (p) { return '<span class="usuarios__resumen-item">' + p + '</span>'; }).join('');
  }

  function filtrados() {
    const texto = $('usuariosFiltroTexto').value.trim().toLowerCase();
    const rol = $('usuariosFiltroRol').value;
    const estado = $('usuariosFiltroEstado').value;
    return usuarios.filter(function (u) {
      if (rol && u.rol !== rol) return false;
      if (estado === 'activo' && !u.activo) return false;
      if (estado === 'inactivo' && u.activo) return false;
      if (estado === 'clave' && estadoDe(u) !== 'clave') return false;
      if (!texto) return true;
      return [u.nombre, u.documento, u.equipo, (u.apoyo || []).join(' '), u.rolEtiqueta, u.cargo, u.correo].some(function (v) {
        return String(v || '').toLowerCase().indexOf(texto) !== -1;
      });
    });
  }

  /* El cargo dice más que el «Otro: …» del ítem 14; sin cargo, se muestra
     esa aclaración como antes. */
  function detalleDeRol(u) {
    const detalle = u.cargo || (u.perfil === 'otro' ? u.perfilOtro : '');
    return detalle && detalle !== u.rolEtiqueta ? '<span class="usuarios__cargo">' + textoSeguro(detalle) + '</span>' : '';
  }

  /* Un dato por renglón, con su icono. El correo largo se recorta con «…»
     (completo al pasar el mouse) en vez de partirse a mitad de palabra. */
  function contacto(u) {
    const partes = [];
    if (u.correo) {
      partes.push('<span class="usuarios__contacto" title="' + textoSeguro(u.correo) + '">' +
        '<i class="ph ph-envelope-simple" aria-hidden="true"></i><span>' + textoSeguro(u.correo) + '</span></span>');
    }
    if (u.telefono) {
      partes.push('<span class="usuarios__contacto mono">' +
        '<i class="ph ph-phone" aria-hidden="true"></i><span>' + textoSeguro(u.telefono) + '</span></span>');
    }
    return partes.length ? partes.join('') : '<span class="usuarios__vacio">Sin contacto</span>';
  }

  function pintarLista() {
    const cuerpo = $('usuariosTableBody');
    const lista = filtrados();
    const actor = SESION.usuario();
    const modifica = SESION.puede('usuarios.modificar');
    const restablece = SESION.puede('usuarios.restablecer');

    cuerpo.innerHTML = lista.map(function (u) {
      const esYo = u.id === actor.id;
      const protegida = u.rol === 'maestro' && actor.rol !== 'maestro';
      const titulo = protegida ? ' title="Sólo un usuario maestro puede modificar esta cuenta"' : '';
      const acciones =
        (modifica ? '<button type="button" class="btn usuarios__accion" data-modificar="' + u.id + '"' +
          (protegida ? ' disabled' + titulo : '') + '><i class="ph ph-pencil-simple" aria-hidden="true"></i>Modificar</button>' : '') +
        (restablece ? '<button type="button" class="btn usuarios__accion" data-restablecer="' + u.id + '"' +
          (protegida ? ' disabled' + titulo : '') + '><i class="ph ph-key" aria-hidden="true"></i>Restablecer clave</button>' : '');
      const estado = estadoDe(u);
      return (
        '<tr class="usuarios__fila usuarios__fila--' + estado + (u.activo ? '' : ' is-inactiva') + '">' +
          '<td data-label="Persona" class="usuarios__persona-celda"><div class="usuarios__persona">' +
            '<span class="usuarios__avatar" aria-hidden="true">' + textoSeguro(iniciales(u.nombre)) + '</span>' +
            '<span class="usuarios__identidad">' +
              '<span class="usuarios__nombre">' + textoSeguro(nombrePropio(u.nombre)) +
                (esYo ? ' <span class="usuarios__yo">Usted</span>' : '') + '</span>' +
              '<span class="usuarios__documento mono">' + textoSeguro(u.tipoId) + ' ' + textoSeguro(u.documento) + '</span>' +
            '</span>' +
          '</div></td>' +
          '<td data-label="Rol y equipo" class="usuarios__rol">' +
            '<span class="usuarios__rol-nombre">' + textoSeguro(u.rolEtiqueta) + '</span>' + detalleDeRol(u) +
            celdaDeEquipo(u) +
          '</td>' +
          '<td data-label="Contacto" class="usuarios__contactos">' + contacto(u) + '</td>' +
          '<td data-label="Estado" class="usuarios__estado-celda">' + celdaEstado(u) + '</td>' +
          '<td class="actions-cell usuarios__acciones-celda">' + (acciones || '<span class="usuarios__vacio">Sólo consulta</span>') + '</td>' +
        '</tr>'
      );
    }).join('');

    $('usuariosEmptyState').hidden = lista.length > 0;
    pintarResumen(lista);

    cuerpo.querySelectorAll('[data-modificar]').forEach(function (boton) {
      boton.addEventListener('click', function () { abrirFormulario(buscar(boton.dataset.modificar)); });
    });
    cuerpo.querySelectorAll('[data-restablecer]').forEach(function (boton) {
      boton.addEventListener('click', function () { restablecerClave(buscar(boton.dataset.restablecer)); });
    });
  }

  function buscar(id) {
    return usuarios.find(function (u) { return String(u.id) === String(id); }) || null;
  }

  async function cargar() {
    $('usuariosError').hidden = true;
    try {
      const respuesta = await fetch('/api/usuarios');
      const cuerpo = await respuesta.json().catch(function () { return {}; });
      if (!respuesta.ok) throw new Error(cuerpo.error || ('HTTP ' + respuesta.status));
      usuarios = cuerpo.usuarios || [];
      pintarLista();
    } catch (error) {
      usuarios = [];
      pintarLista();
      $('usuariosEmptyState').hidden = true;
      $('usuariosError').textContent = 'No fue posible cargar los usuarios: ' + error.message;
      $('usuariosError').hidden = false;
    }
  }

  function abrirVista() {
    if (!SESION.puede('usuarios.ver')) return;
    cambiarVista('usuarios');
    cargar();
  }

  /* ---------------------------------------------------------
     Formulario
     --------------------------------------------------------- */

  function marcarError(campo, mensaje) {
    const formulario = $('formUsuario');
    formulario.querySelectorAll('.field.has-error').forEach(function (f) { f.classList.remove('has-error'); });
    /* Los EBS que apoya se eligen en el mismo campo que el principal. */
    if (campo === 'apoyo') campo = 'equipo';
    if (campo) {
      const contenedor = formulario.querySelector('[data-campo="' + campo + '"]');
      if (contenedor) {
        contenedor.classList.add('has-error');
        const control = Array.from(contenedor.querySelectorAll('input, select')).find(function (e) {
          return e.type !== 'hidden' && e.offsetParent !== null;
        });
        if (control) control.focus();
      }
    }
    const aviso = $('usuarioError');
    aviso.textContent = mensaje || '';
    aviso.hidden = !mensaje;
  }

  function mostrarClaveTemporal(clave) {
    $('usuarioClaveValor').textContent = clave || '';
    $('usuarioClaveTemporal').hidden = !clave;
  }

  /* Los EBS de la persona: el principal y los demás en que trabaja; quien no
     pertenece a ninguno (enfoque diferencial) aparece como «Apoya a». */
  function celdaDeEquipo(u) {
    const otros = (u.apoyo || []).filter(function (c) { return c !== u.equipo; });
    if (!u.equipo && otros.length === 0) return '';
    const chip = function (codigo, principal) {
      return '<span class="usuarios__ebs' + (principal ? ' usuarios__ebs--principal' : '') + '"' +
        (principal && otros.length > 0 ? ' title="EBS principal"' : '') + '>' + textoSeguro(codigo) + '</span>';
    };
    return '<span class="usuarios__equipos">' +
      (u.equipo ? chip(u.equipo, true) : '<span class="usuarios__apoya">Apoya a</span>') +
      otros.map(function (c) { return chip(c, false); }).join('') +
      '</span>';
  }

  /* ---------------------------------------------------------
     EBS de la persona (uno o varios)
     ---------------------------------------------------------
     Una sola lista: el primero es el principal (su equipo de base, que va a
     aps.funcionario.equipo_salud_id) y los demás quedan como EBS en que
     también trabaja (aps.funcionario_apoyo_ebs). Con «sólo los apoya» no hay
     principal: todos van como apoyo (enfoque diferencial). Se eligen de los
     EBS registrados; un código nuevo sólo puede ser el principal, porque el
     servidor únicamente crea el equipo principal (los demás deben existir:
     un código mal escrito crearía un equipo fantasma). */
  const OTRO_CODIGO = '__otro__';
  const FORMATO_EBS = /^[A-Z0-9]{3,20}$/;
  let ebsElegidos = [];

  function ebsRegistrados() {
    return typeof CAT_EQUIPOS_EBS !== 'undefined' && Array.isArray(CAT_EQUIPOS_EBS)
      ? CAT_EQUIPOS_EBS.map(function (c) { return String(c).toUpperCase(); }) : [];
  }

  function esRegistrado(codigo) {
    return ebsRegistrados().indexOf(codigo) !== -1;
  }

  function soloApoya() {
    return $('usuarioEbsSoloApoya').checked;
  }

  function pintarEbs() {
    const lista = $('usuarioEbsLista');
    const sinPrincipal = soloApoya();
    /* Un código nuevo tiene que quedar de principal: mientras haya uno, no se
       ofrece cambiar el principal. */
    const fijo = ebsElegidos.length > 0 && !esRegistrado(ebsElegidos[0]);
    lista.innerHTML = ebsElegidos.map(function (codigo, i) {
      const principal = i === 0 && !sinPrincipal;
      const nuevo = !esRegistrado(codigo);
      const etiqueta = principal ? (ebsElegidos.length > 1 ? 'Principal' : '') : (sinPrincipal ? 'Apoya' : 'También');
      return '<li class="usuarios-ebs__chip' + (principal ? ' is-principal' : '') + '">' +
        '<span class="usuarios-ebs__codigo">' + textoSeguro(codigo) + '</span>' +
        (etiqueta ? '<span class="usuarios-ebs__papel">' + etiqueta + '</span>' : '') +
        (nuevo ? '<span class="usuarios-ebs__papel usuarios-ebs__papel--nuevo">Nuevo</span>' : '') +
        (!principal && !sinPrincipal && !fijo
          ? '<button type="button" class="usuarios-ebs__accion" data-principal="' + i + '" ' +
            'aria-label="Hacer de ' + textoSeguro(codigo) + ' el EBS principal" title="Hacer principal">' +
            '<i class="ph ph-star" aria-hidden="true"></i></button>'
          : '') +
        '<button type="button" class="usuarios-ebs__accion" data-quitar="' + i + '" ' +
          'aria-label="Quitar ' + textoSeguro(codigo) + '" title="Quitar">' +
          '<i class="ph ph-x" aria-hidden="true"></i></button>' +
        '</li>';
    }).join('');
    lista.hidden = ebsElegidos.length === 0;

    /* Lo que queda por agregar: los registrados que aún no están, y al final
       la opción de escribir un código que todavía no existe. */
    const agregar = $('usuarioEbsAgregar');
    const disponibles = ebsRegistrados().filter(function (c) { return ebsElegidos.indexOf(c) === -1; });
    agregar.innerHTML = '';
    const primera = document.createElement('option');
    primera.value = '';
    primera.textContent = ebsElegidos.length === 0 ? 'Elija un EBS…' : 'Agregar otro EBS…';
    agregar.appendChild(primera);
    disponibles.forEach(function (codigo) {
      const opcion = document.createElement('option');
      opcion.value = codigo;
      opcion.textContent = codigo;
      agregar.appendChild(opcion);
    });
    const otro = document.createElement('option');
    otro.value = OTRO_CODIGO;
    otro.textContent = 'Otro código (EBS aún no registrado)…';
    agregar.appendChild(otro);
    agregar.value = '';

    $('usuarioEbsSoloApoyaCampo').hidden = ebsElegidos.length === 0;
    $('usuarioEbsTitulo').textContent = sinPrincipal ? 'EBS que apoya *' : 'Equipos Básicos de Salud *';
  }

  /* Devuelve un mensaje si no se pudo agregar, o null. */
  function agregarEbs(texto) {
    const codigo = String(texto || '').trim().toUpperCase();
    if (!codigo) return null;
    if (!FORMATO_EBS.test(codigo)) return 'El código del EBS lleva entre 3 y 20 letras o números, sin espacios (ej. EBS021).';
    if (ebsElegidos.indexOf(codigo) !== -1) return codigo + ' ya está en la lista.';
    if (!esRegistrado(codigo) && (ebsElegidos.length > 0 || soloApoya())) {
      return codigo + ' no está registrado. Un EBS nuevo sólo puede ser el principal: agréguelo primero, ' +
        'antes que los demás, o elija uno de la lista.';
    }
    ebsElegidos.push(codigo);
    pintarEbs();
    return null;
  }

  function mostrarCodigoNuevo(visible) {
    $('usuarioEbsNuevo').hidden = !visible;
    $('usuarioEbsAgregar').hidden = visible;
    if (visible) {
      $('usuarioEbsCodigo').value = '';
      $('usuarioEbsCodigo').focus();
    } else {
      $('usuarioEbsAgregar').focus();
    }
  }

  function agregarCodigoNuevo() {
    const error = agregarEbs($('usuarioEbsCodigo').value);
    if (error) { marcarError('equipo', error); return; }
    marcarError(null, '');
    mostrarCodigoNuevo(false);
  }

  function inicializarEbs() {
    $('usuarioEbsAgregar').addEventListener('change', function () {
      const valor = this.value;
      if (!valor) return;
      if (valor === OTRO_CODIGO) { this.value = ''; mostrarCodigoNuevo(true); return; }
      const error = agregarEbs(valor);
      marcarError(error ? 'equipo' : null, error || '');
      $('usuarioEbsAgregar').focus();
    });
    $('usuarioEbsCodigoAgregar').addEventListener('click', agregarCodigoNuevo);
    $('usuarioEbsCodigo').addEventListener('keydown', function (evento) {
      if (evento.key === 'Enter') { evento.preventDefault(); agregarCodigoNuevo(); }
      if (evento.key === 'Escape') { evento.preventDefault(); evento.stopPropagation(); marcarError(null, ''); mostrarCodigoNuevo(false); }
    });
    $('usuarioEbsCodigoCancelar').addEventListener('click', function () {
      marcarError(null, '');
      mostrarCodigoNuevo(false);
    });
    $('usuarioEbsLista').addEventListener('click', function (evento) {
      const quitar = evento.target.closest('[data-quitar]');
      const principal = evento.target.closest('[data-principal]');
      if (quitar) {
        ebsElegidos.splice(Number(quitar.getAttribute('data-quitar')), 1);
        /* Si el nuevo primero es un código sin registrar, ya no puede quedar
           detrás de otros: se pide elegir de nuevo. */
        if (ebsElegidos.length > 1 && !esRegistrado(ebsElegidos[0])) ebsElegidos.shift();
        if (ebsElegidos.length === 0) $('usuarioEbsSoloApoya').checked = false;
        pintarEbs();
        $('usuarioEbsAgregar').focus();
      } else if (principal) {
        const i = Number(principal.getAttribute('data-principal'));
        const codigo = ebsElegidos.splice(i, 1)[0];
        ebsElegidos.unshift(codigo);
        pintarEbs();
        const nuevoPrimero = $('usuarioEbsLista').querySelector('[data-quitar="0"]');
        if (nuevoPrimero) nuevoPrimero.focus();
      }
    });
    $('usuarioEbsSoloApoya').addEventListener('change', function () {
      /* Sin principal, un código nuevo no tiene cómo crearse: se retira. */
      if (soloApoya()) ebsElegidos = ebsElegidos.filter(esRegistrado);
      pintarEbs();
    });
  }

  function cargarEbsDe(u) {
    const apoyo = (u && u.apoyo) || [];
    ebsElegidos = [];
    if (u && u.equipo) ebsElegidos.push(String(u.equipo).toUpperCase());
    apoyo.forEach(function (c) {
      const codigo = String(c).toUpperCase();
      if (ebsElegidos.indexOf(codigo) === -1) ebsElegidos.push(codigo);
    });
    $('usuarioEbsSoloApoya').checked = !!(u && !u.equipo && apoyo.length > 0);
    mostrarCodigoNuevo(false);
    pintarEbs();
  }

  /* Lo que se envía: { equipo, apoyo } como siempre los ha recibido la API. */
  function ebsParaEnviar() {
    if (soloApoya()) return { equipo: null, apoyo: ebsElegidos.slice() };
    return { equipo: ebsElegidos[0] || null, apoyo: ebsElegidos.slice(1) };
  }

  /* Qué se le explica a quien crea la cuenta según el rol elegido. El rol
     ya dice qué hace la persona; el cargo sólo aporta cuando el rol no lo
     dice todo: la coordinación y los líderes no tienen EBS y lideran una
     zona, y la administración o el maestro tienen un puesto institucional. */
  const AYUDA_POR_NIVEL = {
    profesional: 'Captura fichas y corrige las de su equipo. Su EBS firma el ítem 10 y su rol es el perfil del ítem 14.',
    tecnico: 'Captura fichas y corrige las suyas. Su EBS firma el ítem 10 y su rol es el perfil del ítem 14.',
    coordinacion: 'No pertenece a un EBS: al diligenciar una ficha indica el EBS de la visita. Anote la zona que lidera.',
    administrador: 'No captura fichas: administra cuentas, equipos y reportes. No necesita EBS.',
    maestro: 'Tiene todos los permisos. Firma sus fichas con el EBS y el perfil que elija.'
  };

  const PLACEHOLDER_CARGO = {
    coordinacion: 'Ej. Líder Zona Norte',
    administrador: 'Ej. Profesional de sistemas',
    maestro: 'Ej. Coordinación APS'
  };

  function muestraCargo(rol) {
    const nivel = nivelDe(rol);
    return nivel === 'coordinacion' || nivel === 'administrador' || nivel === 'maestro';
  }

  /* El maestro y la coordinación eligen el perfil del ítem 14 con que firman;
     para la coordinación, «Otro» toma el cargo como aclaración si se deja
     vacía. El equipo sólo se pide a quien firma fichas con él. */
  function ajustarCamposSegunRol() {
    const rol = $('usuarioRol').value;
    const nivel = nivelDe(rol);
    const elige = eligePerfil(rol);
    const perfil = elige ? $('usuarioPerfil').value : rol;

    $('usuarioCampoPerfil').hidden = !elige;
    $('usuarioCampoPerfilOtro').hidden = perfil !== 'otro';
    $('usuarioCampoPerfilOtro').querySelector('label').textContent =
      '¿Cuál?' + (elige ? '' : ' *');

    $('usuarioCampoEquipo').hidden = !requiereEquipo(rol);

    $('usuarioCampoCargo').hidden = !muestraCargo(rol);
    $('usuarioCargo').placeholder = PLACEHOLDER_CARGO[nivel] || '';
    $('usuarioCampoCargo').querySelector('label').textContent =
      nivel === 'coordinacion' ? 'Zona que lidera' : 'Cargo';

    $('usuarioRolAyuda').textContent = AYUDA_POR_NIVEL[nivel] || '';
  }

  function abrirFormulario(u) {
    editando = u || null;
    const formulario = $('formUsuario');
    formulario.reset();
    marcarError(null, '');
    mostrarClaveTemporal('');

    llenarSelect($('usuarioTipoId'), TIPOS_DOCUMENTO);
    llenarSelect($('usuarioRol'), rolesAsignables().map(function (rol) {
      return { valor: rol, etiqueta: ROLES[rol].etiqueta };
    }));
    llenarSelect($('usuarioPerfil'), Object.keys(ROLES).filter(function (r) {
      return ROLES[r].nivel === 'profesional' || ROLES[r].nivel === 'tecnico';
    }).map(function (r) { return { valor: r, etiqueta: ROLES[r].etiqueta }; }));

    $('modalUsuarioTitulo').textContent = u ? 'Modificar usuario' : 'Nuevo usuario';
    $('btnRestablecerClave').hidden = !u;
    $('usuarioCampoActivo').hidden = !u;
    $('usuarioDocumento').readOnly = !!u;
    $('usuarioTipoId').disabled = !!u;

    if (u) {
      formulario.id.value = u.id;
      $('usuarioTipoId').value = u.tipoId;
      $('usuarioDocumento').value = u.documento;
      $('usuarioNombre').value = u.nombre;
      $('usuarioCargo').value = u.cargo || '';
      $('usuarioCorreo').value = u.correo || '';
      $('usuarioTelefono').value = u.telefono || '';
      $('usuarioRol').value = u.rol;
      $('usuarioPerfil').value = u.perfil && u.perfil !== u.rol ? u.perfil : (eligePerfil(u.rol) ? (u.perfil || 'otro') : 'otro');
      $('usuarioPerfilOtro').value = u.perfilOtro || '';
      $('usuarioActivo').checked = !!u.activo;
      const esYo = u.id === SESION.usuario().id;
      $('usuarioActivo').disabled = esYo;
      $('usuarioRol').disabled = esYo;
    } else {
      formulario.id.value = '';
      $('usuarioTipoId').value = 'CC';
      $('usuarioRol').value = rolesAsignables().indexOf('auxiliar_enfermeria') !== -1
        ? 'auxiliar_enfermeria' : rolesAsignables()[0];
      $('usuarioPerfil').value = 'otro';
      $('usuarioActivo').checked = true;
      $('usuarioActivo').disabled = false;
      $('usuarioRol').disabled = false;
    }

    cargarEbsDe(u);
    ajustarCamposSegunRol();
    $('modalUsuario').hidden = false;
    setTimeout(function () { (u ? $('usuarioNombre') : $('usuarioDocumento')).focus(); }, 40);
  }

  function cerrarFormulario() {
    $('modalUsuario').hidden = true;
    editando = null;
  }

  /* Un campo oculto por el rol no se manda vacío a ciegas: al modificar una
     cuenta se conserva lo que tenía (el cargo siempre; el equipo, mientras
     no cambie el rol), para no borrar datos al abrir y guardar. */
  function valorSegunVisibilidad(campo, input, conservado) {
    if (!$(campo).hidden) return input.value.trim() || null;
    return conservado === undefined ? null : conservado;
  }

  function leerFormulario() {
    const f = $('formUsuario');
    const rol = $('usuarioRol').value;
    /* Con el campo oculto por el rol se conserva lo que tenía, mientras no
       cambie el rol (como el resto de campos ocultos). */
    const ebs = !$('usuarioCampoEquipo').hidden
      ? ebsParaEnviar()
      : (editando && editando.rol === rol
        ? { equipo: editando.equipo || null, apoyo: editando.apoyo || [] }
        : { equipo: null, apoyo: [] });
    return {
      id: f.id.value || undefined,
      tipoId: $('usuarioTipoId').value,
      documento: $('usuarioDocumento').value.trim(),
      nombre: $('usuarioNombre').value.trim(),
      cargo: valorSegunVisibilidad('usuarioCampoCargo', $('usuarioCargo'), editando ? (editando.cargo || null) : null),
      correo: $('usuarioCorreo').value.trim() || null,
      telefono: $('usuarioTelefono').value.trim() || null,
      rol: rol,
      equipo: ebs.equipo,
      apoyo: ebs.apoyo,
      perfil: eligePerfil($('usuarioRol').value) ? $('usuarioPerfil').value : undefined,
      perfilOtro: $('usuarioPerfilOtro').value.trim() || null,
      activo: editando ? $('usuarioActivo').checked : true
    };
  }

  async function enviar(datos) {
    const respuesta = await fetch('/api/usuarios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos)
    });
    const cuerpo = await respuesta.json().catch(function () { return {}; });
    if (!respuesta.ok) {
      const error = new Error(cuerpo.error || 'No fue posible completar la operación.');
      error.campo = cuerpo.campo || null;
      throw error;
    }
    return cuerpo;
  }

  async function guardar(evento) {
    evento.preventDefault();
    marcarError(null, '');
    const datos = leerFormulario();
    const boton = $('btnGuardarUsuario');
    boton.disabled = true;
    try {
      const cuerpo = await enviar(Object.assign({ accion: editando ? 'modificar' : 'crear' }, datos));
      const guardado = cuerpo.usuario;
      const indice = usuarios.findIndex(function (u) { return u.id === guardado.id; });
      if (indice === -1) usuarios.unshift(guardado); else usuarios[indice] = guardado;
      pintarLista();

      /* Ficha técnica APS124CCFP, variable 15: EBS más 3 dígitos. No bloquea
         —hay equipos registrados antes de adoptar la estructura y sus fichas
         cuelgan de ese código—, pero se dice al guardar. */
      const avisoEquipo = datos.equipo && !/^EBS\d{3}$/.test(datos.equipo)
        ? ' El código de equipo ' + datos.equipo + ' no sigue la estructura de la ficha técnica ' +
          '(EBS seguido de 3 dígitos, por ejemplo EBS001).'
        : '';

      if (cuerpo.claveTemporal && !SESION.puede('usuarios.modificar')) {
        /* Quien crea pero no modifica (la coordinación) no se queda en un
           formulario de edición que no podría guardar: la clave se muestra
           aparte, una sola vez. */
        cerrarFormulario();
        mostrarModalClave(guardado.nombre, cuerpo.claveTemporal);
        avisar('Usuario ' + guardado.nombre + ' creado. Entréguele la contraseña temporal en persona.' + avisoEquipo,
          avisoEquipo ? 'warning' : 'success');
      } else if (cuerpo.claveTemporal) {
        /* La cuenta nueva se queda abierta para poder copiar la clave; desde
           aquí ya se edita como una existente. */
        editando = guardado;
        $('formUsuario').id.value = guardado.id;
        $('modalUsuarioTitulo').textContent = 'Usuario creado';
        $('usuarioDocumento').readOnly = true;
        $('usuarioTipoId').disabled = true;
        $('btnRestablecerClave').hidden = false;
        $('usuarioCampoActivo').hidden = false;
        $('usuarioActivo').checked = true;
        mostrarClaveTemporal(cuerpo.claveTemporal);
        avisar('Usuario ' + guardado.nombre + ' creado. Entréguele la contraseña temporal en persona.' + avisoEquipo,
          avisoEquipo ? 'warning' : 'success');
      } else {
        cerrarFormulario();
        avisar('Usuario ' + guardado.nombre + ' actualizado.' + avisoEquipo, avisoEquipo ? 'warning' : 'success');
      }
    } catch (error) {
      marcarError(error.campo, error.message);
    } finally {
      boton.disabled = false;
    }
  }

  /* Pide confirmación con el mismo modal que usa el resto de la app
     (pedirConfirmacion, en app.js) en vez de window.confirm: uno es un
     cuadro nativo del navegador, sin la marca ni el fondo esmerilado, y en
     Safari/iOS puede bloquear el hilo de un modo que confunde al probarlo
     dentro de otro diálogo ya abierto.

     Dos orígenes, dos formas de mostrar el resultado: pedido desde el botón
     de una fila de la lista (el formulario de edición ni se abre: `enFormulario`
     queda en false) muestra la clave en su propia modal; pedido desde dentro
     de «Modificar usuario» la deja donde ya está el resto del formulario. */
  function restablecerClave(u, opciones) {
    const objetivo = u || editando;
    if (!objetivo || typeof pedirConfirmacion !== 'function') return;
    const enFormulario = !!(opciones && opciones.enFormulario);

    pedirConfirmacion({
      titulo: 'Restablecer contraseña',
      mensaje: 'Se generará una contraseña temporal para ' + objetivo.nombre +
        ' y se cerrarán todas sus sesiones activas. Deberá crear una contraseña nueva en su próximo ingreso.',
      textoConfirmar: 'Restablecer',
      alConfirmar: function () { ejecutarRestablecerClave(objetivo, enFormulario); }
    });
  }

  async function ejecutarRestablecerClave(objetivo, enFormulario) {
    if (enFormulario) marcarError(null, '');
    try {
      const cuerpo = await enviar({ accion: 'restablecer', id: objetivo.id });
      const indice = usuarios.findIndex(function (x) { return x.id === cuerpo.usuario.id; });
      if (indice !== -1) usuarios[indice] = cuerpo.usuario;
      pintarLista();
      if (enFormulario) {
        mostrarClaveTemporal(cuerpo.claveTemporal);
        avisar('Contraseña de ' + objetivo.nombre + ' restablecida.', 'success');
      } else {
        mostrarModalClave(objetivo.nombre, cuerpo.claveTemporal);
      }
    } catch (error) {
      if (enFormulario) marcarError(null, error.message);
      else avisar(error.message, 'error');
    }
  }

  function copiarTexto(texto) {
    if (!texto) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(texto).then(function () { avisar('Contraseña copiada.', 'success'); })
        .catch(function () { avisar('No se pudo copiar; anótela manualmente.', 'warning'); });
    } else {
      avisar('Copie la contraseña manualmente.', 'info');
    }
  }

  function mostrarModalClave(nombre, clave) {
    $('claveTemporalIntro').textContent = 'Para ' + nombre + '.';
    $('claveTemporalValor').textContent = clave;
    $('modalClaveTemporal').hidden = false;
  }

  function cerrarModalClave() {
    $('modalClaveTemporal').hidden = true;
  }

  /* ---------------------------------------------------------
     Arranque
     --------------------------------------------------------- */

  document.addEventListener('DOMContentLoaded', function () {
    if (!SESION.puede('usuarios.ver')) return;

    llenarSelect($('usuariosFiltroRol'), Object.keys(ROLES).map(function (rol) {
      return { valor: rol, etiqueta: ROLES[rol].etiqueta };
    }), 'Rol: todos');

    /* El buscador repinta al escribir, no al perder el foco: su «change» al
       pulsar «Modificar» rehacía la tabla entre el mousedown y el click, y el
       primer clic después de buscar no abría nada. */
    $('usuariosFiltroTexto').addEventListener('input', pintarLista);
    ['usuariosFiltroRol', 'usuariosFiltroEstado'].forEach(function (id) {
      $(id).addEventListener('change', pintarLista);
    });

    $('btnNuevoUsuario').addEventListener('click', function () { abrirFormulario(null); });
    $('formUsuario').addEventListener('submit', guardar);
    $('usuarioRol').addEventListener('change', ajustarCamposSegunRol);
    $('usuarioPerfil').addEventListener('change', ajustarCamposSegunRol);
    inicializarEbs();
    $('btnRestablecerClave').addEventListener('click', function () { restablecerClave(editando, { enFormulario: true }); });
    $('btnCopiarClave').addEventListener('click', function () { copiarTexto($('usuarioClaveValor').textContent); });
    $('btnCancelarUsuario').addEventListener('click', cerrarFormulario);
    $('cerrarModalUsuario').addEventListener('click', cerrarFormulario);
    $('modalUsuario').addEventListener('click', function (evento) {
      if (evento.target === $('modalUsuario')) cerrarFormulario();
    });

    $('btnCopiarClaveModal').addEventListener('click', function () { copiarTexto($('claveTemporalValor').textContent); });
    $('btnCerrarClaveTemporal').addEventListener('click', cerrarModalClave);
    $('cerrarModalClaveTemporal').addEventListener('click', cerrarModalClave);
    $('modalClaveTemporal').addEventListener('click', function (evento) {
      if (evento.target === $('modalClaveTemporal')) cerrarModalClave();
    });

    document.addEventListener('keydown', function (evento) {
      if (evento.key !== 'Escape') return;
      if (!$('modalClaveTemporal').hidden) cerrarModalClave();
      else if (!$('modalUsuario').hidden) cerrarFormulario();
    });
  });

  window.USUARIOS = { abrir: abrirVista, recargar: cargar };
})();
