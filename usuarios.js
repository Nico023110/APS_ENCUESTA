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

  function formatearFechaHora(valor) {
    if (!valor) return 'Nunca';
    const fecha = new Date(valor);
    if (isNaN(fecha.getTime())) return '—';
    return fecha.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) +
      ' ' + fecha.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
  }

  function badgeEstado(u) {
    if (!u.activo) return '<span class="badge badge--danger">Desactivada</span>';
    if (u.bloqueadoHasta && new Date(u.bloqueadoHasta) > new Date()) return '<span class="badge badge--warning">Bloqueada</span>';
    if (u.debeCambiarClave) return '<span class="badge badge--warning">Clave temporal</span>';
    return '<span class="badge badge--success">Activa</span>';
  }

  function filtrados() {
    const texto = $('usuariosFiltroTexto').value.trim().toLowerCase();
    const rol = $('usuariosFiltroRol').value;
    const estado = $('usuariosFiltroEstado').value;
    return usuarios.filter(function (u) {
      if (rol && u.rol !== rol) return false;
      if (estado === 'activo' && !u.activo) return false;
      if (estado === 'inactivo' && u.activo) return false;
      if (!texto) return true;
      return [u.nombre, u.documento, u.equipo, u.rolEtiqueta, u.cargo, u.correo].some(function (v) {
        return String(v || '').toLowerCase().indexOf(texto) !== -1;
      });
    });
  }

  /* El cargo dice más que el «Otro: …» del ítem 14; sin cargo, se muestra
     esa aclaración como antes. */
  function detalleDeRol(u) {
    const detalle = u.cargo || (u.perfil === 'otro' ? u.perfilOtro : '');
    return detalle && detalle !== u.rolEtiqueta ? ' <span class="usuarios__detalle">· ' + textoSeguro(detalle) + '</span>' : '';
  }

  function contacto(u) {
    const partes = [];
    if (u.correo) partes.push('<span class="usuarios__contacto">' + textoSeguro(u.correo) + '</span>');
    if (u.telefono) partes.push('<span class="usuarios__contacto mono">' + textoSeguro(u.telefono) + '</span>');
    return partes.length ? partes.join('') : '—';
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
        (modifica ? '<button type="button" class="btn btn--ghost btn--icon" data-modificar="' + u.id + '"' +
          (protegida ? ' disabled' + titulo : '') + '>Modificar</button>' : '') +
        (restablece ? '<button type="button" class="btn btn--ghost btn--icon" data-restablecer="' + u.id + '"' +
          (protegida ? ' disabled' + titulo : '') + '>Restablecer clave</button>' : '');
      return (
        '<tr' + (u.activo ? '' : ' class="is-inactiva"') + '>' +
          '<td data-label="Nombre">' + textoSeguro(u.nombre) + (esYo ? ' <span class="usuarios__yo">(usted)</span>' : '') + '</td>' +
          '<td data-label="Documento"><span class="mono">' + textoSeguro(u.tipoId) + ' ' + textoSeguro(u.documento) + '</span></td>' +
          '<td data-label="Rol">' + textoSeguro(u.rolEtiqueta) + detalleDeRol(u) + '</td>' +
          '<td data-label="Equipo">' + (u.equipo ? '<span class="mono">' + textoSeguro(u.equipo) + '</span>' : '—') + '</td>' +
          '<td data-label="Contacto">' + contacto(u) + '</td>' +
          '<td data-label="Estado">' + badgeEstado(u) + '</td>' +
          '<td data-label="Último acceso">' + textoSeguro(formatearFechaHora(u.ultimoAccesoEn)) + '</td>' +
          '<td class="actions-cell">' + (acciones || '<span class="usuarios__detalle">Sólo consulta</span>') + '</td>' +
        '</tr>'
      );
    }).join('');

    $('usuariosEmptyState').hidden = lista.length > 0;

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

  /* El maestro y la coordinación eligen el perfil del ítem 14 con que firman;
     para la coordinación, «Otro» toma el cargo como aclaración si se deja
     vacía. El equipo es obligatorio sólo para quien lo necesita para firmar. */
  function ajustarCamposSegunRol() {
    const rol = $('usuarioRol').value;
    const elige = eligePerfil(rol);
    const perfil = elige ? $('usuarioPerfil').value : rol;
    $('usuarioCampoPerfil').hidden = !elige;
    $('usuarioCampoPerfilOtro').hidden = perfil !== 'otro';
    $('usuarioCampoPerfilOtro').querySelector('label').textContent =
      '¿Cuál?' + (elige ? '' : ' *');
    $('usuarioEquipo').closest('.field').querySelector('label').textContent =
      'Equipo Básico de Salud' + (requiereEquipo(rol) ? ' *' : '');
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

  function leerFormulario() {
    const f = $('formUsuario');
    return {
      id: f.id.value || undefined,
      tipoId: $('usuarioTipoId').value,
      documento: $('usuarioDocumento').value.trim(),
      nombre: $('usuarioNombre').value.trim(),
      cargo: $('usuarioCargo').value.trim() || null,
      correo: $('usuarioCorreo').value.trim() || null,
      telefono: $('usuarioTelefono').value.trim() || null,
      rol: $('usuarioRol').value,
      equipo: $('usuarioEquipo').value.trim().toUpperCase() || null,
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
