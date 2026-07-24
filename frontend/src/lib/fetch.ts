export async function crossFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  return globalThis.fetch(input, init);
}
