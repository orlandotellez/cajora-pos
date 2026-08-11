export const STATUS_MESSAGES: Record<number, string> = {
  400: "Solicitud inválida",
  401: "No autorizado",
  403: "Acceso denegado",
  404: "No encontrado",
  405: "Método no permitido",
  408: "Tiempo de espera agotado",
  409: "Conflicto",
  413: "Solicitud demasiado grande",
  415: "Tipo de contenido no soportado",
  422: "Entidad no procesable",
  429: "Demasiadas solicitudes",
  500: "Error interno del servidor",
}

export const getErrorMessageForStatus = (status: number): string =>
  STATUS_MESSAGES[status] ?? "Error inesperado"

export const STATUS_CODES: Record<number, string> = {
  400: "BAD_REQUEST",
  401: "UNAUTHORIZED",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  405: "METHOD_NOT_ALLOWED",
  408: "REQUEST_TIMEOUT",
  409: "CONFLICT",
  413: "PAYLOAD_TOO_LARGE",
  415: "UNSUPPORTED_MEDIA_TYPE",
  422: "UNPROCESSABLE_ENTITY",
  429: "TOO_MANY_REQUESTS",
  500: "INTERNAL_SERVER_ERROR",
}

export const getCodeForStatus = (status: number): string =>
  STATUS_CODES[status] ?? "INTERNAL_SERVER_ERROR"
