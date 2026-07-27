import type { SwaggerOptions } from "@fastify/swagger";
import type { FastifySwaggerUiOptions } from "@fastify/swagger-ui";
import { env } from "./env";

export const swaggerOptions: SwaggerOptions = {
  openapi: {
    info: {
      title: "POS System API",
      description:
        "API REST para sistema de punto de venta (POS). Gestión de productos, inventario, ventas, servicios, usuarios y reportes.",
      version: "1.0.0",
    },
    servers: [
      {
        url: `http://localhost:${env.PORT}/api/v1`,
        description: "Servidor de desarrollo",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "Token JWT de acceso (accessToken)",
        },
        cookieAuth: {
          type: "apiKey",
          in: "cookie",
          name: "accessToken",
          description: "Cookie httpOnly con el accessToken JWT",
        },
      },
    },
    tags: [
      {
        name: "Auth",
        description:
          "Autenticación, registro, verificación de email, recuperación de contraseña",
      },
      { name: "Products", description: "Gestión de productos (CRUD, búsqueda por código de barra)" },
      { name: "Categories", description: "Categorías de productos" },
      { name: "Services", description: "Servicios compuestos por productos" },
      {
        name: "Sales",
        description: "Ventas con productos y servicios, reportes",
      },
      { name: "Inventory", description: "Movimientos de inventario individuales" },
      {
        name: "Inventory Batches",
        description: "Lotes de inventario (entradas/salidas/ajustes masivos)",
      },
      { name: "Suppliers", description: "Proveedores" },
      { name: "Settings", description: "Configuración del negocio" },
      { name: "Users", description: "Gestión de usuarios del sistema" },
      { name: "Health", description: "Health check del servidor" },
    ],
  },
};

export const swaggerUiOptions: FastifySwaggerUiOptions = {
  routePrefix: "/docs",
  uiConfig: {
    docExpansion: "list",
    deepLinking: true,
  },
};
