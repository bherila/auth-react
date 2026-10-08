// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiCredentialsSection, describeDuration, type ApiCredentialIndex } from '../api-credentials-section';
import type { AuthComponentSet } from '../types';

const components: AuthComponentSet = {
  Button: (props) => <button {...props} />,
  Card: (props) => <div {...props} />,
  CardContent: (props) => <div {...props} />,
  CardDescription: (props) => <div {...props} />,
  CardHeader: (props) => <div {...props} />,
  CardTitle: (props) => <div {...props} />,
  Input: (props) => <input {...props} />,
  Label: (props) => <label {...props} />,
};

function index(overrides: Partial<ApiCredentialIndex> = {}): ApiCredentialIndex {
  return {
    scopes: [
      { id: 'items:read', description: 'Read items' },
      { id: 'items:write', description: 'Write items' },
    ],
    token_lifetimes: ['PT4H', 'P30D'],
    issue_token_href: '/account/api-credentials/tokens',
    register_app_href: '/account/api-credentials/apps',
    tokens: [],
    apps: [],
    ...overrides,
  };
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('ApiCredentialsSection', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('creates a token, shows its secret once from memory, and reloads only the lists', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json(200, { data: index() }))
      .mockResolvedValueOnce(json(201, { data: { kind: 'token', name: 'Connector', token: 'synthetic-secret-token' } }))
      .mockResolvedValueOnce(
        json(200, {
          data: index({
            tokens: [{ id: 't1', name: 'Connector', scopes: ['items:read'], created_at: null, expires_at: null, revoke_href: '/x/tokens/t1' }],
          }),
        }),
      );
    vi.stubGlobal('fetch', fetchMock);
    render(<ApiCredentialsSection indexUrl="/account/api-credentials" components={components} csrfToken="csrf-1" />);

    fireEvent.change(await screen.findByLabelText('Token name'), { target: { value: 'Connector' } });
    fireEvent.click(screen.getAllByLabelText(/items:read/)[0]);
    fireEvent.click(screen.getByLabelText(/30 days/));
    fireEvent.click(screen.getByRole('button', { name: 'Create API token' }));

    expect(await screen.findByText(/will not be shown again/)).toBeTruthy();
    expect(screen.getByText('synthetic-secret-token')).toBeTruthy();
    const [url, init] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(url).toBe('/account/api-credentials/tokens');
    expect((init.headers as Record<string, string>)['X-CSRF-TOKEN']).toBe('csrf-1');
    expect(JSON.parse(String(init.body))).toEqual({ name: 'Connector', scopes: ['items:read'], lifetime: 'P30D' });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    expect(fetchMock.mock.calls[2][0]).toBe('/account/api-credentials');
  });

  it.each([
    [401, { message: 'Unauthenticated.' }],
    [419, { message: 'CSRF token mismatch.' }],
  ])('asks the person to sign in again on %i', async (status, body) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(json(200, { data: index() })).mockResolvedValueOnce(json(status, body)));
    render(<ApiCredentialsSection indexUrl="/i" components={components} />);

    fireEvent.change(await screen.findByLabelText('App name'), { target: { value: 'App' } });
    fireEvent.change(screen.getByLabelText('Redirect URIs (one per line)'), { target: { value: 'https://app.example.test/cb' } });
    fireEvent.click(screen.getAllByLabelText(/items:read/)[1]);
    fireEvent.click(screen.getByRole('button', { name: 'Register OAuth app' }));

    expect((await screen.findByRole('alert')).textContent).toContain('Your session has expired');
  });

  it('shows a validation refusal and keeps the form', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(json(200, { data: index() }))
        .mockResolvedValueOnce(json(422, { message: 'Invalid.', errors: { credential: ['Redirect URIs must be https.'] } })),
    );
    render(<ApiCredentialsSection indexUrl="/i" components={components} />);

    fireEvent.change(await screen.findByLabelText('App name'), { target: { value: 'App' } });
    fireEvent.change(screen.getByLabelText('Redirect URIs (one per line)'), { target: { value: 'http://app.example.test/cb' } });
    fireEvent.click(screen.getAllByLabelText(/items:read/)[1]);
    fireEvent.click(screen.getByRole('button', { name: 'Register OAuth app' }));

    expect((await screen.findByRole('alert')).textContent).toBe('Redirect URIs must be https.');
    expect((screen.getByLabelText('App name') as HTMLInputElement).value).toBe('App');
    expect(screen.queryByText(/will not be shown again/)).toBeNull();
  });

  it('hides issuing while it is unavailable but keeps revocation and shows app permissions', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce(
        json(200, {
          data: index({
            issue_token_href: null,
            register_app_href: null,
            apps: [
              {
                id: 'c1',
                name: 'Connector app',
                confidential: false,
                redirect_uris: ['https://app.example.test/cb'],
                scopes: ['items:read'],
                created_at: null,
                delete_href: '/x/apps/c1',
              },
            ],
          }),
        }),
      ),
    );
    render(<ApiCredentialsSection indexUrl="/i" components={components} />);

    expect(await screen.findByText(/unavailable right now/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Create API token' })).toBeNull();
    expect(screen.getByText(/May request: items:read/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeTruthy();
  });

  it('describes ISO-8601 lifetimes', () => {
    expect(describeDuration('PT4H')).toBe('4 hours');
    expect(describeDuration('P30D')).toBe('30 days');
    expect(describeDuration('P1Y')).toBe('1 year');
    expect(describeDuration('nonsense')).toBe('nonsense');
  });

  it('does not reload the index when the parent passes a new callback', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(500, { message: 'Boom' }));
    vi.stubGlobal('fetch', fetchMock);
    const { rerender } = render(<ApiCredentialsSection indexUrl="/i" components={components} onError={() => undefined} />);
    await screen.findByRole('alert');
    rerender(<ApiCredentialsSection indexUrl="/i" components={components} onError={() => undefined} />);
    rerender(<ApiCredentialsSection indexUrl="/i" components={components} onError={() => undefined} />);
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('keeps every undismissed secret when several credentials are created', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(json(200, { data: index() }))
        .mockResolvedValueOnce(json(201, { data: { kind: 'token', name: 'First', token: 'first-secret' } }))
        .mockResolvedValueOnce(json(200, { data: index() }))
        .mockResolvedValueOnce(json(201, { data: { kind: 'token', name: 'Second', token: 'second-secret' } }))
        .mockResolvedValue(json(200, { data: index() })),
    );
    render(<ApiCredentialsSection indexUrl="/i" components={components} />);

    for (const name of ['First', 'Second']) {
      fireEvent.change(await screen.findByLabelText('Token name'), { target: { value: name } });
      fireEvent.click(screen.getAllByLabelText(/items:read/)[0]);
      fireEvent.click(screen.getByRole('button', { name: 'Create API token' }));
      await screen.findByText(`${name.toLowerCase()}-secret`);
    }

    expect(screen.getByText('first-secret')).toBeTruthy();
    expect(screen.getByText('second-secret')).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { name: 'Done' })[0]);
    expect(screen.queryByText('first-secret')).toBeNull();
    expect(screen.getByText('second-secret')).toBeTruthy();
  });

  it('shows a failed revoke on the page even without an onError callback', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(
          json(200, { data: index({ tokens: [{ id: 't1', name: 'Mine', scopes: ['items:read'], created_at: null, expires_at: null, revoke_href: '/x/t1' }] }) }),
        )
        .mockResolvedValueOnce(json(419, { message: 'CSRF token mismatch.' })),
    );
    render(<ApiCredentialsSection indexUrl="/i" components={components} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Revoke' }));

    expect((await screen.findByRole('alert')).textContent).toContain('Your session has expired');
  });

  it('sends one request when revoke is double-clicked', async () => {
    let finish: (response: Response) => void = () => undefined;
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        json(200, { data: index({ tokens: [{ id: 't1', name: 'Mine', scopes: ['items:read'], created_at: null, expires_at: null, revoke_href: '/x/t1' }] }) }),
      )
      .mockImplementationOnce(() => new Promise<Response>((resolve) => (finish = resolve)))
      .mockResolvedValue(json(200, { data: index() }));
    vi.stubGlobal('fetch', fetchMock);
    render(<ApiCredentialsSection indexUrl="/i" components={components} />);

    const revoke = await screen.findByRole('button', { name: 'Revoke' });
    fireEvent.click(revoke);
    fireEvent.click(revoke);
    finish(json(200, { data: { revoked: true } }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));

    expect(fetchMock.mock.calls.filter(([, init]) => (init as RequestInit | undefined)?.method === 'DELETE')).toHaveLength(1);
  });

  it('ignores a slower response for an index URL that is no longer shown', async () => {
    let finishOld: (response: Response) => void = () => undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) =>
        url === '/old'
          ? new Promise<Response>((resolve) => (finishOld = resolve))
          : Promise.resolve(
              json(200, { data: index({ tokens: [{ id: 'n', name: 'New context', scopes: [], created_at: null, expires_at: null, revoke_href: '/new/n' }] }) }),
            ),
      ),
    );
    const { rerender } = render(<ApiCredentialsSection indexUrl="/old" components={components} />);
    rerender(<ApiCredentialsSection indexUrl="/new" components={components} />);
    await screen.findByText('New context');

    finishOld(json(200, { data: index({ tokens: [{ id: 'o', name: 'Old context', scopes: [], created_at: null, expires_at: null, revoke_href: '/old/o' }] }) }));
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(screen.queryByText('Old context')).toBeNull();
    expect(screen.getByText('New context')).toBeTruthy();
  });

  it('never reports a copy that did not happen', async () => {
    vi.stubGlobal('navigator', { ...navigator, clipboard: undefined });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(200, { data: index() })));
    render(
      <ApiCredentialsSection indexUrl="/i" components={components} links={[{ label: 'OpenAPI document', url: 'https://app.example.test/api/openapi.json' }]} />,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Copy OpenAPI document' }));

    expect(await screen.findByText(/select the text and copy it manually/)).toBeTruthy();
    expect(screen.queryByText('Copied')).toBeNull();
  });
});
