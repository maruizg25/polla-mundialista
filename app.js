/* ============================================================
   POLLA MUNDIALISTA — LÓGICA DE LA APLICACIÓN (app.js)
   ------------------------------------------------------------
   Maneja las pantallas, las predicciones, el motor de puntos y
   el panel del organizador. Para guardar/leer usa la capa
   "Datos" (que decide entre modo local o Supabase). El acceso
   pasa por "Auth" (login con código + jugador + PIN).
   ============================================================ */

'use strict';

/* Estado en memoria. Los datos los llena Datos.cargar(); los
   campos de interfaz (usuarioActual, vista) los maneja la app. */
let estado = {
  config: JSON.parse(JSON.stringify(CONFIG_DEFAULT)),
  jugadores: [],
  partidos: [],
  predicciones: {},
  apuestas: {},   // apuestas por partido: apuestas[jugadorId][partidoId] = { pago }
  resultadoFinal: { campeon: null, subcampeon: null },
  usuarioActual: null,
  vista: 'inicio',
};
let filtroCal = 'todos';   // filtro del Calendario: 'todos' | 'ecuador' | 'hoy'
let cdInterval = null;     // temporizador del contador del próximo partido

/* ----------------------------------------------------------------
   AYUDANTES
   ---------------------------------------------------------------- */
function getJugador(id) { return estado.jugadores.find(j => j.id === id); }
function getEquipo(id)  { return EQUIPOS[id] || { nombre: '¿?', bandera: '🏳️' }; }
function usuario()      { return getJugador(estado.usuarioActual); }
function esOrganizador(){ const u = usuario(); return !!(u && u.esOrganizador); }
function nombreEquipo(id) { return getEquipo(id).nombre; }
function chipEquipo(id) { const e = getEquipo(id); return `${e.bandera} ${e.nombre}`; }

function formatMoneda(n) {
  try {
    return new Intl.NumberFormat('es-EC', { style: 'currency', currency: estado.config.moneda || 'USD', maximumFractionDigits: 0 }).format(n || 0);
  } catch (e) { return '$' + (n || 0).toLocaleString('es-EC'); }
}
// Las fechas se guardan en hora de Ecuador (UTC-5). Las anclamos a ese offset
// para que se vean igual sin importar la zona horaria del dispositivo.
const TZ_EC = 'America/Guayaquil';
function fechaEc(iso) {
  if (typeof iso === 'string' && /T\d{2}:\d{2}$/.test(iso)) return new Date(iso + ':00-05:00');
  return new Date(iso);
}
function formatFecha(iso) {
  const d = fechaEc(iso);
  if (isNaN(d)) return iso;
  const f = new Intl.DateTimeFormat('es-EC', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: TZ_EC }).format(d);
  return f.charAt(0).toUpperCase() + f.slice(1);
}
function horaEc(iso) {
  return new Intl.DateTimeFormat('es-EC', { hour: '2-digit', minute: '2-digit', timeZone: TZ_EC }).format(fechaEc(iso));
}
function diaKey(d) { return new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: TZ_EC }).format(d); }
function diaLargo(d) { const s = new Intl.DateTimeFormat('es-EC', { weekday: 'long', day: 'numeric', month: 'long', timeZone: TZ_EC }).format(d); return s.charAt(0).toUpperCase() + s.slice(1); }
function partidoBloqueado(p) {
  if (p.jugado) return true;
  const inicio = fechaEc(p.fecha);
  return !isNaN(inicio) && inicio.getTime() <= Date.now();
}
function escapar(t) {
  return String(t == null ? '' : t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
// Ejecuta una operación de guardado sin romper la interfaz si falla.
function sync(promesa) { if (promesa && promesa.catch) promesa.catch(e => console.warn('No se pudo guardar:', e)); }

/* ----------------------------------------------------------------
   MOTOR DE PUNTOS
   ---------------------------------------------------------------- */
function puntosDePartido(pred, p) {
  if (!p.jugado || p.golesLocal == null || p.golesVisita == null) return null;
  if (!pred || pred.local == null || pred.visita == null) return 0;
  const cfg = estado.config.puntos;
  if (pred.local === p.golesLocal && pred.visita === p.golesVisita) return cfg.marcadorExacto;
  const s = (a, b) => a > b ? 1 : (a < b ? -1 : 0);
  if (s(pred.local, pred.visita) === s(p.golesLocal, p.golesVisita)) return cfg.resultadoAcertado;
  return 0;
}
function puntosTotales(jugadorId) {
  const pr = estado.predicciones[jugadorId];
  if (!pr) return 0;
  let total = 0;
  estado.partidos.forEach(p => { const x = puntosDePartido(pr.partidos[p.id], p); if (x != null) total += x; });
  const rf = estado.resultadoFinal;
  if (rf.campeon && pr.campeon === rf.campeon) total += estado.config.puntos.campeon;
  if (rf.subcampeon && pr.subcampeon === rf.subcampeon) total += estado.config.puntos.subcampeon;
  return total;
}
function exactosDe(jugadorId) {
  const pr = estado.predicciones[jugadorId];
  if (!pr) return 0;
  let n = 0;
  estado.partidos.forEach(p => {
    if (p.jugado) { const x = pr.partidos[p.id]; if (x && x.local === p.golesLocal && x.visita === p.golesVisita) n++; }
  });
  return n;
}
function tablaPosiciones() {
  return estado.jugadores
    .map(j => ({ jugador: j, puntos: puntosTotales(j.id), exactos: exactosDe(j.id) }))
    .sort((a, b) => b.puntos - a.puntos || b.exactos - a.exactos || a.jugador.nombre.localeCompare(b.jugador.nombre));
}
function posicionDe(jugadorId) { return tablaPosiciones().findIndex(x => x.jugador.id === jugadorId) + 1; }
/* --- Bote general (con abonos por partes) --- */
function pagoCompleto(j) { return (j.abonado || 0) >= estado.config.montoApuesta; }
function saldoJugador(j) { return Math.max(0, estado.config.montoApuesta - (j.abonado || 0)); }
function jugadoresQuePagaron() { return estado.jugadores.filter(pagoCompleto).length; }
function boteRecaudado() { return estado.jugadores.reduce((s, j) => s + Math.min(j.abonado || 0, estado.config.montoApuesta), 0); }
function botePotencial()  { return estado.jugadores.length * estado.config.montoApuesta; }

/* --- Motor de APUESTAS POR PARTIDO (opt-in + jackpot acumulado) ---
   Cada quien elige en qué partidos entra y paga su monto. Gana quien acierte
   el marcador exacto; si nadie acierta, el pozo se acumula al siguiente. */
function calcularApuestas() {
  const stake = estado.config.montoPartido || 0;
  const ordenados = estado.partidos.slice().sort((a, b) => (a.orden || 0) - (b.orden || 0));
  const porPartido = {};
  let acumulado = 0;        // jackpot que se arrastra
  let jackpotAsignado = false;
  let jackpotActual = 0;    // acumulado disponible para el próximo partido sin jugar
  ordenados.forEach(p => {
    const ap = estado.apuestas;
    const participantes = estado.jugadores.filter(j => ap[j.id] && ap[j.id][p.id]);
    const pagados = participantes.filter(j => ap[j.id][p.id].pago);
    let entrante = 0;
    if (p.jugado) entrante = acumulado;
    else if (!jackpotAsignado) { entrante = acumulado; jackpotActual = acumulado; jackpotAsignado = true; }
    const pot = stake * pagados.length + entrante;
    let ganadores = [], est = 'abierto';
    if (p.jugado) {
      ganadores = pagados.filter(j => {
        const x = estado.predicciones[j.id] && estado.predicciones[j.id].partidos[p.id];
        return x && x.local === p.golesLocal && x.visita === p.golesVisita;
      });
      if (ganadores.length > 0) { est = 'ganado'; acumulado = 0; }
      else { est = 'vacante'; acumulado = pot; }
    }
    porPartido[p.id] = { participantes, pagados, pot, entrante, ganadores, estado: est, premio: ganadores.length ? pot / ganadores.length : 0 };
  });
  return { porPartido, jackpot: jackpotActual };
}
function entradoEnApuesta(jugadorId, partidoId) { return !!(estado.apuestas[jugadorId] && estado.apuestas[jugadorId][partidoId]); }

/* ----------------------------------------------------------------
   VISTAS
   ---------------------------------------------------------------- */
const VISTAS = { inicio: vistaInicio, calendario: vistaCalendario, partidos: vistaPartidos, posiciones: vistaPosiciones, final: vistaFinal, bote: vistaBote, admin: vistaAdmin };

function vistaInicio() {
  const yo = usuario();
  const pr = estado.predicciones[yo.id] || { partidos: {} };
  const proximos = estado.partidos.filter(p => !partidoBloqueado(p)).sort((a, b) => fechaEc(a.fecha) - fechaEc(b.fecha)).slice(0, 3);
  const abiertos = estado.partidos.filter(p => !partidoBloqueado(p));
  const faltan = abiertos.filter(p => { const x = pr.partidos[p.id]; return !x || x.local == null || x.visita == null; }).length;

  return `
    <div class="aviso info"><span class="ico">👋</span>
      <div>¡Hola, <strong>${escapar(yo.nombre)}</strong>! Estás en <strong>${escapar(estado.config.nombrePolla)}</strong>. Haz tus predicciones antes de que empiece cada partido.</div></div>
    <div class="resumen">
      <div class="stat azul"><div class="ico-fondo">🏅</div><div class="etq">Tu posición</div><div class="val">${posicionDe(yo.id)}º <span style="font-size:1rem;color:var(--gris)">de ${estado.jugadores.length}</span></div></div>
      <div class="stat"><div class="ico-fondo">⭐</div><div class="etq">Tus puntos</div><div class="val">${puntosTotales(yo.id)}</div></div>
      <div class="stat dorada"><div class="ico-fondo">💰</div><div class="etq">Bote acumulado</div><div class="val">${formatMoneda(boteRecaudado())}</div></div>
      <div class="stat roja"><div class="ico-fondo">📝</div><div class="etq">Predicciones pendientes</div><div class="val">${faltan}</div></div>
    </div>
    <div class="tarjeta">
      <div class="tarjeta-titulo">⚽ Próximos partidos</div>
      ${proximos.length === 0 ? '<p class="texto-mini">No hay partidos próximos.</p>' : proximos.map(p => tarjetaResumenPartido(p, yo.id)).join('')}
      <div class="mt8 centro"><button class="boton secundario pequeno" data-accion="ir" data-vista="partidos">Ver todos y predecir →</button></div>
    </div>`;
}
function tarjetaResumenPartido(p, jugadorId) {
  const pr = estado.predicciones[jugadorId];
  const pred = pr && pr.partidos[p.id];
  const tiene = pred && pred.local != null && pred.visita != null;
  return `<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--linea)">
      <div><div style="font-weight:700">${getEquipo(p.local).bandera} ${nombreEquipo(p.local)} <span style="color:var(--gris)">vs</span> ${nombreEquipo(p.visita)} ${getEquipo(p.visita).bandera}</div>
        <div class="texto-mini">${formatFecha(p.fecha)} · Grupo ${p.grupo}</div></div>
      <span class="chip ${tiene ? 'grupo' : ''}">${tiene ? `Predijiste ${pred.local}-${pred.visita}` : 'Sin predicción'}</span></div>`;
}

function vistaPartidos() {
  const yo = usuario();
  const pr = estado.predicciones[yo.id] || { partidos: {} };
  const ap = calcularApuestas();
  const grupos = {};
  estado.partidos.forEach(p => { (grupos[p.grupo] = grupos[p.grupo] || []).push(p); });
  let html = `<div class="titulo-vista">Partidos y apuestas</div><div class="subtitulo-vista">Pon tu marcador y, si quieres, entra a la apuesta del partido (${formatMoneda(estado.config.montoPartido)} c/u). Puedes cambiar hasta que empiece el juego.</div>`;
  if (ap.jackpot > 0) html += `<div class="jackpot-banner">🔥 Pozo acumulado: <strong>${formatMoneda(ap.jackpot)}</strong> — se lo lleva el próximo que acierte el marcador exacto.</div>`;
  Object.keys(grupos).sort().forEach(g => {
    html += `<div class="grupo-titulo">📋 Grupo ${g}</div>`;
    grupos[g].sort((a, b) => (a.orden || 0) - (b.orden || 0)).forEach(p => { html += filaPartido(p, pr, ap.porPartido[p.id]); });
  });
  return html;
}
function filaPartido(p, pr, info) {
  const pred = pr.partidos[p.id] || { local: null, visita: null };
  const bloqueado = partidoBloqueado(p);
  const pts = puntosDePartido(pred, p);
  let badge = '';
  if (p.jugado) {
    if (pts === estado.config.puntos.marcadorExacto) badge = `<span class="badge-puntos gano">🎯 +${pts} pts (¡exacto!)</span>`;
    else if (pts > 0) badge = `<span class="badge-puntos gano">+${pts} pts</span>`;
    else badge = `<span class="badge-puntos cero">+0 pts</span>`;
  }
  let centro;
  if (p.jugado) centro = `<div class="marcador-real">${p.golesLocal}<span class="vs">–</span>${p.golesVisita}</div>`;
  else if (bloqueado) centro = `<div class="marcador-centro"><span class="candado">🔒 En juego</span></div>`;
  else centro = `<div class="inputs-pred">
      <input type="number" min="0" max="20" inputmode="numeric" value="${pred.local != null ? pred.local : ''}" data-accion="pred" data-partido="${p.id}" data-lado="local" aria-label="Goles ${nombreEquipo(p.local)}">
      <span class="vs">–</span>
      <input type="number" min="0" max="20" inputmode="numeric" value="${pred.visita != null ? pred.visita : ''}" data-accion="pred" data-partido="${p.id}" data-lado="visita" aria-label="Goles ${nombreEquipo(p.visita)}"></div>`;
  let pie = '';
  if (p.jugado) {
    const t = (pred.local != null && pred.visita != null) ? `Tu predicción: <strong>${pred.local}-${pred.visita}</strong>` : 'No predijiste este partido';
    pie = `<div class="pred-pie"><span>${t}</span>${badge}</div>`;
  } else if (bloqueado) pie = `<div class="pred-pie"><span>El partido ya empezó, predicciones cerradas.</span><span class="candado">🔒</span></div>`;
  const chip = p.jugado ? '<span class="chip jugado">Finalizado</span>' : (bloqueado ? '<span class="chip live">En juego</span>' : '<span class="chip grupo">Abierto</span>');
  return `<div class="partido">
      <div class="partido-cab"><span>${formatFecha(p.fecha)} · ${escapar(p.estadio || '')}</span>${chip}</div>
      <div class="partido-cuerpo">
        <div class="equipo local"><span class="bandera">${getEquipo(p.local).bandera}</span><span>${nombreEquipo(p.local)}</span></div>
        ${centro}
        <div class="equipo visita"><span>${nombreEquipo(p.visita)}</span><span class="bandera">${getEquipo(p.visita).bandera}</span></div>
      </div>${pie}${stripApuesta(p, info, bloqueado)}</div>`;
}

// Franja de "apuesta por partido" debajo de cada partido.
function stripApuesta(p, info, bloqueado) {
  info = info || { participantes: [], pagados: [], pot: 0, entrante: 0, ganadores: [], estado: 'abierto', premio: 0 };
  const yo = usuario();
  const stake = estado.config.montoPartido || 0;
  const org = esOrganizador();
  const miEntrada = estado.apuestas[yo.id] && estado.apuestas[yo.id][p.id];

  const infoPozo = `<span class="ap-pozo">💸 Pozo ${formatMoneda(info.pot)}</span><span class="ap-n">${info.pagados.length} jugando${info.entrante > 0 ? ` · +${formatMoneda(info.entrante)} 🔥` : ''}</span>`;

  let accion = '';
  if (p.jugado) {
    if (info.estado === 'ganado') accion = `<span class="ap-result gano">🏆 ${info.ganadores.map(g => escapar(g.nombre)).join(', ')} ${info.ganadores.length > 1 ? 'reparten' : 'gana'} ${formatMoneda(info.premio)}${info.ganadores.length > 1 ? ' c/u' : ''}</span>`;
    else if (info.pagados.length > 0) accion = `<span class="ap-result vacante">Nadie acertó · ${formatMoneda(info.pot)} se acumula 🔥</span>`;
    else accion = `<span class="ap-result">Sin apuestas</span>`;
  } else if (bloqueado) {
    accion = `<span class="ap-result">🔒 Apuesta cerrada</span>`;
  } else if (miEntrada) {
    accion = `<span class="ap-en">✓ Apostando ${miEntrada.pago ? '<span class="ap-pagado">pagado</span>' : `<span class="ap-debe">debes ${formatMoneda(stake)}</span>`}</span> <button class="boton secundario pequeno" data-accion="apuesta-salir" data-partido="${p.id}">Salir</button>`;
  } else {
    accion = `<button class="boton dorado pequeno" data-accion="apuesta-entrar" data-partido="${p.id}">💸 Entrar (${formatMoneda(stake)})</button>`;
  }

  let pagos = '';
  if (org && info.participantes.length > 0 && !p.jugado) {
    pagos = `<div class="ap-pagos">${info.participantes.map(j => {
      const pagado = estado.apuestas[j.id][p.id].pago;
      return `<button class="ap-chip ${pagado ? 'pagado' : ''}" data-accion="apuesta-pago" data-jug="${j.id}" data-partido="${p.id}" title="${pagado ? 'Pagado' : 'Marcar pago'}">${escapar(j.nombre)} ${pagado ? '✓' : '○'}</button>`;
    }).join('')}</div>`;
  }

  return `<div class="apuesta-strip"><div class="ap-top">${infoPozo}<span class="ap-accion">${accion}</span></div>${pagos}</div>`;
}

function vistaPosiciones() {
  const tabla = tablaPosiciones();
  const medallas = ['🥇', '🥈', '🥉'];
  const filas = tabla.map((row, i) => {
    const j = row.jugador, esYo = j.id === estado.usuarioActual;
    return `<tr class="${esYo ? 'fila-yo' : ''}">
        <td class="pos">${medallas[i] || (i + 1)}</td>
        <td><div class="jug-celda"><div class="avatar" style="background:${j.color}">${escapar(j.nombre.charAt(0))}</div>
          <div><div style="font-weight:700">${escapar(j.nombre)}${esYo ? ' <span class="chip grupo">tú</span>' : ''}</div>
          <div class="texto-mini">${row.exactos} marcador(es) exacto(s)</div></div></div></td>
        <td class="pts-celda">${row.puntos}</td></tr>`;
  }).join('');
  return `<div class="titulo-vista">Tabla de posiciones</div>
    <div class="subtitulo-vista">Quien tenga más puntos al final del Mundial se lleva el bote de ${formatMoneda(botePotencial())}.</div>
    <div class="tarjeta"><table class="tabla-pos"><thead><tr><th>#</th><th>Jugador</th><th style="text-align:right">Puntos</th></tr></thead><tbody>${filas}</tbody></table></div>
    <div class="aviso info"><span class="ico">ℹ️</span><div><strong>Cómo se ganan los puntos:</strong> marcador exacto = ${estado.config.puntos.marcadorExacto} · acertar quién gana o empate = ${estado.config.puntos.resultadoAcertado} · campeón = ${estado.config.puntos.campeon} · subcampeón = ${estado.config.puntos.subcampeon}.</div></div>`;
}

function vistaFinal() {
  const yo = usuario();
  const pr = estado.predicciones[yo.id] || {};
  const opts = sel => Object.keys(EQUIPOS).map(id => `<option value="${id}" ${sel === id ? 'selected' : ''}>${getEquipo(id).bandera} ${getEquipo(id).nombre}</option>`).join('');
  const rf = estado.resultadoFinal, definido = rf.campeon || rf.subcampeon;
  return `<div class="titulo-vista">Fase final 🏆</div>
    <div class="subtitulo-vista">Elige quién llegará a la final. ¡Acertar da muchos puntos extra!</div>
    <div class="pick-final">
      <div class="pick-card campeon"><div class="emoji">🏆</div><h4>Campeón</h4><div class="texto-mini">+${estado.config.puntos.campeon} pts si aciertas</div>
        <select data-accion="pick-final" data-tipo="campeon"><option value="">— Elegir —</option>${opts(pr.campeon)}</select></div>
      <div class="pick-card"><div class="emoji">🥈</div><h4>Subcampeón</h4><div class="texto-mini">+${estado.config.puntos.subcampeon} pts si aciertas</div>
        <select data-accion="pick-final" data-tipo="subcampeon"><option value="">— Elegir —</option>${opts(pr.subcampeon)}</select></div></div>
    ${definido
      ? `<div class="aviso demo" style="margin-top:18px"><span class="ico">🏁</span><div>Resultado oficial: Campeón <strong>${rf.campeon ? chipEquipo(rf.campeon) : '—'}</strong>, Subcampeón <strong>${rf.subcampeon ? chipEquipo(rf.subcampeon) : '—'}</strong>.</div></div>`
      : `<div class="aviso info" style="margin-top:18px"><span class="ico">⏳</span><div>Al terminar el Mundial, el organizador define el campeón y subcampeón reales, y se suman los puntos extra automáticamente.</div></div>`}
    <div class="seccion-sep">🔮 Lo que eligió cada jugador</div>
    <div class="tarjeta">${estado.jugadores.map(j => { const p = estado.predicciones[j.id] || {}; return `<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--linea)"><span style="font-weight:700">${escapar(j.nombre)}</span><span class="texto-mini">🏆 ${p.campeon ? chipEquipo(p.campeon) : '—'} · 🥈 ${p.subcampeon ? chipEquipo(p.subcampeon) : '—'}</span></div>`; }).join('')}</div>`;
}

function vistaBote() {
  const lider = tablaPosiciones()[0];
  const org = esOrganizador();
  const ap = calcularApuestas();
  let totalEntradas = 0; const ganados = [];
  estado.partidos.forEach(p => {
    const inf = ap.porPartido[p.id]; if (!inf) return;
    totalEntradas += inf.pagados.length;
    if (inf.estado === 'ganado') ganados.push({ p, inf });
  });
  const totalApuestas = totalEntradas * (estado.config.montoPartido || 0);

  return `<div class="titulo-vista">El dinero 💰</div>
    <div class="subtitulo-vista">La web lleva la cuenta; los pagos se hacen entre ustedes (efectivo o transferencia).</div>

    <div class="seccion-sep">🏆 Bote del Mundial</div>
    <div class="bote-hero"><div class="etq">RECAUDADO EN ABONOS</div><div class="monto">${formatMoneda(boteRecaudado())}</div>
      <div class="nota">${jugadoresQuePagaron()} de ${estado.jugadores.length} con cuota completa · meta ${formatMoneda(botePotencial())}</div></div>
    <div class="tarjeta"><div class="tarjeta-titulo">🏅 Va ganando el bote</div>
      ${lider ? `<div style="display:flex;align-items:center;gap:12px"><div class="avatar" style="background:${lider.jugador.color};width:46px;height:46px;font-size:1.1rem">${escapar(lider.jugador.nombre.charAt(0))}</div>
        <div><div style="font-weight:800;font-size:1.1rem">${escapar(lider.jugador.nombre)}</div><div class="texto-mini">${lider.puntos} puntos · si terminara hoy se lleva ${formatMoneda(botePotencial())}</div></div></div>` : '<p class="texto-mini">Aún no hay puntos.</p>'}</div>
    <div class="tarjeta"><div class="tarjeta-titulo">💵 Abonos · cuota ${formatMoneda(estado.config.montoApuesta)}</div>
      <ul class="lista-jug">${estado.jugadores.map(j => {
        const completo = pagoCompleto(j);
        return `<li><div class="avatar" style="background:${j.color}">${escapar(j.nombre.charAt(0))}</div>
          <span class="nombre">${escapar(j.nombre)}</span>
          <span class="abono-monto">${formatMoneda(j.abonado || 0)} / ${formatMoneda(estado.config.montoApuesta)}</span>
          <span class="estado-pago ${completo ? 'pago' : 'debe'}">${completo ? '✓ Completo' : 'faltan ' + formatMoneda(saldoJugador(j))}</span>
          ${org ? `<button class="boton secundario pequeno" data-accion="abono" data-jug="${j.id}">+ Abono</button>${completo ? `<button class="boton secundario pequeno" data-accion="abono-reset" data-jug="${j.id}" title="Reiniciar abono">↺</button>` : `<button class="boton secundario pequeno" data-accion="abono-full" data-jug="${j.id}">Completar</button>`}` : ''}</li>`;
      }).join('')}</ul>
      ${!org ? '<p class="texto-mini mt8">Solo el organizador registra los abonos.</p>' : ''}</div>

    <div class="seccion-sep">💸 Apuestas por partido</div>
    <div class="bote-hero jackpot"><div class="etq">🔥 POZO ACUMULADO</div><div class="monto">${formatMoneda(ap.jackpot)}</div>
      <div class="nota">Se lo lleva el próximo que acierte el marcador exacto</div></div>
    <div class="tarjeta"><div class="tarjeta-titulo">📊 Resumen de apuestas</div>
      <div class="resumen2">
        <div><div class="texto-mini">Monto por partido</div><div class="r2-val">${formatMoneda(estado.config.montoPartido)}</div></div>
        <div><div class="texto-mini">Entradas pagadas</div><div class="r2-val">${totalEntradas}</div></div>
        <div><div class="texto-mini">Total movido</div><div class="r2-val">${formatMoneda(totalApuestas)}</div></div>
      </div>
      <p class="texto-mini mt8">Para entrar a las apuestas y marcar pagos por partido, ve a <strong>⚽ Partidos</strong>.</p></div>
    ${ganados.length ? `<div class="tarjeta"><div class="tarjeta-titulo">🏆 Pozos ya ganados</div>${ganados.map(({ p, inf }) => `<div class="gan-fila"><span>${getEquipo(p.local).bandera} ${p.golesLocal}-${p.golesVisita} ${getEquipo(p.visita).bandera}</span><span class="texto-mini"><strong>${inf.ganadores.map(g => escapar(g.nombre)).join(', ')}</strong> · ${formatMoneda(inf.premio)}${inf.ganadores.length > 1 ? ' c/u' : ''}</span></div>`).join('')}</div>` : ''}`;
}

function vistaAdmin() {
  if (!esOrganizador()) return `<div class="titulo-vista">Panel del organizador</div><div class="aviso info"><span class="ico">🔒</span><div>Esta sección es solo para el organizador de la polla.</div></div>`;
  const cfg = estado.config;
  const resultados = estado.partidos.slice().sort((a, b) => (a.orden || 0) - (b.orden || 0)).map(p => `
      <div class="admin-resultado">
        <div><div style="font-weight:700">${getEquipo(p.local).bandera} ${nombreEquipo(p.local)} vs ${nombreEquipo(p.visita)} ${getEquipo(p.visita).bandera}</div><div class="texto-mini">Grupo ${p.grupo} · ${formatFecha(p.fecha)}</div></div>
        <div class="admin-vs"><input type="number" min="0" max="20" value="${p.golesLocal != null ? p.golesLocal : ''}" data-accion="res" data-partido="${p.id}" data-lado="local"><span>–</span><input type="number" min="0" max="20" value="${p.golesVisita != null ? p.golesVisita : ''}" data-accion="res" data-partido="${p.id}" data-lado="visita"></div>
        <label class="texto-mini" style="display:flex;align-items:center;gap:5px;white-space:nowrap"><input type="checkbox" ${p.jugado ? 'checked' : ''} data-accion="jugado" data-partido="${p.id}"> Finalizado</label>
      </div>`).join('');
  const opts = sel => '<option value="">—</option>' + Object.keys(EQUIPOS).map(id => `<option value="${id}" ${sel === id ? 'selected' : ''}>${getEquipo(id).bandera} ${getEquipo(id).nombre}</option>`).join('');

  return `<div class="titulo-vista">Panel del organizador 🛠️</div>
    <div class="subtitulo-vista">Ingresa los resultados reales, configura la apuesta y administra a los jugadores.</div>
    <div class="aviso demo"><span class="ico">✨</span><div>¿Probar cómo funcionan los puntos? <button class="boton dorado pequeno" data-accion="demo-resultados">Cargar resultados de ejemplo</button> <button class="boton secundario pequeno" data-accion="borrar-resultados">Borrar resultados</button></div></div>
    <div class="tarjeta"><div class="tarjeta-titulo">⚽ Resultados de los partidos</div>${resultados}</div>
    <div class="tarjeta"><div class="tarjeta-titulo">🔄 Fixture oficial</div>
      <p class="texto-mini">Recarga los 72 partidos oficiales del Mundial 2026 desde el código. Actualiza rivales y fechas; <strong>no borra</strong> las predicciones ya hechas.</p>
      <div class="mt8"><button class="boton secundario" data-accion="re-sembrar">🔄 Re-cargar fixture oficial</button></div></div>
    <div class="tarjeta"><div class="tarjeta-titulo">🏁 Resultado final del Mundial</div>
      <div class="fila-campos"><div class="campo"><label>Campeón</label><select data-accion="final-real" data-tipo="campeon">${opts(estado.resultadoFinal.campeon)}</select></div>
        <div class="campo"><label>Subcampeón</label><select data-accion="final-real" data-tipo="subcampeon">${opts(estado.resultadoFinal.subcampeon)}</select></div></div>
      <p class="texto-mini">Al definirlos se suman los puntos extra a quienes acertaron.</p></div>
    <div class="tarjeta"><div class="tarjeta-titulo">⚙️ Configuración</div>
      <div class="campo"><label>Nombre de la polla</label><input type="text" value="${escapar(cfg.nombrePolla)}" data-accion="cfg" data-campo="nombrePolla"></div>
      <div class="fila-campos"><div class="campo"><label>Código de invitación</label><input type="text" value="${escapar(cfg.codigoInvitacion)}" data-accion="cfg" data-campo="codigoInvitacion"></div>
        <div class="campo"><label>Cuota del bote (${escapar(cfg.moneda)})</label><input type="number" min="0" value="${cfg.montoApuesta}" data-accion="cfg" data-campo="montoApuesta"></div></div>
      <div class="campo"><label>Monto por apuesta de partido (${escapar(cfg.moneda)})</label><input type="number" min="0" value="${cfg.montoPartido}" data-accion="cfg" data-campo="montoPartido"></div>
      <div class="tarjeta-titulo" style="margin-top:8px">Puntos</div>
      <div class="fila-campos"><div class="campo"><label>Marcador exacto</label><input type="number" min="0" value="${cfg.puntos.marcadorExacto}" data-accion="cfg-pts" data-campo="marcadorExacto"></div>
        <div class="campo"><label>Resultado acertado</label><input type="number" min="0" value="${cfg.puntos.resultadoAcertado}" data-accion="cfg-pts" data-campo="resultadoAcertado"></div>
        <div class="campo"><label>Campeón</label><input type="number" min="0" value="${cfg.puntos.campeon}" data-accion="cfg-pts" data-campo="campeon"></div>
        <div class="campo"><label>Subcampeón</label><input type="number" min="0" value="${cfg.puntos.subcampeon}" data-accion="cfg-pts" data-campo="subcampeon"></div></div></div>
    <div class="tarjeta"><div class="tarjeta-titulo">👥 Jugadores</div>
      <ul class="lista-jug">${estado.jugadores.map(j => `<li><div class="avatar" style="background:${j.color}">${escapar(j.nombre.charAt(0))}</div>
        <span class="nombre">${escapar(j.nombre)} ${j.esOrganizador ? '<span class="chip grupo">organizador</span>' : ''}</span>
        <span class="estado-pago ${pagoCompleto(j) ? 'pago' : 'debe'}">${pagoCompleto(j) ? '✓ Pagó' : 'Debe'}</span>
        ${!j.esOrganizador ? `<button class="boton secundario pequeno" data-accion="hacer-org" data-jug="${j.id}">Hacer organizador</button>` : ''}
        ${j.id !== estado.usuarioActual ? `<button class="boton peligro pequeno" data-accion="quitar-jug" data-jug="${j.id}">Quitar</button>` : ''}</li>`).join('')}</ul>
      <div class="boton-fila mt8"><input type="text" id="nuevo-jugador" placeholder="Nombre del nuevo jugador" class="campo" style="margin:0;flex:1;min-width:160px"><button class="boton" data-accion="agregar-jug">＋ Agregar</button></div></div>
    ${!Datos.online ? `<div class="tarjeta"><div class="tarjeta-titulo">⚠️ Zona de peligro</div><p class="texto-mini">Borra todos los datos de este equipo y vuelve a los de ejemplo.</p><div class="mt8"><button class="boton peligro" data-accion="reiniciar">Reiniciar todo</button></div></div>` : ''}`;
}

/* ---- CALENDARIO (agenda para los hinchas) ---- */
function vistaCalendario() {
  const ahora = Date.now();
  const ordenados = estado.partidos.slice().sort((a, b) => fechaEc(a.fecha) - fechaEc(b.fecha));
  const hoyKey = diaKey(new Date());

  let lista = ordenados;
  if (filtroCal === 'ecuador') lista = lista.filter(p => p.local === 'ecu' || p.visita === 'ecu');
  if (filtroCal === 'hoy') lista = lista.filter(p => diaKey(fechaEc(p.fecha)) === hoyKey);

  // Próximo partido (respeta el filtro; si no hay, usa el próximo general)
  const proximo = lista.find(p => !partidoBloqueado(p)) || ordenados.find(p => !partidoBloqueado(p));
  let hero;
  if (proximo) {
    hero = `<div class="cal-hero">
      <div class="cal-hero-tag">⏳ PRÓXIMO PARTIDO</div>
      <div class="cal-hero-match">${getEquipo(proximo.local).bandera} ${nombreEquipo(proximo.local)} <span class="vs">vs</span> ${nombreEquipo(proximo.visita)} ${getEquipo(proximo.visita).bandera}</div>
      <div class="cal-hero-meta">${formatFecha(proximo.fecha)} · Grupo ${proximo.grupo}</div>
      <div class="cal-hero-count" id="cd-timer" data-ts="${fechaEc(proximo.fecha).getTime()}">—</div>
    </div>`;
  } else {
    hero = `<div class="cal-hero"><div class="cal-hero-tag">🏁 FASE DE GRUPOS FINALIZADA</div></div>`;
  }

  const chip = (id, txt) => `<button class="cal-chip ${filtroCal === id ? 'activo' : ''}" data-accion="filtro-cal" data-filtro="${id}">${txt}</button>`;
  const filtros = `<div class="cal-filtros">${chip('todos', 'Todos')}${chip('ecuador', '🇪🇨 Ecuador')}${chip('hoy', 'Hoy')}</div>`;

  let cuerpo = '';
  if (lista.length === 0) {
    cuerpo = `<p class="texto-mini centro" style="padding:24px">${filtroCal === 'hoy' ? 'No hay partidos programados para hoy.' : 'No hay partidos para este filtro.'}</p>`;
  } else {
    let diaActual = '';
    lista.forEach(p => {
      const k = diaKey(fechaEc(p.fecha));
      if (k !== diaActual) {
        diaActual = k;
        const esHoy = k === hoyKey;
        cuerpo += `<div class="cal-dia ${esHoy ? 'cal-dia-hoy' : ''}">${diaLargo(fechaEc(p.fecha))}${esHoy ? ' <span class="chip live">HOY</span>' : ''}</div>`;
      }
      cuerpo += filaCalendario(p, ahora);
    });
  }

  return `
    <div class="titulo-vista">📅 Calendario del Mundial</div>
    <div class="subtitulo-vista">Los 72 partidos de la fase de grupos. 🕐 Horarios en <strong>hora de Ecuador</strong> (Quito · UTC-5).</div>
    ${hero}
    ${filtros}
    ${cuerpo}
    <div class="mt8 centro"><button class="boton secundario pequeno" data-accion="ir" data-vista="partidos">✍️ Hacer mis predicciones →</button></div>`;
}

function filaCalendario(p, ahora) {
  const yo = usuario();
  const pr = yo && estado.predicciones[yo.id];
  const miPred = pr && pr.partidos[p.id];
  const tienePred = miPred && miPred.local != null && miPred.visita != null;
  const ts = fechaEc(p.fecha).getTime();
  const enVivo = !p.jugado && ts <= ahora && (ahora - ts) < 2.5 * 3600 * 1000;

  let col;
  if (p.jugado) col = `<span class="cal-score">${p.golesLocal}–${p.golesVisita}</span>`;
  else if (enVivo) col = `<span class="chip live">EN VIVO</span>`;
  else col = `<span class="cal-hora">${horaEc(p.fecha)}</span>`;

  const pred = tienePred ? `<span class="cal-pred">Tu pronóstico: ${miPred.local}–${miPred.visita}</span>` : '';
  const esEcu = p.local === 'ecu' || p.visita === 'ecu';
  return `<div class="cal-partido ${esEcu ? 'cal-ecu' : ''}">
    <div class="cal-col-hora">${col}<div class="cal-grupo">Grupo ${p.grupo}</div></div>
    <div class="cal-col-eq">
      <div class="cal-eq"><span>${getEquipo(p.local).bandera}</span> ${nombreEquipo(p.local)}</div>
      <div class="cal-eq"><span>${getEquipo(p.visita).bandera}</span> ${nombreEquipo(p.visita)}</div>
      ${pred}
    </div></div>`;
}

// Contador en vivo del próximo partido (actualiza el texto cada segundo).
function actualizarCountdown() {
  const el = document.getElementById('cd-timer');
  if (!el) { if (cdInterval) { clearInterval(cdInterval); cdInterval = null; } return; }
  let diff = parseInt(el.dataset.ts, 10) - Date.now();
  if (diff <= 0) { el.textContent = '¡Comienza ahora! ⚽'; return; }
  const d = Math.floor(diff / 86400000); diff %= 86400000;
  const h = Math.floor(diff / 3600000); diff %= 3600000;
  const m = Math.floor(diff / 60000); diff %= 60000;
  const s = Math.floor(diff / 1000);
  el.textContent = (d > 0 ? d + 'd ' : '') + h + 'h ' + m + 'm ' + s + 's';
}

/* ----------------------------------------------------------------
   RENDER + ENCABEZADO + NAVEGACIÓN
   ---------------------------------------------------------------- */
const TABS = [
  { id: 'inicio', ico: '🏠', txt: 'Inicio' }, { id: 'calendario', ico: '📅', txt: 'Calendario' },
  { id: 'partidos', ico: '⚽', txt: 'Partidos' }, { id: 'posiciones', ico: '🏅', txt: 'Posiciones' },
  { id: 'final', ico: '🏆', txt: 'Fase final' }, { id: 'bote', ico: '💰', txt: 'Bote' },
  { id: 'admin', ico: '🛠️', txt: 'Organizador' },
];

function render() {
  const yo = usuario();
  if (!yo) { Auth.salir(); return; }   // por si el jugador fue eliminado

  document.getElementById('nombre-polla').textContent = estado.config.nombrePolla;
  document.getElementById('badge-conexion').innerHTML = Datos.online ? '🟢 En línea' : '💾 Local';
  document.getElementById('usuario-chip').innerHTML = `<span class="avatar mini" style="background:${yo.color}">${escapar(yo.nombre.charAt(0))}</span><span>${escapar(yo.nombre)}</span>`;

  const tabs = TABS.filter(t => t.id !== 'admin' || esOrganizador());
  document.getElementById('nav-inner').innerHTML = tabs.map(t => `<button data-accion="ir" data-vista="${t.id}" class="${estado.vista === t.id ? 'activa' : ''}"><span class="ico">${t.ico}</span><span>${t.txt}</span></button>`).join('');

  if (estado.vista === 'admin' && !esOrganizador()) estado.vista = 'inicio';
  document.getElementById('contenido').innerHTML = (VISTAS[estado.vista] || vistaInicio)();

  // Contador en vivo (solo cuando el Calendario está abierto)
  if (cdInterval) { clearInterval(cdInterval); cdInterval = null; }
  if (estado.vista === 'calendario' && document.getElementById('cd-timer')) {
    actualizarCountdown();
    cdInterval = setInterval(actualizarCountdown, 1000);
  }
  window.scrollTo({ top: 0 });
}

/* ----------------------------------------------------------------
   EVENTOS (delegados)
   ---------------------------------------------------------------- */
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-accion]');
  if (!el) return;
  const a = el.dataset.accion;
  if (a.startsWith('login-')) return; // los maneja auth.js

  switch (a) {
    case 'ir': estado.vista = el.dataset.vista; render(); break;
    case 'filtro-cal': filtroCal = el.dataset.filtro; render(); break;
    case 'salir': Auth.salir(); break;

    case 'abono': {
      if (!esOrganizador()) return;
      const j = getJugador(el.dataset.jug); if (!j) return;
      const txt = prompt(`¿Cuánto abona ${j.nombre}? (cuota ${formatMoneda(estado.config.montoApuesta)}, lleva ${formatMoneda(j.abonado || 0)})`, '');
      if (txt == null) return;
      const monto = Math.max(0, parseFloat(String(txt).replace(',', '.')) || 0);
      j.abonado = (j.abonado || 0) + monto;
      sync(Datos.guardarJugador(j.id)); render(); break;
    }
    case 'abono-full': {
      if (!esOrganizador()) return;
      const j = getJugador(el.dataset.jug); if (j) { j.abonado = estado.config.montoApuesta; sync(Datos.guardarJugador(j.id)); }
      render(); break;
    }
    case 'abono-reset': {
      if (!esOrganizador()) return;
      const j = getJugador(el.dataset.jug); if (j) { j.abonado = 0; sync(Datos.guardarJugador(j.id)); }
      render(); break;
    }
    case 'apuesta-entrar': {
      const yo = usuario(); if (!yo) return;
      const p = estado.partidos.find(x => x.id === el.dataset.partido);
      if (!p || partidoBloqueado(p)) return;
      if (!estado.apuestas[yo.id]) estado.apuestas[yo.id] = {};
      estado.apuestas[yo.id][p.id] = { pago: false };
      sync(Datos.guardarApuesta(yo.id, p.id)); render(); break;
    }
    case 'apuesta-salir': {
      const yo = usuario(); if (!yo) return;
      const p = estado.partidos.find(x => x.id === el.dataset.partido);
      if (!p || partidoBloqueado(p)) return;
      sync(Datos.eliminarApuesta(yo.id, p.id)); render(); break;
    }
    case 'apuesta-pago': {
      if (!esOrganizador()) return;
      const jid = el.dataset.jug, pid = el.dataset.partido;
      if (estado.apuestas[jid] && estado.apuestas[jid][pid]) {
        estado.apuestas[jid][pid].pago = !estado.apuestas[jid][pid].pago;
        sync(Datos.guardarApuesta(jid, pid));
      }
      render(); break;
    }
    case 'hacer-org': {
      if (!esOrganizador()) return;
      const j = getJugador(el.dataset.jug); if (j) { j.esOrganizador = true; sync(Datos.guardarJugador(j.id)); }
      render(); break;
    }
    case 'demo-resultados': {
      const ej = { p1: [1, 1], p2: [3, 0], p7: [2, 0], p8: [1, 2], p13: [2, 1], p14: [1, 0] };
      estado.partidos.forEach(p => { if (ej[p.id]) { p.jugado = true; p.golesLocal = ej[p.id][0]; p.golesVisita = ej[p.id][1]; sync(Datos.guardarPartido(p.id)); } });
      render(); break;
    }
    case 'borrar-resultados':
      estado.partidos.forEach(p => { if (p.jugado || p.golesLocal != null) { p.jugado = false; p.golesLocal = null; p.golesVisita = null; sync(Datos.guardarPartido(p.id)); } });
      estado.resultadoFinal = { campeon: null, subcampeon: null }; sync(Datos.guardarConfig()); render(); break;

    case 'agregar-jug': {
      const input = document.getElementById('nuevo-jugador');
      const nombre = (input.value || '').trim();
      if (!nombre) { input.focus(); return; }
      const colores = ['#0540A6', '#E4002B', '#E6A700', '#0A8754', '#7c3aed', '#0891b2', '#be123c', '#c2410c'];
      Promise.resolve(Datos.crearJugador({ nombre, color: colores[estado.jugadores.length % colores.length], pago: false, esOrganizador: false, pin: '' })).then(render).catch(err => console.warn(err));
      break;
    }
    case 'quitar-jug':
      if (confirm('¿Quitar a este jugador y sus predicciones?')) { sync(Datos.eliminarJugador(el.dataset.jug)); render(); }
      break;
    case 'reiniciar':
      if (!Datos.online && confirm('Esto borra TODO en este equipo. ¿Seguro?')) { Datos.reiniciarLocal(); estado.vista = 'inicio'; render(); }
      break;
    case 're-sembrar':
      if (!esOrganizador()) return;
      if (confirm('¿Re-cargar los 72 partidos oficiales? Actualiza rivales y fechas; no borra las predicciones.')) {
        Promise.resolve(Datos.reSembrarPartidos()).then(() => { estado.vista = 'partidos'; render(); }).catch(err => console.warn(err));
      }
      break;
  }
});

document.addEventListener('change', (e) => {
  const el = e.target.closest('[data-accion]');
  if (!el) return;
  const a = el.dataset.accion;

  switch (a) {
    case 'pred': {
      const pr = estado.predicciones[estado.usuarioActual] || (estado.predicciones[estado.usuarioActual] = { partidos: {}, campeon: null, subcampeon: null });
      const p = pr.partidos[el.dataset.partido] || (pr.partidos[el.dataset.partido] = { local: null, visita: null });
      p[el.dataset.lado] = el.value === '' ? null : Math.max(0, parseInt(el.value, 10) || 0);
      sync(Datos.guardarPrediccion(estado.usuarioActual, el.dataset.partido));
      break;
    }
    case 'pick-final': {
      const pr = estado.predicciones[estado.usuarioActual] || (estado.predicciones[estado.usuarioActual] = { partidos: {}, campeon: null, subcampeon: null });
      pr[el.dataset.tipo] = el.value || null;
      sync(Datos.guardarPickFinal(estado.usuarioActual)); render(); break;
    }
    case 'res': {
      if (!esOrganizador()) return;
      const p = estado.partidos.find(x => x.id === el.dataset.partido);
      if (p) { p['goles' + (el.dataset.lado === 'local' ? 'Local' : 'Visita')] = el.value === '' ? null : Math.max(0, parseInt(el.value, 10) || 0); sync(Datos.guardarPartido(p.id)); }
      break;
    }
    case 'jugado': {
      if (!esOrganizador()) return;
      const p = estado.partidos.find(x => x.id === el.dataset.partido);
      if (p) { p.jugado = el.checked; if (p.jugado) { p.golesLocal = p.golesLocal || 0; p.golesVisita = p.golesVisita || 0; } sync(Datos.guardarPartido(p.id)); }
      render(); break;
    }
    case 'final-real': {
      if (!esOrganizador()) return;
      estado.resultadoFinal[el.dataset.tipo] = el.value || null; sync(Datos.guardarConfig()); render(); break;
    }
    case 'cfg': {
      if (!esOrganizador()) return;
      const campo = el.dataset.campo;
      estado.config[campo] = (el.type === 'number') ? (parseInt(el.value, 10) || 0) : el.value;
      if (campo === 'nombrePolla') document.getElementById('nombre-polla').textContent = el.value;
      sync(Datos.guardarConfig()); break;
    }
    case 'cfg-pts':
      if (!esOrganizador()) return;
      estado.config.puntos[el.dataset.campo] = parseInt(el.value, 10) || 0; sync(Datos.guardarConfig()); break;
  }
});

/* ----------------------------------------------------------------
   CINTA DE BANDERAS (temática mundialista)
   ---------------------------------------------------------------- */
function pintarBanderas() {
  const flags = Object.keys(EQUIPOS).map(id => EQUIPOS[id].bandera);
  const fila = flags.concat(flags).map(b => `<span>${b}</span>`).join('');
  const cinta = document.getElementById('cinta-banderas');
  if (cinta) cinta.innerHTML = fila;
}

/* ----------------------------------------------------------------
   ARRANQUE
   ---------------------------------------------------------------- */
function alHaberCambios() {
  const appVisible = document.getElementById('app').style.display !== 'none';
  if (appVisible && estado.usuarioActual && usuario()) render();
  else if (Auth.refrescar) Auth.refrescar();
}

async function iniciar() {
  pintarBanderas();
  await Datos.cargar(estado, alHaberCambios);
  Auth.iniciar(estado, () => { estado.vista = 'inicio'; render(); });
}
iniciar();
