const FIELD_LABELS: Record<string, string> = {
  // auth / users
  name: "nombre",
  email: "correo electrónico",
  password: "contraseña",
  newPassword: "nueva contraseña",
  phone: "teléfono",
  role: "rol",
  storeName: "nombre de la tienda",
  storeAddress: "dirección de la tienda",
  storePhone: "teléfono de la tienda",
  adminName: "nombre del administrador",
  adminEmail: "correo del administrador",
  adminPassword: "contraseña del administrador",
  refreshToken: "token de refresco",
  sessionId: "sesión",
  // products
  price: "precio",
  cost: "costo",
  stock: "stock",
  barcode: "código de barras",
  unit_type: "tipo de unidad",
  unit_quantity: "cantidad por unidad",
  category_id: "categoría",
  supplier_id: "proveedor",
  low_stock_threshold: "umbral de stock mínimo",
  // services
  base_price: "precio base",
  // categories / suppliers / generic
  description: "descripción",
  address: "dirección",
  notes: "notas",
  contact_name: "nombre de contacto",
  is_active: "estado activo",
  active: "estado activo",
  // sales / inventory
  items: "productos",
  quantity: "cantidad",
  product_id: "producto",
  // printers
  connection_type: "tipo de conexión",
  codepage: "codepage",
};

function fieldLabel(raw: string): string {
  return FIELD_LABELS[raw] ?? raw;
}

interface ValidationItem {
  instancePath?: string;
  keyword?: string;
  message?: string;
  params?: Record<string, unknown>;
}

/**
 * Construye un mensaje entendible a partir del primer item de validación de
 * Fastify/AJV (`error.validation[0]`). Devuelve null si no se puede construir.
 */
export function formatAjvValidationMessage(item: ValidationItem | undefined): string | null {
  if (!item) return null;
  const keyword = item.keyword ?? "";

  // `required` → AJV indica la propiedad faltante en params.missingProperty.
  if (keyword === "required") {
    const missing = item.params?.missingProperty;
    const label = typeof missing === "string" ? fieldLabel(missing) : "campo";
    return `El campo "${label}" es obligatorio`;
  }

  const path = (item.instancePath ?? "").replace(/^\//, "");
  const rawField = path.split("/").pop() ?? "";
  const label = fieldLabel(rawField);

  switch (keyword) {
    case "exclusiveMinimum": {
      const limit = item.params?.limit;
      return `El campo "${label}" debe ser mayor que ${typeof limit === "number" ? limit : 0}`;
    }
    case "minimum": {
      const limit = item.params?.limit;
      return `El campo "${label}" debe ser mayor o igual que ${typeof limit === "number" ? limit : 0}`;
    }
    case "maximum":
      return `El campo "${label}" es demasiado grande`;
    case "type": {
      const type = item.params?.type;
      const typeName =
        type === "number" ? "un número" : type === "string" ? "texto" : type === "boolean" ? "un valor verdadero/falso" : "válido";
      return `El campo "${label}" debe ser ${typeName}`;
    }
    case "format": {
      const fmt = item.params?.format;
      return fmt === "email"
        ? `El campo "${label}" debe ser un correo electrónico válido`
        : `El campo "${label}" tiene un formato inválido`;
    }
    case "minLength": {
      const limit = item.params?.limit;
      return `El campo "${label}" debe tener al menos ${typeof limit === "number" ? limit : 1} caracteres`;
    }
    case "maxLength":
      return `El campo "${label}" es demasiado largo`;
    case "enum":
      return `El campo "${label}" tiene un valor no permitido`;
    case "minItems":
      return `El campo "${label}" no puede estar vacío`;
    default:
      return label ? `El campo "${label}" es inválido` : null;
  }
}

interface ZodIssue {
  path?: (string | number)[];
  message?: string;
  code?: string;
  minimum?: number | bigint;
  type?: string;
}

export function formatZodIssueMessage(issue: ZodIssue | undefined): string | null {
  if (!issue) return null;
  const rawField =
    Array.isArray(issue.path) && issue.path.length > 0 ? String(issue.path[issue.path.length - 1]) : "";
  const label = fieldLabel(rawField);

  switch (issue.code) {
    case "invalid_type":
      return `El campo "${label}" debe ser ${issue.type === "number" ? "un número" : issue.type === "string" ? "texto" : "válido"}`;
    case "too_small":
      if (issue.type === "string") return `El campo "${label}" es demasiado corto`;
      return `El campo "${label}" debe ser mayor o igual que ${issue.minimum ?? 0}`;
    case "too_big":
      return `El campo "${label}" es demasiado grande`;
    case "invalid_string":
      return `El campo "${label}" tiene un formato inválido`;
    case "custom":
      return issue.message ? `El campo "${label}": ${issue.message}` : `El campo "${label}" es inválido`;
    default:
      return label ? `El campo "${label}" es inválido` : null;
  }
}
