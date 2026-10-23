# Breeze en Android

La aplicación Android usa el servidor web de Breeze y graba con un servicio
nativo de micrófono. Requiere Android 8 (API 26) o posterior. No requiere publicar
en Play Store ni guardar credenciales del servidor dentro del APK.

## Obtener, instalar y actualizar

Abrir [Breeze → Android](https://breeze-ai-lime.vercel.app/android), también
accesible desde el encabezado de la web. El botón principal descarga
[`breeze.apk`](https://breeze-ai-lime.vercel.app/api/android/apk) desde el propio
sitio, sin ZIP ni inicio de sesión en GitHub. GitHub queda como descarga alternativa. Abrirlo y autorizar la instalación desde
esa fuente cuando Android lo pida. La página muestra la versión instalada cuando se abre desde la app y
permite descargar otra vez para actualizar; Android pide confirmar la instalación.
No es una actualización automática ni una publicación en Play Store.

**Migración desde el primer APK:** el artefacto inicial de Actions usaba una firma
aleatoria de CI que no se conserva. La primera versión de distribución tiene otra
firma: Android rechaza su instalación sobre aquella versión. Antes de
hacer una única desinstalación/reinstalación, sincronizar todo y exportar los WAV
pendientes con **Export audio**. Desinstalar o borrar datos elimina el audio privado y
la sesión. **Estado actual:** el APK publicado sigue disponible y funciona,
pero todavía no es posible publicar nuevas actualizaciones compatibles con su firma.
Consultar el diagnóstico de firma más abajo antes de intentar reinstalar.

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

**Llamadas en el mismo teléfono:** durante una llamada de WhatsApp o telefónica,
Android entrega el micrófono sólo a la app de la llamada y Breeze recibe silencio;
tras unos 3 segundos el servicio detiene la grabación y conserva lo grabado. No
hay forma de que una app grabe esa llamada desde el mismo teléfono. El grabador
lo advierte antes de empezar y, si una llamada corta la grabación, muestra la
explicación en lugar de abrir la reunión automáticamente. Para grabar una llamada,
usar WhatsApp Web en una computadora con Breeze web y el audio de la pestaña, o
poner la llamada en altavoz y grabar desde otro dispositivo. La detección usa el
mensaje de error del servicio (contiene "llamada"); si se cambia ese texto en
`RecordingService.java`, actualizar `interruptedByCall`.

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

### Diagnóstico actual: actualizaciones de APK bloqueadas

La primera release pública se firmó con la clave debug que Gradle creó en
`/home/runner/.config/.android/debug.keystore`. Esa ruta no se conservó en la
caché: se guardó una clave personal distinta en `~/.android/debug.keystore`.
El diagnóstico de CI confirmó que los certificados difieren y que la clave
original no aparece en los directorios restaurados. La clave pública del APK no
permite recuperar su clave privada.

El APK publicado y su descarga web siguen funcionando. El workflow rechaza
nuevas publicaciones para preservar esa distribución; no se debe borrar la
release ni desactivar la comprobación de certificado. Mientras no aparezca una
copia privada de la clave original, las actualizaciones sobre la app instalada
están bloqueadas.

Una nueva firma exige autorización explícita del propietario y una migración:
subir o exportar todos los audios locales antes de desinstalar, instalar el nuevo
APK y volver a iniciar sesión. Antes de publicar esa nueva distribución, respaldar
su clave privada fuera de las cachés de Actions y configurar la misma clave en
los secretos de firma. No afirmar que las siguientes actualizaciones conservan
los datos hasta verificar una actualización real entre dos APK con esa misma firma.


El workflow **Android APK** siempre verifica la web. Ejecuta
`test lintDebug assembleDebug` en Android solamente cuando cambian `android/**`,
el propio workflow o los scripts de detección, firma/publicación y sus pruebas.
Compara el commit previo exacto del push o la base del PR con `HEAD`.
**Run workflow** fuerza la compilación nativa. Los cambios únicamente web y de
documentación pueden desplegarse y llegar al APK instalado sin compilar ni
publicar otro APK; por ejemplo, corregir márgenes dentro del WebView.
Cuando hay cambios nativos, los PR producen artefactos de prueba; sólo `master`
puede publicar y requiere que la verificación web y la compilación Android pasen.
La protección de firma sigue bloqueando nuevas publicaciones mientras falte la
clave original. Esperar ambas verificaciones
antes de dar por publicada una versión. `BREEZE_APP_URL` es una variable de
repositorio con un origen HTTPS, sin ruta ni barra final; por defecto usa
`https://breeze-ai-lime.vercel.app`.

La release `android-latest` mantiene `breeze.apk` y `android-release.json` (versión,
commit, fecha, SHA-256 del archivo y certificado de firma). El `versionCode` debe
crecer en cada publicación. El script rechaza un código que no aumenta o un
certificado distinto al ya publicado: **restaurar la clave original**, no borrar
la release ni generar otra para eludir esa comprobación.

CI restaura primero `~/.android/debug.keystore` desde la caché original
`breeze-android-personal-signing-v1`, y la clave recuperada de
`~/.android/breeze-distribution.keystore` desde `breeze-android-personal-signing-v2`.
Selecciona la ruta explícitamente mediante `BREEZE_KEYSTORE_PATH`; no depende de
la ubicación de firma debug que Gradle elija por defecto. Antes de compilar,
`scripts/restore-android-signer.sh` compara el certificado público con el APK ya
publicado y puede recuperar una clave coincidente de los directorios restaurados.
Solo la clave coincidente se conserva en la caché v2; las claves configuradas mediante
secretos nunca entran en esas cachés. Si no encuentra la firma original, falla sin
rotar la clave. `scripts/verify-android-signing.sh` comprueba después que el APK
compilado usó exactamente la clave seleccionada, antes de subir el artefacto.
Los logs muestran rutas y huellas públicas para diagnóstico, nunca claves privadas.
La clave personal debug inicial usa alias `androiddebugkey` y contraseñas de
desarrollo `android`; solo sirve para una distribución personal.
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

## Barras del sistema en el APK instalado

La web detecta `BreezeAndroid` y aplica `NativeAppFrame` exclusivamente dentro de
la app. Reserva arriba y abajo al menos 32 y 48 píxeles CSS, respectivamente,
y utiliza `env(safe-area-inset-*)` cuando el WebView informa espacios mayores.
El encabezado sticky y las notificaciones respetan ese espacio; el pie queda
alcanzable al desplazarse. Chrome y otros navegadores sin el bridge mantienen
su diseño normal.

Es una corrección web para el APK ya instalado, no una medición exacta del teléfono:
la versión antigua no expone `WindowInsets` y algunos WebViews reportan cero.
Comprobar en el dispositivo que el encabezado no invade la hora/iconos y que el
pie se puede desplazar por encima de la navegación; probar también orientación
horizontal y navegación por gestos. El arreglo nativo futuro debe consumir
`WindowInsets` (o aplicar correctamente los insets al WebView), retirar esta
reserva cuando el host gestione esos espacios y publicarse con la firma original.
No desinstalar solo para corregir el espaciado: recargar/reabrir la app obtiene
los cambios web sin tocar las grabaciones locales.

## Estado visible del audio y respaldo de firma preparado

La pantalla nativa muestra **Saved on phone**, **Uploading** con partes confirmadas
y **Uploaded** cuando el servidor confirmó la subida. Una subida confirmada no
significa que el audio esté archivado en OneDrive: la reunión muestra por separado
**Saved in OneDrive** o **OneDrive archive not confirmed**. Mientras no haya
confirmación del archivo, conservar la copia local y usar **Export audio** antes de
reinstalar. Estos estados llegan por la web al APK instalado y no necesitan cambiar
su firma.

Está preparada y probada una utilidad para cifrar/restaurar un respaldo de firma
con un único secreto del propietario; **todavía no está activada**. Ver
[preparación de migración y respaldo](android-signing-migration.md). El APK actual
no cambió y su firma original sigue bloqueando nuevas publicaciones compatibles.

## Inicio rápido de grabación

La pantalla principal (`/meetings`) muestra un círculo grande **Record**;
la pestaña **My meetings** abre el historial en `/meetings/history`. El círculo
es el acceso principal en Android, móvil y escritorio, y abre una grabación de
micrófono directamente, sin pedir nombre ni fuente. El permiso de micrófono del
sistema sigue siendo necesario. El pedido de inicio se consume en esta visita:
recargar la página no inicia otra grabación. Abrir `/meetings/new` directamente
permite iniciar manualmente o subir un archivo.

La web espera a identificar el puente Android antes de montar un grabador. En
el APK se consulta primero el estado local; una grabación ya activa se muestra
sin crear otra. Las subidas anteriores se recuperan en segundo plano sin
interrumpir la nueva grabación. **Meeting details** conserva el nombre opcional;
el nombre también se puede cambiar después de grabar. Estos cambios son web y
llegan al APK instalado sin publicar otra firma. Probar en teléfono físico un
inicio desde **New meeting**, reabrir con una grabación activa y detener/subir.
