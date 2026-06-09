/* ============================================================
   CAPA DE DATOS (Datos)
   ------------------------------------------------------------
   Una sola interfaz para guardar/leer, con dos motores:
     • MODO LOCAL  -> guarda en este equipo (localStorage).
     • MODO ONLINE -> guarda en Supabase (compartido + tiempo real).
   El resto de la app (app.js) llama siempre a Datos.* y no
   tiene que saber cuál motor está activo.
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

  // Construye los datos "semilla" para el modo local (con predicciones de ejemplo).
  function generarSemilla() {
    const predicciones = {};
    JUGADORES_SEMILLA.forEach((j, ji) => {
      predicciones[j.id] = { partidos: {}, campeon: null, subcampeon: null };
      PARTIDOS_SEMILLA.forEach((p, pi) => {
        predicciones[j.id].partidos[p.id] = { local: (ji * 7 + pi * 3) % 4, visita: (ji * 5 + pi * 2 + 1) % 4 };
      });
      predicciones[j.id].campeon    = ['arg', 'ecu', 'bra', 'esp', 'fra'][ji % 5];
      predicciones[j.id].subcampeon = ['col', 'mex', 'por', 'ned', 'cro'][ji % 5];
    });
    return {
      config:        JSON.parse(JSON.stringify(CONFIG_DEFAULT)),
      jugadores:     JSON.parse(JSON.stringify(JUGADORES_SEMILLA)),
      partidos:      JSON.parse(JSON.stringify(PARTIDOS_SEMILLA)),
      predicciones:  predicciones,
      resultadoFinal:{ campeon: null, subcampeon: null },
    };
  }

  // Copia los campos de datos a `est`, conservando los campos de interfaz.
  function aplicar(datos) {
    est.config         = datos.config;
    est.jugadores      = datos.jugadores;
    est.partidos       = datos.partidos;
    est.predicciones   = datos.predicciones;
    est.resultadoFinal = datos.resultadoFinal;
  }

  /* ============================================================
     MOTOR LOCAL
     ============================================================ */
  function cargarLocal() {
    const guardado = localStorage.getItem(CLAVE_LOCAL);
    if (guardado) {
      try { aplicar(JSON.parse(guardado)); return; } catch (e) { /* recrear */ }
    }
    aplicar(generarSemilla());
    guardarLocal();
  }
  function guardarLocal() {
    localStorage.setItem(CLAVE_LOCAL, JSON.stringify({
      config: est.config, jugadores: est.jugadores, partidos: est.partidos,
      predicciones: est.predicciones, resultadoFinal: est.resultadoFinal,
    }));
  }

  /* ============================================================
     MOTOR ONLINE (Supabase)
     ============================================================ */
  // Mapeos entre la app (camelCase) y la base de datos (snake_case)
  const aFilaJugador = j => ({ id: j.id, nombre: j.nombre, color: j.color, pago: !!j.pago, es_organizador: !!j.esOrganizador, pin: j.pin || '' });
  const deFilaJugador = r => ({ id: r.id, nombre: r.nombre, color: r.color, pago: !!r.pago, esOrganizador: !!r.es_organizador, pin: r.pin || '' });
  const aFilaPartido = p => ({ id: p.id, orden: p.orden, grupo: p.grupo, fase: p.fase, local: p.local, visita: p.visita, fecha: p.fecha, estadio: p.estadio, jugado: !!p.jugado, goles_local: p.golesLocal, goles_visita: p.golesVisita });
  const deFilaPartido = r => ({ id: r.id, orden: r.orden, grupo: r.grupo, fase: r.fase, local: r.local, visita: r.visita, fecha: r.fecha, estadio: r.estadio, jugado: !!r.jugado, golesLocal: r.goles_local, golesVisita: r.goles_visita });

  async function cargarOnline() {
    // 1) CONFIG (fila única id=1); si no existe, la creamos.
    let { data: cfgRow } = await sb.from('config').select('*').eq('id', 1).maybeSingle();
    if (!cfgRow) {
      const c = CONFIG_DEFAULT;
      await sb.from('config').upsert({ id: 1, nombre: c.nombrePolla, codigo: c.codigoInvitacion, moneda: c.moneda, monto: c.montoApuesta, puntos: c.puntos, campeon_real: null, subcampeon_real: null });
      ({ data: cfgRow } = await sb.from('config').select('*').eq('id', 1).maybeSingle());
    }
    const config = {
      nombrePolla: cfgRow.nombre, codigoInvitacion: cfgRow.codigo, moneda: cfgRow.moneda,
      montoApuesta: cfgRow.monto, puntos: cfgRow.puntos || CONFIG_DEFAULT.puntos,
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

    // 4) PREDICCIONES + PICKS FINALES
    const { data: predRows } = await sb.from('predicciones').select('*');
    const { data: pickRows } = await sb.from('picks_final').select('*');
    const predicciones = {};
    jugadores.forEach(j => { predicciones[j.id] = { partidos: {}, campeon: null, subcampeon: null }; });
    (predRows || []).forEach(r => {
      if (!predicciones[r.jugador_id]) predicciones[r.jugador_id] = { partidos: {}, campeon: null, subcampeon: null };
      predicciones[r.jugador_id].partidos[r.partido_id] = { local: r.local, visita: r.visita };
    });
    (pickRows || []).forEach(r => {
      if (!predicciones[r.jugador_id]) predicciones[r.jugador_id] = { partidos: {}, campeon: null, subcampeon: null };
      predicciones[r.jugador_id].campeon = r.campeon || null;
      predicciones[r.jugador_id].subcampeon = r.subcampeon || null;
    });

    aplicar({ config, jugadores, partidos, predicciones, resultadoFinal });
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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'config' }, recargar)
      .subscribe();
  }

  /* ============================================================
     API PÚBLICA  (app.js y auth.js solo usan esto)
     ============================================================ */
  return {
    get online() { return MODO_ONLINE; },

    async cargar(estado, callbackCambio) {
      est = estado;
      onCambio = callbackCambio || (() => {});
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
      const nuevo = { ...jugador, esOrganizador: jugador.esOrganizador || esPrimero };
      if (!MODO_ONLINE) {
        nuevo.id = nuevo.id || uid();
        est.jugadores.push(nuevo);
        est.predicciones[nuevo.id] = { partidos: {}, campeon: null, subcampeon: null };
        guardarLocal();
        return nuevo;
      }
      const fila = aFilaJugador(nuevo); delete fila.id; // que la BD genere el uuid
      const { data, error } = await sb.from('jugadores').insert(fila).select().single();
      if (error) { console.error(error); throw error; }
      const creado = deFilaJugador(data);
      est.jugadores.push(creado);
      est.predicciones[creado.id] = { partidos: {}, campeon: null, subcampeon: null };
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
      if (!MODO_ONLINE) return guardarLocal();
      await sb.from('predicciones').delete().eq('jugador_id', id);
      await sb.from('picks_final').delete().eq('jugador_id', id);
      await sb.from('jugadores').delete().eq('id', id);
    },

    async guardarPrediccion(jugadorId, partidoId) {
      const pred = est.predicciones[jugadorId].partidos[partidoId];
      if (!MODO_ONLINE) return guardarLocal();
      await sb.from('predicciones').upsert({ jugador_id: jugadorId, partido_id: partidoId, local: pred.local, visita: pred.visita }, { onConflict: 'jugador_id,partido_id' });
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

    async guardarConfig() {
      const c = est.config, rf = est.resultadoFinal;
      if (!MODO_ONLINE) return guardarLocal();
      await sb.from('config').update({
        nombre: c.nombrePolla, codigo: c.codigoInvitacion, moneda: c.moneda,
        monto: c.montoApuesta, puntos: c.puntos,
        campeon_real: rf.campeon, subcampeon_real: rf.subcampeon,
      }).eq('id', 1);
    },

    // Solo modo local: borra todo y vuelve a la semilla.
    reiniciarLocal() {
      localStorage.removeItem(CLAVE_LOCAL);
      aplicar(generarSemilla());
      guardarLocal();
    },

    // Re-carga el fixture oficial (PARTIDOS_SEMILLA de datos.js) en la base de
    // datos. Usa upsert: actualiza rivales/fechas y añade partidos nuevos SIN
    // borrar las predicciones ya hechas. Útil al actualizar el calendario.
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
