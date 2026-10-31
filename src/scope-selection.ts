/**
 * Pure selection logic for the scope picker. Implications are a picker-only
 * cascade: the credential still stores exactly the ids that end up selected,
 * and the server never infers one scope from another.
 */

/** scope id => scope ids it needs, e.g. `{ 'billing:write': ['billing:read'] }`. */
export type ScopeImplications = Record<string, string[]>;

/** Transitive closure of `implications`, with self-references and cycles dropped. */
export function closeImplications(implications: ScopeImplications): ScopeImplications {
  const closed: ScopeImplications = {};
  for (const key of Object.keys(implications)) {
    const seen = new Set<string>();
    const walk = (id: string) => {
      for (const needed of implications[id] ?? []) {
        if (needed !== key && !seen.has(needed)) {
          seen.add(needed);
          walk(needed);
        }
      }
    };
    walk(key);
    if (seen.size > 0) {
      closed[key] = [...seen];
    }
  }

  return closed;
}

/** Keeps only entries whose key and every requirement are offered; drops entries left empty. */
export function restrictImplications(implications: ScopeImplications | undefined, offered: Set<string>): ScopeImplications {
  const result: ScopeImplications = {};
  for (const [key, needed] of Object.entries(implications ?? {})) {
    if (!offered.has(key) || !Array.isArray(needed)) {
      continue;
    }
    const kept = needed.filter((id) => offered.has(id));
    if (kept.length > 0) {
      result[key] = kept;
    }
  }

  return result;
}

/** Orders `ids` by `catalog`, removing duplicates and ids not in it. */
export function inCatalogOrder(ids: Iterable<string>, catalog: string[]): string[] {
  const wanted = new Set(ids);

  return catalog.filter((id) => wanted.has(id));
}

/** Ticking: adds the ids and everything they need. */
export function withScopes(selected: string[], ids: string[], closed: ScopeImplications): Set<string> {
  const next = new Set(selected);
  for (const id of ids) {
    next.add(id);
    for (const needed of closed[id] ?? []) {
      next.add(needed);
    }
  }

  return next;
}

/** Unticking: removes the ids and every selected scope that needs one of them. */
export function withoutScopes(selected: string[], ids: string[], closed: ScopeImplications): Set<string> {
  const removed = new Set(ids);
  const next = new Set(selected);
  for (const id of ids) {
    next.delete(id);
  }
  for (const [scope, needed] of Object.entries(closed)) {
    if (needed.some((id) => removed.has(id))) {
      next.delete(scope);
    }
  }

  return next;
}

/** Selected scopes that need `id`, in catalog order: why `id` is ticked beyond the person's own choice. */
export function neededBy(id: string, selected: string[], closed: ScopeImplications): string[] {
  return selected.filter((scope) => scope !== id && (closed[scope] ?? []).includes(id));
}

export function sameSelection(a: string[], b: string[]): boolean {
  if (a.length !== b.length) {
    return false;
  }
  const set = new Set(a);

  return b.every((id) => set.has(id));
}
