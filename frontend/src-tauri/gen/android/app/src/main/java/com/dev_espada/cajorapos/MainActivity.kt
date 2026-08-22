package com.dev_espada.cajorapos

import android.Manifest
import android.content.pm.PackageManager
import android.os.Bundle
import android.view.ViewGroup
import android.webkit.PermissionRequest
import android.webkit.WebChromeClient
import android.webkit.WebView
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat

class MainActivity : TauriActivity() {
  private var pendingWebViewPermission: PermissionRequest? = null

  private val requestPermissionsLauncher = registerForActivityResult(
    ActivityResultContracts.RequestMultiplePermissions()
  ) { grants ->
    val cameraGranted = grants[Manifest.permission.CAMERA] == true
    pendingWebViewPermission?.let { request ->
      if (cameraGranted) {
        request.grant(arrayOf(PermissionRequest.RESOURCE_VIDEO_CAPTURE))
      } else {
        request.deny()
      }
      pendingWebViewPermission = null
    }
  }

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    hookWebViewPermissions()
  }

  override fun onResume() {
    super.onResume()
    hookWebViewPermissions()
  }

  private fun hookWebViewPermissions() {
    window.decorView.post {
      findWebView(window.decorView.rootView)?.let { wv ->
        wv.webChromeClient = object : WebChromeClient() {
          override fun onPermissionRequest(request: PermissionRequest) {
            runOnUiThread {
              val cameraGranted = ContextCompat.checkSelfPermission(
                this@MainActivity, Manifest.permission.CAMERA
              ) == PackageManager.PERMISSION_GRANTED

              if (cameraGranted) {
                request.grant(request.resources)
              } else {
                pendingWebViewPermission = request
                requestPermissionsLauncher.launch(
                  arrayOf(Manifest.permission.CAMERA)
                )
              }
            }
          }
        }
      }
    }
  }

  private fun findWebView(view: android.view.View): WebView? {
    if (view is WebView) return view
    if (view is ViewGroup) {
      for (i in 0 until view.childCount) {
        findWebView(view.getChildAt(i))?.let { return it }
      }
    }
    return null
  }
}
