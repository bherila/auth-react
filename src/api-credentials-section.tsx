import * as React from 'react';

import { resolveAuthComponents } from './components';
import type { AuthComponentInput } from './types';
import { getCsrfToken } from './webauthn-utils';

export interface ApiCredentialScope {
  id: string;
  description: string;
}

export interface ApiCredentialToken {
  id: string;
  name: string;
  scopes: string[];
  created_at: string | null;
  expires_at: string | null;
  revoke_href: string;
}

export interface ApiCredentialApp {
  id: string;
  name: string;
  confidential: boolean;
  redirect_uris: string[];
  scopes: string[];
  created_at: string | null;
  delete_href: string;
}

/** The server's index response (`data`): every URL is finished; this component assembles none. */
export interface ApiCredentialIndex {
  scopes: ApiCredentialScope[];
  token_lifetimes: string[];
  /** Null while issuing is unavailable (the OAuth server is switched off). Revocation stays available. */
  issue_token_href: string | null;
  register_app_href: string | null;
  tokens: ApiCredentialToken[];
  apps: ApiCredentialApp[];
}

export type IssuedApiCredential =
  | { kind: 'token'; name: string; token: string; expires_at?: string }
  | { kind: 'app'; name: string; client_id: string; client_secret: string | null };

export interface ApiCredentialEndpointLink {
  label: string;
  url: string;
}

export interface ApiCredentialsSectionProps {
  /** The credential service's index URL (GET). */
  indexUrl: string;
  components: AuthComponentInput;
  /** Values a connector needs: the OpenAPI document, API base, OAuth authorize/token URLs, MCP URL. */
  links?: ApiCredentialEndpointLink[];
  csrfToken?: string;
  onSuccess?: (message: string) => void;
  onError?: (field: string, message: string) => void;
}

/**
 * A person's credentials for apps that use the API: personal API tokens (for
 * connectors that ask for a key) and OAuth apps (for connectors that run the
 * authorization-code flow).
 *
 * Each secret arrives once, in the response that created it, and lives only
 * in this component's memory; afterwards only the lists are reloaded, so it is
 * never part of page props or browser history.
 */
export function ApiCredentialsSection({ indexUrl, components, links = [], csrfToken, onSuccess, onError }: ApiCredentialsSectionProps) {
  const { Card, CardContent, CardDescription, CardHeader, CardTitle } = resolveAuthComponents(components);
  const [index, setIndex] = React.useState<ApiCredentialIndex | null>(null);
  const [issued, setIssued] = React.useState<IssuedApiCredential | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  // Callbacks are read through a ref so an inline function from the parent
  // never re-triggers the index load (which, on failure, could loop).
  const onErrorRef = React.useRef(onError);
  onErrorRef.current = onError;

  const reload = React.useCallback(async () => {
    const result = await credentialRequest<ApiCredentialIndex>('GET', indexUrl, undefined, csrfToken);
    if (result.ok) {
      setIndex(result.data);
      setLoadError(null);
    } else {
      setLoadError(result.message);
      onErrorRef.current?.('api-credentials', result.message);
    }
  }, [indexUrl, csrfToken]);

  React.useEffect(() => {
    void reload();
  }, [reload]);

  const shared = { components, csrfToken, onError, onSuccess };

  return (
    <Card>
      <CardHeader>
        <CardTitle>API access</CardTitle>
        <CardDescription>
          Connect apps that use the API. Register an OAuth app for apps that sign you in, or create an API token for apps
          that ask for a key. Each carries only the permissions you choose, and never more than your own access.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div style={{ display: 'grid', gap: '1.5rem', minWidth: 0 }}>
          {links.length > 0 && (
            <dl style={{ display: 'grid', gap: '0.5rem', minWidth: 0 }}>
              {links.map((link) => (
                <div key={link.label} style={{ minWidth: 0 }}>
                  <dt>{link.label}</dt>
                  <dd style={{ margin: 0, overflowWrap: 'anywhere' }}>
                    <code>{link.url}</code> <CopyButton text={link.url} label={link.label} components={components} />
                  </dd>
                </div>
              ))}
            </dl>
          )}
          {issued !== null && <IssuedNotice issued={issued} components={components} onDismiss={() => setIssued(null)} />}
          {loadError !== null && <p role="alert">{loadError}</p>}
          {index !== null && (
            <>
              {(index.issue_token_href === null || index.register_app_href === null) && (
                <p role="status">Creating new credentials is unavailable right now. You can still revoke existing ones.</p>
              )}
              <TokenSection index={index} {...shared} onIssued={setIssued} reload={reload} />
              <AppSection index={index} {...shared} onIssued={setIssued} reload={reload} />
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

interface SectionProps {
  index: ApiCredentialIndex;
  components: AuthComponentInput;
  csrfToken?: string;
  onIssued: (issued: IssuedApiCredential) => void;
  reload: () => Promise<void>;
  onSuccess?: (message: string) => void;
  onError?: (field: string, message: string) => void;
}

function TokenSection({ index, components, csrfToken, onIssued, reload, onSuccess, onError }: SectionProps) {
  const { Button, Input, Label } = resolveAuthComponents(components);
  const [name, setName] = React.useState('');
  const [scopes, setScopes] = React.useState<string[]>([]);
  const [lifetime, setLifetime] = React.useState(index.token_lifetimes[0] ?? '');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    if (index.issue_token_href === null) {
      return;
    }
    setBusy(true);
    const result = await credentialRequest<IssuedApiCredential>('POST', index.issue_token_href, { name, scopes, lifetime }, csrfToken);
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      onError?.('api-tokens', result.message);

      return;
    }
    setError(null);
    setName('');
    setScopes([]);
    onIssued(result.data);
    onSuccess?.('API token created.');
    await reload();
  }

  async function revoke(token: ApiCredentialToken) {
    const result = await credentialRequest('DELETE', token.revoke_href, undefined, csrfToken);
    if (!result.ok) {
      onError?.('api-tokens', result.message);

      return;
    }
    onSuccess?.('API token revoked.');
    await reload();
  }

  return (
    <section style={{ display: 'grid', gap: '0.75rem', minWidth: 0 }}>
      <h3>API tokens</h3>
      {index.issue_token_href !== null && (
        <form onSubmit={create} style={{ display: 'grid', gap: '0.75rem' }}>
          <div style={{ display: 'grid', gap: '0.25rem' }}>
            <Label htmlFor="api-token-name">Token name</Label>
            <Input id="api-token-name" value={name} maxLength={120} onChange={(event) => setName(event.target.value)} />
          </div>
          <ScopePicker idPrefix="api-token-scope" scopes={index.scopes} selected={scopes} onChange={setScopes} />
          <fieldset style={{ display: 'grid', gap: '0.25rem', border: 0, padding: 0 }}>
            <legend>Expires after</legend>
            {index.token_lifetimes.map((spec) => (
              <label key={spec}>
                <input type="radio" name="api-token-lifetime" checked={lifetime === spec} onChange={() => setLifetime(spec)} />{' '}
                {describeDuration(spec)}
              </label>
            ))}
          </fieldset>
          {error !== null && <p role="alert">{error}</p>}
          <div>
            <Button type="submit" disabled={busy || name.trim() === '' || scopes.length === 0 || lifetime === ''}>
              Create API token
            </Button>
          </div>
        </form>
      )}
      <ul style={{ display: 'grid', gap: '0.5rem', listStyle: 'none', padding: 0, margin: 0, minWidth: 0 }}>
        {index.tokens.map((token) => (
          <li key={token.id} style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
            <strong>{token.name}</strong> · {token.scopes.join(', ')}
            {token.expires_at !== null && <> · expires {new Date(token.expires_at).toLocaleString()}</>}{' '}
            <Button type="button" onClick={() => void revoke(token)}>
              Revoke
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function AppSection({ index, components, csrfToken, onIssued, reload, onSuccess, onError }: SectionProps) {
  const { Button, Input, Label } = resolveAuthComponents(components);
  const [name, setName] = React.useState('');
  const [redirects, setRedirects] = React.useState('');
  const [confidential, setConfidential] = React.useState(true);
  const [scopes, setScopes] = React.useState<string[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const redirectUris = redirects
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '');

  async function register(event: React.FormEvent) {
    event.preventDefault();
    if (index.register_app_href === null) {
      return;
    }
    setBusy(true);
    const result = await credentialRequest<IssuedApiCredential>(
      'POST',
      index.register_app_href,
      { name, redirect_uris: redirectUris, confidential, scopes },
      csrfToken,
    );
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      onError?.('oauth-apps', result.message);

      return;
    }
    setError(null);
    setName('');
    setRedirects('');
    setScopes([]);
    onIssued(result.data);
    onSuccess?.('OAuth app registered.');
    await reload();
  }

  async function remove(app: ApiCredentialApp) {
    const result = await credentialRequest('DELETE', app.delete_href, undefined, csrfToken);
    if (!result.ok) {
      onError?.('oauth-apps', result.message);

      return;
    }
    onSuccess?.('OAuth app deleted and its tokens revoked.');
    await reload();
  }

  return (
    <section style={{ display: 'grid', gap: '0.75rem', minWidth: 0 }}>
      <h3>OAuth apps</h3>
      {index.register_app_href !== null && (
        <form onSubmit={register} style={{ display: 'grid', gap: '0.75rem' }}>
          <div style={{ display: 'grid', gap: '0.25rem' }}>
            <Label htmlFor="oauth-app-name">App name</Label>
            <Input id="oauth-app-name" value={name} maxLength={120} onChange={(event) => setName(event.target.value)} />
          </div>
          <div style={{ display: 'grid', gap: '0.25rem' }}>
            <Label htmlFor="oauth-app-redirects">Redirect URIs (one per line)</Label>
            <textarea id="oauth-app-redirects" rows={3} value={redirects} onChange={(event) => setRedirects(event.target.value)} />
          </div>
          <fieldset style={{ display: 'grid', gap: '0.25rem', border: 0, padding: 0 }}>
            <legend>Client type</legend>
            <label>
              <input type="radio" name="oauth-app-type" checked={confidential} onChange={() => setConfidential(true)} /> Confidential:
              the app keeps a client secret on its server
            </label>
            <label>
              <input type="radio" name="oauth-app-type" checked={!confidential} onChange={() => setConfidential(false)} /> Public:
              no secret, PKCE only
            </label>
          </fieldset>
          <ScopePicker idPrefix="oauth-app-scope" scopes={index.scopes} selected={scopes} onChange={setScopes} />
          {error !== null && <p role="alert">{error}</p>}
          <div>
            <Button type="submit" disabled={busy || name.trim() === '' || redirectUris.length === 0 || scopes.length === 0}>
              Register OAuth app
            </Button>
          </div>
        </form>
      )}
      <ul style={{ display: 'grid', gap: '0.5rem', listStyle: 'none', padding: 0, margin: 0, minWidth: 0 }}>
        {index.apps.map((app) => (
          <li key={app.id} style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
            <strong>{app.name}</strong> · client ID <code>{app.id}</code> · {app.confidential ? 'confidential' : 'public'}
            <br />
            {app.redirect_uris.join(', ')}
            <br />
            May request: {app.scopes.join(', ')}{' '}
            <Button type="button" onClick={() => void remove(app)}>
              Delete
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ScopePicker({
  idPrefix,
  scopes,
  selected,
  onChange,
}: {
  idPrefix: string;
  scopes: ApiCredentialScope[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  return (
    <fieldset style={{ display: 'grid', gap: '0.25rem', border: 0, padding: 0, minWidth: 0 }}>
      <legend>Permissions</legend>
      {scopes.map((scope) => {
        const id = `${idPrefix}-${scope.id}`;

        return (
          <label key={scope.id} htmlFor={id} style={{ overflowWrap: 'anywhere' }}>
            <input
              id={id}
              type="checkbox"
              checked={selected.includes(scope.id)}
              onChange={(event) =>
                onChange(event.target.checked ? [...selected, scope.id] : selected.filter((value) => value !== scope.id))
              }
            />{' '}
            <code>{scope.id}</code> {scope.description}
          </label>
        );
      })}
    </fieldset>
  );
}

function IssuedNotice({
  issued,
  components,
  onDismiss,
}: {
  issued: IssuedApiCredential;
  components: AuthComponentInput;
  onDismiss: () => void;
}) {
  const { Button } = resolveAuthComponents(components);
  const values: ApiCredentialEndpointLink[] =
    issued.kind === 'token'
      ? [{ label: 'API token', url: issued.token }]
      : [
          { label: 'Client ID', url: issued.client_id },
          ...(issued.client_secret !== null ? [{ label: 'Client secret', url: issued.client_secret }] : []),
        ];

  return (
    <div role="status" style={{ display: 'grid', gap: '0.5rem', minWidth: 0 }}>
      <p style={{ overflowWrap: 'anywhere' }}>
        {issued.kind === 'token' ? `API token “${issued.name}” created.` : `OAuth app “${issued.name}” registered.`} Copy it now: it
        will not be shown again.
      </p>
      {values.map((value) => (
        <div key={value.label} style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
          {value.label}: <code>{value.url}</code> <CopyButton text={value.url} label={value.label} components={components} />
        </div>
      ))}
      <div>
        <Button type="button" onClick={onDismiss}>
          Done
        </Button>
      </div>
    </div>
  );
}

function CopyButton({ text, label, components }: { text: string; label: string; components: AuthComponentInput }) {
  const { Button } = resolveAuthComponents(components);
  const [copied, setCopied] = React.useState(false);

  return (
    <Button
      type="button"
      aria-label={`Copy ${label}`}
      onClick={async () => {
        try {
          await navigator.clipboard?.writeText(text);
          setCopied(true);
        } catch {
          setCopied(false);
        }
      }}
    >
      {copied ? 'Copied' : 'Copy'}
    </Button>
  );
}

/** PT4H → "4 hours", P30D → "30 days", P1Y → "1 year". Unknown shapes are shown as given. */
export function describeDuration(spec: string): string {
  const match = /^P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?)?$/.exec(spec);
  if (!match) {
    return spec;
  }
  const units = ['year', 'month', 'week', 'day', 'hour', 'minute'];
  const parts = match
    .slice(1)
    .map((value, position) => (value ? `${Number(value)} ${units[position]}${Number(value) === 1 ? '' : 's'}` : null))
    .filter((part): part is string => part !== null);

  return parts.length > 0 ? parts.join(' ') : spec;
}

type CredentialResult<T> = { ok: true; status: number; data: T } | { ok: false; status: number; message: string };

async function credentialRequest<T = unknown>(
  method: 'GET' | 'POST' | 'DELETE',
  url: string,
  body: object | undefined,
  csrfToken?: string,
): Promise<CredentialResult<T>> {
  let response: Response;
  try {
    response = await fetch(url, {
      method,
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(method !== 'GET' ? { 'X-CSRF-TOKEN': getCsrfToken(csrfToken) } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    return { ok: false, status: 0, message: 'The server could not be reached. Check the connection and try again.' };
  }

  const payload: unknown = await response.json().catch(() => null);
  if (response.ok) {
    const data = typeof payload === 'object' && payload !== null && 'data' in payload ? (payload as { data: T }).data : (payload as T);

    return { ok: true, status: response.status, data };
  }

  return { ok: false, status: response.status, message: refusalMessage(response.status, payload) };
}

function refusalMessage(status: number, payload: unknown): string {
  // Before the payload: the framework's own text for these tells nobody what to do.
  if (status === 401 || status === 419) {
    return 'Your session has expired. Reload the page and sign in again.';
  }
  if (typeof payload === 'object' && payload !== null) {
    const errors = (payload as { errors?: Record<string, unknown> }).errors;
    if (errors && typeof errors === 'object') {
      const first = Object.values(errors)[0];
      if (Array.isArray(first) && typeof first[0] === 'string') {
        return first[0];
      }
    }
    const message = (payload as { message?: unknown }).message;
    if (typeof message === 'string' && message !== '') {
      return message;
    }
  }
  if (status === 403) {
    return 'You do not have permission to do that.';
  }
  if (status === 404) {
    return 'That credential no longer exists, or creating credentials is unavailable right now.';
  }

  return 'That action could not be completed.';
}
