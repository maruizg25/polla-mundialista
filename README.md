# 🏆 Polla Mundialista 2026 🇪🇨

Página web para que tu grupo de amigos juegue la polla del Mundial: cada quien
predice los marcadores y quién será el campeón, se ganan puntos por acertar, y
la web lleva la cuenta del bote y de quién va ganando. Diseño **tricolor
(amarillo, azul, rojo)** con temática mundialista y las banderas de todos los
países.

## ⚙️ Dos modos de uso

| Modo | Para qué sirve | Cómo se activa |
|---|---|---|
| **💾 Local** | Probar todo en un solo equipo (sin internet). | Es el modo por defecto. Solo abre `index.html`. |
| **🟢 En línea** | Que todos jueguen desde su celular con datos compartidos. | Pega tus claves de Supabase en `config.js`. |

### Probar ahora mismo (modo local)
Haz **doble clic en `index.html`**. Entra con el código de prueba **`ECUADOR26`**
y elige un jugador. ¡Listo!

### Publicarla para todos (modo en línea)
Sigue la **[GUIA-PUBLICAR.md](GUIA-PUBLICAR.md)** — son ~10 minutos: crear una
base de datos gratis en Supabase y subir la carpeta a Netlify. Te da un enlace
para compartir por WhatsApp.
- Si un correo ya fue confirmado antes y vuelves a ver usuarios repetidos, ejecuta [supabase-auth-limpiar-duplicados.sql](supabase-auth-limpiar-duplicados.sql) en el SQL Editor de Supabase para limpiar Auth y las tablas de la polla.

## 🎮 Cómo se juega
1. **Entrar:** código de invitación del grupo → eliges/creas tu jugador (con un PIN personal opcional).
2. **⚽ Partidos:** escribes tu marcador para cada juego (se bloquea al empezar el partido).
3. **🏆 Fase final:** eliges campeón y subcampeón (dan puntos extra).
4. **🏅 Posiciones:** el ranking de todos, en vivo.
5. **💰 Bote:** cuánto se juntó, quién pagó y quién va ganando.

### Puntos (configurables por el organizador)
| Acierto | Puntos |
|---|---|
| Marcador exacto (ej. 2-1) | 5 |
| Acertar quién gana o empate | 3 |
| Acertar el campeón | 15 |
| Acertar el subcampeón | 7 |

## 🛠️ Para el organizador
El **primero que se registra** queda como organizador. Desde la pestaña
**Organizador** puede: ingresar resultados reales (los puntos se calculan solos),
definir el campeón/subcampeón al final, cambiar montos y puntos, y administrar
jugadores. El botón *“Cargar resultados de ejemplo”* sirve para ver el
funcionamiento sin esperar al Mundial.

## ✏️ Poner los partidos reales
Edita el archivo **`datos.js`** (equipos y partidos, con comentarios). Cuando
salga el sorteo oficial, reemplaza los partidos de ejemplo por los reales. Si ya
publicaste, vuelve a subir la carpeta a Netlify.

## 🗂️ Archivos
| Archivo | Qué contiene |
|---|---|
| `index.html` | La página principal. |
| `styles.css` | Diseño tricolor y temática mundialista. |
| `config.js` | **Tus claves de Supabase** (para el modo en línea). |
| `datos.js` | Equipos y partidos (**edítalo** para los datos reales). |
| `db.js` | Capa de datos: funciona en local o con Supabase. |
| `auth.js` | Pantalla de login (código + jugador + PIN). |
| `app.js` | Lógica: predicciones, puntos, ranking y panel del organizador. |
| `supabase.sql` | Script para crear la base de datos (se pega en Supabase). |
| `GUIA-PUBLICAR.md` | Pasos con clics para dejarla en internet. |

## 🔒 Seguridad y dinero
Es una polla **entre amigos**: seguridad sencilla (código de grupo + PIN). La web
**solo lleva la cuenta** del dinero; los pagos se hacen por fuera (efectivo o
transferencia). No se procesan pagos reales.

---
*Hecho con ⚽ para disfrutar el Mundial entre amigos. ¡Vamos Ecuador! 🇪🇨*
