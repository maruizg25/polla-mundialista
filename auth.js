/* ============================================================
   AUTENTICACIÓN (Auth) — correo + contraseña con Supabase Auth
   ------------------------------------------------------------
   • Cualquiera se registra con su correo y una contraseña.
   • No hace falta código de invitación.
   • Quien se registra queda en la base de datos como jugador.
   • El PRIMERO en registrarse queda como organizador.
   • Incluye "olvidé mi contraseña".
   (En modo local de prueba entra directo, sin login.)
   ============================================================ */

const Auth = (function () {
  let est = null;
  let alEntrar = () => {};
  let modo = 'login';   // 'login' | 'registro'
  let error = '';
  let aviso = '';
  let creando = false;  // evita crear el jugador dos veces

  const esc = t => String(t == null ? '' : t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const COLORES = ['#0540A6', '#E4002B', '#E6A700', '#0A8754', '#7c3aed', '#0891b2', '#be123c', '#c2410c'];

  function entrarApp(jugadorId) {
    est.usuarioActual = jugadorId;
    ocultarLogin();
    alEntrar();
  }
  function mostrarLogin() {
    document.getElementById('app').style.display = 'none';
    const c = document.getElementById('pantalla-login');
    c.style.display = 'flex';
    pintar();
  }
  function ocultarLogin() {
    document.getElementById('pantalla-login').style.display = 'none';
    document.getElementById('app').style.display = 'block';
  }

  async function iniciar(estado, callbackEntrar) {
    est = estado; alEntrar = callbackEntrar;
    if (!Datos.online) {                       // modo prueba local: entrar directo
      const id = est.jugadores[0] && est.jugadores[0].id;
      if (id) entrarApp(id); else mostrarLogin();
      return;
    }
    Datos.onAuth(s => manejarSesion(s));        // cambios de sesión (login/logout)
    manejarSesion(await Datos.authSesion());    // sesión inicial
  }

  async function manejarSesion(session) {
    if (session && session.user) {
      const emailL = (session.user.email || '').toLowerCase();
      if ((est.bloqueados || []).includes(emailL)) {   // el organizador lo quitó
        est.usuarioActual = null; modo = 'login'; aviso = '';
        error = 'El organizador te quitó de la polla. Si crees que es un error, contáctalo.';
        mostrarLogin(); return;
      }
      let j = Datos.jugadorPorEmail(session.user.email);
      if (!j && !creando) {
        creando = true;
        const meta = session.user.user_metadata || {};
        const nombre = [meta.nombre, meta.apellidos].filter(Boolean).join(' ').trim() || meta.nombre_completo || (session.user.email || 'Jugador').split('@')[0];
        try { j = await Datos.crearJugador({ nombre, email: session.user.email, color: COLORES[est.jugadores.length % COLORES.length] }); }
        catch (e) { console.warn(e); }
        creando = false;
      }
      if (j) { entrarApp(j.id); return; }
    }
    est.usuarioActual = null;
    mostrarLogin();
  }

  function salir() {
    if (Datos.online) Datos.authSalir();   // onAuth → manejarSesion(null) → login
    est.usuarioActual = null;
    modo = 'login'; error = ''; aviso = '';
    mostrarLogin();
  }

  function pintar() {
    const cont = document.getElementById('pantalla-login');
    let cuerpo;
    if (!Datos.online) {
      cuerpo = est.jugadores.length
        ? `<p class="login-sub">Modo de prueba (local). Entra con un jugador existente.</p>
          <div class="login-lista">${est.jugadores.map(j => `<div class="login-jug"><div class="avatar" style="background:${j.color}">${esc((j.nombre || '?').charAt(0))}</div><div style="flex:1;min-width:0"><div style="font-weight:700">${esc(j.nombre)}</div></div><button class="boton pequeno" data-accion="login-local" data-jug="${j.id}">Entrar</button></div>`).join('')}</div>`
        : `<p class="login-sub">No hay jugadores aún. Crea el primero con nombre y apellidos.</p>
          ${error ? `<div class="login-error">${esc(error)}</div>` : ''}
          <div class="campo"><input type="text" id="loc-nombre" placeholder="Nombres" autocomplete="given-name"></div>
          <div class="campo"><input type="text" id="loc-apellidos" placeholder="Apellidos" autocomplete="family-name"></div>
          <button class="boton login-boton" data-accion="login-local-registrar">Crear jugador local →</button>`;
    } else if (modo === 'registro') {
      cuerpo = `<p class="login-sub">Crea tu cuenta con tu correo. ¡Y a jugar!</p>
        ${error ? `<div class="login-error">${esc(error)}</div>` : ''}
        <div class="campo"><input type="text" id="reg-nombre" placeholder="Tu nombre" autocomplete="name"></div>
        <div class="campo"><input type="text" id="reg-apellidos" placeholder="Tus apellidos" autocomplete="family-name"></div>
        <div class="campo"><input type="email" id="reg-email" placeholder="Correo electrónico" autocomplete="email"></div>
        <div class="campo"><input type="password" id="reg-pass" placeholder="Contraseña (mínimo 6)" autocomplete="new-password"></div>
        <button class="boton login-boton" data-accion="login-registrar">Crear cuenta →</button>
        <button class="login-volver" data-accion="login-modo-login">← Ya tengo cuenta</button>`;
    } else {
      cuerpo = `<p class="login-sub">Entra con tu correo y contraseña.</p>
        ${error ? `<div class="login-error">${esc(error)}</div>` : ''}
        ${aviso ? `<div class="login-ok">${esc(aviso)}</div>` : ''}
        <div class="campo"><input type="email" id="log-email" placeholder="Correo electrónico" autocomplete="email"></div>
        <div class="campo"><input type="password" id="log-pass" placeholder="Contraseña" autocomplete="current-password"></div>
        <button class="boton login-boton" data-accion="login-entrar">Iniciar sesión →</button>
        <div class="login-acciones"><button class="login-link" data-accion="login-modo-registro">Crear cuenta nueva</button><button class="login-link" data-accion="login-reset">Olvidé mi contraseña</button></div>`;
    }
    cont.innerHTML = `<div class="login-tarjeta"><div class="login-cinta"></div><div class="login-logo">🏆</div><h1 class="login-titulo">${esc(est.config.nombrePolla)}</h1>${cuerpo}</div>`;
  }

  document.addEventListener('click', async (e) => {
    const el = e.target.closest('[data-accion]');
    if (!el || !el.dataset.accion.startsWith('login-')) return;
    const a = el.dataset.accion;

    if (a === 'login-local') { entrarApp(el.dataset.jug); return; }
    if (a === 'login-local-registrar') {
      if (typeof puedeEditarJugadores === 'function' && !puedeEditarJugadores()) { error = 'La edición de jugadores ya está cerrada porque empezó el primer partido.'; pintar(); return; }
      const nombre = (document.getElementById('loc-nombre').value || '').trim();
      const apellidos = (document.getElementById('loc-apellidos').value || '').trim();
      if (!nombre || !apellidos) { error = 'Escribe nombre y apellidos.'; pintar(); return; }
      const completo = `${nombre} ${apellidos}`.trim();
      const j = await Datos.crearJugador({ nombre: completo, color: COLORES[est.jugadores.length % COLORES.length] });
      entrarApp(j.id); return;
    }
    if (a === 'login-modo-registro') { modo = 'registro'; error = ''; aviso = ''; pintar(); return; }
    if (a === 'login-modo-login') { modo = 'login'; error = ''; aviso = ''; pintar(); return; }

    if (a === 'login-entrar') {
      const email = (document.getElementById('log-email').value || '').trim();
      const pass = document.getElementById('log-pass').value || '';
      if (!email || !pass) { error = 'Escribe tu correo y contraseña.'; pintar(); return; }
      el.disabled = true; el.textContent = 'Entrando…';
      const { error: err } = await Datos.authLogin(email, pass);
      if (err) { error = traducir(err.message); aviso = ''; pintar(); }
      return;   // si todo ok, onAuth → manejarSesion entra a la app
    }

    if (a === 'login-registrar') {
      if (typeof puedeEditarJugadores === 'function' && !puedeEditarJugadores()) { error = 'La edición de jugadores ya está cerrada porque empezó el primer partido.'; pintar(); return; }
      const nombre = (document.getElementById('reg-nombre').value || '').trim();
      const apellidos = (document.getElementById('reg-apellidos').value || '').trim();
      const email = (document.getElementById('reg-email').value || '').trim();
      const pass = document.getElementById('reg-pass').value || '';
      if (!nombre || !apellidos || !email || pass.length < 6) { error = 'Completa nombres, apellidos, correo y una contraseña de al menos 6 caracteres.'; pintar(); return; }
      el.disabled = true; el.textContent = 'Creando…';
      const { data, error: err } = await Datos.authRegistrar(email, pass, nombre, apellidos);
      if (err) { error = traducir(err.message); pintar(); return; }
      if (data && data.session) {
        try { const j = await Datos.crearJugador({ nombre, email, color: COLORES[est.jugadores.length % COLORES.length] }); entrarApp(j.id); }
        catch (e2) { error = 'Cuenta creada, pero no se pudo guardar el jugador. Inicia sesión.'; modo = 'login'; pintar(); }
      } else {
        modo = 'login'; error = ''; aviso = 'Te enviamos un correo para confirmar tu cuenta. Ábrelo y luego inicia sesión.'; pintar();
      }
      return;
    }

    if (a === 'login-reset') {
      const email = (document.getElementById('log-email').value || '').trim();
      if (!email) { error = 'Escribe tu correo arriba y vuelve a tocar "Olvidé mi contraseña".'; pintar(); return; }
      await Datos.authReset(email);
      error = ''; aviso = 'Te enviamos un correo para restablecer tu contraseña.'; pintar();
      return;
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    if (e.target.id === 'log-pass') { e.preventDefault(); document.querySelector('[data-accion="login-entrar"]')?.click(); }
    if (e.target.id === 'reg-pass') { e.preventDefault(); document.querySelector('[data-accion="login-registrar"]')?.click(); }
    if (e.target.id === 'loc-apellidos') { e.preventDefault(); document.querySelector('[data-accion="login-local-registrar"]')?.click(); }
  });

  function traducir(msg) {
    msg = msg || '';
    if (/Invalid login/i.test(msg)) return 'Correo o contraseña incorrectos.';
    if (/already registered|already been registered|already exists/i.test(msg)) return 'Ese correo ya tiene cuenta. Inicia sesión.';
    if (/Email not confirmed/i.test(msg)) return 'Debes confirmar tu correo antes de entrar.';
    if (/at least 6|password should be/i.test(msg)) return 'La contraseña debe tener al menos 6 caracteres.';
    if (/valid email|invalid format/i.test(msg)) return 'Escribe un correo válido.';
    return msg;
  }

  function refrescar() {
    const c = document.getElementById('pantalla-login');
    if (c && c.style.display !== 'none') pintar();
  }

  return { iniciar, salir, refrescar, usuarioActual: () => (est ? est.usuarioActual : null) };
})();
