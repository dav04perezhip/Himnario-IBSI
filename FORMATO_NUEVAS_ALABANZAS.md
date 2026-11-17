# Cómo agregar alabanzas (desde la versión 3.3)

Cada alabanza vive en un archivo de texto en la carpeta `alabanzas/`, por ejemplo `alabanzas/216.cho`.
Dentro, cada acorde va entre corchetes justo antes de la sílaba donde se toca:

```
{title: Bondad de Dios}
{artist: Bethel Music}
{key: A#}

CORO
[D#]En mi vida has sido b[A#]ueno
```

Eso es solo cómo se guarda. En la app el acorde siempre se dibuja **arriba** de esa sílaba, en
cualquier pantalla y en cualquier tono.

## Forma rápida: publicar desde la app (desde la versión 3.4)

1. En la app pulsa **Soy administrador** (al final del catálogo) y escribe la clave. Solo se pide una vez por dispositivo.
2. Pulsa **+ Agregar alabanza**, pega la canción de LaCuerda.net y revisa la vista previa.
3. Pulsa **Publicar para todos**. Recibe el número siguiente (221, 222…) y a los demás les aparece
   la próxima vez que abran la app con internet.
4. Para corregirla: ábrela y pulsa **Editar**. Para quitarla para todos: botón de basura (como administrador).

Las alabanzas publicadas se guardan en Cloudflare (base de datos D1 `himnario-ibsi`, servicio en la carpeta `api/`).
Para cambiar la clave de administrador: en la carpeta `api` ejecutar `npx wrangler secret put ADMIN_PIN`.

## Agregarla de forma permanente al repositorio (opcional)

1. En la app, pulsa **+ Agregar alabanza**.
2. Pega la canción tal como está en LaCuerda.net (acordes en la línea de arriba de la letra).
3. Revisa la vista previa: cada acorde debe quedar sobre la misma sílaba que en LaCuerda.
4. Copia el texto de la alabanza en formato `[acorde]sílaba` y guárdalo como `alabanzas/NNN.cho` (NNN = número siguiente, por ejemplo `221.cho`).
5. Agrega la alabanza a `hymns.json` (número, título, artista, tono original y `preferFlats`).
6. Ejecuta `node tools/empaquetar_alabanzas.js` para regenerar `alabanzas.json`.
7. Sube `APP_VERSION` en `app.js` y la versión en `sw.js`, `index.html` y `manifest.webmanifest`
   para que los teléfonos descarguen la actualización.

Si solo quieres usar una alabanza en tu teléfono, basta con **Guardar en este dispositivo**.

## Reglas

1. La letra y los acordes se toman exactamente de la fuente (PDF, LaCuerda o documento definitivo).
2. No se cambia, corrige ni transpone ningún acorde salvo instrucción expresa.
3. Se conserva la sílaba sobre la que va cada acorde.
4. Se registra título, artista o autor según aparezca en la fuente.
5. Los acordes con bajo alternativo (`B/D#`, `A/E`) se guardan completos y se transponen completos.
6. Antes de publicar se revisa la alabanza en teléfono y PC y se prueba la transposición.

## Vista original del PDF

Las 220 alabanzas originales conservan su página del PDF en `hymn_layouts.json`. En el visor, el botón
**PDF** muestra esa página; **Texto** vuelve a la vista con acordes arriba. Los archivos `.cho` de esas
alabanzas se generaron con `tools/convertir_layouts.js`; no hace falta volver a ejecutarlo (sobrescribiría
las correcciones hechas a mano en `alabanzas/`).
