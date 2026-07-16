# AGENTS.md — veo-video-generador

> Manual de trabajo para agentes de IA (OpenCode / Claude Code) en este repo.
> Idioma de comunicación con el usuario: **ESPAÑOL**.

---

## Selección de modelo (auto-routing — hazlo ANTES de empezar la tarea)
Este proyecto trabaja con dos PERFILES, no con nombres fijos:
- Perfil PESADO (rol tipo "Opus": el potente) — mejor en ficheros enormes y tareas largas/multi-fichero.
- Perfil DIARIO (rol tipo "Sonnet": rápido y barato) — el de por defecto para tareas normales.

| Perfil | Modelo |
|---|---|
| PESADO | el modelo potente del usuario (él sabe cuál cargar) |
| DIARIO | el modelo rápido/barato del usuario (él sabe cuál cargar) |

Al recibir una tarea, clasifícala y avisa en UNA línea. Es PESADA si cumple CUALQUIERA:
- Localizar/modificar detalles en un fichero muy grande (> ~2000 líneas) o varios grandes.
- El cambio toca MÁS de ~3-4 ficheros o muchos call-sites.
- Tarea multi-paso larga (migración, barrido) de muchos turnos.
- Perder el hilo entre pasos tendría coste alto.
Si no, es LIGERA. Si es PESADA: di "Esta tarea es PESADA (motivo: …), usa el perfil PESADO
(ver tabla); si no lo tienes cargado, cámbialo antes de seguir." Si es LIGERA: procede sin avisar.
En ficheros de miles de líneas, si concluyes que algo "no existe", haz grep del nombre exacto antes de afirmarlo.

**Ficheros que casi siempre disparan PESADO aquí:** ninguno hoy. El repo es pequeño
(~820 líneas de TS/TSX en total); el mayor es `src/app/page.tsx` (~400 líneas). Aquí lo
PESADO lo dispara el *alcance* (tocar API + cliente Vertex + UI a la vez), no el tamaño.

---

## 1. Resumen del proyecto

App web de una sola pantalla que genera vídeos cortos con **Google Veo 3.1 Fast** a través
de **Vertex AI**. El usuario sube hasta 3 imágenes de referencia (opcionales), escribe un
prompt, elige formato vertical (9:16) u horizontal (16:9) y recibe un vídeo mudo de 5 s que
puede reproducir, descargar o compartir. Todo el frontend es un único componente cliente
(`src/app/page.tsx`); la única ruta de servidor (`src/app/api/generate-video/route.ts`)
valida una contraseña compartida y delega en `src/lib/vertex-client.ts`, que llama al
`PredictionServiceClient` de Vertex AI. Las imágenes se comprimen **en el navegador**
(canvas → JPEG 1024 px máx, calidad 0.8) y viajan como base64 en el JSON del POST. No hay
base de datos, ni sesiones, ni persistencia: cada generación es un round-trip aislado.

**Stack:** Next.js 16 (App Router) + React 19 + TypeScript 5 (`strict`) · Tailwind CSS 4
(vía `@tailwindcss/postcss`, config en `@theme` dentro de `globals.css`, sin
`tailwind.config`) · `lucide-react` (iconos) · `@google-cloud/aiplatform` v6 (Vertex AI) ·
ESLint 9 flat config. Sin tests, sin CI, sin Docker.

---

## 2. Comandos reales

Todos desde la **raíz del repo** (no hay monorepo ni subcarpetas de proyecto).

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # next build
npm run start    # next start (requiere build previo)
npm run lint     # eslint  (OJO: es `eslint` pelado, NO `next lint`)
```

`node_modules/` no está instalado en el checkout actual: el primer `npm install` es
obligatorio antes de cualquier build o lint.

### Tests
**No existen.** Ni unitarios, ni e2e, ni workflows de CI (`.github/` no existe).
La única verificación automatizada disponible es `npm run build` + `npm run lint`.
PENDIENTE: confirmar si se quiere añadir suite de tests.

### Script auxiliar de diagnóstico (Python, fuera del build)
```bash
python check_models.py    # lista modelos de vídeo del Model Garden de Vertex AI
```
Utilidad suelta de depuración: parsea `.env.local` **a mano con regex** (no usa dotenv) y
lista los publisher models para verificar acceso/credenciales. No forma parte de la app ni
del despliegue. **No hay `requirements.txt`**: necesita `google-cloud-aiplatform` y
`google-auth` instalados por tu cuenta. PENDIENTE: confirmar si se mantiene o se borra.

---

## 3. Arquitectura y directorios clave

```
src/
  app/
    page.tsx                     # ÚNICO componente de UI ('use client'). Máquina de estados
                                 # IDLE|GENERATING|SUCCESS|ERROR + modal de contraseña +
                                 # compresión de imágenes en canvas + selector de formato
    layout.tsx                   # RootLayout: fuente Inter, tema oscuro fijo, metadata
    globals.css                  # Tailwind 4: tokens de tema en @theme (no hay tailwind.config)
    api/generate-video/route.ts  # POST: valida password -> generateVideo() -> { prediction }
  components/
    ImageUploader.tsx            # drag&drop + file input, FileReader -> base64. Tope 3 imágenes
    VideoPlayer.tsx              # <video> + descarga vía blob + navigator.share con fallback
  lib/
    vertex-client.ts             # CLIENTE VERTEX. Credenciales, endpoint, modelo y parámetros
check_models.py                  # script suelto de diagnóstico (no forma parte del build)
public/                          # SVGs por defecto de create-next-app (sin usar)
```

**Flujo de datos (única ruta que importa):**
`page.tsx` (comprime imgs → base64) → `POST /api/generate-video`
`{ prompt, images[], password, aspectRatio }` → `route.ts` (valida `APP_PASSWORD`) →
`vertex-client.ts:generateVideo()` → Vertex AI `predict` → `{ prediction }` → la UI extrae
la URI con `prediction.videoUri || prediction.video || prediction`.

**Variables de entorno** (en `.env.local`, ignorado por git vía `.env*`):

| Variable | Uso | Obligatoria |
|---|---|---|
| `GOOGLE_SERVICE_ACCOUNT_JSON` | JSON completo de la service account, en una línea | Sí en despliegue (en local puede valer ADC) |
| `GOOGLE_CLOUD_PROJECT_ID` | Fallback si el JSON no trae `project_id` | Recomendada |
| `APP_PASSWORD` | Contraseña compartida de acceso | **Sí — sin ella la API queda abierta** (ver Gotcha 1) |

No hay `.env.example`. PENDIENTE: confirmar si se quiere crear uno.

---

## 4. Convenciones

- **Código:** identificadores y comentarios de código en inglés; los textos de UI y los
  mensajes de error de cara al usuario, en español ("Contraseña no autorizada",
  "Soñando...", "Máximo 3 imágenes permitidas").
- **Componentes:** todo es cliente (`'use client'`), export default, props tipadas con
  `interface <Nombre>Props` declarada justo encima del componente.
- **Estilos:** Tailwind utility-first inline en el JSX. Paleta fija: fondo `#030303`,
  acento violeta (`violet-500/600`), bordes `white/10`, superficies `neutral-900/50` con
  `backdrop-blur`. Mantén ese lenguaje visual — no introduzcas otra paleta ni CSS modules.
- **Diseño mobile-first:** el layout está centrado en `max-w-md` y el `viewport` bloquea el
  zoom. Es una app pensada para móvil: valida cualquier cambio de UI a ancho de móvil.
- **Commits:** el repo **NO tiene convención clara** (4 commits, español libre en
  minúsculas: `mejoras logica`, `contraseña generar`, `Estructura inicial de Veo App`).
  PENDIENTE: confirmar convención. Sugerencia: Conventional Commits en español con scope,
  como en el proyecto hermano `bet-ai-master` (`feat(ui): …`, `fix(vertex): …`).
- **Rama por defecto:** `main`. Remote: `origin` → `github.com/9ness/veo-video-generador`.
- **Formato:** sin Prettier ni reglas propias de ESLint más allá de
  `eslint-config-next` (core-web-vitals + typescript) en flat config.
- **Salida del agente:** prefiere reescribir funciones completas antes que líneas sueltas.
  Razonamiento interno en inglés, respuesta al usuario en español.

---

## 5. Gotchas / cosas no obvias

1. **La contraseña es opcional por accidente.** En `route.ts` la comprobación es
   `if (correctPassword && password !== correctPassword)`. Si `APP_PASSWORD` NO está
   definida en el entorno, la validación se salta entera y **el endpoint queda público**
   (y cada llamada cuesta dinero en Vertex). Verifica siempre que la var existe en el
   despliegue. No "arregles" esto sin avisar: cambia el comportamiento en local.
2. **La contraseña se guarda en `localStorage`** (`veo_access_password`) en claro y **no se
   borra nunca ante un 401**. Si el usuario teclea una contraseña mal la primera vez, queda
   cacheada y el modal ya no vuelve a salir: seguirá fallando con "Contraseña no
   autorizada" para siempre. Para depurar: borra esa clave del localStorage.
3. **`export const config = { api: { bodyParser: … } }` en `route.ts` NO hace nada.** Es
   sintaxis del **Pages Router**; en App Router se ignora silenciosamente. Ese `sizeLimit:
   '10mb'` es decorativo: el límite real lo pone el host (p. ej. ~4.5 MB de body en
   funciones serverless de Vercel). De ahí la compresión en cliente (canvas → 1024 px,
   JPEG 0.8) en `page.tsx`: es la ÚNICA defensa real contra el 413 "Request Entity Too
   Large". Si tocas la compresión, piensa en el 413.
4. **`maxDuration = 60` puede quedarse corto.** La ruta espera a Vertex de forma síncrona
   (`await client.predict(...)`), así que la generación entera debe caber en 60 s. Veo suele
   tardar; si aparecen timeouts, la solución real es pasar a operación long-running +
   polling, no subir el número a ciegas. PENDIENTE: confirmar plan de hosting (el `maxDuration`
   > 60 s exige plan Pro en Vercel).
5. **`location = 'us-central1'` está congelado a propósito.** El propio código lo marca
   ("STRICTLY ENFORCED: Quota is allocated here. Do not change") y añade un `console.warn`
   defensivo. La cuota de Veo 3.1 está asignada a esa región: cambiarla rompe la app con
   errores de cuota, no de región.
6. **`RESOURCE_EXHAUSTED` (code 8) = cuota, no bug.** `route.ts` lo loguea con detalle a
   propósito y devuelve `code` al frontend para depurar. Si ves ese error, revisa la cuota
   de Vertex antes de tocar código.
7. **El contrato de la respuesta de Vertex es una suposición.** La UI hace
   `prediction.videoUri || prediction.video || prediction` — tres intentos a ciegas porque
   la forma real no está fijada. Igual en `vertex-client.ts`: `image_input_config` y
   `aspect_ratio` en snake_case, mezclados con `sampleCount`/`durationSeconds` en camelCase,
   con comentarios que admiten la duda ("Usually…", "it might use…"). **Si algo falla en la
   generación, sospecha primero del schema del payload** y contrástalo con la doc vigente
   de Vertex AI antes de cambiar la UI.
8. **`page.tsx` está lleno de comentarios-monólogo obsoletos** (líneas ~75-181: deliberación
   sobre cuándo activar el estado 'GENERATING', incluyendo TODOs de refactors que YA se
   hicieron — `isSubmitting` existe). No los tomes como especificación: **el código manda**.
   Limpiarlos es bienvenido si tocas esa función.
9. **Lógica de descarga duplicada.** Existe en `VideoPlayer.tsx:handleDownload` y otra vez
   inline en `page.tsx` (botón `<Download/>` del estado SUCCESS). Si arreglas una, arregla
   la otra. Nota: `page.tsx` hace `revokeObjectURL` y `VideoPlayer` **no** (fuga de blob).
10. **El cliente de Vertex se instancia en el import** (módulo top-level de
    `vertex-client.ts`). Si las credenciales están mal, el fallo aparece al cargar el
    módulo, no dentro del `try/catch` de `generateVideo`.
11. **`package.json` se llama `"temp_app"`** y el `README.md` es el boilerplate intacto de
    `create-next-app` (habla de `app/page.tsx`, no de `src/app/`). Ninguno de los dos
    describe el proyecto real. PENDIENTE: confirmar si se renombra / reescribe.
12. **`layout.tsx` declara `viewport` y `themeColor` dentro de `export const metadata`.**
    En Next 16 eso está deprecado: van en un `export const viewport` aparte. Hoy funciona
    pero puede avisar/romper en un upgrade.
13. **`ImageUploader` usa `document.getElementById('fileInput')`** con id fijo: si algún día
    hay dos uploaders en la misma página, se pisan. Además usa `<img>` en vez de
    `next/image` (ESLint puede quejarse con `core-web-vitals`).
14. **`check_models.py` parsea `.env.local` con regex**, no con dotenv. Si cambias el
    formato/comillas de `GOOGLE_SERVICE_ACCOUNT_JSON` en el `.env.local`, ese script deja de
    encontrarlo aunque Next siga funcionando.

---

## 6. Reglas de trabajo

- **Git:** el agente NO commitea ni pushea salvo petición explícita del usuario.
  Cuando se autorice: `git add <fichero concreto>`, nunca `git add .`.
  Prohibido: force-push, reescribir historial, crear/borrar ramas o tags.
- **NO tocar sin permiso:** la región `us-central1` y el id de modelo
  `veo-3.1-fast-generate-001` en `vertex-client.ts` (cuota calibrada en producción), y la
  validación de contraseña de `route.ts`.
- **Secretos:** nunca los imprimas, comitees ni los saques de `.env.local`. `.gitignore` ya
  bloquea `.env*` — no lo debilites. Claves en juego: `GOOGLE_SERVICE_ACCOUNT_JSON` (JSON
  íntegro de la service account), `GOOGLE_CLOUD_PROJECT_ID`, `APP_PASSWORD`. Ojo con los
  logs: `route.ts` ya hace `console.log` del prompt; no añadas la contraseña ni las
  credenciales a ningún log ni a los mensajes de error que van al frontend.
- **Cada generación cuesta dinero real** en Vertex AI. No dispares `/api/generate-video` en
  bucle ni "para probar" sin avisar al usuario.
- **Antes de un comando o escritura crítica**, párate y razona: *"¿esto rompe el build o
  dispara gasto en Vertex?"*. Verifica con `npm run build` + `npm run lint` (no hay tests
  que te cubran).
- **Ante cualquier duda, pregunta.** No inventes rutas, keys ni comandos.
- **Mantén un LEARNINGS.md con 1 línea por bug/aprendizaje resuelto.**
