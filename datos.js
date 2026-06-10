/* ============================================================
   DATOS DE LA POLLA MUNDIALISTA — MUNDIAL 2026 (OFICIAL)
   ------------------------------------------------------------
   Grupos y calendario REALES del sorteo del 5 de diciembre de
   2025 (Washington D.C.). 48 selecciones, 12 grupos, 72 partidos
   de fase de grupos (11–27 de junio de 2026).
   Horarios en hora de ECUADOR (UTC-5).
   ============================================================ */

/* --- LAS 48 SELECCIONES (por grupo) ------------------------- */
const EQUIPOS = {
  // Grupo A
  mex: { nombre: 'México',          bandera: '🇲🇽' },
  rsa: { nombre: 'Sudáfrica',       bandera: '🇿🇦' },
  kor: { nombre: 'Corea del Sur',   bandera: '🇰🇷' },
  cze: { nombre: 'Chequia',         bandera: '🇨🇿' },
  // Grupo B
  can: { nombre: 'Canadá',          bandera: '🇨🇦' },
  bih: { nombre: 'Bosnia y Herzegovina', bandera: '🇧🇦' },
  qat: { nombre: 'Catar',           bandera: '🇶🇦' },
  sui: { nombre: 'Suiza',           bandera: '🇨🇭' },
  // Grupo C
  bra: { nombre: 'Brasil',          bandera: '🇧🇷' },
  mar: { nombre: 'Marruecos',       bandera: '🇲🇦' },
  hai: { nombre: 'Haití',           bandera: '🇭🇹' },
  sco: { nombre: 'Escocia',         bandera: '🏴󠁧󠁢󠁳󠁣󠁴󠁿' },
  // Grupo D
  usa: { nombre: 'Estados Unidos',  bandera: '🇺🇸' },
  par: { nombre: 'Paraguay',        bandera: '🇵🇾' },
  aus: { nombre: 'Australia',       bandera: '🇦🇺' },
  tur: { nombre: 'Turquía',         bandera: '🇹🇷' },
  // Grupo E (¡Ecuador!)
  ale: { nombre: 'Alemania',        bandera: '🇩🇪' },
  cuw: { nombre: 'Curazao',         bandera: '🇨🇼' },
  civ: { nombre: 'Costa de Marfil', bandera: '🇨🇮' },
  ecu: { nombre: 'Ecuador',         bandera: '🇪🇨' },
  // Grupo F
  ned: { nombre: 'Países Bajos',    bandera: '🇳🇱' },
  jpn: { nombre: 'Japón',           bandera: '🇯🇵' },
  sue: { nombre: 'Suecia',          bandera: '🇸🇪' },
  tun: { nombre: 'Túnez',           bandera: '🇹🇳' },
  // Grupo G
  bel: { nombre: 'Bélgica',         bandera: '🇧🇪' },
  egi: { nombre: 'Egipto',          bandera: '🇪🇬' },
  irn: { nombre: 'Irán',            bandera: '🇮🇷' },
  nzl: { nombre: 'Nueva Zelanda',   bandera: '🇳🇿' },
  // Grupo H
  esp: { nombre: 'España',          bandera: '🇪🇸' },
  cpv: { nombre: 'Cabo Verde',      bandera: '🇨🇻' },
  ksa: { nombre: 'Arabia Saudita',  bandera: '🇸🇦' },
  uru: { nombre: 'Uruguay',         bandera: '🇺🇾' },
  // Grupo I
  fra: { nombre: 'Francia',         bandera: '🇫🇷' },
  sen: { nombre: 'Senegal',         bandera: '🇸🇳' },
  irq: { nombre: 'Irak',            bandera: '🇮🇶' },
  nor: { nombre: 'Noruega',         bandera: '🇳🇴' },
  // Grupo J
  arg: { nombre: 'Argentina',       bandera: '🇦🇷' },
  dza: { nombre: 'Argelia',         bandera: '🇩🇿' },
  aut: { nombre: 'Austria',         bandera: '🇦🇹' },
  jor: { nombre: 'Jordania',        bandera: '🇯🇴' },
  // Grupo K
  por: { nombre: 'Portugal',        bandera: '🇵🇹' },
  cod: { nombre: 'RD Congo',        bandera: '🇨🇩' },
  uzb: { nombre: 'Uzbekistán',      bandera: '🇺🇿' },
  col: { nombre: 'Colombia',        bandera: '🇨🇴' },
  // Grupo L
  ing: { nombre: 'Inglaterra',      bandera: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  cro: { nombre: 'Croacia',         bandera: '🇭🇷' },
  gha: { nombre: 'Ghana',           bandera: '🇬🇭' },
  pan: { nombre: 'Panamá',          bandera: '🇵🇦' },
};

/* --- CALENDARIO OFICIAL (72 partidos, hora de Ecuador) ------ */
const PARTIDOS_SEMILLA = [
  // ===== Jornada 1 =====
  { id: 'p1',  orden: 1,  grupo: 'A', fase: 'grupos', local: 'mex', visita: 'rsa', fecha: '2026-06-11T14:00', estadio: 'Estadio Ciudad de México', jugado: false, golesLocal: null, golesVisita: null },
  { id: 'p2',  orden: 2,  grupo: 'A', fase: 'grupos', local: 'kor', visita: 'cze', fecha: '2026-06-11T21:00', estadio: 'Estadio Guadalajara',       jugado: false, golesLocal: null, golesVisita: null },
  { id: 'p3',  orden: 3,  grupo: 'B', fase: 'grupos', local: 'can', visita: 'bih', fecha: '2026-06-12T14:00', estadio: 'Estadio Toronto',           jugado: false, golesLocal: null, golesVisita: null },
  { id: 'p4',  orden: 4,  grupo: 'D', fase: 'grupos', local: 'usa', visita: 'par', fecha: '2026-06-12T20:00', estadio: 'Estadio Los Ángeles',       jugado: false, golesLocal: null, golesVisita: null },
  { id: 'p5',  orden: 5,  grupo: 'B', fase: 'grupos', local: 'qat', visita: 'sui', fecha: '2026-06-13T14:00', estadio: 'Estadio San Francisco',     jugado: false, golesLocal: null, golesVisita: null },
  { id: 'p6',  orden: 6,  grupo: 'C', fase: 'grupos', local: 'bra', visita: 'mar', fecha: '2026-06-13T17:00', estadio: 'Estadio Nueva York/Nueva Jersey', jugado: false, golesLocal: null, golesVisita: null },
  { id: 'p7',  orden: 7,  grupo: 'C', fase: 'grupos', local: 'hai', visita: 'sco', fecha: '2026-06-13T20:00', estadio: 'Estadio Boston',            jugado: false, golesLocal: null, golesVisita: null },
  { id: 'p8',  orden: 8,  grupo: 'D', fase: 'grupos', local: 'aus', visita: 'tur', fecha: '2026-06-13T23:00', estadio: 'Estadio Vancouver',         jugado: false, golesLocal: null, golesVisita: null },
  { id: 'p9',  orden: 9,  grupo: 'E', fase: 'grupos', local: 'ale', visita: 'cuw', fecha: '2026-06-14T12:00', estadio: 'Estadio Houston',           jugado: false, golesLocal: null, golesVisita: null },
  { id: 'p10', orden: 10, grupo: 'F', fase: 'grupos', local: 'ned', visita: 'jpn', fecha: '2026-06-14T15:00', estadio: 'Estadio Dallas',            jugado: false, golesLocal: null, golesVisita: null },
  { id: 'p11', orden: 11, grupo: 'E', fase: 'grupos', local: 'civ', visita: 'ecu', fecha: '2026-06-14T18:00', estadio: 'Estadio Filadelfia',        jugado: false, golesLocal: null, golesVisita: null },
  { id: 'p12', orden: 12, grupo: 'F', fase: 'grupos', local: 'sue', visita: 'tun', fecha: '2026-06-14T21:00', estadio: 'Estadio Monterrey',         jugado: false, golesLocal: null, golesVisita: null },
  { id: 'p13', orden: 13, grupo: 'H', fase: 'grupos', local: 'esp', visita: 'cpv', fecha: '2026-06-15T11:00', estadio: 'Estadio Atlanta',           jugado: false, golesLocal: null, golesVisita: null },
  { id: 'p14', orden: 14, grupo: 'G', fase: 'grupos', local: 'bel', visita: 'egi', fecha: '2026-06-15T14:00', estadio: 'Estadio Seattle',           jugado: false, golesLocal: null, golesVisita: null },
  { id: 'p15', orden: 15, grupo: 'H', fase: 'grupos', local: 'ksa', visita: 'uru', fecha: '2026-06-15T17:00', estadio: 'Estadio Miami',             jugado: false, golesLocal: null, golesVisita: null },
  { id: 'p16', orden: 16, grupo: 'G', fase: 'grupos', local: 'irn', visita: 'nzl', fecha: '2026-06-15T20:00', estadio: 'Estadio Los Ángeles',       jugado: false, golesLocal: null, golesVisita: null },
  { id: 'p17', orden: 17, grupo: 'I', fase: 'grupos', local: 'fra', visita: 'sen', fecha: '2026-06-16T14:00', estadio: 'Estadio Nueva York/Nueva Jersey', jugado: false, golesLocal: null, golesVisita: null },
  { id: 'p18', orden: 18, grupo: 'I', fase: 'grupos', local: 'irq', visita: 'nor', fecha: '2026-06-16T17:00', estadio: 'Estadio Boston',            jugado: false, golesLocal: null, golesVisita: null },
  { id: 'p19', orden: 19, grupo: 'J', fase: 'grupos', local: 'arg', visita: 'dza', fecha: '2026-06-16T20:00', estadio: 'Estadio Kansas City',       jugado: false, golesLocal: null, golesVisita: null },
  { id: 'p20', orden: 20, grupo: 'J', fase: 'grupos', local: 'aut', visita: 'jor', fecha: '2026-06-16T23:00', estadio: 'Estadio San Francisco',     jugado: false, golesLocal: null, golesVisita: null },
  { id: 'p21', orden: 21, grupo: 'K', fase: 'grupos', local: 'por', visita: 'cod', fecha: '2026-06-17T12:00', estadio: 'Estadio Houston',           jugado: false, golesLocal: null, golesVisita: null },
  { id: 'p22', orden: 22, grupo: 'L', fase: 'grupos', local: 'ing', visita: 'cro', fecha: '2026-06-17T15:00', estadio: 'Estadio Dallas',            jugado: false, golesLocal: null, golesVisita: null },
  { id: 'p23', orden: 23, grupo: 'L', fase: 'grupos', local: 'gha', visita: 'pan', fecha: '2026-06-17T18:00', estadio: 'Estadio Toronto',           jugado: false, golesLocal: null, golesVisita: null },
  { id: 'p24', orden: 24, grupo: 'K', fase: 'grupos', local: 'uzb', visita: 'col', fecha: '2026-06-17T21:00', estadio: 'Estadio Ciudad de México',  jugado: false, golesLocal: null, golesVisita: null },

  // ===== Jornada 2 =====
  { id: 'p25', orden: 25, grupo: 'A', fase: 'grupos', local: 'cze', visita: 'rsa', fecha: '2026-06-18T11:00', estadio: 'Estadio Atlanta',           jugado: false, golesLocal: null, golesVisita: null },
  { id: 'p26', orden: 26, grupo: 'B', fase: 'grupos', local: 'sui', visita: 'bih', fecha: '2026-06-18T14:00', estadio: 'Estadio Los Ángeles',       jugado: false, golesLocal: null, golesVisita: null },
  { id: 'p27', orden: 27, grupo: 'B', fase: 'grupos', local: 'can', visita: 'qat', fecha: '2026-06-18T17:00', estadio: 'Estadio Vancouver',         jugado: false, golesLocal: null, golesVisita: null },
  { id: 'p28', orden: 28, grupo: 'A', fase: 'grupos', local: 'mex', visita: 'kor', fecha: '2026-06-18T20:00', estadio: 'Estadio Guadalajara',       jugado: false, golesLocal: null, golesVisita: null },
  { id: 'p29', orden: 29, grupo: 'D', fase: 'grupos', local: 'usa', visita: 'aus', fecha: '2026-06-19T14:00', estadio: 'Estadio Seattle',           jugado: false, golesLocal: null, golesVisita: null },
  { id: 'p30', orden: 30, grupo: 'C', fase: 'grupos', local: 'sco', visita: 'mar', fecha: '2026-06-19T17:00', estadio: 'Estadio Boston',            jugado: false, golesLocal: null, golesVisita: null },
  { id: 'p31', orden: 31, grupo: 'C', fase: 'grupos', local: 'bra', visita: 'hai', fecha: '2026-06-19T19:30', estadio: 'Estadio Filadelfia',        jugado: false, golesLocal: null, golesVisita: null },
  { id: 'p32', orden: 32, grupo: 'D', fase: 'grupos', local: 'tur', visita: 'par', fecha: '2026-06-19T22:00', estadio: 'Estadio San Francisco',     jugado: false, golesLocal: null, golesVisita: null },
  { id: 'p33', orden: 33, grupo: 'F', fase: 'grupos', local: 'ned', visita: 'sue', fecha: '2026-06-20T12:00', estadio: 'Estadio Houston',           jugado: false, golesLocal: null, golesVisita: null },
  { id: 'p34', orden: 34, grupo: 'E', fase: 'grupos', local: 'ale', visita: 'civ', fecha: '2026-06-20T15:00', estadio: 'Estadio Toronto',           jugado: false, golesLocal: null, golesVisita: null },
  { id: 'p35', orden: 35, grupo: 'E', fase: 'grupos', local: 'ecu', visita: 'cuw', fecha: '2026-06-20T19:00', estadio: 'Estadio Kansas City',       jugado: false, golesLocal: null, golesVisita: null },
  { id: 'p36', orden: 36, grupo: 'F', fase: 'grupos', local: 'tun', visita: 'jpn', fecha: '2026-06-20T23:00', estadio: 'Estadio Monterrey',         jugado: false, golesLocal: null, golesVisita: null },
  { id: 'p37', orden: 37, grupo: 'H', fase: 'grupos', local: 'esp', visita: 'ksa', fecha: '2026-06-21T11:00', estadio: 'Estadio Atlanta',           jugado: false, golesLocal: null, golesVisita: null },
  { id: 'p38', orden: 38, grupo: 'G', fase: 'grupos', local: 'bel', visita: 'irn', fecha: '2026-06-21T14:00', estadio: 'Estadio Los Ángeles',       jugado: false, golesLocal: null, golesVisita: null },
  { id: 'p39', orden: 39, grupo: 'H', fase: 'grupos', local: 'uru', visita: 'cpv', fecha: '2026-06-21T17:00', estadio: 'Estadio Miami',             jugado: false, golesLocal: null, golesVisita: null },
  { id: 'p40', orden: 40, grupo: 'G', fase: 'grupos', local: 'nzl', visita: 'egi', fecha: '2026-06-21T20:00', estadio: 'Estadio Vancouver',         jugado: false, golesLocal: null, golesVisita: null },
  { id: 'p41', orden: 41, grupo: 'J', fase: 'grupos', local: 'arg', visita: 'aut', fecha: '2026-06-22T12:00', estadio: 'Estadio Dallas',            jugado: false, golesLocal: null, golesVisita: null },
  { id: 'p42', orden: 42, grupo: 'I', fase: 'grupos', local: 'fra', visita: 'irq', fecha: '2026-06-22T16:00', estadio: 'Estadio Filadelfia',        jugado: false, golesLocal: null, golesVisita: null },
  { id: 'p43', orden: 43, grupo: 'I', fase: 'grupos', local: 'nor', visita: 'sen', fecha: '2026-06-22T19:00', estadio: 'Estadio Nueva York/Nueva Jersey', jugado: false, golesLocal: null, golesVisita: null },
  { id: 'p44', orden: 44, grupo: 'J', fase: 'grupos', local: 'jor', visita: 'dza', fecha: '2026-06-22T22:00', estadio: 'Estadio San Francisco',     jugado: false, golesLocal: null, golesVisita: null },
  { id: 'p45', orden: 45, grupo: 'K', fase: 'grupos', local: 'por', visita: 'uzb', fecha: '2026-06-23T12:00', estadio: 'Estadio Houston',           jugado: false, golesLocal: null, golesVisita: null },
  { id: 'p46', orden: 46, grupo: 'L', fase: 'grupos', local: 'ing', visita: 'gha', fecha: '2026-06-23T15:00', estadio: 'Estadio Boston',            jugado: false, golesLocal: null, golesVisita: null },
  { id: 'p47', orden: 47, grupo: 'L', fase: 'grupos', local: 'pan', visita: 'cro', fecha: '2026-06-23T18:00', estadio: 'Estadio Toronto',           jugado: false, golesLocal: null, golesVisita: null },
  { id: 'p48', orden: 48, grupo: 'K', fase: 'grupos', local: 'col', visita: 'cod', fecha: '2026-06-23T21:00', estadio: 'Estadio Guadalajara',       jugado: false, golesLocal: null, golesVisita: null },

  // ===== Jornada 3 (definición, partidos simultáneos) =====
  { id: 'p49', orden: 49, grupo: 'B', fase: 'grupos', local: 'sui', visita: 'can', fecha: '2026-06-24T14:00', estadio: 'Estadio Vancouver',         jugado: false, golesLocal: null, golesVisita: null },
  { id: 'p50', orden: 50, grupo: 'B', fase: 'grupos', local: 'bih', visita: 'qat', fecha: '2026-06-24T14:00', estadio: 'Estadio Seattle',           jugado: false, golesLocal: null, golesVisita: null },
  { id: 'p51', orden: 51, grupo: 'C', fase: 'grupos', local: 'sco', visita: 'bra', fecha: '2026-06-24T17:00', estadio: 'Estadio Miami',             jugado: false, golesLocal: null, golesVisita: null },
  { id: 'p52', orden: 52, grupo: 'C', fase: 'grupos', local: 'mar', visita: 'hai', fecha: '2026-06-24T17:00', estadio: 'Estadio Atlanta',           jugado: false, golesLocal: null, golesVisita: null },
  { id: 'p53', orden: 53, grupo: 'A', fase: 'grupos', local: 'cze', visita: 'mex', fecha: '2026-06-24T20:00', estadio: 'Estadio Ciudad de México',  jugado: false, golesLocal: null, golesVisita: null },
  { id: 'p54', orden: 54, grupo: 'A', fase: 'grupos', local: 'rsa', visita: 'kor', fecha: '2026-06-24T20:00', estadio: 'Estadio Monterrey',         jugado: false, golesLocal: null, golesVisita: null },
  { id: 'p55', orden: 55, grupo: 'E', fase: 'grupos', local: 'cuw', visita: 'civ', fecha: '2026-06-25T15:00', estadio: 'Estadio Filadelfia',        jugado: false, golesLocal: null, golesVisita: null },
  { id: 'p56', orden: 56, grupo: 'E', fase: 'grupos', local: 'ecu', visita: 'ale', fecha: '2026-06-25T15:00', estadio: 'Estadio Nueva York/Nueva Jersey', jugado: false, golesLocal: null, golesVisita: null },
  { id: 'p57', orden: 57, grupo: 'F', fase: 'grupos', local: 'jpn', visita: 'sue', fecha: '2026-06-25T18:00', estadio: 'Estadio Dallas',            jugado: false, golesLocal: null, golesVisita: null },
  { id: 'p58', orden: 58, grupo: 'F', fase: 'grupos', local: 'tun', visita: 'ned', fecha: '2026-06-25T18:00', estadio: 'Estadio Kansas City',       jugado: false, golesLocal: null, golesVisita: null },
  { id: 'p59', orden: 59, grupo: 'D', fase: 'grupos', local: 'tur', visita: 'usa', fecha: '2026-06-25T21:00', estadio: 'Estadio Los Ángeles',       jugado: false, golesLocal: null, golesVisita: null },
  { id: 'p60', orden: 60, grupo: 'D', fase: 'grupos', local: 'par', visita: 'aus', fecha: '2026-06-25T21:00', estadio: 'Estadio San Francisco',     jugado: false, golesLocal: null, golesVisita: null },
  { id: 'p61', orden: 61, grupo: 'I', fase: 'grupos', local: 'nor', visita: 'fra', fecha: '2026-06-26T14:00', estadio: 'Estadio Boston',            jugado: false, golesLocal: null, golesVisita: null },
  { id: 'p62', orden: 62, grupo: 'I', fase: 'grupos', local: 'sen', visita: 'irq', fecha: '2026-06-26T14:00', estadio: 'Estadio Toronto',           jugado: false, golesLocal: null, golesVisita: null },
  { id: 'p63', orden: 63, grupo: 'H', fase: 'grupos', local: 'cpv', visita: 'ksa', fecha: '2026-06-26T19:00', estadio: 'Estadio Houston',           jugado: false, golesLocal: null, golesVisita: null },
  { id: 'p64', orden: 64, grupo: 'H', fase: 'grupos', local: 'uru', visita: 'esp', fecha: '2026-06-26T19:00', estadio: 'Estadio Guadalajara',       jugado: false, golesLocal: null, golesVisita: null },
  { id: 'p65', orden: 65, grupo: 'G', fase: 'grupos', local: 'egi', visita: 'irn', fecha: '2026-06-26T22:00', estadio: 'Estadio Seattle',           jugado: false, golesLocal: null, golesVisita: null },
  { id: 'p66', orden: 66, grupo: 'G', fase: 'grupos', local: 'nzl', visita: 'bel', fecha: '2026-06-26T22:00', estadio: 'Estadio Vancouver',         jugado: false, golesLocal: null, golesVisita: null },
  { id: 'p67', orden: 67, grupo: 'L', fase: 'grupos', local: 'pan', visita: 'ing', fecha: '2026-06-27T16:00', estadio: 'Estadio Nueva York/Nueva Jersey', jugado: false, golesLocal: null, golesVisita: null },
  { id: 'p68', orden: 68, grupo: 'L', fase: 'grupos', local: 'cro', visita: 'gha', fecha: '2026-06-27T16:00', estadio: 'Estadio Filadelfia',        jugado: false, golesLocal: null, golesVisita: null },
  { id: 'p69', orden: 69, grupo: 'K', fase: 'grupos', local: 'col', visita: 'por', fecha: '2026-06-27T18:30', estadio: 'Estadio Miami',             jugado: false, golesLocal: null, golesVisita: null },
  { id: 'p70', orden: 70, grupo: 'K', fase: 'grupos', local: 'cod', visita: 'uzb', fecha: '2026-06-27T18:30', estadio: 'Estadio Atlanta',           jugado: false, golesLocal: null, golesVisita: null },
  { id: 'p71', orden: 71, grupo: 'J', fase: 'grupos', local: 'dza', visita: 'aut', fecha: '2026-06-27T21:00', estadio: 'Estadio Kansas City',       jugado: false, golesLocal: null, golesVisita: null },
  { id: 'p72', orden: 72, grupo: 'J', fase: 'grupos', local: 'jor', visita: 'arg', fecha: '2026-06-27T21:00', estadio: 'Estadio Dallas',            jugado: false, golesLocal: null, golesVisita: null },
];

/* --- JUGADORES DE EJEMPLO (solo modo local de prueba) ------- */
// abonado = cuánto ha pagado de su cuota del bote general (de a poco).
const JUGADORES_SEMILLA = [
  { id: 'u1', nombre: 'Mauricio', color: '#0540A6', abonado: 10, esOrganizador: true,  pin: '' },
  { id: 'u2', nombre: 'Carlos',   color: '#E4002B', abonado: 5,  esOrganizador: false, pin: '' },
  { id: 'u3', nombre: 'Ana',      color: '#E6A700', abonado: 10, esOrganizador: false, pin: '' },
  { id: 'u4', nombre: 'Diego',    color: '#0A8754', abonado: 0,  esOrganizador: false, pin: '' },
  { id: 'u5', nombre: 'Laura',    color: '#7c3aed', abonado: 10, esOrganizador: false, pin: '' },
];

/* --- CONFIGURACIÓN POR DEFECTO ------------------------------ */
const CONFIG_DEFAULT = {
  nombrePolla: 'Polla Mundialista 2026',
  codigoInvitacion: 'ECUADOR26',
  moneda: 'USD',
  montoApuesta: 1,    // premio/bote por etapa (solo informativo, $1 en la primera)
  puntos: { acierto: 1, campeon: 1, subcampeon: 1 },  // 1 punto por acertar el resultado (L/E/V)
};
