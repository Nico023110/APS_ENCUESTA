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
    if (campo) {
      const contenedor = formulario.querySelector('[data-campo="' + campo + '"]');
      if (contenedor) {
        contenedor.classList.add('has-error');
        const control = contenedor.querySelector('input, select');
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

  /* El equipo propio y, para quien apoya a varios EBS (enfoque diferencial),
     los que apoya. */
  function celdaDeEquipo(u) {
    const apoyo = u.apoyo || [];
    if (!u.equipo && apoyo.length === 0) return '';
    const chip = function (codigo) { return '<span class="usuarios__ebs">' + textoSeguro(codigo) + '</span>'; };
    return '<span class="usuarios__equipos">' +
      (u.equipo ? chip(u.equipo) : '') +
      (apoyo.length > 0 ? '<span class="usuarios__apoya">Apoya a</span>' + apoyo.map(chip).join('') : '') +
      '</span>';
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
    $('usuarioCampoApoyo').hidden = !requiereEquipo(rol);
    $('usuarioCampoEquipo').querySelector('label').textContent = $('usuarioApoyo').value.trim()
      ? 'Equipo Básico de Salud (si pertenece a uno)' : 'Equipo Básico de Salud *';

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
      $('usuarioEquipo').value = u.equipo || '';
      $('usuarioApoyo').value = (u.apoyo || []).join(', ');
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
    const equipo = valorSegunVisibilidad('usuarioCampoEquipo', $('usuarioEquipo'),
      editando && editando.rol === rol ? (editando.equipo || null) : null);
    return {
      id: f.id.value || undefined,
      tipoId: $('usuarioTipoId').value,
      documento: $('usuarioDocumento').value.trim(),
      nombre: $('usuarioNombre').value.trim(),
      cargo: valorSegunVisibilidad('usuarioCampoCargo', $('usuarioCargo'), editando ? (editando.cargo || null) : null),
      correo: $('usuarioCorreo').value.trim() || null,
      telefono: $('usuarioTelefono').value.trim() || null,
      rol: rol,
      equipo: equipo ? equipo.toUpperCase() : null,
      apoyo: valorSegunVisibilidad('usuarioCampoApoyo', $('usuarioApoyo'),
        editando && editando.rol === rol ? (editando.apoyo || []).join(', ') : null) || '',
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

    ['usuariosFiltroTexto', 'usuariosFiltroRol', 'usuariosFiltroEstado'].forEach(function (id) {
      $(id).addEventListener('input', pintarLista);
      $(id).addEventListener('change', pintarLista);
    });

    $('btnNuevoUsuario').addEventListener('click', function () { abrirFormulario(null); });
    $('formUsuario').addEventListener('submit', guardar);
    $('usuarioRol').addEventListener('change', ajustarCamposSegunRol);
    $('usuarioPerfil').addEventListener('change', ajustarCamposSegunRol);
    $('usuarioApoyo').addEventListener('input', ajustarCamposSegunRol);
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
