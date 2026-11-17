# Himnario IBSI - versión 3.5

Aplicación web progresiva del Himnario IBSI con las alabanzas originales (1–214) y las nuevas desde la 215.

- Consulta y búsqueda por número, título o artista.
- Letra con los acordes arriba de cada sílaba, que se acomoda a teléfono, tablet y PC.
- Vista original del PDF con el botón **PDF**.
- Transposición de acordes y tamaño de letra ajustable.
- Agregar alabanzas pegándolas desde LaCuerda.net y publicarlas para todos (ver `FORMATO_NUEVAS_ALABANZAS.md`).
- Las alabanzas publicadas se guardan en Cloudflare (carpeta `api/`).

Dirección: https://himnario-ibsi.hiptank-news.workers.dev/ (Cloudflare). La de GitHub Pages solo muestra el aviso de mudanza.
Publicar a mano: `npx wrangler deploy` en esta carpeta (o automático al subir a GitHub si está conectado en Cloudflare).
- Creación, guardado y uso compartido de listados.
- Instalación como aplicación y funcionamiento sin conexión.
