# Breeze en Android

La aplicación Android usa el servidor web de Breeze y graba con un servicio
nativo de micrófono. Requiere Android 8 (API 26) o posterior. No requiere publicar
en Play Store ni guardar credenciales del servidor dentro del APK.

## Obtener e instalar el APK

1. Desplegar esta versión de la web en un dominio HTTPS accesible desde el celular.
2. Si usás otro dominio, configurar la variable de repositorio `BREEZE_APP_URL` en GitHub (Settings →
   Secrets and variables → Actions → Variables), con el origen de esa web, por
   ejemplo `https://mi-breeze.vercel.app`, sin ruta ni barra final. El workflow usa
   `https://breeze-ai-lime.vercel.app` por defecto, el dominio registrado en la
   documentación de Breeze. Ese servidor debe tener desplegados estos cambios.
3. Ejecutar **Actions → Android APK → Run workflow**. También se ejecuta en PR y
   al subir cambios a `codex/android-background-recording`.
4. Descargar el artefacto `breeze-android-debug`, extraer `app-debug.apk` y abrirlo
   en Android. Autorizar la instalación desde esa fuente cuando Android lo pida.

El APK es de depuración y está firmado con una clave de desarrollo. No es una
versión para Play Store. La clave de CI puede cambiar entre compilaciones: si
Android rechaza una actualización por firma incompatible, **no desinstalar si
quedan grabaciones locales pendientes**. Sincronizarlas primero; desinstalar
borra los datos locales. Para actualizaciones personales estables, usar una clave
de firma persistente o compilar siempre con el mismo entorno local.

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
**Saved recordings**, usar **Save WAV** para exportar una copia a una ubicación
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
