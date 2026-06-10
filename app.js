/* ============================================================
   POLLA MUNDIALISTA — LÓGICA DE LA APLICACIÓN (app.js)
   ------------------------------------------------------------
   Modelo simple (v2): cada quien pronostica el RESULTADO de
   cada partido — Local (L), Empate (E) o Visita (V) — y gana
   1 punto por acierto. Datos vía "Datos"; acceso vía "Auth".
   ============================================================ */

'use strict';

let estado = {
  config: JSON.parse(JSON.stringify(CONFIG_DEFAULT)),
  jugadores: [],
  partidos: [],
  predicciones: {},   // predicciones[jugadorId].partidos[partidoId] = 'L' | 'E' | 'V'
  bloqueados: [],     // correos de jugadores quitados (no pueden volver a entrar)
  resultadoFinal: { campeon: null, subcampeon: null },
  usuarioActual: null,
  vista: 'inicio',
};
let filtroCal = 'todos';
let cdInterval = null;
let grupoSel = null;   // grupo seleccionado en Partidos / Organizador (navegación por grupo)
let faseSel = 'grupos';   // fase seleccionada (grupos | eliminatorias | final)
let faseTabla = 'total';  // fase seleccionada en Posiciones (total | grupos | ...)

/* --- Fases --- */
function fasesCfg() { return estado.config.fases || []; }
function faseInfo(id) { return fasesCfg().find(f => f.id === id) || { id, nombre: id, abierta: true, monto: 0 }; }
function faseAbierta(id) { return !!faseInfo(id).abierta; }
function partidosDeFase(id) { return estado.partidos.filter(p => (p.fase || 'grupos') === id); }
function esKnockout(p) { return (p.fase || 'grupos') !== 'grupos'; }

/* ----------------------------------------------------------------
   AYUDANTES
   ---------------------------------------------------------------- */
function getJugador(id) { return estado.jugadores.find(j => j.id === id); }
function getEquipo(id)  { return EQUIPOS[id] || { nombre: '¿?', bandera: '🏳️' }; }
function usuario()      { return getJugador(estado.usuarioActual); }
function esOrganizador(){ const u = usuario(); return !!(u && u.esOrganizador); }
function nombreEquipo(id) { return getEquipo(id).nombre; }
function chipEquipo(id) { const e = getEquipo(id); return `${e.bandera} ${e.nombre}`; }
// Texto de un resultado L/E/V para un partido dado.
function textoResultado(p, r) { return r === 'L' ? nombreEquipo(p.local) : (r === 'V' ? nombreEquipo(p.visita) : 'Empate'); }

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
function horaEc(iso) { return new Intl.DateTimeFormat('es-EC', { hour: '2-digit', minute: '2-digit', timeZone: TZ_EC }).format(fechaEc(iso)); }
function diaKey(d) { return new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: TZ_EC }).format(d); }
function diaLargo(d) { const s = new Intl.DateTimeFormat('es-EC', { weekday: 'long', day: 'numeric', month: 'long', timeZone: TZ_EC }).format(d); return s.charAt(0).toUpperCase() + s.slice(1); }
function partidoBloqueado(p) {
  if (p.jugado) return true;
  if (!faseAbierta(p.fase || 'grupos')) return true;   // fase cerrada: no se pronostica
  const inicio = fechaEc(p.fecha);
  return !isNaN(inicio) && inicio.getTime() <= Date.now();
}
function escapar(t) {
  return String(t == null ? '' : t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function sync(promesa) { if (promesa && promesa.catch) promesa.catch(e => console.warn('No se pudo guardar:', e)); }

/* ----------------------------------------------------------------
   UX DIVERTIDA (progreso, chispas, confeti, avisos)
   ---------------------------------------------------------------- */
function progresoPredicciones() {
  const pr = (estado.predicciones[estado.usuarioActual] || {}).partidos || {};
  const abiertos = estado.partidos.filter(p => !partidoBloqueado(p));
  const hechos = abiertos.filter(p => pr[p.id]).length;
  return { total: abiertos.length, hechos };
}
function toast(msg, tipo) {
  const t = document.createElement('div');
  t.className = 'toast ' + (tipo || '');
  t.innerHTML = msg;
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add('visible'));
  setTimeout(() => { t.classList.remove('visible'); setTimeout(() => t.remove(), 350); }, 2600);
}
function chispitas(rect) {
  if (!rect) return;
  const cont = document.createElement('div');
  cont.className = 'chispas';
  cont.style.left = (rect.left + rect.width / 2) + 'px';
  cont.style.top = (rect.top + rect.height / 2) + 'px';
  const dirs = [[-36, -30], [36, -30], [30, 34], [-30, 34]];
  ['✨', '⚽', '⭐', '🎉'].forEach((e, i) => { const s = document.createElement('span'); s.textContent = e; s.style.setProperty('--dx', dirs[i][0] + 'px'); s.style.setProperty('--dy', dirs[i][1] + 'px'); cont.appendChild(s); });
  document.body.appendChild(cont);
  setTimeout(() => cont.remove(), 750);
}
function festejo() {
  toast('🎉 ¡Completaste todos tus pronósticos! 🏆', 'exito');
  const cont = document.createElement('div');
  cont.className = 'confeti';
  const emojis = ['⚽', '🎉', '🏆', '🥳', '🇪🇨', '✨', '🔥', '⭐'];
  for (let i = 0; i < 50; i++) {
    const s = document.createElement('span');
    s.textContent = emojis[Math.floor(Math.random() * emojis.length)];
    s.style.left = (Math.random() * 100) + '%';
    s.style.animationDuration = (1.8 + Math.random() * 1.8) + 's';
    s.style.animationDelay = (Math.random() * 0.5) + 's';
    s.style.fontSize = (16 + Math.random() * 18) + 'px';
    cont.appendChild(s);
  }
  document.body.appendChild(cont);
  setTimeout(() => cont.remove(), 4200);
}

/* ----------------------------------------------------------------
   MOTOR DE PUNTOS (1 punto por acertar L / E / V)
   ---------------------------------------------------------------- */
function puntosDePartido(pred, p) {
  if (!p.jugado || !p.resultado) return null;   // aún no hay resultado
  if (!pred) return 0;                           // no pronosticó
  return pred === p.resultado ? (estado.config.puntos.acierto || 1) : 0;
}
function puntosEnPartidos(jugadorId, lista) {
  const pr = estado.predicciones[jugadorId];
  if (!pr) return 0;
  let total = 0;
  lista.forEach(p => { const x = puntosDePartido(pr.partidos[p.id], p); if (x != null) total += x; });
  return total;
}
function puntosTotales(jugadorId) { return puntosEnPartidos(jugadorId, estado.partidos); }
function puntosDeFase(jugadorId, faseId) { return puntosEnPartidos(jugadorId, partidosDeFase(faseId)); }
function aciertosDe(jugadorId) {
  const pr = estado.predicciones[jugadorId];
  if (!pr) return 0;
  let n = 0;
  estado.partidos.forEach(p => { if (p.jugado && p.resultado && pr.partidos[p.id] === p.resultado) n++; });
  return n;
}
function tablaPosiciones(faseId) {
  return estado.jugadores
    .map(j => ({ jugador: j, puntos: (faseId && faseId !== 'total') ? puntosDeFase(j.id, faseId) : puntosTotales(j.id), aciertos: aciertosDe(j.id) }))
    .sort((a, b) => b.puntos - a.puntos || b.aciertos - a.aciertos || a.jugador.nombre.localeCompare(b.jugador.nombre));
}
function posicionDe(jugadorId) { return tablaPosiciones().findIndex(x => x.jugador.id === jugadorId) + 1; }
function premioBote() { return (estado.config.montoApuesta || 0) * estado.jugadores.length; }
function premioFase(faseId) { return (faseInfo(faseId).monto || 0) * estado.jugadores.length; }
function premioTotal() { return fasesCfg().reduce((s, f) => s + (f.monto || 0), 0) * estado.jugadores.length; }

/* ----------------------------------------------------------------
   VISTAS
   ---------------------------------------------------------------- */
const VISTAS = { inicio: vistaInicio, calendario: vistaCalendario, partidos: vistaPartidos, posiciones: vistaPosiciones, bote: vistaBote, admin: vistaAdmin };

function vistaInicio() {
  const yo = usuario();
  const pr = estado.predicciones[yo.id] || { partidos: {} };
  const proximos = estado.partidos.filter(p => !partidoBloqueado(p)).sort((a, b) => fechaEc(a.fecha) - fechaEc(b.fecha)).slice(0, 3);
  const faltan = estado.partidos.filter(p => !partidoBloqueado(p) && !pr.partidos[p.id]).length;

  return `
    <div class="aviso info"><span class="ico">👋</span>
      <div>¡Hola, <strong>${escapar(yo.nombre)}</strong>! Pronostica <strong>quién gana</strong> (o empate) en cada partido. Cada acierto vale <strong>1 punto</strong>.</div></div>
    <div class="resumen">
      <div class="stat azul"><div class="ico-fondo">🏅</div><div class="etq">Tu posición</div><div class="val">${posicionDe(yo.id)}º <span style="font-size:1rem;color:var(--gris)">de ${estado.jugadores.length}</span></div></div>
      <div class="stat"><div class="ico-fondo">⭐</div><div class="etq">Tus puntos</div><div class="val">${puntosTotales(yo.id)}</div></div>
      <div class="stat dorada"><div class="ico-fondo">💰</div><div class="etq">Premio total</div><div class="val">${formatMoneda(premioTotal())}</div></div>
      <div class="stat roja"><div class="ico-fondo">📝</div><div class="etq">Por pronosticar</div><div class="val">${faltan}</div></div>
    </div>
    <div class="tarjeta">
      <div class="tarjeta-titulo">⚽ Próximos partidos</div>
      ${proximos.length === 0 ? '<p class="texto-mini">No hay partidos próximos.</p>' : proximos.map(p => tarjetaResumenPartido(p, yo.id)).join('')}
      <div class="mt8 centro"><button class="boton secundario pequeno" data-accion="ir" data-vista="partidos">Ver todos y pronosticar →</button></div>
    </div>`;
}
function tarjetaResumenPartido(p, jugadorId) {
  const pred = (estado.predicciones[jugadorId] || {}).partidos ? estado.predicciones[jugadorId].partidos[p.id] : null;
  return `<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--linea)">
      <div><div style="font-weight:700">${getEquipo(p.local).bandera} ${nombreEquipo(p.local)} <span style="color:var(--gris)">vs</span> ${nombreEquipo(p.visita)} ${getEquipo(p.visita).bandera}</div>
        <div class="texto-mini">${formatFecha(p.fecha)} · Grupo ${p.grupo}</div></div>
      <span class="chip ${pred ? 'grupo' : ''}">${pred ? '✓ ' + textoResultado(p, pred) : 'Sin pronóstico'}</span></div>`;
}

function vistaPartidos() {
  const yo = usuario();
  const pr = estado.predicciones[yo.id] || { partidos: {} };
  const { total, hechos } = progresoPredicciones();
  const pct = total ? Math.round(hechos / total * 100) : 0;
  const msg = total === 0 ? 'No hay partidos abiertos por ahora.' : (hechos === total ? '¡Listo! Pronosticaste todos 🎉' : (hechos === 0 ? '¡Dale, empieza a pronosticar! 🎯' : `Llevas ${hechos} de ${total}`));
  const emoji = pct === 100 ? '🏆' : (pct >= 66 ? '🔥' : (pct >= 33 ? '💪' : '🎯'));
  const fases = fasesCfg();
  if (!fases.find(f => f.id === faseSel)) faseSel = 'grupos';
  const fchips = fases.map(f => `<button class="fchip ${f.id === faseSel ? 'sel' : ''} ${f.abierta ? '' : 'cerrada'}" data-accion="fase" data-f="${f.id}">${escapar(f.nombre)}${f.abierta ? '' : ' 🔒'}</button>`).join('');

  let html = `<div class="titulo-vista">Partidos y pronósticos</div>
    <div class="subtitulo-vista">Toca quién crees que gana. 1 punto por acierto.</div>
    <div class="progreso-card">
      <div class="progreso-top"><span>${emoji} ${msg}</span><strong>${pct}%</strong></div>
      <div class="progreso-barra"><div class="progreso-fill" style="width:${pct}%"></div></div>
    </div>
    <div class="fases-nav">${fchips}</div>`;

  const f = faseInfo(faseSel);
  const partidosF = partidosDeFase(faseSel);

  if (!f.abierta) {
    html += `<div class="aviso info"><span class="ico">🔒</span><div>La fase <strong>${escapar(f.nombre)}</strong> aún no está abierta. El organizador la abrirá cuando corresponda.</div></div>`;
  } else if (partidosF.length === 0) {
    html += `<div class="aviso info"><span class="ico">⏳</span><div>Aún no se agregan los partidos de <strong>${escapar(f.nombre)}</strong>. Aparecerán cuando se definan los equipos.</div></div>`;
  } else if (faseSel === 'grupos') {
    const grupos = {};
    partidosF.forEach(p => { (grupos[p.grupo] = grupos[p.grupo] || []).push(p); });
    const claves = Object.keys(grupos).sort();
    const completoG = g => { const ab = grupos[g].filter(p => !partidoBloqueado(p)); return ab.length > 0 && ab.every(p => pr.partidos[p.id]); };
    if (!grupoSel || !grupos[grupoSel]) grupoSel = claves.find(g => !completoG(g)) || claves[0];
    const chips = claves.map(g => `<button class="gchip ${g === grupoSel ? 'sel' : ''} ${completoG(g) ? 'ok' : ''}" data-accion="grupo" data-g="${g}">${g}${completoG(g) ? ' ✓' : ''}</button>`).join('');
    const ps = grupos[grupoSel].sort((a, b) => (a.orden || 0) - (b.orden || 0));
    const ab = ps.filter(p => !partidoBloqueado(p)); const he = ab.filter(p => pr.partidos[p.id]).length; const okSel = ab.length > 0 && he === ab.length;
    html += `<div class="grupos-nav">${chips}</div><div class="grupo-titulo">📋 Grupo ${grupoSel} <span class="grupo-cont ${okSel ? 'ok' : ''}">${he}/${ab.length}${okSel ? ' ✓' : ''}</span></div>`;
    ps.forEach(p => { html += filaPartido(p, pr.partidos[p.id]); });
  } else {
    let rondaAct = '';
    partidosF.slice().sort((a, b) => (a.orden || 0) - (b.orden || 0)).forEach(p => {
      const r = p.ronda || f.nombre;
      if (r !== rondaAct) { rondaAct = r; html += `<div class="grupo-titulo">🏆 ${escapar(r)}</div>`; }
      html += filaPartido(p, pr.partidos[p.id]);
    });
  }
  return html;
}
function filaPartido(p, pred) {
  const bloqueado = partidoBloqueado(p);
  const tieneRes = !!(p.jugado && p.resultado);
  const fijo = bloqueado || tieneRes;
  const chip = tieneRes ? '<span class="chip jugado">Finalizado</span>' : (bloqueado ? '<span class="chip live">En juego</span>' : '<span class="chip grupo">Abierto</span>');

  const opt = (r, txt) => {
    const sel = pred === r;
    const cls = (sel ? 'sel ' : '') + (tieneRes && p.resultado === r ? 'es-resultado ' : '');
    return `<button class="pred-btn ${cls}" ${fijo ? 'disabled' : `data-accion="pred" data-partido="${p.id}" data-r="${r}"`}>${sel ? '<span class="check">✓</span> ' : ''}${txt}</button>`;
  };
  const ko = esKnockout(p);
  const control = `<div class="pred-1x2${ko ? ' dos' : ''}">
    ${opt('L', `${getEquipo(p.local).bandera} ${nombreEquipo(p.local)}`)}
    ${ko ? '' : opt('E', '🤝 Empate')}
    ${opt('V', `${nombreEquipo(p.visita)} ${getEquipo(p.visita).bandera}`)}
  </div>`;

  let pie = '';
  if (tieneRes) {
    const acerto = pred && pred === p.resultado;
    pie = `<div class="pred-pie"><span>${ko ? 'Avanzó' : 'Resultado'}: <strong>${textoResultado(p, p.resultado)}</strong>${pred ? ` · tu pronóstico: ${textoResultado(p, pred)}` : ' · no pronosticaste'}</span>${pred ? (acerto ? '<span class="badge-puntos gano">✓ +1</span>' : '<span class="badge-puntos cero">+0</span>') : ''}</div>`;
  } else if (bloqueado) {
    pie = `<div class="pred-pie"><span>El partido empezó · pronóstico cerrado${pred ? `: <strong>${textoResultado(p, pred)}</strong>` : ''}</span><span class="candado">🔒</span></div>`;
  }

  const quitar = (pred && !fijo) ? `<div class="pred-quitar"><button class="link-quitar" data-accion="pred-quitar" data-partido="${p.id}">Quitar mi pronóstico</button></div>` : '';
  return `<div class="partido compacto">
      <div class="partido-cab"><span>${formatFecha(p.fecha)}</span>${chip}</div>
      ${control}
      ${quitar}
      ${pie}</div>`;
}

function vistaPosiciones() {
  const fases = fasesCfg();
  const opciones = [{ id: 'total', nombre: 'General' }].concat(fases.map(f => ({ id: f.id, nombre: f.nombre })));
  if (!opciones.find(o => o.id === faseTabla)) faseTabla = 'total';
  const chips = opciones.map(o => `<button class="fchip ${o.id === faseTabla ? 'sel' : ''}" data-accion="fase-tabla" data-f="${o.id}">${escapar(o.nombre)}</button>`).join('');
  const tabla = tablaPosiciones(faseTabla);
  const medallas = ['🥇', '🥈', '🥉'];
  const filas = tabla.map((row, i) => {
    const j = row.jugador, esYo = j.id === estado.usuarioActual;
    return `<tr class="${esYo ? 'fila-yo' : ''}">
        <td class="pos">${medallas[i] || (i + 1)}</td>
        <td><div class="jug-celda"><div class="avatar" style="background:${j.color}">${escapar(j.nombre.charAt(0))}</div>
          <div><div style="font-weight:700">${escapar(j.nombre)}${esYo ? ' <span class="chip grupo">tú</span>' : ''}</div>
          <div class="texto-mini">${row.aciertos} acierto(s)</div></div></div></td>
        <td class="pts-celda">${row.puntos}</td></tr>`;
  }).join('');
  return `<div class="titulo-vista">Tabla de posiciones</div>
    <div class="subtitulo-vista">1 punto por acierto. ${faseTabla === 'total' ? 'Ranking general (todas las fases).' : 'Ranking solo de esta fase.'}</div>
    <div class="fases-nav">${chips}</div>
    <div class="tarjeta"><table class="tabla-pos"><thead><tr><th>#</th><th>Jugador</th><th style="text-align:right">Puntos</th></tr></thead><tbody>${filas}</tbody></table></div>`;
}

function vistaFinal() {
  const yo = usuario();
  const pr = estado.predicciones[yo.id] || {};
  const opts = sel => Object.keys(EQUIPOS).map(id => `<option value="${id}" ${sel === id ? 'selected' : ''}>${getEquipo(id).bandera} ${getEquipo(id).nombre}</option>`).join('');
  const rf = estado.resultadoFinal, definido = rf.campeon || rf.subcampeon;
  return `<div class="titulo-vista">Fase final 🏆</div>
    <div class="subtitulo-vista">Elige al campeón y subcampeón del Mundial. Cada acierto suma 1 punto.</div>
    <div class="pick-final">
      <div class="pick-card campeon"><div class="emoji">🏆</div><h4>Campeón</h4><div class="texto-mini">+${estado.config.puntos.campeon || 0} pt si aciertas</div>
        <select data-accion="pick-final" data-tipo="campeon"><option value="">— Elegir —</option>${opts(pr.campeon)}</select></div>
      <div class="pick-card"><div class="emoji">🥈</div><h4>Subcampeón</h4><div class="texto-mini">+${estado.config.puntos.subcampeon || 0} pt si aciertas</div>
        <select data-accion="pick-final" data-tipo="subcampeon"><option value="">— Elegir —</option>${opts(pr.subcampeon)}</select></div></div>
    ${definido
      ? `<div class="aviso demo" style="margin-top:18px"><span class="ico">🏁</span><div>Resultado oficial: Campeón <strong>${rf.campeon ? chipEquipo(rf.campeon) : '—'}</strong>, Subcampeón <strong>${rf.subcampeon ? chipEquipo(rf.subcampeon) : '—'}</strong>.</div></div>`
      : `<div class="aviso info" style="margin-top:18px"><span class="ico">⏳</span><div>Al terminar el Mundial, el organizador define el campeón y subcampeón, y se suman los puntos automáticamente.</div></div>`}
    <div class="seccion-sep">🔮 Lo que eligió cada jugador</div>
    <div class="tarjeta">${estado.jugadores.map(j => { const p = estado.predicciones[j.id] || {}; return `<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--linea)"><span style="font-weight:700">${escapar(j.nombre)}</span><span class="texto-mini">🏆 ${p.campeon ? chipEquipo(p.campeon) : '—'} · 🥈 ${p.subcampeon ? chipEquipo(p.subcampeon) : '—'}</span></div>`; }).join('')}</div>`;
}

function vistaBote() {
  const fases = fasesCfg();
  return `<div class="titulo-vista">Premios 💰</div>
    <div class="subtitulo-vista">Cada fase tiene su propio premio (dato informativo). Los pagos se hacen entre ustedes.</div>
    <div class="bote-hero"><div class="etq">PREMIO TOTAL</div><div class="monto">${formatMoneda(premioTotal())}</div>
      <div class="nota">${estado.jugadores.length} jugador(es) en juego</div></div>
    ${fases.map(f => {
      const lider = tablaPosiciones(f.id)[0];
      const con = lider && lider.puntos > 0;
      return `<div class="tarjeta"><div class="tarjeta-titulo">${f.abierta ? '🔓' : '🔒'} ${escapar(f.nombre)} · ${formatMoneda(premioFase(f.id))}</div>
        ${con ? `<div style="display:flex;align-items:center;gap:12px"><div class="avatar" style="background:${lider.jugador.color};width:42px;height:42px;font-size:1rem">${escapar(lider.jugador.nombre.charAt(0))}</div><div><div style="font-weight:800">🏅 ${escapar(lider.jugador.nombre)}</div><div class="texto-mini">va ganando esta fase · ${lider.puntos} pts</div></div></div>` : `<p class="texto-mini">Aún sin puntos en esta fase.</p>`}</div>`;
    }).join('')}`;
}

function vistaAdmin() {
  if (!esOrganizador()) return `<div class="titulo-vista">Panel del organizador</div><div class="aviso info"><span class="ico">🔒</span><div>Esta sección es solo para el organizador de la polla.</div></div>`;
  const cfg = estado.config;
  const fases = fasesCfg();
  if (!fases.find(f => f.id === faseSel)) faseSel = 'grupos';
  const fAct = faseInfo(faseSel);
  const opts = sel => '<option value="">—</option>' + Object.keys(EQUIPOS).map(id => `<option value="${id}" ${sel === id ? 'selected' : ''}>${getEquipo(id).bandera} ${getEquipo(id).nombre}</option>`).join('');
  const fchipsR = fases.map(ff => `<button class="fchip ${ff.id === faseSel ? 'sel' : ''}" data-accion="fase" data-f="${ff.id}">${escapar(ff.nombre)}</button>`).join('');
  const rbtns = p => { const ko = esKnockout(p); const b = (r, txt) => `<button class="res-ico ${p.resultado === r ? 'sel' : ''}" data-accion="res" data-partido="${p.id}" data-r="${r}" title="${escapar(textoResultado(p, r))}">${txt}</button>`; return `<div class="admin-res-btns">${b('L', getEquipo(p.local).bandera)}${ko ? '' : b('E', '🤝')}${b('V', getEquipo(p.visita).bandera)}${p.resultado ? `<button class="res-ico limpiar" data-accion="res" data-partido="${p.id}" data-r="" title="Borrar resultado">🗑️</button>` : ''}</div>`; };
  const filaRes = p => `<div class="admin-res"><div class="admin-res-info"><span>${p.fecha ? formatFecha(p.fecha) : (p.ronda || '')}</span><div class="admin-res-eq">${getEquipo(p.local).bandera} <strong>${nombreEquipo(p.local)}</strong> <span class="texto-mini">vs</span> <strong>${nombreEquipo(p.visita)}</strong> ${getEquipo(p.visita).bandera}</div></div>${rbtns(p)}</div>`;
  const partidosFA = partidosDeFase(faseSel);
  let resBody = '';
  if (partidosFA.length === 0) {
    resBody = `<p class="texto-mini centro" style="padding:14px">No hay partidos en esta fase.${faseSel !== 'grupos' ? ' Agrégalos abajo.' : ''}</p>`;
  } else if (faseSel === 'grupos') {
    const gr = {}; partidosFA.forEach(p => { (gr[p.grupo] = gr[p.grupo] || []).push(p); });
    const cl = Object.keys(gr).sort();
    const okR = g => gr[g].every(p => p.resultado);
    if (!grupoSel || !gr[grupoSel]) grupoSel = cl.find(g => !okR(g)) || cl[0];
    resBody = `<div class="grupos-nav">${cl.map(g => `<button class="gchip ${g === grupoSel ? 'sel' : ''} ${okR(g) ? 'ok' : ''}" data-accion="grupo" data-g="${g}">${g}${okR(g) ? ' ✓' : ''}</button>`).join('')}</div>`;
    resBody += gr[grupoSel].sort((a, b) => (a.orden || 0) - (b.orden || 0)).map(filaRes).join('');
  } else {
    let ra = '';
    resBody = partidosFA.slice().sort((a, b) => (a.orden || 0) - (b.orden || 0)).map(p => { let h = ''; const r = p.ronda || fAct.nombre; if (r !== ra) { ra = r; h += `<div class="grupo-titulo">🏆 ${escapar(r)}</div>`; } return h + filaRes(p) + `<div style="text-align:right;margin:-4px 0 6px"><button class="link-quitar" data-accion="quitar-partido" data-partido="${p.id}">✕ quitar partido</button></div>`; }).join('');
  }
  const fasesCard = `<div class="tarjeta"><div class="tarjeta-titulo">🥇 Fases del concurso</div><p class="texto-mini" style="margin-bottom:10px">Abre cada fase cuando corresponda. Mientras esté cerrada, nadie puede pronosticar esos partidos.</p>${fases.map(ff => `<div class="fase-fila"><div><strong>${escapar(ff.nombre)}</strong> <span class="texto-mini">· ${partidosDeFase(ff.id).length} partidos · premio ${formatMoneda(premioFase(ff.id))}</span></div><div class="fase-acc"><label class="texto-mini">$<input type="number" min="0" step="0.5" value="${ff.monto}" data-accion="fase-monto" data-f="${ff.id}" style="width:54px"></label><button class="boton ${ff.abierta ? 'secundario' : 'dorado'} pequeno" data-accion="fase-toggle" data-f="${ff.id}">${ff.abierta ? '🔓 Abierta' : '🔒 Cerrada'}</button></div></div>`).join('')}</div>`;
  const addCard = `<div class="tarjeta"><div class="tarjeta-titulo">➕ Agregar partido (eliminatoria / final)</div><p class="texto-mini" style="margin-bottom:10px">Cuando se definan los equipos, agrégalos aquí. Se predice quién avanza.</p><div class="fila-campos"><div class="campo"><label>Fase</label><select id="add-fase"><option value="eliminatorias">Eliminatorias</option><option value="final">Final</option></select></div><div class="campo"><label>Ronda</label><input type="text" id="add-ronda" placeholder="Octavos, Cuartos, Semifinal…"></div></div><div class="fila-campos"><div class="campo"><label>Local</label><select id="add-local">${opts('')}</select></div><div class="campo"><label>Visitante</label><select id="add-visita">${opts('')}</select></div></div><div class="campo"><label>Fecha y hora (Ecuador)</label><input type="datetime-local" id="add-fecha"></div><button class="boton" data-accion="agregar-partido">➕ Agregar partido</button></div>`;

  return `<div class="titulo-vista">Panel del organizador 🛠️</div>
    <div class="subtitulo-vista">Abre las fases, marca resultados y administra a los jugadores.</div>
    ${fasesCard}
    <div class="tarjeta"><div class="tarjeta-titulo">⚽ Resultados</div><p class="texto-mini" style="margin-bottom:10px">Toca la bandera del <strong>${faseSel === 'grupos' ? 'ganador (o 🤝 empate)' : 'que avanza'}</strong>. Los puntos se calculan al instante.</p><div class="fases-nav">${fchipsR}</div>${resBody}<div class="boton-fila mt8"><button class="boton dorado pequeno" data-accion="demo-resultados">Resultados de ejemplo</button> <button class="boton secundario pequeno" data-accion="borrar-resultados">Borrar resultados</button></div></div>
    ${addCard}
    <div class="tarjeta"><div class="tarjeta-titulo">🔄 Fixture oficial</div>
      <p class="texto-mini">Recarga los 72 partidos oficiales del Mundial 2026. No borra los pronósticos.</p>
      <div class="mt8"><button class="boton secundario" data-accion="re-sembrar">🔄 Re-cargar fixture oficial</button></div></div>
    <div class="tarjeta"><div class="tarjeta-titulo">⚙️ Configuración</div>
      <div class="campo"><label>Nombre de la polla</label><input type="text" value="${escapar(cfg.nombrePolla)}" data-accion="cfg" data-campo="nombrePolla"></div>
      <div class="fila-campos"><div class="campo"><label>Código de invitación</label><input type="text" value="${escapar(cfg.codigoInvitacion)}" data-accion="cfg" data-campo="codigoInvitacion"></div>
        <div class="campo"><label>Puntos por acierto</label><input type="number" min="1" value="${cfg.puntos.acierto}" data-accion="cfg-pts" data-campo="acierto"></div></div></div>
    <div class="tarjeta"><div class="tarjeta-titulo">👥 Jugadores</div>
      <ul class="lista-jug">${estado.jugadores.map(j => `<li><div class="avatar" style="background:${j.color}">${escapar(j.nombre.charAt(0))}</div>
        <span class="nombre">${escapar(j.nombre)} ${j.esOrganizador ? '<span class="chip grupo">organizador</span>' : ''}</span>
        ${!j.esOrganizador ? `<button class="boton secundario pequeno" data-accion="hacer-org" data-jug="${j.id}">Hacer organizador</button>` : ''}
        ${j.id !== estado.usuarioActual ? `<button class="boton peligro pequeno" data-accion="quitar-jug" data-jug="${j.id}">Quitar</button>` : ''}</li>`).join('')}</ul>
      <p class="texto-mini mt8">Los jugadores se registran solos con su correo y contraseña. Aquí puedes hacerlos organizador o quitarlos.</p></div>
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
    <div class="mt8 centro"><button class="boton secundario pequeno" data-accion="ir" data-vista="partidos">✍️ Hacer mis pronósticos →</button></div>`;
}

function filaCalendario(p, ahora) {
  const yo = usuario();
  const pred = yo && estado.predicciones[yo.id] ? estado.predicciones[yo.id].partidos[p.id] : null;
  const ts = fechaEc(p.fecha).getTime();
  const enVivo = !p.jugado && ts <= ahora && (ahora - ts) < 2.5 * 3600 * 1000;

  let col;
  if (p.jugado && p.resultado) col = `<span class="cal-score">${p.resultado === 'E' ? '🤝' : (p.resultado === 'L' ? getEquipo(p.local).bandera : getEquipo(p.visita).bandera)}</span>`;
  else if (enVivo) col = `<span class="chip live">EN VIVO</span>`;
  else col = `<span class="cal-hora">${horaEc(p.fecha)}</span>`;

  const predTxt = pred ? `<span class="cal-pred">Tu pronóstico: ${textoResultado(p, pred)}</span>` : '';
  const esEcu = p.local === 'ecu' || p.visita === 'ecu';
  return `<div class="cal-partido ${esEcu ? 'cal-ecu' : ''}">
    <div class="cal-col-hora">${col}<div class="cal-grupo">Grupo ${p.grupo}</div></div>
    <div class="cal-col-eq">
      <div class="cal-eq"><span>${getEquipo(p.local).bandera}</span> ${nombreEquipo(p.local)}</div>
      <div class="cal-eq"><span>${getEquipo(p.visita).bandera}</span> ${nombreEquipo(p.visita)}</div>
      ${predTxt}
    </div></div>`;
}

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
  { id: 'inicio', ico: '🏠', txt: 'Inicio' }, { id: 'calendario', ico: '📅', txt: 'Calendario', m: 'Agenda' },
  { id: 'partidos', ico: '⚽', txt: 'Partidos' }, { id: 'posiciones', ico: '🏅', txt: 'Posiciones', m: 'Tabla' },
  { id: 'bote', ico: '💰', txt: 'Premio' }, { id: 'admin', ico: '🛠️', txt: 'Organizador', m: 'Admin' },
];

function render() {
  const yo = usuario();
  if (!yo) { Auth.salir(); return; }

  document.getElementById('nombre-polla').textContent = estado.config.nombrePolla;
  document.getElementById('badge-conexion').innerHTML = Datos.online ? '🟢 En línea' : '💾 Local';
  document.getElementById('usuario-chip').innerHTML = `<span class="avatar mini" style="background:${yo.color}">${escapar(yo.nombre.charAt(0))}</span><span>${escapar(yo.nombre)}</span>`;

  const tabs = TABS.filter(t => t.id !== 'admin' || esOrganizador());
  document.getElementById('nav-inner').innerHTML = tabs.map(t => `<button data-accion="ir" data-vista="${t.id}" class="${estado.vista === t.id ? 'activa' : ''}"><span class="ico">${t.ico}</span><span class="t-full">${t.txt}</span><span class="t-corto">${t.m || t.txt}</span></button>`).join('');

  if (estado.vista === 'admin' && !esOrganizador()) estado.vista = 'inicio';
  document.getElementById('contenido').innerHTML = (VISTAS[estado.vista] || vistaInicio)();

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
  if (a.startsWith('login-')) return;

  switch (a) {
    case 'ir': estado.vista = el.dataset.vista; render(); break;
    case 'filtro-cal': filtroCal = el.dataset.filtro; render(); break;
    case 'grupo': grupoSel = el.dataset.g; render(); break;
    case 'fase': faseSel = el.dataset.f; grupoSel = null; render(); break;
    case 'fase-tabla': faseTabla = el.dataset.f; render(); break;
    case 'salir': Auth.salir(); break;

    case 'pred': {  // el jugador toca L / E / V (solo fija; no quita)
      const p = estado.partidos.find(x => x.id === el.dataset.partido);
      if (!p || partidoBloqueado(p)) return;
      const pr = estado.predicciones[estado.usuarioActual] || (estado.predicciones[estado.usuarioActual] = { partidos: {}, campeon: null, subcampeon: null });
      const antes = progresoPredicciones();
      const eraNuevo = !pr.partidos[p.id];
      const rect = el.getBoundingClientRect();
      pr.partidos[p.id] = el.dataset.r;
      sync(Datos.guardarPrediccion(estado.usuarioActual, p.id));
      const desp = progresoPredicciones();
      const completoAhora = desp.total > 0 && desp.hechos === desp.total && antes.hechos < antes.total;
      render();
      if (completoAhora) festejo();
      else if (eraNuevo) chispitas(rect);
      break;
    }
    case 'pred-quitar': {
      const p = estado.partidos.find(x => x.id === el.dataset.partido);
      if (!p || partidoBloqueado(p)) return;
      const pr = estado.predicciones[estado.usuarioActual];
      if (pr) { pr.partidos[p.id] = null; sync(Datos.guardarPrediccion(estado.usuarioActual, p.id)); }
      render(); break;
    }
    case 'res': {   // el organizador marca el resultado
      if (!esOrganizador()) return;
      const p = estado.partidos.find(x => x.id === el.dataset.partido); if (!p) return;
      const r = el.dataset.r;
      p.resultado = r || null;
      p.jugado = !!r;
      sync(Datos.guardarPartido(p.id)); render(); break;
    }
    case 'hacer-org': {
      if (!esOrganizador()) return;
      const j = getJugador(el.dataset.jug); if (j) { j.esOrganizador = true; sync(Datos.guardarJugador(j.id)); }
      render(); break;
    }
    case 'demo-resultados': {
      const ej = { p1: 'L', p2: 'V', p3: 'E', p7: 'L', p8: 'V', p13: 'L', p14: 'L' };
      estado.partidos.forEach(p => { if (ej[p.id]) { p.resultado = ej[p.id]; p.jugado = true; sync(Datos.guardarPartido(p.id)); } });
      render(); break;
    }
    case 'borrar-resultados':
      estado.partidos.forEach(p => { if (p.jugado || p.resultado) { p.jugado = false; p.resultado = null; sync(Datos.guardarPartido(p.id)); } });
      estado.resultadoFinal = { campeon: null, subcampeon: null }; sync(Datos.guardarConfig()); render(); break;

    case 'agregar-jug': {
      const input = document.getElementById('nuevo-jugador');
      const nombre = (input.value || '').trim();
      if (!nombre) { input.focus(); return; }
      const colores = ['#0540A6', '#E4002B', '#E6A700', '#0A8754', '#7c3aed', '#0891b2', '#be123c', '#c2410c'];
      Promise.resolve(Datos.crearJugador({ nombre, color: colores[estado.jugadores.length % colores.length], esOrganizador: false, pin: '' })).then(render).catch(err => console.warn(err));
      break;
    }
    case 'quitar-jug':
      if (confirm('¿Quitar a este jugador y sus pronósticos?')) { sync(Datos.eliminarJugador(el.dataset.jug)); render(); }
      break;
    case 'reiniciar':
      if (!Datos.online && confirm('Esto borra TODO en este equipo. ¿Seguro?')) { Datos.reiniciarLocal(); estado.vista = 'inicio'; render(); }
      break;
    case 're-sembrar':
      if (!esOrganizador()) return;
      if (confirm('¿Re-cargar los 72 partidos oficiales? No borra los pronósticos.')) {
        Promise.resolve(Datos.reSembrarPartidos()).then(() => { estado.vista = 'partidos'; faseSel = 'grupos'; render(); }).catch(err => console.warn(err));
      }
      break;
    case 'fase-toggle': {
      if (!esOrganizador()) return;
      const f = faseInfo(el.dataset.f); f.abierta = !f.abierta;
      sync(Datos.guardarConfig()); render(); break;
    }
    case 'agregar-partido': {
      if (!esOrganizador()) return;
      const fase = document.getElementById('add-fase').value;
      const ronda = (document.getElementById('add-ronda').value || '').trim();
      const local = document.getElementById('add-local').value;
      const visita = document.getElementById('add-visita').value;
      const fechaIn = document.getElementById('add-fecha').value;
      if (!local || !visita || local === visita) { alert('Elige local y visitante (distintos).'); return; }
      const p = { id: 'k' + Date.now().toString(36), orden: 1000 + estado.partidos.length, grupo: null, fase, ronda: ronda || faseInfo(fase).nombre, local, visita, fecha: fechaIn || '', estadio: '', jugado: false, resultado: null, golesLocal: null, golesVisita: null };
      Promise.resolve(Datos.crearPartido(p)).then(() => { faseSel = fase; render(); }).catch(err => console.warn(err));
      break;
    }
    case 'quitar-partido':
      if (!esOrganizador()) return;
      if (confirm('¿Quitar este partido y sus pronósticos?')) { sync(Datos.eliminarPartido(el.dataset.partido)); render(); }
      break;
  }
});

document.addEventListener('change', (e) => {
  const el = e.target.closest('[data-accion]');
  if (!el) return;
  const a = el.dataset.accion;

  switch (a) {
    case 'pick-final': {
      const pr = estado.predicciones[estado.usuarioActual] || (estado.predicciones[estado.usuarioActual] = { partidos: {}, campeon: null, subcampeon: null });
      pr[el.dataset.tipo] = el.value || null;
      sync(Datos.guardarPickFinal(estado.usuarioActual)); render(); break;
    }
    case 'final-real': {
      if (!esOrganizador()) return;
      estado.resultadoFinal[el.dataset.tipo] = el.value || null; sync(Datos.guardarConfig()); render(); break;
    }
    case 'cfg': {
      if (!esOrganizador()) return;
      const campo = el.dataset.campo;
      estado.config[campo] = (el.type === 'number') ? (parseFloat(el.value) || 0) : el.value;
      if (campo === 'nombrePolla') document.getElementById('nombre-polla').textContent = el.value;
      sync(Datos.guardarConfig()); break;
    }
    case 'cfg-pts':
      if (!esOrganizador()) return;
      estado.config.puntos[el.dataset.campo] = parseInt(el.value, 10) || 0; sync(Datos.guardarConfig()); break;
    case 'fase-monto': {
      if (!esOrganizador()) return;
      const f = faseInfo(el.dataset.f); f.monto = parseFloat(el.value) || 0;
      sync(Datos.guardarConfig()); break;
    }
  }
});

/* ---- Cinta de banderas (temática mundialista) ---- */
function pintarBanderas() {
  const flags = Object.keys(EQUIPOS).map(id => EQUIPOS[id].bandera);
  const fila = flags.concat(flags).map(b => `<span>${b}</span>`).join('');
  const cinta = document.getElementById('cinta-banderas');
  if (cinta) cinta.innerHTML = fila;
}

/* ---- Arranque ---- */
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
