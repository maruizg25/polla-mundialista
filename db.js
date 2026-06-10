/* ============================================================
   CAPA DE DATOS (Datos)
   ------------------------------------------------------------
   Una sola interfaz para guardar/leer, con dos motores:
     • MODO LOCAL  -> guarda en este equipo (localStorage).
     • MODO ONLINE -> guarda en Supabase (compartido + tiempo real).
   Maneja: jugadores (con abonos), predicciones, partidos,
   picks finales, configuración y APUESTAS POR PARTIDO.
   ============================================================ */

const Datos = (function () {
  const CLAVE_LOCAL = 'pollaMundialista_v2';
  let sb = null;          // cliente de Supabase (solo online)
  let est = null;         // referencia al estado en memoria (lo crea app.js)
  let onCambio = () => {}; // callback para re-pintar cuando llegan cambios

  if (MODO_ONLINE && window.supabase) {
    sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  }

  /* ---------- Utilidades ---------- */
  function uid(pre) { return (pre || 'u') + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36); }

  // Datos "semilla" para el modo local (con predicciones y apuestas de ejemplo).
  function generarSemilla() {
    const predicciones = {};
    const apuestas = {};
    JUGADORES_SEMILLA.forEach((j, ji) => {
      predicciones[j.id] = { partidos: {}, campeon: null, subcampeon: null };
      apuestas[j.id] = {};
      PARTIDOS_SEMILLA.forEach((p, pi) => {
        predicciones[j.id].partidos[p.id] = ['L', 'E', 'V'][(ji * 2 + pi) % 3]; // pronóstico demo 1X2
      });
      predicciones[j.id].campeon    = ['arg', 'ecu', 'bra', 'esp', 'fra'][ji % 5];
      predicciones[j.id].subcampeon = ['col', 'mex', 'por', 'ned', 'cro'][ji % 5];
    });
    return {
      config:        JSON.parse(JSON.stringify(CONFIG_DEFAULT)),
      jugadores:     JSON.parse(JSON.stringify(JUGADORES_SEMILLA)),
      partidos:      JSON.parse(JSON.stringify(PARTIDOS_SEMILLA)),
      predicciones:  predicciones,
      apuestas:      apuestas,
      resultadoFinal:{ campeon: null, subcampeon: null },
    };
  }

  // Copia los campos de datos a `est`, conservando los campos de interfaz.
  function aplicar(datos) {
    est.config         = datos.config;
    est.jugadores      = datos.jugadores;
    est.partidos       = datos.partidos;
    est.predicciones   = datos.predicciones;
    est.apuestas       = datos.apuestas || {};
    est.resultadoFinal = datos.resultadoFinal;
  }

  /* ============================================================
     MOTOR LOCAL
     ============================================================ */
  function cargarLocal() {
    const guardado = localStorage.getItem(CLAVE_LOCAL);
    if (guardado) {
      try { const d = JSON.parse(guardado); if (!d.apuestas) d.apuestas = {}; aplicar(d); return; } catch (e) { /* recrear */ }
    }
    aplicar(generarSemilla());
    guardarLocal();
  }
  function guardarLocal() {
    localStorage.setItem(CLAVE_LOCAL, JSON.stringify({
      config: est.config, jugadores: est.jugadores, partidos: est.partidos,
      predicciones: est.predicciones, apuestas: est.apuestas, resultadoFinal: est.resultadoFinal,
    }));
  }

  /* ============================================================
     MOTOR ONLINE (Supabase)
     ============================================================ */
  const montoCuota = () => (est && est.config ? est.config.montoApuesta : 0);
  const aFilaJugador = j => ({ id: j.id, nombre: j.nombre, color: j.color, email: j.email || null, abonado: j.abonado || 0, pago: (j.abonado || 0) >= montoCuota(), es_organizador: !!j.esOrganizador, pin: j.pin || '' });
  const deFilaJugador = r => ({ id: r.id, nombre: r.nombre, color: r.color, email: r.email || null, abonado: r.abonado || 0, esOrganizador: !!r.es_organizador, pin: r.pin || '' });
  const aFilaPartido = p => ({ id: p.id, orden: p.orden, grupo: p.grupo, fase: p.fase, ronda: p.ronda || null, local: p.local, visita: p.visita, fecha: p.fecha, estadio: p.estadio, jugado: !!p.jugado, resultado: p.resultado || null, goles_local: p.golesLocal, goles_visita: p.golesVisita });
  const deFilaPartido = r => ({ id: r.id, orden: r.orden, grupo: r.grupo, fase: r.fase, ronda: r.ronda || null, local: r.local, visita: r.visita, fecha: r.fecha, estadio: r.estadio, jugado: !!r.jugado, resultado: r.resultado || null, golesLocal: r.goles_local, golesVisita: r.goles_visita });

  async function cargarOnline() {
    // 1) CONFIG (fila única id=1); si no existe, la creamos.
    let { data: cfgRow } = await sb.from('config').select('*').eq('id', 1).maybeSingle();
    if (!cfgRow) {
      const c = CONFIG_DEFAULT;
      await sb.from('config').upsert({ id: 1, nombre: c.nombrePolla, codigo: c.codigoInvitacion, moneda: c.moneda, monto: c.montoApuesta, puntos: c.puntos, fases: c.fases, campeon_real: null, subcampeon_real: null });
      ({ data: cfgRow } = await sb.from('config').select('*').eq('id', 1).maybeSingle());
    }
    const config = {
      nombrePolla: cfgRow.nombre, codigoInvitacion: cfgRow.codigo, moneda: cfgRow.moneda,
      montoApuesta: cfgRow.monto,
      puntos: cfgRow.puntos || CONFIG_DEFAULT.puntos,
      fases: (cfgRow.fases && cfgRow.fases.length) ? cfgRow.fases : JSON.parse(JSON.stringify(CONFIG_DEFAULT.fases)),
    };
    const resultadoFinal = { campeon: cfgRow.campeon_real || null, subcampeon: cfgRow.subcampeon_real || null };

    // 2) PARTIDOS; si la tabla está vacía, sembramos los de ejemplo.
    let { data: partRows } = await sb.from('partidos').select('*').order('orden');
    if (!partRows || partRows.length === 0) {
      await sb.from('partidos').upsert(PARTIDOS_SEMILLA.map(aFilaPartido));
      ({ data: partRows } = await sb.from('partidos').select('*').order('orden'));
    }
    const partidos = (partRows || []).map(deFilaPartido);

    // 3) JUGADORES (pueden no existir aún)
    const { data: jugRows } = await sb.from('jugadores').select('*').order('creado');
    const jugadores = (jugRows || []).map(deFilaJugador);

    // 4) PREDICCIONES + PICKS + APUESTAS POR PARTIDO
    const { data: predRows } = await sb.from('predicciones').select('*');
    const { data: pickRows } = await sb.from('picks_final').select('*');
    const { data: apRows } = await sb.from('apuestas').select('*');
    const predicciones = {};
    const apuestas = {};
    jugadores.forEach(j => { predicciones[j.id] = { partidos: {}, campeon: null, subcampeon: null }; apuestas[j.id] = {}; });
    (predRows || []).forEach(r => {
      if (!predicciones[r.jugador_id]) predicciones[r.jugador_id] = { partidos: {}, campeon: null, subcampeon: null };
      predicciones[r.jugador_id].partidos[r.partido_id] = r.resultado || null; // 'L' | 'E' | 'V'
    });
    (pickRows || []).forEach(r => {
      if (!predicciones[r.jugador_id]) predicciones[r.jugador_id] = { partidos: {}, campeon: null, subcampeon: null };
      predicciones[r.jugador_id].campeon = r.campeon || null;
      predicciones[r.jugador_id].subcampeon = r.subcampeon || null;
    });
    (apRows || []).forEach(r => {
      if (!apuestas[r.jugador_id]) apuestas[r.jugador_id] = {};
      apuestas[r.jugador_id][r.partido_id] = { pago: !!r.pago };
    });

    aplicar({ config, jugadores, partidos, predicciones, apuestas, resultadoFinal });
  }

  /* ---------- Suscripción a cambios en tiempo real ---------- */
  function suscribir() {
    if (!sb) return;
    let pendiente = null;
    const recargar = () => {
      clearTimeout(pendiente);
      pendiente = setTimeout(async () => { await cargarOnline(); onCambio(); }, 250);
    };
    sb.channel('polla-cambios')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'partidos' }, recargar)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'predicciones' }, recargar)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'picks_final' }, recargar)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jugadores' }, recargar)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'apuestas' }, recargar)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'config' }, recargar)
      .subscribe();
  }

  /* ============================================================
     API PÚBLICA
     ============================================================ */
  return {
    get online() { return MODO_ONLINE; },

    async cargar(estado, callbackCambio) {
      est = estado;
      onCambio = callbackCambio || (() => {});
      if (!est.apuestas) est.apuestas = {};
      if (!MODO_ONLINE) { cargarLocal(); return est; }
      if (!sb) { console.error('Falta la librería de Supabase'); cargarLocal(); return est; }
      try { await cargarOnline(); suscribir(); }
      catch (e) { console.error('Error conectando a Supabase:', e); }
      return est;
    },

    nuevoId: uid,

    // Crea un jugador. El primero en registrarse queda como organizador.
    async crearJugador(jugador) {
      const esPrimero = est.jugadores.length === 0;
      const nuevo = { abonado: 0, ...jugador, esOrganizador: jugador.esOrganizador || esPrimero };
      if (!MODO_ONLINE) {
        nuevo.id = nuevo.id || uid();
        est.jugadores.push(nuevo);
        est.predicciones[nuevo.id] = { partidos: {}, campeon: null, subcampeon: null };
        est.apuestas[nuevo.id] = {};
        guardarLocal();
        return nuevo;
      }
      const fila = aFilaJugador(nuevo); delete fila.id; // que la BD genere el uuid
      const { data, error } = await sb.from('jugadores').insert(fila).select().single();
      if (error) { console.error(error); throw error; }
      const creado = deFilaJugador(data);
      est.jugadores.push(creado);
      est.predicciones[creado.id] = { partidos: {}, campeon: null, subcampeon: null };
      est.apuestas[creado.id] = {};
      return creado;
    },

    async guardarJugador(id) {
      const j = est.jugadores.find(x => x.id === id);
      if (!j) return;
      if (!MODO_ONLINE) return guardarLocal();
      await sb.from('jugadores').update(aFilaJugador(j)).eq('id', id);
    },

    async eliminarJugador(id) {
      est.jugadores = est.jugadores.filter(j => j.id !== id);
      delete est.predicciones[id];
      delete est.apuestas[id];
      if (!MODO_ONLINE) return guardarLocal();
      await sb.from('predicciones').delete().eq('jugador_id', id);
      await sb.from('picks_final').delete().eq('jugador_id', id);
      await sb.from('apuestas').delete().eq('jugador_id', id);
      await sb.from('jugadores').delete().eq('id', id);
    },

    async guardarPrediccion(jugadorId, partidoId) {
      const pred = est.predicciones[jugadorId].partidos[partidoId];
      if (!MODO_ONLINE) return guardarLocal();
      await sb.from('predicciones').upsert({ jugador_id: jugadorId, partido_id: partidoId, resultado: pred }, { onConflict: 'jugador_id,partido_id' });
    },

    async guardarPickFinal(jugadorId) {
      const pr = est.predicciones[jugadorId];
      if (!MODO_ONLINE) return guardarLocal();
      await sb.from('picks_final').upsert({ jugador_id: jugadorId, campeon: pr.campeon, subcampeon: pr.subcampeon });
    },

    async guardarPartido(partidoId) {
      const p = est.partidos.find(x => x.id === partidoId);
      if (!p) return;
      if (!MODO_ONLINE) return guardarLocal();
      await sb.from('partidos').update(aFilaPartido(p)).eq('id', partidoId);
    },

    // Crear un partido (p. ej. de eliminatoria) — lo agrega el organizador.
    async crearPartido(p) {
      if (!est.partidos.find(x => x.id === p.id)) est.partidos.push(p);
      if (!MODO_ONLINE) return guardarLocal();
      await sb.from('partidos').upsert(aFilaPartido(p));
    },
    async eliminarPartido(id) {
      est.partidos = est.partidos.filter(x => x.id !== id);
      if (!MODO_ONLINE) return guardarLocal();
      await sb.from('predicciones').delete().eq('partido_id', id);
      await sb.from('partidos').delete().eq('id', id);
    },

    async guardarConfig() {
      const c = est.config, rf = est.resultadoFinal;
      if (!MODO_ONLINE) return guardarLocal();
      await sb.from('config').update({
        nombre: c.nombrePolla, codigo: c.codigoInvitacion, moneda: c.moneda,
        monto: c.montoApuesta, puntos: c.puntos, fases: c.fases,
        campeon_real: rf.campeon, subcampeon_real: rf.subcampeon,
      }).eq('id', 1);
    },

    /* ---- APUESTAS POR PARTIDO ---- */
    // Crea/actualiza la entrada del jugador a un partido (opt-in + estado de pago).
    async guardarApuesta(jugadorId, partidoId) {
      const ap = est.apuestas[jugadorId] && est.apuestas[jugadorId][partidoId];
      if (!ap) return;
      if (!MODO_ONLINE) return guardarLocal();
      await sb.from('apuestas').upsert({ jugador_id: jugadorId, partido_id: partidoId, pago: !!ap.pago }, { onConflict: 'jugador_id,partido_id' });
    },
    // Saca al jugador de la apuesta de un partido.
    async eliminarApuesta(jugadorId, partidoId) {
      if (est.apuestas[jugadorId]) delete est.apuestas[jugadorId][partidoId];
      if (!MODO_ONLINE) return guardarLocal();
      await sb.from('apuestas').delete().eq('jugador_id', jugadorId).eq('partido_id', partidoId);
    },

    /* ---- AUTENTICACIÓN (Supabase Auth: correo + contraseña) ---- */
    async authSesion() { if (!sb) return null; const { data } = await sb.auth.getSession(); return data.session; },
    async authLogin(email, password) { return await sb.auth.signInWithPassword({ email, password }); },
    async authRegistrar(email, password, nombre) { return await sb.auth.signUp({ email, password, options: { data: { nombre } } }); },
    async authReset(email) { return await sb.auth.resetPasswordForEmail(email); },
    async authSalir() { if (sb) await sb.auth.signOut(); },
    onAuth(cb) { if (sb) sb.auth.onAuthStateChange((_evt, session) => cb(session)); },
    jugadorPorEmail(email) { const e = (email || '').toLowerCase(); return est.jugadores.find(j => (j.email || '').toLowerCase() === e); },

    // Solo modo local: borra todo y vuelve a la semilla.
    reiniciarLocal() {
      localStorage.removeItem(CLAVE_LOCAL);
      aplicar(generarSemilla());
      guardarLocal();
    },

    // Re-carga el fixture oficial (PARTIDOS_SEMILLA) en la BD vía upsert.
    async reSembrarPartidos() {
      if (!MODO_ONLINE) {
        est.partidos = JSON.parse(JSON.stringify(PARTIDOS_SEMILLA));
        guardarLocal();
        return est.partidos.length;
      }
      await sb.from('partidos').upsert(PARTIDOS_SEMILLA.map(aFilaPartido));
      await cargarOnline();
      return est.partidos.length;
    },
  };
})();
