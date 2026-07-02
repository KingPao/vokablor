/** Hono's `app.request()` return type is `Response | Promise<Response>`; this normalizes + types the JSON body. */
export async function json<T = unknown>(response: Response | Promise<Response>): Promise<T> {
  const resolved = await response;
  return (await resolved.json()) as T;
}
