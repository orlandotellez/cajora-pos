export const CLIENT_ERROR_MESSAGES: Record<number, string> = {
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
};

const CONNECTION_ERROR_MESSAGE = "Error al conectar con el servidor";
const UNEXPECTED_ERROR_MESSAGE = "Error inesperado";

const KNOWN_CLIENT_MESSAGES = new Set<string>([
  ...Object.values(CLIENT_ERROR_MESSAGES),
  CONNECTION_ERROR_MESSAGE,
  UNEXPECTED_ERROR_MESSAGE,
]);

function extractErrorMessage(body: unknown): string | null {
  if (typeof body === "object" && body !== null) {
    const message = (body as Record<string, unknown>).message;
    if (typeof message === "string") return message;
  }
  return null;
}

export function extractErrorCode(body: unknown): string | null {
  if (typeof body === "object" && body !== null) {
    const code = (body as Record<string, unknown>).code;
    if (typeof code === "string") return code;
  }
  return null;
}

export function resolveErrorMessage(status: number, body: unknown, code?: string): string {
  const bodyMessage = extractErrorMessage(body);

  // 1. Validación de formulario: confiamos en el mensaje del backend (ya es ES entendible).
  if ((status === 400 || status === 422) && bodyMessage !== null) return bodyMessage;

  // 2. Resto: solo genéricos conocidos del mapa.
  if (bodyMessage !== null && KNOWN_CLIENT_MESSAGES.has(bodyMessage)) return bodyMessage;

  const mapped = CLIENT_ERROR_MESSAGES[status];
  if (mapped) return mapped;

  if (status === 0) return CONNECTION_ERROR_MESSAGE;

  void code;
  return UNEXPECTED_ERROR_MESSAGE;
}
