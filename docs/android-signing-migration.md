# Preparación de firma y respaldo (pendiente de activar)

La firma original de `android-latest` se perdió. Ese APK y su descarga siguen
intactos. Esta preparación **no genera una nueva clave, no publica backups ni
APK y no modifica el workflow activo**. Cambiar la firma publicada exige una
excepción explícita del propietario a `AGENTS.md`: antes de reinstalar, subir o
exportar los audios locales; desinstalar borra esos archivos y la sesión.

## Único paso de configuración del propietario

Crear el secreto de repositorio **`ANDROID_SIGNING_BACKUP_PASSWORD`** en
[Settings → Secrets and variables → Actions → New repository secret](https://github.com/Julianchoo/Breeze-AI-Note-Taker/settings/secrets/actions/new).
Usar una contraseña aleatoria de al menos 32 caracteres generada por un gestor de
contraseñas, y guardarla también en ese gestor. No compartirla en chat, issues o
commits. La integración GitHub disponible no permite escribir secretos y el CLI
no puede autenticarse desde este entorno; ese paso requiere al propietario.

El flujo propuesto usa esa única contraseña tanto para el PKCS12 como para su
copia cifrada con GnuPG AES-256. El respaldo duradero sería una release separada
`android-signing-backup` con **solo** `breeze-signing.p12.gpg` y un manifiesto
público. Nunca subir el `.p12` sin cifrar ni la contraseña. Descargar el respaldo
cifrado y guardarlo fuera de GitHub también; sin la contraseña no se puede recuperar
la clave. La caché de Actions deja de ser la fuente del firmante.

## Utilidad preparada y probada

`scripts/android-signing-backup.py` cifra o restaura **una clave existente**.
Recibe la contraseña mediante `ANDROID_SIGNING_BACKUP_PASSWORD`, y la pasa a GPG
por entrada estándar, sin incluirla en argumentos o logs. Por defecto, el PKCS12
usa la misma contraseña y alias `breeze`; para una clave existente con otros datos,
usar `BREEZE_KEYSTORE_PASSWORD` y `BREEZE_KEY_ALIAS`. Estas variables son entradas
para la utilidad, no nuevos secretos obligatorios del flujo propuesto.

En un runner aislado, con las variables ya configuradas y la clave privada dentro
de `$RUNNER_TEMP`, el uso es:

```bash
python3 scripts/android-signing-backup.py encrypt \
  "$RUNNER_TEMP/breeze-signing.p12" "$RUNNER_TEMP/breeze-signing.p12.gpg" \
  --manifest "$RUNNER_TEMP/android-signing-backup.json"

# En otro runner: descargar primero los dos assets cifrado/manifiesto.
python3 scripts/android-signing-backup.py decrypt \
  "$RUNNER_TEMP/breeze-signing.p12.gpg" "$RUNNER_TEMP/restored-signing.p12" \
  --manifest "$RUNNER_TEMP/android-signing-backup.json"
```

El cifrado comprueba una restauración completa antes de escribir el resultado.
La restauración exige la protección de integridad de GPG, el SHA-256 del PKCS12 y
el certificado público del manifiesto. Rechaza contraseñas incorrectas, corrupción,
un certificado distinto y sobrescribir una clave existente. Los archivos privados
restaurados tienen permisos `0600`. El manifiesto contiene versión del formato,
alias y huellas públicas; no contiene secretos.

Pruebas con una clave efímera que se elimina al finalizar:

```bash
python3 scripts/test-android-signing-backup.py
```

## Activación posterior a la aprobación

Después de crear el secreto **y** aprobar la migración, integrar un workflow que:

1. Genere la clave una sola vez en un runner, cifre y verifique el backup y publique
   únicamente esos dos assets en la release separada de respaldo.
2. En cada compilación, restaure la misma clave desde esos assets y confirme el
   certificado del manifiesto antes de firmar el APK. Si falta un asset o el secreto,
   falle; nunca genere otra clave para reemplazarla.
3. Prepare el APK candidato en un canal nuevo, manteniendo la release anterior.
   Cambie la descarga recomendada solo como parte de la migración autorizada.
4. Verifique una segunda actualización con ese mismo certificado y un `versionCode`
   mayor antes de declarar que las actualizaciones conservan datos.

El workflow activo todavía conserva el bloqueo de firma original. La utilidad
por sí sola no restablece las actualizaciones del APK existente.
