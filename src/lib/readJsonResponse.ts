/** Parse fetch body as JSON; surface HTML/404 pages as a clear error (not SyntaxError). */
export async function readJsonResponse<T extends Record<string, unknown> = Record<string, unknown>>(
  res: Response
): Promise<T> {
  const text = await res.text();
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error(`Empty response from server (${res.status})`);
  }
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    const looksHtml = trimmed.startsWith("<") || /^The page/i.test(trimmed);
    if (looksHtml || res.status === 404) {
      throw new Error(
        "Payment API returned a web page instead of JSON. The route may be misconfigured on the edge proxy — use the latest deploy or try again from the Vercel URL."
      );
    }
    throw new Error(`Invalid server response: ${trimmed.slice(0, 120)}`);
  }
}
