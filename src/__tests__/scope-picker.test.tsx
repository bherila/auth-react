// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiCredentialsSection, type ApiCredentialIndex } from '../api-credentials-section';
import { ScopePicker, type ApiCredentialScopeGroup, type ApiCredentialScopePreset } from '../scope-picker';
import { closeImplications, restrictImplications } from '../scope-selection';
import type { AuthComponentSet } from '../types';

const components: AuthComponentSet = {
  Button: ({ variant: _variant, size: _size, ...props }) => <button {...props} />,
  Card: (props) => <div {...props} />,
  CardContent: (props) => <div {...props} />,
  CardDescription: (props) => <div {...props} />,
  CardHeader: (props) => <div {...props} />,
  CardTitle: (props) => <div {...props} />,
  Input: (props) => <input {...props} />,
  Label: (props) => <label {...props} />,
};

const scopes = [
  { id: 'identity:read', description: 'Read identity' },
  { id: 'tasks:read', description: 'Read tasks' },
  { id: 'billing:read', description: 'Read invoices' },
  { id: 'billing:write', description: 'Write invoices' },
  { id: 'admin:a', description: 'Admin A' },
  { id: 'admin:b', description: 'Admin B' },
  { id: 'admin:c', description: 'Admin C' },
];
const groups: ApiCredentialScopeGroup[] = [
  { id: 'general', label: 'General', description: null, sensitive: false, scopes: ['identity:read', 'tasks:read'] },
  { id: 'billing', label: 'Billing', description: null, sensitive: false, scopes: ['billing:read', 'billing:write'] },
  { id: 'admin', label: 'Admin', description: 'Acts on clients and money.', sensitive: true, scopes: ['admin:a', 'admin:b', 'admin:c'] },
];
const presets: ApiCredentialScopePreset[] = [
  { id: 'reader', label: 'Reader', description: 'Reads general things.', scopes: ['identity:read', 'tasks:read'] },
  { id: 'biller', label: 'Biller', description: 'Reads and writes invoices.', scopes: ['billing:read', 'billing:write'] },
  // Deliberately not closed under the implications: the picker must still cascade.
  { id: 'writer', label: 'Writer', description: 'Writes invoices.', scopes: ['billing:write'] },
];
const implications = { 'billing:write': ['billing:read'], 'admin:b': ['admin:a'], 'admin:c': ['billing:read'] };

function Harness({ initial = [], withGroups = true, withImplications = true }: { initial?: string[]; withGroups?: boolean; withImplications?: boolean }) {
  const [selected, setSelected] = React.useState<string[]>(initial);

  return (
    <>
      <ScopePicker
        idPrefix="t"
        scopes={scopes}
        groups={withGroups ? groups : undefined}
        presets={withGroups ? presets : undefined}
        implications={withImplications ? implications : undefined}
        selected={selected}
        onChange={setSelected}
        components={components}
      />
      <output data-testid="selection">{selected.join(',')}</output>
    </>
  );
}

const selection = () => screen.getByTestId('selection').textContent;
const box = (id: string) => document.getElementById(`t-${id}`) as HTMLInputElement;
const parent = () => document.getElementById('t-group-admin') as HTMLInputElement;
const preset = (name: string) => screen.getByRole('button', { name });
const openAdmin = () => fireEvent.click(screen.getByRole('button', { name: /individual Admin permissions/ }));

afterEach(cleanup);

describe('ScopePicker', () => {
  it('replaces the selection with exactly the preset and tracks an exact match in aria-pressed', () => {
    render(<Harness initial={['admin:a']} />);

    fireEvent.click(preset('Reader'));
    expect(selection()).toBe('identity:read,tasks:read');
    expect(preset('Reader').getAttribute('aria-pressed')).toBe('true');
    expect(preset('Biller').getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByText('Reads general things.')).toBeTruthy();

    fireEvent.click(box('tasks:read'));
    expect(preset('Reader').getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByText(/Custom selection/)).toBeTruthy();

    fireEvent.click(box('tasks:read'));
    expect(preset('Reader').getAttribute('aria-pressed')).toBe('true');

    fireEvent.click(preset('Biller'));
    expect(selection()).toBe('billing:read,billing:write');
    expect(screen.queryByRole('button', { name: /select all/i })).toBeNull();
  });

  it('shows the sensitive parent as unchecked, mixed and checked, and its click selects or clears everything', () => {
    render(<Harness />);
    expect(parent().checked).toBe(false);
    expect(parent().indeterminate).toBe(false);
    expect(parent().getAttribute('aria-checked')).toBe('false');
    expect(screen.getByText('Sensitive')).toBeTruthy();
    expect(screen.getByText('Acts on clients and money.')).toBeTruthy();

    openAdmin();
    fireEvent.click(box('admin:a'));
    expect(parent().indeterminate).toBe(true);
    expect(parent().checked).toBe(false);
    expect(parent().getAttribute('aria-checked')).toBe('mixed');

    // From "some", a click selects everything (and what Admin C needs).
    fireEvent.click(parent());
    expect(parent().checked).toBe(true);
    expect(parent().indeterminate).toBe(false);
    expect(parent().getAttribute('aria-checked')).toBe('true');
    expect(selection()).toBe('billing:read,admin:a,admin:b,admin:c');

    // From "all", a click clears the group but not the routine scope it pulled in.
    fireEvent.click(parent());
    expect(selection()).toBe('billing:read');
    expect(parent().getAttribute('aria-checked')).toBe('false');
  });

  it('reveals the sensitive group scopes behind an aria-expanded disclosure', () => {
    render(<Harness />);
    const toggle = screen.getByRole('button', { name: 'Adjust individual Admin permissions' });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(box('admin:a')).toBeNull();

    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(toggle.textContent).toContain('Hide individual Admin permissions');
    fireEvent.click(box('admin:a'));
    expect(selection()).toBe('admin:a');
    fireEvent.click(box('admin:a'));
    expect(selection()).toBe('');

    fireEvent.click(toggle);
    expect(box('admin:a')).toBeNull();
  });

  it('cascades implications on tick and untick', () => {
    render(<Harness />);

    fireEvent.click(box('billing:write'));
    expect(selection()).toBe('billing:read,billing:write');
    expect(box('billing:read').checked).toBe(true);

    fireEvent.click(box('billing:read'));
    expect(selection()).toBe('');

    openAdmin();
    fireEvent.click(box('admin:b'));
    expect(selection()).toBe('admin:a,admin:b');
    fireEvent.click(box('admin:a'));
    expect(selection()).toBe('');
  });

  it('applies the cascade from a preset and from the sensitive parent', () => {
    render(<Harness />);

    fireEvent.click(preset('Writer'));
    expect(selection()).toBe('billing:read,billing:write');
    expect(preset('Writer').getAttribute('aria-pressed')).toBe('false');

    fireEvent.click(preset('Reader'));
    fireEvent.click(parent());
    expect(selection()).toBe('identity:read,tasks:read,billing:read,admin:a,admin:b,admin:c');

    // Clearing the parent leaves billing:read; unticking it afterwards removes what needs it (nothing is left that does).
    fireEvent.click(parent());
    expect(selection()).toBe('identity:read,tasks:read,billing:read');
  });

  it('unticking a requirement from a preset also removes the scopes that need it', () => {
    render(<Harness initial={['billing:read', 'billing:write']} />);
    fireEvent.click(box('billing:read'));
    expect(selection()).toBe('');
  });

  it('notes which selected scope a ticked scope is needed by', () => {
    render(<Harness />);
    expect(screen.queryByText(/needed by/)).toBeNull();

    fireEvent.click(box('billing:write'));
    expect(screen.getByText('needed by billing:write')).toBeTruthy();
    expect(box('billing:read').getAttribute('aria-describedby')).toBeTruthy();

    fireEvent.click(box('billing:write'));
    expect(screen.queryByText(/needed by/)).toBeNull();
  });

  it('summarises the explicit ids', () => {
    render(<Harness />);
    expect(screen.getByText('No permissions selected.')).toBeTruthy();
    fireEvent.click(preset('Biller'));
    expect(screen.getByText('This credential will request 2 permissions:')).toBeTruthy();
  });

  it('renders a flat list, as before, without groups, presets or a summary', () => {
    render(<Harness withGroups={false} withImplications={false} />);

    expect(screen.getAllByRole('group').map((group) => within(group).getByText('Permissions', { selector: 'legend' }).textContent)).toEqual(['Permissions']);
    expect(screen.getAllByRole('checkbox')).toHaveLength(scopes.length);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByText(/will request/)).toBeNull();

    // Choices keep the order they were made in.
    fireEvent.click(box('tasks:read'));
    fireEvent.click(box('identity:read'));
    expect(selection()).toBe('tasks:read,identity:read');
  });

  it('lists a scope that no group names in a final Other group, and ignores presets it cannot offer', () => {
    render(
      <ScopePicker
        idPrefix="t"
        scopes={[...scopes, { id: 'misc:read', description: 'Misc' }]}
        groups={groups}
        presets={[{ id: 'x', label: 'Ghost', description: 'd', scopes: ['nope:read'] }]}
        selected={[]}
        onChange={() => undefined}
        components={components}
      />,
    );
    expect(screen.getByRole('group', { name: 'Other permissions' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Ghost' })).toBeNull();
  });
});

describe('implication helpers', () => {
  it('closes transitively, drops cycles and self references, and restricts to the offered scopes', () => {
    expect(closeImplications({ a: ['b'], b: ['c', 'a'], c: [], d: ['d'] })).toEqual({ a: ['b', 'c'], b: ['c', 'a'] });
    expect(restrictImplications({ a: ['b', 'x'], x: ['a'], c: ['x'] }, new Set(['a', 'b', 'c']))).toEqual({ a: ['b'] });
  });
});

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function index(overrides: Partial<ApiCredentialIndex> = {}): ApiCredentialIndex {
  return {
    scopes,
    token_lifetimes: ['PT4H', 'P30D'],
    issue_token_href: '/tokens',
    register_app_href: '/apps',
    tokens: [],
    apps: [],
    scope_groups: groups,
    scope_presets: presets,
    scope_implications: implications,
    ...overrides,
  };
}

describe('ApiCredentialsSection with grouped scopes', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('gives the token form the token_* keys and the OAuth-app form the scope_* keys', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce(
        json(200, {
          data: index({
            token_scopes: [
              { id: 'identity:read', description: 'Read identity' },
              { id: 'tasks:read', description: 'Read tasks' },
            ],
            token_scope_groups: [{ id: 'only', label: 'Token only', description: null, sensitive: false, scopes: ['identity:read', 'tasks:read'] }],
            token_scope_presets: [{ id: 'tp', label: 'Token preset', description: 'For tokens.', scopes: ['identity:read'] }],
          }),
        }),
      ),
    );
    render(<ApiCredentialsSection indexUrl="/i" components={components} />);

    expect(await screen.findByRole('group', { name: 'Token only' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Token preset' })).toBeTruthy();
    // The OAuth-app form shows scope_groups and scope_presets, not the token ones.
    expect(screen.getAllByRole('group', { name: 'Billing' })).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Biller' })).toBeTruthy();
    expect(document.getElementById('api-token-scope-billing:write')).toBeNull();
    expect(document.getElementById('oauth-app-scope-billing:write')).not.toBeNull();
  });

  it('falls back to the scope_* keys for the token form when no token_* keys are present', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(json(200, { data: index() })));
    render(<ApiCredentialsSection indexUrl="/i" components={components} />);

    expect(await screen.findAllByRole('group', { name: 'Billing' })).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: 'Biller' })).toHaveLength(2);
  });

  it('posts explicit scope ids only, never a group or preset id', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json(200, { data: index() }))
      .mockResolvedValueOnce(json(201, { data: { kind: 'token', name: 'Billing bot', token: 'synthetic-secret' } }))
      .mockResolvedValueOnce(json(200, { data: index() }));
    vi.stubGlobal('fetch', fetchMock);
    render(<ApiCredentialsSection indexUrl="/i" components={components} />);

    fireEvent.change(await screen.findByLabelText('Token name'), { target: { value: 'Billing bot' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Writer' })[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Create API token' }));

    expect(await screen.findByText('synthetic-secret')).toBeTruthy();
    const body = JSON.parse(String((fetchMock.mock.calls[1] as [string, RequestInit])[1].body));
    expect(body).toEqual({ name: 'Billing bot', scopes: ['billing:read', 'billing:write'], lifetime: 'PT4H' });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
  });

  it('offers connection scopes to tokens only, with their own lifetimes', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce(
        json(200, {
          data: index({
            scope_groups: undefined,
            scope_presets: undefined,
            scope_implications: undefined,
            token_connection_scopes: [{ id: 'mcp:use', description: 'Use MCP' }],
            connection_token_lifetimes: ['PT4H'],
          }),
        }),
      ),
    );
    render(<ApiCredentialsSection indexUrl="/i" components={components} />);

    await screen.findByLabelText('Token name');
    expect(document.getElementById('oauth-app-scope-mcp:use')).toBeNull();
    expect(screen.getByLabelText(/30 days/)).toBeTruthy();
    fireEvent.click(document.getElementById('api-token-scope-mcp:use') as HTMLElement);
    expect(screen.queryByLabelText(/30 days/)).toBeNull();
    expect(screen.getByLabelText(/4 hours/)).toBeTruthy();
  });
});
