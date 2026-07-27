import { zodToJsonSchema } from "zod-to-json-schema"
import type { ZodTypeAny } from "zod"

function resolveRef(root: Record<string, unknown>, ref: string): Record<string, unknown> | null {
  if (!ref.startsWith("#/")) return null
  const parts = ref.slice(2).split("/")
  let current: unknown = root
  for (const part of parts) {
    if (current && typeof current === "object" && part in (current as Record<string, unknown>)) {
      current = (current as Record<string, unknown>)[part]
    } else {
      return null
    }
  }
  return current as Record<string, unknown>
}

function sanitizeSchema(node: unknown): void {
  if (!node || typeof node !== "object") return

  const obj = node as Record<string, unknown>

  // ── exclusiveMinimum / exclusiveMaximum booleanos → numéricos ──
  if (obj.exclusiveMinimum === true && typeof obj.minimum === "number") {
    obj.exclusiveMinimum = obj.minimum
  } else if (obj.exclusiveMinimum === true) {
    obj.exclusiveMinimum = 0
  }

  if (obj.exclusiveMaximum === true && typeof obj.maximum === "number") {
    obj.exclusiveMaximum = obj.maximum
  } else if (obj.exclusiveMaximum === true) {
    obj.exclusiveMaximum = 0
  }

  // ── nullable sin type → inválido para Ajv ──
  const propagateNullable = (arr: unknown[]) => {
    for (const alt of arr) {
      if (alt && typeof alt === "object") {
        (alt as Record<string, unknown>).nullable = true
      }
    }
  }

  if (obj.nullable === true && !obj.type) {
    if (Array.isArray(obj.anyOf)) propagateNullable(obj.anyOf)
    else if (Array.isArray(obj.oneOf)) propagateNullable(obj.oneOf)
    delete obj.nullable
  }

  // ── Recursión ──
  if (obj.properties && typeof obj.properties === "object") {
    for (const val of Object.values(obj.properties as Record<string, unknown>)) {
      sanitizeSchema(val)
    }
  }
  if (obj.items && typeof obj.items === "object") {
    sanitizeSchema(obj.items)
  }
  ;["oneOf", "anyOf", "allOf"].forEach((key) => {
    const arr = obj[key]
    if (Array.isArray(arr)) arr.forEach(sanitizeSchema)
  })
}

export function toJsonSchema(schema: ZodTypeAny) {
  const jsonSchema = zodToJsonSchema(schema, { target: "openApi3" }) as Record<string, unknown>

  // Extraer el schema raíz siguiendo la $ref (si existe)
  const root = jsonSchema.$ref && typeof jsonSchema.$ref === "string"
    ? resolveRef(jsonSchema, jsonSchema.$ref) ?? jsonSchema
    : jsonSchema

  // Sanitizar para compatibilidad con Ajv
  sanitizeSchema(root)

  // Forzar additionalProperties: false en objetos raíz
  if (root.type === "object") {
    root.additionalProperties = false
  }

  return root
}
