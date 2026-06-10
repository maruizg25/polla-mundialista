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
  resultadoFinal: { campeon: null, subcampeon: null },
  usuarioActual: null,
  vista: 'inicio',
};
let filtroCal = 'todos';
let cdInterval = null;

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
function puntosTotales(jugadorId) {
  const pr = estado.predicciones[jugadorId];
  if (!pr) return 0;
  let total = 0;
  estado.partidos.forEach(p => { const x = puntosDePartido(pr.partidos[p.id], p); if (x != null) total += x; });
  const rf = estado.resultadoFinal;
  if (rf.campeon && pr.campeon === rf.campeon) total += (estado.config.puntos.campeon || 0);
  if (rf.subcampeon && pr.subcampeon === rf.subcampeon) total += (estado.config.puntos.subcampeon || 0);
  return total;
}
function aciertosDe(jugadorId) {
  const pr = estado.predicciones[jugadorId];
  if (!pr) return 0;
  let n = 0;
  estado.partidos.forEach(p => { if (p.jugado && p.resultado && pr.partidos[p.id] === p.resultado) n++; });
  return n;
}
function tablaPosiciones() {
  return estado.jugadores
    .map(j => ({ jugador: j, puntos: puntosTotales(j.id), aciertos: aciertosDe(j.id) }))
    .sort((a, b) => b.puntos - a.puntos || b.aciertos - a.aciertos || a.jugador.nombre.localeCompare(b.jugador.nombre));
}
function posicionDe(jugadorId) { return tablaPosiciones().findIndex(x => x.jugador.id === jugadorId) + 1; }
function premioBote() { return (estado.config.montoApuesta || 0) * estado.jugadores.length; }

/* ----------------------------------------------------------------
   VISTAS
   ---------------------------------------------------------------- */
const VISTAS = { inicio: vistaInicio, calendario: vistaCalendario, partidos: vistaPartidos, posiciones: vistaPosiciones, final: vistaFinal, bote: vistaBote, admin: vistaAdmin };

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
      <div class="stat dorada"><div class="ico-fondo">💰</div><div class="etq">Premio (bote)</div><div class="val">${formatMoneda(premioBote())}</div></div>
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
  const grupos = {};
  estado.partidos.forEach(p => { (grupos[p.grupo] = grupos[p.grupo] || []).push(p); });

  let html = `<div class="titulo-vista">Partidos y pronósticos</div>
    <div class="subtitulo-vista">Toca quién crees que gana, o empate. 1 punto por acierto.</div>
    <div class="progreso-card">
      <div class="progreso-top"><span>${emoji} ${msg}</span><strong>${pct}%</strong></div>
      <div class="progreso-barra"><div class="progreso-fill" style="width:${pct}%"></div></div>
    </div>`;

  Object.keys(grupos).sort().forEach(g => {
    const ps = grupos[g].sort((a, b) => (a.orden || 0) - (b.orden || 0));
    const ab = ps.filter(p => !partidoBloqueado(p));
    const he = ab.filter(p => pr.partidos[p.id]).length;
    const okG = ab.length > 0 && he === ab.length;
    html += `<div class="grupo-titulo">📋 Grupo ${g} <span class="grupo-cont ${okG ? 'ok' : ''}">${he}/${ab.length}${okG ? ' ✓' : ''}</span></div>`;
    ps.forEach(p => { html += filaPartido(p, pr.partidos[p.id]); });
  });
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
  const control = `<div class="pred-1x2">
    ${opt('L', `${getEquipo(p.local).bandera} ${nombreEquipo(p.local)}`)}
    ${opt('E', '🤝 Empate')}
    ${opt('V', `${nombreEquipo(p.visita)} ${getEquipo(p.visita).bandera}`)}
  </div>`;

  let pie = '';
  if (tieneRes) {
    const acerto = pred && pred === p.resultado;
    pie = `<div class="pred-pie"><span>Resultado: <strong>${textoResultado(p, p.resultado)}</strong>${pred ? ` · tu pronóstico: ${textoResultado(p, pred)}` : ' · no pronosticaste'}</span>${pred ? (acerto ? '<span class="badge-puntos gano">✓ +1</span>' : '<span class="badge-puntos cero">+0</span>') : ''}</div>`;
  } else if (bloqueado) {
    pie = `<div class="pred-pie"><span>El partido empezó · pronóstico cerrado${pred ? `: <strong>${textoResultado(p, pred)}</strong>` : ''}</span><span class="candado">🔒</span></div>`;
  }

  const quitar = (pred && !fijo) ? `<div class="pred-quitar"><button class="link-quitar" data-accion="pred-quitar" data-partido="${p.id}">Quitar mi pronóstico</button></div>` : '';
  return `<div class="partido">
      <div class="partido-cab"><span>${formatFecha(p.fecha)} · ${escapar(p.estadio || '')}</span>${chip}</div>
      ${control}
      ${quitar}
      ${pie}</div>`;
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
          <div class="texto-mini">${row.aciertos} acierto(s)</div></div></div></td>
        <td class="pts-celda">${row.puntos}</td></tr>`;
  }).join('');
  return `<div class="titulo-vista">Tabla de posiciones</div>
    <div class="subtitulo-vista">1 punto por acertar el resultado. Quien más sume al final se lleva el premio.</div>
    <div class="tarjeta"><table class="tabla-pos"><thead><tr><th>#</th><th>Jugador</th><th style="text-align:right">Puntos</th></tr></thead><tbody>${filas}</tbody></table></div>
    <div class="aviso info"><span class="ico">ℹ️</span><div><strong>Cómo se gana:</strong> aciertas si pronosticas bien quién gana o si hay empate → <strong>1 punto</strong> por partido. Acertar campeón o subcampeón también suma.</div></div>`;
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
  const lider = tablaPosiciones()[0];
  return `<div class="titulo-vista">Premio 💰</div>
    <div class="subtitulo-vista">Dato informativo. Los pagos se hacen entre ustedes (efectivo o transferencia); la web solo lleva la cuenta.</div>
    <div class="bote-hero"><div class="etq">BOTE / PREMIO</div><div class="monto">${formatMoneda(premioBote())}</div>
      <div class="nota">${formatMoneda(estado.config.montoApuesta)} por jugador × ${estado.jugadores.length} jugador(es)</div></div>
    <div class="tarjeta"><div class="tarjeta-titulo">🏅 Va ganando</div>
      ${lider ? `<div style="display:flex;align-items:center;gap:12px"><div class="avatar" style="background:${lider.jugador.color};width:46px;height:46px;font-size:1.1rem">${escapar(lider.jugador.nombre.charAt(0))}</div>
        <div><div style="font-weight:800;font-size:1.1rem">${escapar(lider.jugador.nombre)}</div><div class="texto-mini">${lider.puntos} puntos · si terminara hoy se lleva ${formatMoneda(premioBote())}</div></div></div>` : '<p class="texto-mini">Aún no hay puntos.</p>'}</div>`;
}

function vistaAdmin() {
  if (!esOrganizador()) return `<div class="titulo-vista">Panel del organizador</div><div class="aviso info"><span class="ico">🔒</span><div>Esta sección es solo para el organizador de la polla.</div></div>`;
  const cfg = estado.config;
  const resultados = estado.partidos.slice().sort((a, b) => (a.orden || 0) - (b.orden || 0)).map(p => {
    const rb = (r, txt) => `<button class="res-btn2 ${p.resultado === r ? 'sel' : ''}" data-accion="res" data-partido="${p.id}" data-r="${r}">${txt}</button>`;
    return `<div class="admin-res">
        <div class="admin-res-info">${getEquipo(p.local).bandera} <strong>${nombreEquipo(p.local)}</strong> vs <strong>${nombreEquipo(p.visita)}</strong> ${getEquipo(p.visita).bandera} <span class="texto-mini">· Grupo ${p.grupo} · ${formatFecha(p.fecha)}</span></div>
        <div class="admin-res-btns">${rb('L', `✅ Gana ${nombreEquipo(p.local)}`)}${rb('E', '🤝 Empate')}${rb('V', `✅ Gana ${nombreEquipo(p.visita)}`)}${p.resultado ? `<button class="res-btn2 limpiar" data-accion="res" data-partido="${p.id}" data-r="">✕ Borrar</button>` : ''}</div>
      </div>`;
  }).join('');
  const opts = sel => '<option value="">—</option>' + Object.keys(EQUIPOS).map(id => `<option value="${id}" ${sel === id ? 'selected' : ''}>${getEquipo(id).bandera} ${getEquipo(id).nombre}</option>`).join('');

  return `<div class="titulo-vista">Panel del organizador 🛠️</div>
    <div class="subtitulo-vista">Marca el resultado de cada partido (gana local, empate o gana visita); los puntos se calculan solos.</div>
    <div class="aviso demo"><span class="ico">✨</span><div>¿Probar cómo funcionan los puntos? <button class="boton dorado pequeno" data-accion="demo-resultados">Cargar resultados de ejemplo</button> <button class="boton secundario pequeno" data-accion="borrar-resultados">Borrar resultados</button></div></div>
    <div class="tarjeta"><div class="tarjeta-titulo">⚽ Resultados de los partidos</div><p class="texto-mini" style="margin-bottom:10px">Toca quién ganó cada partido (o empate). Los puntos de todos se calculan al instante. Puedes cambiarlo cuando quieras.</p>${resultados}</div>
    <div class="tarjeta"><div class="tarjeta-titulo">🔄 Fixture oficial</div>
      <p class="texto-mini">Recarga los 72 partidos oficiales del Mundial 2026. No borra los pronósticos ya hechos.</p>
      <div class="mt8"><button class="boton secundario" data-accion="re-sembrar">🔄 Re-cargar fixture oficial</button></div></div>
    <div class="tarjeta"><div class="tarjeta-titulo">🏁 Resultado final del Mundial</div>
      <div class="fila-campos"><div class="campo"><label>Campeón</label><select data-accion="final-real" data-tipo="campeon">${opts(estado.resultadoFinal.campeon)}</select></div>
        <div class="campo"><label>Subcampeón</label><select data-accion="final-real" data-tipo="subcampeon">${opts(estado.resultadoFinal.subcampeon)}</select></div></div></div>
    <div class="tarjeta"><div class="tarjeta-titulo">⚙️ Configuración</div>
      <div class="campo"><label>Nombre de la polla</label><input type="text" value="${escapar(cfg.nombrePolla)}" data-accion="cfg" data-campo="nombrePolla"></div>
      <div class="fila-campos"><div class="campo"><label>Código de invitación</label><input type="text" value="${escapar(cfg.codigoInvitacion)}" data-accion="cfg" data-campo="codigoInvitacion"></div>
        <div class="campo"><label>Premio por jugador (${escapar(cfg.moneda)})</label><input type="number" min="0" step="0.5" value="${cfg.montoApuesta}" data-accion="cfg" data-campo="montoApuesta"></div></div>
      <div class="fila-campos"><div class="campo"><label>Puntos por acierto</label><input type="number" min="0" value="${cfg.puntos.acierto}" data-accion="cfg-pts" data-campo="acierto"></div>
        <div class="campo"><label>Puntos campeón</label><input type="number" min="0" value="${cfg.puntos.campeon}" data-accion="cfg-pts" data-campo="campeon"></div>
        <div class="campo"><label>Puntos subcampeón</label><input type="number" min="0" value="${cfg.puntos.subcampeon}" data-accion="cfg-pts" data-campo="subcampeon"></div></div></div>
    <div class="tarjeta"><div class="tarjeta-titulo">👥 Jugadores</div>
      <ul class="lista-jug">${estado.jugadores.map(j => `<li><div class="avatar" style="background:${j.color}">${escapar(j.nombre.charAt(0))}</div>
        <span class="nombre">${escapar(j.nombre)} ${j.esOrganizador ? '<span class="chip grupo">organizador</span>' : ''}</span>
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
  { id: 'inicio', ico: '🏠', txt: 'Inicio' }, { id: 'calendario', ico: '📅', txt: 'Calendario' },
  { id: 'partidos', ico: '⚽', txt: 'Partidos' }, { id: 'posiciones', ico: '🏅', txt: 'Posiciones' },
  { id: 'final', ico: '🏆', txt: 'Fase final' }, { id: 'bote', ico: '💰', txt: 'Premio' },
  { id: 'admin', ico: '🛠️', txt: 'Organizador' },
];

function render() {
  const yo = usuario();
  if (!yo) { Auth.salir(); return; }

  document.getElementById('nombre-polla').textContent = estado.config.nombrePolla;
  document.getElementById('badge-conexion').innerHTML = Datos.online ? '🟢 En línea' : '💾 Local';
  document.getElementById('usuario-chip').innerHTML = `<span class="avatar mini" style="background:${yo.color}">${escapar(yo.nombre.charAt(0))}</span><span>${escapar(yo.nombre)}</span>`;

  const tabs = TABS.filter(t => t.id !== 'admin' || esOrganizador());
  document.getElementById('nav-inner').innerHTML = tabs.map(t => `<button data-accion="ir" data-vista="${t.id}" class="${estado.vista === t.id ? 'activa' : ''}"><span class="ico">${t.ico}</span><span>${t.txt}</span></button>`).join('');

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
