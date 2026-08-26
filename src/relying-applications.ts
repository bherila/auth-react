/**
 * The sibling applications an identity provider reports for the signed-in person.
 *
 * Every relying party receives this list the same way — server-side, injected per request
 * from the session rather than compiled into a bundle — but each one carries it into the
 * page differently: a `#app-initial-data` script tag, an Inertia shared prop, a Blade loop.
 * What they cannot afford to do differently is decide which entries are safe to render, so
 * that decision lives here and the transport stays the application's business.
 */
export interface RelyingApplication {
  key: string;
  name: string;
  url: string;
}

/**
 * Reduce a URL from the wire to one that is safe to put in an `href`, or reject it.
 *
 * These arrive as text in the page and end up as a link the browser will follow, so the
 * scheme is what matters: `javascript:` and `data:` both pass a server-side URL validity
 * check but execute rather than navigate. Parsing and allowing only http(s) is stronger
 * than matching a prefix — it normalises away the leading control characters, mixed case,
 * and escapes that a hand-rolled test can be walked past — and it returns the *parsed*
 * form, so what gets rendered is exactly what was validated.
 *
 * Absolute URLs only, deliberately. These point at other origins; a relative one means the
 * provider told us something unexpected, and guessing a base for it would be inventing a
 * destination rather than validating one.
 */
export function safeApplicationHref(url: string): string | null {
  try {
    const parsed = new URL(url);

    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.toString() : null;
  } catch {
    return null;
  }
}

/**
 * Validate whatever the page handed over into a list that is safe to render.
 *
 * Unrecognised entries are dropped rather than throwing. This is navigation chrome: one
 * malformed entry, or a provider that has grown a field, must not be able to take down the
 * page it appears on. Anything that is not a well-formed list degrades to an empty menu.
 */
export function relyingApplicationsFrom(value: unknown): RelyingApplication[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry): RelyingApplication[] => {
    if (typeof entry !== 'object' || entry === null) {
      return [];
    }

    const { key, name, url } = entry as Partial<RelyingApplication>;

    if (typeof key !== 'string' || typeof name !== 'string' || typeof url !== 'string') {
      return [];
    }

    if (key === '' || name.trim() === '') {
      return [];
    }

    const href = safeApplicationHref(url);

    return href === null ? [] : [{ key, name: name.trim(), url: href }];
  });
}
