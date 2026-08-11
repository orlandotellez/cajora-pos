package com.dev_espada.frontend

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import android.util.Log
import androidx.core.content.FileProvider
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin
import java.io.File

// ===========================================================================
// Actualización automática (Android)
//
// Recibe el path del APK descargado por `download_apk` (Rust) y abre el
// instalador de paquetes con FileProvider + ACTION_VIEW. El file_paths.xml
// ya expone `cache-path`, que es donde Rust guarda `pos-update.apk`.
//
// En Android 8+ el usuario debe autorizar "Instalar apps desconocidas" para
// este paquete; si no está habilitado, lo llevamos a los ajustes de la app.
// ===========================================================================

@TauriPlugin
class UpdaterPlugin(private val activity: Activity) : Plugin(activity) {

  companion object {
    private const val LOG_TAG = "UpdaterPlugin"
  }

  @Command
  fun installApk(invoke: Invoke) {
    val args = invoke.parseArgs(InstallApkArgs::class.java)
    val apkPath = args.path
    if (apkPath.isBlank()) {
      invoke.reject("Ruta del APK vacía")
      return
    }

    val apkFile = File(apkPath)
    if (!apkFile.exists() || !apkFile.canRead()) {
      invoke.reject("El APK no existe o no se puede leer: $apkPath")
      return
    }

    // `canRequestPackageInstalls` existe recién en Android 8 (API 26).
    // En Android 7 (API 24-25) el permiso de "instalar apps desconocidas"
    // es global y se pide en Settings > Security; no lo bloqueamos acá.
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O &&
      !activity.packageManager.canRequestPackageInstalls()
    ) {
      // Android 8+: sin el permiso "Instalar apps desconocidas" el Intent
      // falla silenciosamente. Lo pedimos y abortamos.
      openInstallSettings()
      invoke.reject("Se requiere permiso para instalar apps desconocidas")
      return
    }

    val apkUri = FileProvider.getUriForFile(
      activity,
      "${activity.packageName}.fileprovider",
      apkFile
    )

    val intent = Intent(Intent.ACTION_VIEW).apply {
      setDataAndType(apkUri, "application/vnd.android.package-archive")
      addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    }

    try {
      activity.startActivity(intent)
      invoke.resolve(JSObject().put("installed", true))
    } catch (e: Exception) {
      Log.e(LOG_TAG, "No se pudo abrir el instalador", e)
      invoke.reject("No se pudo abrir el instalador: ${e.message}")
    }
  }

  private fun openInstallSettings() {
    try {
      val intent = Intent(
        Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
        Uri.parse("package:${activity.packageName}")
      )
      activity.startActivity(intent)
    } catch (e: Exception) {
      Log.e(LOG_TAG, "No se pudo abrir los ajustes de instalación", e)
    }
  }
}

@InvokeArg
internal class InstallApkArgs {
  lateinit var path: String
}
