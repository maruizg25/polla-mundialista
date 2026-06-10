# 🚀 Guía para publicar la Polla (≈10 minutos)

Sigue estos pasos para que la polla quede **en internet** y todos tus amigos
jueguen desde su celular con los mismos datos. Es **gratis**.

Son 2 partes: **(A) base de datos** y **(B) publicar la página**.

---

## PARTE A — Crear la base de datos gratis (Supabase)

1. Entra a **https://supabase.com** y haz clic en **“Start your project”**.
   Inicia sesión con Google o GitHub (lo más rápido) o con tu correo.

2. Clic en **“New project”**:
   - **Name:** `polla` (o el que quieras)
   - **Database Password:** inventa una y **guárdala** (no la necesitarás para la app, pero Supabase la pide).
   - **Region:** elige la más cercana (ej. *East US*).
   - Clic en **“Create new project”** y espera ~2 minutos a que diga listo.

3. En el menú de la izquierda abre **SQL Editor** → **“New query”**.
   Abre el archivo **`supabase.sql`** (de esta carpeta), **copia todo** su
   contenido, pégalo ahí y haz clic en **“Run”** (▶). Debe decir *Success*.

4. En otro query, ejecuta también **`supabase-v6-cierre-individual.sql`**
   para habilitar el cierre individual de pronósticos por jugador.

5. Ahora copia tus 2 claves: menú **Settings** (engranaje) → **API Keys** (o **Data API**):
   - **Project URL** → algo como `https://abcdxyz.supabase.co`
   - **anon public** → una clave larga que empieza por `eyJ...`

6. Abre el archivo **`config.js`** de esta carpeta y pega las 2 claves:
   ```js
   const SUPABASE_URL  = 'https://abcdxyz.supabase.co';   // tu Project URL
   const SUPABASE_KEY  = 'eyJhbGciOi...';                 // tu clave anon public
   ```
   Guarda el archivo. ✅ *Con esto la app cambia sola a “modo en línea”.*

---

## PARTE B — Publicar la página (Netlify Drop)

1. Entra a **https://app.netlify.com/drop**

2. **Arrastra la carpeta completa** `polla mundialista` (toda, con todos los
   archivos) hacia el recuadro de la página. Espera unos segundos.

3. Netlify te dará un **enlace público** tipo `https://nombre-raro.netlify.app`.
   ¡Esa es tu polla en internet! 🎉
   - *(Opcional)* Crea una cuenta gratis para conservar el sitio y poder
     cambiarle el nombre por uno más bonito.

4. Crea la cuenta administradora usando el correo configurado como
   `organizadorEmail` y la `CLAVE_ADMIN` definida en `config.js`.
   > Solo esa cuenta verá la pestaña **Organizador**.

5. **Comparte por WhatsApp** el enlace + el código de invitación con tus amigos.
   Cada uno crea su jugador y empieza a predecir.

---

## ✅ ¿Cómo sé que quedó “en línea”?
Arriba a la derecha, junto a tu nombre, debe decir **🟢 En línea**
(en vez de *💾 Local*). Si dice *Local*, revisa que pegaste bien las 2 claves
en `config.js` y vuelve a subir la carpeta a Netlify.

## 🔁 Si cambias algo del código
Cada vez que edites archivos (por ejemplo los partidos en `datos.js`), vuelve a
**arrastrar la carpeta a Netlify Drop** para actualizar el sitio publicado.

## 🔒 Sobre la seguridad
Esto es una polla **entre amigos**: la seguridad es sencilla (código de grupo +
PIN personal). No manejes dinero real dentro de la web ni compartas el enlace
fuera del grupo. Si algún día quieres seguridad fuerte (correo y contraseña),
se puede agregar después.

## 💵 Sobre el dinero
La web **solo lleva la cuenta** (bote, quién pagó, quién va ganando). Los pagos
se hacen entre ustedes por fuera (efectivo, transferencia, etc.).
