# Breeze en Android

La aplicación Android usa el servidor web de Breeze y graba con un servicio
nativo de micrófono. Requiere Android 8 (API 26) o posterior. No requiere publicar
en Play Store ni guardar credenciales del servidor dentro del APK.

## Obtener, instalar y actualizar

Abrir [Breeze → Android](https://breeze-ai-lime.vercel.app/android), también
accesible desde el encabezado de la web. El botón descarga directamente
[`breeze.apk`](https://github.com/Julianchoo/Breeze-AI-Note-Taker/releases/download/android-latest/breeze.apk),
sin ZIP ni inicio de sesión en GitHub. Abrirlo y autorizar la instalación desde
esa fuente cuando Android lo pida. La página muestra la versión instalada cuando se abre desde la app y
permite descargar otra vez para actualizar; Android pide confirmar la instalación.
No es una actualización automática ni una publicación en Play Store.

**Migración desde el primer APK:** el artefacto inicial de Actions usaba una firma
aleatoria de CI que no se conserva. La primera versión de distribución tiene otra
firma: Android rechaza su instalación sobre aquella versión. Antes de
hacer una única desinstalación/reinstalación, sincronizar todo y exportar los WAV
pendientes con **Export audio**. Desinstalar o borrar datos elimina el audio privado y
la sesión. Las versiones de distribución siguientes conservan su firma para
actualizar sobre la instalada sin borrar datos.

## Grabar y recuperar audio

Al abrir por primera vez, confirmar el dominio HTTPS de Breeze en **Connect
Breeze**. La dirección viene precompletada y se guarda en el teléfono. Debe ser
un origen sin ruta, parámetros ni credenciales. Iniciar sesión y otorgar permiso
de micrófono. En Android 13 o
posterior, permitir también las notificaciones para poder ver el estado y detener
la grabación desde la notificación.

Iniciar la grabación con la aplicación visible. El servicio mantiene una
notificación mientras graba y puede continuar con la pantalla bloqueada o al
cambiar de aplicación. En teléfonos con restricciones agresivas de batería,
configurar Breeze para uso de batería **sin restricciones** en los ajustes de
Android y comprobar primero una grabación corta con pantalla bloqueada.

Cada grabación tiene un límite de cuatro horas; al alcanzarlo, se detiene y
conserva el audio. Iniciar otra grabación si necesitás continuar.

El audio se guarda en el almacenamiento privado del teléfono. Al volver a la
aplicación, se sincronizan los fragmentos pendientes con el servidor; si falla la
conexión, permanecen locales para reintentar. La aplicación necesita una sesión
válida y la misma cuenta para sincronizar. Mantener el teléfono con espacio libre
y abrir Breeze después de grabar para completar la sincronización.

Las grabaciones sincronizadas también quedan guardadas en el teléfono. En
**Saved on this phone**, usar **Export audio** para exportar una copia a una ubicación
elegida en el selector de archivos de Android. Los originales privados se
conservan hasta desinstalar la aplicación o borrar sus datos; controlar el espacio
disponible y guardar copias antes de hacerlo.

Las llamadas, la revocación del permiso, el reinicio, **Forzar detención** o ciertas
restricciones del fabricante pueden interrumpir la captura. No se reanuda el
micrófono automáticamente tras un reinicio o un cierre forzado. Al abrir de nuevo,
la aplicación recupera el audio local que alcanzó a guardar y marca la grabación
interrumpida; revisar su estado antes de iniciar otra. No borrar datos ni
desinstalar con audio pendiente.

El inicio de sesión con Google abre el navegador del sistema. Después de iniciar
sesión, tocar **Connect** para volver a la aplicación. La sesión se transfiere
mediante un token cifrado de corta duración (120 segundos) protegido con PKCE. Este flujo
requiere desplegar también las nuevas rutas de autenticación de la web antes de
usar el APK; compilarlo no actualiza el servidor. Breeze tiene habilitado el inicio
de sesión con Google; correo y contraseña están deshabilitados.

## Arquitectura y archivos para mantenimiento

Es una aplicación **nativa Java con WebView**, no Capacitor ni una PWA. La web
remota provee la interfaz y el servidor existente; `window.BreezeAndroid` conecta
el grabador web al servicio nativo. Desplegar cambios de interfaz o API normalmente
no exige reinstalar. Cambiar Java, permisos/manifest, recursos (incluido el icono)
o configuración nativa sí exige publicar e instalar otro APK.

| Archivo | Responsabilidad |
|---|---|
| `android/app/src/main/java/com/breeze/app/MainActivity.java` | WebView, origen HTTPS, puente nativo, permisos, login y exportación |
| `android/app/src/main/java/com/breeze/app/RecordingService.java` | Servicio de micrófono en primer plano, notificación y wake lock |
| `android/app/src/main/java/com/breeze/app/RecordingStore.java` | Archivos privados, metadatos, recibos de subida y recuperación |
| `android/app/src/main/java/com/breeze/app/WavFile.java` | Escritura y reparación de WAV PCM mono, 16 bits, 16 kHz |
| `android/app/src/main/AndroidManifest.xml`, `res/` | Permisos, deep link, servicio e iconos del launcher/notificación |
| `src/app/icon.svg`, `android/app/src/main/res/drawable/ic_launcher_foreground.xml` | Favicon y su versión vectorial nativa; mantener ambas marcas coordinadas |
| `src/lib/native-android-recorder.ts` | Puente TypeScript y sincronización autenticada de fragmentos |
| `src/components/meetings/native-meeting-recorder.tsx` | UI del grabador y grabaciones guardadas |
| `src/app/android/connect/page.tsx`, `src/app/api/android/session/route.ts`, `src/lib/android-handoff.ts` | Login en navegador y transferencia de sesión cifrada/PKCE |
| `src/app/api/meetings/[id]/chunks/route.ts` | Recepción de fragmentos de audio por la API existente |
| `src/app/android/page.tsx` | Página pública para instalar/actualizar |
| `.github/workflows/android-apk.yml`, `scripts/publish-android-release.sh` | Verificaciones, APK firmado y publicación estable |

El servicio escribe fragmentos WAV de hasta 120 segundos y sincroniza el archivo
en disco aproximadamente cada segundo. Recupera los fragmentos parciales guardados
tras una interrupción; no puede recuperar audio que nunca se escribió. La captura
no depende de la red. La subida ocurre al abrir el grabador con sesión válida;
no existe un uploader nativo que garantice sincronización con la app cerrada.

Las claves de Soniox, OpenAI, base de datos, almacenamiento y OAuth siguen en el
servidor. El APK contiene el origen web y una sesión del usuario, nunca las claves
de proveedor. El login usa el navegador del sistema, retorno a la app y un token
AES-GCM de 120 segundos ligado a PKCE y al estado. Cambiar el dominio exige revisar
la configuración de auth y que las rutas Android estén desplegadas.

## Compilar localmente

Instalar Java 21, Android SDK 35 (incluyendo Build Tools 35.0.0) y Gradle 8.11.1.
Configurar `ANDROID_HOME` y ejecutar desde la carpeta `android`:

```sh
gradle -PbreezeOrigin=https://mi-breeze.vercel.app test lintDebug assembleDebug
```

El resultado está en `android/app/build/outputs/apk/debug/app-debug.apk`. El origen
debe ser HTTPS y corresponder al servidor que querés usar. La dirección de ejemplo
`https://breeze.example.com` permite compilar sin secretos, pero no es un servidor
real: configurar el origen antes de usar el APK. El workflow configura el dominio
de Breeze mencionado arriba en lugar de esa dirección de ejemplo.

El workflow también ejecuta `pnpm lint`, `pnpm typecheck` y `pnpm build:ci` para
verificar la web sin ejecutar migraciones ni usar credenciales de producción.
La compilación y los tests no sustituyen comprobar la grabación, la recuperación
y la sincronización en un teléfono físico.

## Publicación y firma persistente

El workflow **Android APK** verifica la web y ejecuta `test lintDebug assembleDebug`
en Android. Los PR producen artefactos de prueba; sólo la rama `master` publica
la distribución estable, por push o **Run workflow**. Esperar ambas verificaciones
antes de dar por publicada una versión. `BREEZE_APP_URL` es una variable de
repositorio con un origen HTTPS, sin ruta ni barra final; por defecto usa
`https://breeze-ai-lime.vercel.app`.

La release `android-latest` mantiene `breeze.apk` y `android-release.json` (versión,
commit, fecha, SHA-256 del archivo y certificado de firma). El `versionCode` debe
crecer en cada publicación. El script rechaza un código que no aumenta o un
certificado distinto al ya publicado: **restaurar la clave original**, no borrar
la release ni generar otra para eludir esa comprobación.

CI conserva `~/.android/debug.keystore` en la caché
`breeze-android-personal-signing-v1`. Si no hay caché ni secretos, genera una clave
personal debug (alias `androiddebugkey`, contraseñas de desarrollo `android`).
`versionCode` usa `github.run_number + 100`; `versionName`, `1.0.<run_number>`.
No reiniciar esa numeración ni usar códigos locales para la distribución sin
comprobar el manifiesto publicado.

Para respaldar/restaurar la firma o usar una clave explícita, configurar los
secretos de repositorio `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`,
`ANDROID_KEY_ALIAS` y `ANDROID_KEY_PASSWORD`. El primero contiene el keystore en
base64; los otros identifican la entrada y sus contraseñas. Respaldar **la misma
clave que firmó la distribución**, no sustituirla por una nueva. Para compilación
local con esa clave, `build.gradle` acepta `BREEZE_KEYSTORE_PATH`,
`BREEZE_KEYSTORE_PASSWORD`, `BREEZE_KEY_ALIAS` y `BREEZE_KEY_PASSWORD` como variables
de entorno; pasar `-PbreezeVersionCode=N -PbreezeVersionName=X` a Gradle cuando
corresponda. No publicar compilaciones locales por encima de CI sin ajustar antes
la estrategia de numeración.

La clave privada necesita una copia de respaldo fuera del repositorio. Una caché
de Actions no reemplaza ese respaldo: puede desaparecer por presión de espacio o
tras siete días sin uso. Respaldar/configurar la firma persistente antes de que
se elimine la caché; sin la clave original, las siguientes publicaciones quedan
bloqueadas para preservar las actualizaciones de las apps instaladas. Nunca commitear
keystores, contraseñas, `.env` ni imprimir sus contenidos en logs. El APK de uso
personal conserva el tipo debug; la firma persistente permite mantenerlo sin
rotaciones accidentales, pero no lo convierte en una release para Play Store.

## Comprobaciones antes de publicar

```sh
node tests/android-handoff.test.mjs
python3 scripts/test-android-publication.py
pnpm exec tsx scripts/test-native-recorder.ts
pnpm lint
pnpm typecheck
pnpm build:ci
# Desde android/ con Java/SDK/Gradle configurados:
gradle -PbreezeOrigin=https://breeze-ai-lime.vercel.app test lintDebug assembleDebug
```

`build:ci` no ejecuta migraciones; `pnpm build` sí. Los tests nativos incluyen WAV;
las comprobaciones TypeScript cubren sincronización y el handoff prueba su validez,
caducidad y PKCE. Ninguna de ellas sustituye probar en un teléfono físico:

- Login Google con retorno a la app y permisos de micrófono/notificaciones.
- Grabar más de dos minutos, bloquear pantalla, cambiar de app y detener desde
  la notificación; escuchar el WAV y verificar todos los fragmentos en la reunión.
- Grabar sin conexión y reabrir el grabador con red; comprobar subida y notas.
- Interrumpir con llamada, revocar permiso, forzar cierre o reiniciar; reabrir,
  recuperar/exportar el fragmento parcial y confirmar que no continúa solo.
- Exportar WAV y actualizar sobre la versión de distribución anterior; comprobar
  que siguen las grabaciones locales y la sesión. Verificar icono y descarga web.

## Descarga web y diagnóstico

El botón de `/android` descarga desde `/api/android/apk` en el mismo sitio:
el servidor descarga y valida únicamente el APK público de la release fija
`android-latest`, sin reenviar cookies ni usar credenciales de GitHub. Conserva
`Content-Disposition: attachment`, el nombre `breeze.apk`, el tipo APK y el tamaño.
Valida destino final, tamaño máximo de 4 MiB (por debajo del límite de respuesta de Vercel) y cabecera ZIP antes de responder;
una release ausente o una respuesta HTML produce 502 en lugar de guardar una página
como APK. No cachea la descarga para evitar entregar una versión vieja.

La descarga alternativa sigue apuntando directamente a GitHub. Si un navegador
integrado muestra una barra completa pero no guarda el archivo, abrir la web de
Breeze en Chrome, entrar a Android app y usar el botón principal. Las primeras
versiones de la app no gestionan descargas dentro del WebView: necesitan abrir
la web en Chrome; este cambio web no puede modificar el APK ya instalado.

OneDrive no reemplaza la recuperación local: solo recibe audio tras procesar una
reunión cuando la integración del administrador está conectada. Audio pendiente
que todavía está únicamente en el teléfono debe subirse o exportarse antes de
desinstalar. No asumir que una grabación interrumpida ya está en OneDrive.
