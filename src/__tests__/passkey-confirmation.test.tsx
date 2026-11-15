// @vitest-environment jsdom
import * as React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PasskeySection } from '../passkey-section';
import { confirmPasskey, confirmPasswordForPasskey, PasswordConfirmationRequiredError, registerPasskey } from '../webauthn-utils';
import type { AuthComponentSet, AuthEndpointConfig } from '../types';

const components: AuthComponentSet = {
  Button: ({ variant: _variant, ...props }) => <button {...props} />,
  Card: (props) => <div {...props} />, CardContent: (props) => <div {...props} />,
  CardDescription: (props) => <div {...props} />, CardHeader: (props) => <div {...props} />,
  CardTitle: (props) => <div {...props} />, Input: (props) => <input {...props} />,
  Label: (props) => <label {...props} />,
};
const bytes = new Uint8Array([0]).buffer;
const assertion = { id: 'owned-passkey', rawId: bytes, type: 'public-key', response: { clientDataJSON: bytes, authenticatorData: bytes, signature: bytes, userHandle: null } } as unknown as PublicKeyCredential;
const attestation = { id: 'new-passkey', rawId: bytes, type: 'public-key', response: { clientDataJSON: bytes, attestationObject: bytes } } as unknown as PublicKeyCredential;
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

function setup({ ready = false, passwordStatus = 200, alwaysLocked = false, lockAtVerify = false, prefix = '' } = {}) {
  let confirmed = ready;
  let verification = 0;
  const get = vi.fn(async (_options: CredentialRequestOptions) => assertion);
  const create = vi.fn(async (_options: CredentialCreationOptions) => attestation);
  vi.stubGlobal('PublicKeyCredential', class {});
  const userAgent = navigator.userAgent;
  const browser = Object.create(navigator);
  Object.defineProperty(browser, 'userAgent', { value: userAgent });
  Object.defineProperty(browser, 'credentials', { value: { get, create } });
  vi.stubGlobal('navigator', browser);
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input); requests.push({ url, init });
    if (url === `${prefix}/api/passkeys`) return json([]);
    if (url === `${prefix}/api/auth/confirm-password`) {
      if (passwordStatus !== 200) return json({ message: 'Password confirmation failed.' }, passwordStatus);
      confirmed = true; return json({ success: true });
    }
    if (url === `${prefix}/api/passkeys/confirm/options`) return json({ challenge: 'AA', allowCredentials: [{ type: 'public-key', id: 'AA' }], userVerification: 'preferred' });
    if (url === `${prefix}/api/passkeys/confirm`) { confirmed = true; return json({ success: true }); }
    if (url === `${prefix}/api/passkeys/register/options`) {
      if ((!confirmed && !lockAtVerify) || alwaysLocked) return json({ error: 'password_confirmation_required' }, 423);
      return json({ challenge: verification ? 'AQ' : 'AA', user: { id: 'AA', name: 'synthetic@example.test', displayName: 'Synthetic' }, rp: { name: 'Synthetic' }, pubKeyCredParams: [] });
    }
    if (url === `${prefix}/api/passkeys/register`) {
      verification++;
      if (lockAtVerify && !confirmed) return json({ error: 'password_confirmation_required' }, 423);
      return json({ success: true });
    }
    throw new Error(`Unexpected synthetic URL: ${url}`);
  });
  vi.stubGlobal('fetch', fetchMock);
  const endpoints: AuthEndpointConfig = {
    csrfToken: 'synthetic-csrf', passkeyList: `${prefix}/api/passkeys`,
    passkeyRegisterOptions: `${prefix}/api/passkeys/register/options`, passkeyRegister: `${prefix}/api/passkeys/register`,
    confirmPassword: `${prefix}/api/auth/confirm-password`, passkeyConfirmOptions: `${prefix}/api/passkeys/confirm/options`, passkeyConfirm: `${prefix}/api/passkeys/confirm`,
  };
  const success = vi.fn(); const error = vi.fn();
  async function page() {
    const view = render(<PasskeySection components={components} endpoints={endpoints} onSuccess={success} onError={error} />);
    await screen.findByText('No passkeys registered yet.');
    return view;
  }
  async function prompt() {
    const view = await page();
    fireEvent.change(screen.getByLabelText('Passkey name'), { target: { value: 'Synthetic key' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add Passkey' }));
    await screen.findByRole('group', { name: 'Confirm your identity' });
    return view;
  }
  return { get, create, requests, fetchMock, endpoints, success, error, page, prompt };
}

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('passkey enrollment confirmation', () => {
  it('reacts to 423, confirms once, clears the password and starts a fresh enrollment', async () => {
    const fixture = setup(); await fixture.prompt();
    expect(fixture.create).not.toHaveBeenCalled();
    expect(fixture.error).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Current password'), { target: { value: 'synthetic-confirmation-password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm password and continue' }));
    await waitFor(() => expect(fixture.success).toHaveBeenCalledOnce());
    expect(screen.queryByRole('group', { name: 'Confirm your identity' })).toBeNull();
    expect(fixture.create).toHaveBeenCalledOnce();
    expect(fixture.requests.filter(({ url }) => url.endsWith('/register/options'))).toHaveLength(2);
    const proofs = fixture.requests.filter(({ url }) => url.endsWith('/confirm-password'));
    expect(proofs).toHaveLength(1);
    expect(JSON.parse(String(proofs[0].init?.body))).toEqual({ password: 'synthetic-confirmation-password' });
    expect(fixture.requests.filter(({ url }) => !url.endsWith('/confirm-password')).every(({ init }) => !String(init?.body).includes('synthetic-confirmation-password'))).toBe(true);
    for (const { init } of fixture.requests.filter(({ init }) => init?.method === 'POST')) expect(init?.headers).toMatchObject({ 'X-CSRF-TOKEN': 'synthetic-csrf', Accept: 'application/json' });
  });

  it.each([422, 429, 401])('does not enroll after a failed confirmation (%s)', async (passwordStatus) => {
    const fixture = setup({ passwordStatus }); await fixture.prompt();
    fireEvent.change(screen.getByLabelText('Current password'), { target: { value: 'synthetic-wrong-password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm password and continue' }));
    await screen.findByRole('alert');
    expect((screen.getByLabelText('Current password') as HTMLInputElement).value).toBe('');
    expect(fixture.create).not.toHaveBeenCalled(); expect(fixture.success).not.toHaveBeenCalled();
    expect(fixture.requests.filter(({ url }) => url.endsWith('/register/options'))).toHaveLength(1);
  });

  it('supports a passwordless account through an owned user-verified passkey without signing in', async () => {
    const fixture = setup({ prefix: '/identity' }); await fixture.prompt();
    fireEvent.click(screen.getByRole('button', { name: 'Use existing passkey' }));
    await waitFor(() => expect(fixture.success).toHaveBeenCalledOnce());
    expect(fixture.get).toHaveBeenCalledOnce();
    const options = fixture.get.mock.calls[0][0];
    expect(options.publicKey?.userVerification).toBe('required');
    expect(options.publicKey?.allowCredentials?.[0].id).toEqual(bytes);
    const proof = fixture.requests.find(({ url }) => url.endsWith('/passkeys/confirm'));
    expect(JSON.parse(String(proof?.init?.body))).toMatchObject({ credential: { id: 'owned-passkey', response: { signature: 'AA', userHandle: null } } });
    expect(fixture.requests.some(({ url }) => url.includes('/auth/') || url.endsWith('/passkeys/auth'))).toBe(false);
  });

  it('keeps an already-confirmed or older-server enrollment free of an extra prompt', async () => {
    const fixture = setup({ ready: true }); await fixture.page();
    fireEvent.click(screen.getByRole('button', { name: 'Add Passkey' }));
    await waitFor(() => expect(fixture.success).toHaveBeenCalledOnce());
    expect(screen.queryByRole('group', { name: 'Confirm your identity' })).toBeNull();
    expect(fixture.requests.some(({ url }) => url.includes('confirm'))).toBe(false);
  });

  it('begins a new ceremony if confirmation expires between options and attestation', async () => {
    const fixture = setup({ lockAtVerify: true }); await fixture.prompt();
    expect(fixture.create).toHaveBeenCalledOnce();
    fireEvent.change(screen.getByLabelText('Current password'), { target: { value: 'synthetic-confirmation-password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm password and continue' }));
    await waitFor(() => expect(fixture.success).toHaveBeenCalledOnce());
    expect(fixture.create).toHaveBeenCalledTimes(2);
    expect(fixture.create.mock.calls[0][0].publicKey?.challenge).toEqual(new Uint8Array([0]).buffer);
    expect(fixture.create.mock.calls[1][0].publicKey?.challenge).toEqual(new Uint8Array([1]).buffer);
  });

  it('bounds retries if the server still refuses the proof', async () => {
    const fixture = setup({ alwaysLocked: true }); await fixture.prompt();
    fireEvent.change(screen.getByLabelText('Current password'), { target: { value: 'synthetic-confirmation-password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm password and continue' }));
    await screen.findByRole('alert');
    expect(fixture.requests.filter(({ url }) => url.endsWith('/confirm-password'))).toHaveLength(1);
    expect(fixture.requests.filter(({ url }) => url.endsWith('/register/options'))).toHaveLength(2);
    expect(fixture.create).not.toHaveBeenCalled(); expect(fixture.success).not.toHaveBeenCalled();
  });

  it.each(['cancel', 'unmount', 'endpoint-change'])('aborts stale confirmation on %s and never posts its assertion', async (action) => {
    const fixture = setup(); const view = await fixture.prompt();
    let resolve!: (value: PublicKeyCredential) => void;
    fixture.get.mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
    fireEvent.click(screen.getByRole('button', { name: 'Use existing passkey' }));
    await waitFor(() => expect(fixture.get).toHaveBeenCalledOnce());
    const signal = fixture.get.mock.calls[0][0].signal;
    if (action === 'cancel') fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    else if (action === 'unmount') view.unmount();
    else view.rerender(<PasskeySection components={components} endpoints={{ ...fixture.endpoints, csrfToken: 'next-session-csrf' }} onSuccess={fixture.success} />);
    expect(signal?.aborted).toBe(true);
    await act(async () => { resolve(assertion); });
    expect(fixture.requests.filter(({ url }) => url.endsWith('/passkeys/confirm'))).toHaveLength(0);
    expect(fixture.create).not.toHaveBeenCalled(); expect(fixture.success).not.toHaveBeenCalled();
    if (action !== 'unmount') expect((screen.getByRole('button', { name: 'Add Passkey' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('does not offer an unconstrained discoverable assertion when there are no owned credentials', async () => {
    const fixture = setup(); fixture.fetchMock.mockResolvedValueOnce(json({ challenge: 'AA', allowCredentials: [] }));
    await expect(confirmPasskey({ endpoints: fixture.endpoints })).rejects.toThrow('No existing passkey');
    expect(fixture.get).not.toHaveBeenCalled();
  });

  it('fails an already-aborted password confirmation without sending the password', async () => {
    const fixture = setup(); const controller = new AbortController(); controller.abort();
    await expect(confirmPasswordForPasskey({ password: 'synthetic-password', endpoints: fixture.endpoints, signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });
    expect(fixture.fetchMock).not.toHaveBeenCalled();
  });

  it('only interprets the explicit 423 confirmation contract as step-up', async () => {
    const fixture = setup(); fixture.fetchMock.mockResolvedValueOnce(json({ error: 'password_confirmation_required' }, 429));
    await expect(registerPasskey()).rejects.not.toBeInstanceOf(PasswordConfirmationRequiredError);
    expect(fixture.create).not.toHaveBeenCalled();
  });
});
