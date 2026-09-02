export async function acquireCameraStream(): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("Tu navegador no permite el acceso a la cámara.");
  }
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: { ideal: "environment" } },
  });
  stream.getTracks().forEach((t) => t.stop());
  return stream;
}

type CameraPlatform =
  | "ios"
  | "android"
  | "desktop-chrome"
  | "desktop-firefox"
  | "desktop-other"
  | "unknown";

function detectPlatform(): CameraPlatform {
  if (typeof navigator === "undefined") return "unknown";
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  if (/Android/i.test(ua)) return "android";
  if (/Edg\//.test(ua)) return "desktop-chrome"; // Edge es Chromium: mismo flujo que Chrome
  if (/Chrome\//.test(ua) && !/OPR|Opera/i.test(ua)) return "desktop-chrome";
  if (/Firefox\//.test(ua)) return "desktop-firefox";
  if (/Windows|Macintosh|Linux/i.test(ua)) return "desktop-other";
  return "unknown";
}

export function cameraPermissionInstructions(): string {
  switch (detectPlatform()) {
    case "android":
      return [
        "Permiso de cámara denegado.",
        "Para que vuelva a preguntar en Android (Chrome):",
        "1. Tocá el ⋮ (tres puntos) de arriba a la derecha",
        "2. Entrá a Configuración del sitio",
        "3. Cámara → elegí Preguntar",
        "Después tocá Reintentar.",
      ].join("\n");
    case "ios":
      return [
        "Permiso de cámara denegado.",
        "Para que vuelva a preguntar en iPhone/iPad:",
        "1. Cerrá esta pestaña y volvé a abrirla (a veces alcanza)",
        "2. Si no pregunta de nuevo: Ajustes del iPhone → Safari → Cámara",
        "3. Elegí Preguntar para este sitio",
        "Después tocá Reintentar.",
      ].join("\n");
    case "desktop-firefox":
      return [
        "Permiso de cámara denegado.",
        "Para que Firefox vuelva a preguntar:",
        "1. Tocá el candado de la barra de direcciones",
        "2. Entrá a Permisos",
        "3. Cámara → elegí Permitir",
        "Después tocá Reintentar.",
      ].join("\n");
    case "desktop-chrome":
    case "desktop-other":
      return [
        "Permiso de cámara denegado.",
        "Para que el navegador vuelva a preguntar:",
        "1. Tocá el candado de la barra de direcciones",
        "2. Entrá a Configuración del sitio",
        "3. Cámara → elegí Preguntar",
        "Después tocá Reintentar.",
      ].join("\n");
    default:
      return "Permiso de cámara denegado. Para que el navegador vuelva a preguntar, habilitá la cámara desde la configuración del sitio (candado o ⋮ → Configuración del sitio → Cámara) y reintentá.";
  }
}

/** Traduce el error de getUserMedia / html5-qrcode a un mensaje accionable. */
export function cameraErrorMessage(err: any): string {
  const name = err?.name;
  if (name === "NotAllowedError" || name === "PermissionDeniedError") {
    return cameraPermissionInstructions();
  }
  if (name === "NotFoundError") {
    return "No se detectó ninguna cámara en este dispositivo.";
  }
  if (name === "NotReadableError") {
    return "La cámara está en uso por otra aplicación. Cerrá la otra app e intentá de nuevo.";
  }
  if (name === "OverconstrainedError") {
    return "La cámara no soporta el modo de escaneo requerido.";
  }
  if (name === "SecurityError") {
    return "El acceso a la cámara está bloqueado en este contexto.";
  }
  return err?.message || "No se pudo activar la cámara.";
}
