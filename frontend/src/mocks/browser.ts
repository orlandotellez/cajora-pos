import { setupWorker } from "msw/browser";
import { handlers } from "./handlers";

/**
 * Worker de MSW del modo demo.
 *
 * `onUnhandledRequest: "error"` grita en consola si algún endpoint no tiene
 * handler — combinado con el catch-all 404 de handlers.ts, es imposible que
 * un request salga a la red real sin que nos enteremos.
 */
export const worker = setupWorker(...handlers);

worker.start({
  onUnhandledRequest: "error",
});