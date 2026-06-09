/* ============================================================
   AUTENTICACIÓN SENCILLA (Auth)
   ------------------------------------------------------------
   Pensada para un grupo privado de amigos:
     1) Entrar con el CÓDIGO DE INVITACIÓN del grupo.
     2) Elegir tu jugador (o crear uno nuevo).
     3) Un PIN personal opcional evita que otro edite tus
        predicciones.
   No usa correo ni contraseñas complicadas. Es seguridad
   "casual" para jugar entre conocidos.
   ============================================================ */

const Auth = (function () {
  const CLAVE_SESION = 'pollaSesion_v2';
  let est = null;
  let alEntrar = () => {};
  let paso = 'codigo';   // 'codigo' | 'jugadores'
  let error = '';

  const esc = t => String(t == null ? '' : t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const COLORES = ['#0540A6', '#E4002B', '#E6A700', '#0A8754', '#7c3aed', '#0891b2', '#be123c', '#c2410c'];

  function sesionGuardada() {
    try { return JSON.parse(localStorage.getItem(CLAVE_SESION)); } catch (e) { return null; }
  }

  async function iniciar(estado, callbackEntrar) {
    est = estado;
    alEntrar = callbackEntrar;

    // ¿Sesión activa y el jugador todavía existe?
    const ses = sesionGuardada();
    if (ses && ses.jugadorId && est.jugadores.find(j => j.id === ses.jugadorId)) {
      entrarComo(ses.jugadorId);
      return;
    }
    mostrarLogin();
  }

  function entrarComo(jugadorId) {
    est.usuarioActual = jugadorId;
    localStorage.setItem(CLAVE_SESION, JSON.stringify({ jugadorId }));
    ocultarLogin();
    alEntrar();
  }

  function salir() {
    localStorage.removeItem(CLAVE_SESION);
    paso = 'codigo'; error = '';
    mostrarLogin();
  }

  function mostrarLogin() {
    document.getElementById('app').style.display = 'none';
    const cont = document.getElementById('pantalla-login');
    cont.style.display = 'flex';
    pintar();
  }
  function ocultarLogin() {
    document.getElementById('pantalla-login').style.display = 'none';
    document.getElementById('app').style.display = 'block';
  }

  function pintar() {
    const cont = document.getElementById('pantalla-login');
    const pista = !Datos.online
      ? `<p class="login-pista">Modo de prueba · código: <strong>${esc(est.config.codigoInvitacion)}</strong></p>`
      : '';

    let cuerpo;
    if (paso === 'codigo') {
      cuerpo = `
        <p class="login-sub">Ingresa el código de invitación de tu grupo para entrar.</p>
        <div class="campo">
          <input type="text" id="login-codigo" placeholder="Código de invitación" autocomplete="off"
                 value="" style="text-align:center;text-transform:uppercase;font-weight:700;letter-spacing:.1em">
        </div>
        ${error ? `<div class="login-error">${esc(error)}</div>` : ''}
        <button class="boton login-boton" data-accion="login-codigo">Entrar al grupo →</button>
        ${pista}`;
    } else {
      const jugadores = est.jugadores.map(j => `
        <div class="login-jug">
          <div class="avatar" style="background:${j.color}">${esc((j.nombre || '?').charAt(0))}</div>
          <div style="flex:1;min-width:0">
            <div style="font-weight:700">${esc(j.nombre)} ${j.esOrganizador ? '<span class="chip grupo">organizador</span>' : ''}</div>
            ${j.pin ? `<input type="password" inputmode="numeric" maxlength="6" placeholder="PIN" class="login-pin" data-jug="${j.id}">` : '<div class="texto-mini">Sin PIN · entra directo</div>'}
          </div>
          <button class="boton pequeno" data-accion="login-entrar" data-jug="${j.id}">Entrar</button>
        </div>`).join('');

      cuerpo = `
        <p class="login-sub">¿Quién eres? Elige tu jugador o crea uno nuevo.</p>
        ${error ? `<div class="login-error">${esc(error)}</div>` : ''}
        <div class="login-lista">${jugadores || '<p class="texto-mini centro">Aún no hay jugadores. ¡Crea el primero!</p>'}</div>
        <div class="login-nuevo">
          <div class="tarjeta-titulo">➕ Crear jugador nuevo</div>
          <div class="campo"><input type="text" id="nuevo-nombre" placeholder="Tu nombre" autocomplete="off"></div>
          <div class="campo"><input type="password" id="nuevo-pin" inputmode="numeric" maxlength="6" placeholder="PIN (opcional, 4 dígitos)" autocomplete="off"></div>
          <button class="boton" data-accion="login-crear">Crear y entrar</button>
        </div>
        <button class="login-volver" data-accion="login-volver">← Cambiar código</button>`;
    }

    cont.innerHTML = `
      <div class="login-tarjeta">
        <div class="login-cinta"></div>
        <div class="login-logo">🏆</div>
        <h1 class="login-titulo">${esc(est.config.nombrePolla)}</h1>
        ${cuerpo}
      </div>`;
  }

  // Eventos (delegados dentro de la pantalla de login)
  document.addEventListener('click', async (e) => {
    const el = e.target.closest('[data-accion]');
    if (!el || !el.dataset.accion.startsWith('login-')) return;
    const accion = el.dataset.accion;

    if (accion === 'login-codigo') {
      const val = (document.getElementById('login-codigo').value || '').trim().toUpperCase();
      const esperado = (est.config.codigoInvitacion || '').toUpperCase();
      if (val && val === esperado) { paso = 'jugadores'; error = ''; }
      else { error = 'Código incorrecto. Pídeselo al organizador.'; }
      pintar();
    }

    if (accion === 'login-volver') { paso = 'codigo'; error = ''; pintar(); }

    if (accion === 'login-entrar') {
      const id = el.dataset.jug;
      const j = est.jugadores.find(x => x.id === id);
      if (j && j.pin) {
        const input = document.querySelector(`.login-pin[data-jug="${id}"]`);
        if (!input || input.value !== j.pin) { error = 'PIN incorrecto.'; pintar(); return; }
      }
      entrarComo(id);
    }

    if (accion === 'login-crear') {
      const nombre = (document.getElementById('nuevo-nombre').value || '').trim();
      const pin = (document.getElementById('nuevo-pin').value || '').trim();
      if (!nombre) { error = 'Escribe tu nombre.'; pintar(); return; }
      if (est.jugadores.some(j => j.nombre.toLowerCase() === nombre.toLowerCase())) {
        error = 'Ya hay un jugador con ese nombre. Elígelo de la lista.'; pintar(); return;
      }
      el.disabled = true;
      try {
        const nuevo = await Datos.crearJugador({
          nombre,
          color: COLORES[est.jugadores.length % COLORES.length],
          pago: false, esOrganizador: false, pin,
        });
        entrarComo(nuevo.id);
      } catch (err) {
        error = 'No se pudo crear el jugador. Revisa la conexión.'; el.disabled = false; pintar();
      }
    }
  });

  // Enter para enviar el código
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    if (e.target.id === 'login-codigo') { e.preventDefault(); document.querySelector('[data-accion="login-codigo"]')?.click(); }
  });

  // Re-pinta la pantalla de login si está visible (p. ej. si entró un jugador nuevo).
  function refrescar() {
    const cont = document.getElementById('pantalla-login');
    if (cont && cont.style.display !== 'none') pintar();
  }

  return { iniciar, salir, refrescar, usuarioActual: () => (est ? est.usuarioActual : null) };
})();
