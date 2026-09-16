// @vitest-environment jsdom

import * as React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { LoginForm } from '../forms';
import { PasskeyLoginButton } from '../passkey-login-button';
import type { AuthComponentSet } from '../types';

const components: AuthComponentSet = {
  Button: ({ variant: _variant, ...props }) => <button {...props} />,
  Card: (props) => <div {...props} />,
  CardContent: (props) => <div {...props} />,
  CardDescription: (props) => <div {...props} />,
  CardHeader: (props) => <div {...props} />,
  CardTitle: (props) => <div {...props} />,
  Input: (props) => <input {...props} />,
  Label: (props) => <label {...props} />,
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

function mockBrowser() {
  const requests: Array<{
    options: CredentialRequestOptions;
    resolve: (credential: Credential) => void;
    reject: (error: Error) => void;
  }> = [];
  let outstanding = false;
  const get = vi.fn((options: CredentialRequestOptions) => {
    if (outstanding) return Promise.reject(new Error('A request is already pending.'));
    if (options.signal?.aborted) return Promise.reject(new DOMException('Cancelled', 'AbortError'));
    outstanding = true;
    const request = deferred<Credential>();
    requests.push({ options, resolve: request.resolve, reject: request.reject });
    return request.promise.finally(() => { outstanding = false; });
  });
  const conditionalAvailable = vi.fn(async () => true);
  vi.stubGlobal('PublicKeyCredential', class {
    static isConditionalMediationAvailable = conditionalAvailable;
  });
  const navigatorMock = Object.create(navigator);
  Object.defineProperty(navigatorMock, 'credentials', { value: { get } });
  vi.stubGlobal('navigator', navigatorMock);
  const fetchMock = vi.fn(async (url: RequestInfo | URL, _init?: RequestInit) => new Response(
    JSON.stringify(String(url).endsWith('/options')
      ? { challenge: 'AA', allowCredentials: [] }
      : { success: true, redirect: '/signed-in' }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  ));
  vi.stubGlobal('fetch', fetchMock);

  return {
    get, requests, conditionalAvailable, fetchMock,
    async abort(index: number) {
      expect(requests[index].options.signal?.aborted).toBe(true);
      await act(async () => requests[index].reject(new DOMException('Cancelled', 'AbortError')));
    },
    async succeed(index: number) {
      const bytes = new Uint8Array([0]).buffer;
      await act(async () => requests[index].resolve({
        id: 'synthetic-credential', type: 'public-key', rawId: bytes,
        response: { clientDataJSON: bytes, authenticatorData: bytes, signature: bytes, userHandle: null },
      } as unknown as PublicKeyCredential));
    },
  };
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('coordinated passkey login', () => {
  it('waits for conditional cancellation to settle before starting explicit login', async () => {
    const browser = mockBrowser();
    const onSuccess = vi.fn();
    const onError = vi.fn();
    render(<LoginForm components={components} enablePasskeys onPasskeySuccess={onSuccess} onError={onError} />);
    await waitFor(() => expect(browser.get).toHaveBeenCalledOnce());
    expect(browser.requests[0].options.mediation).toBe('conditional');

    fireEvent.click(screen.getByRole('button', { name: 'Sign in with Passkey' }));
    expect(browser.requests[0].options.signal?.aborted).toBe(true);
    expect(browser.get).toHaveBeenCalledOnce();
    expect(browser.fetchMock).toHaveBeenCalledOnce();
    await browser.abort(0);
    await waitFor(() => expect(browser.get).toHaveBeenCalledTimes(2));
    expect(browser.requests[1].options.mediation).toBeUndefined();
    await browser.succeed(1);
    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith('/signed-in', expect.objectContaining({ success: true })));
    expect(onError).not.toHaveBeenCalled();
  });

  it('supports abortable WebAuthn browsers without AbortSignal.throwIfAborted', async () => {
    const browser = mockBrowser();
    class LegacyAbortController extends AbortController {
      constructor() {
        super();
        Object.defineProperty(this.signal, 'throwIfAborted', { value: undefined });
      }
    }
    vi.stubGlobal('AbortController', LegacyAbortController);
    const onSuccess = vi.fn();
    const onError = vi.fn();
    render(<LoginForm components={components} enablePasskeys onPasskeySuccess={onSuccess} onError={onError} />);
    await waitFor(() => expect(browser.get).toHaveBeenCalledOnce());
    fireEvent.click(screen.getByRole('button', { name: 'Sign in with Passkey' }));
    await browser.abort(0);
    await waitFor(() => expect(browser.get).toHaveBeenCalledTimes(2));
    await browser.succeed(1);
    await waitFor(() => expect(onSuccess).toHaveBeenCalledOnce());
    expect(onError).not.toHaveBeenCalled();
  });

  it('keeps autofill pending through email edits and uses the latest consumer callbacks', async () => {
    const browser = mockBrowser();
    const oldSuccess = vi.fn();
    const newSuccess = vi.fn();
    const { rerender } = render(<LoginForm components={components} enablePasskeys onPasskeySuccess={oldSuccess} onError={() => undefined} />);
    await waitFor(() => expect(browser.get).toHaveBeenCalledOnce());
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'synthetic@example.test' } });
    rerender(<LoginForm components={components} enablePasskeys onPasskeySuccess={newSuccess} onError={() => undefined} />);
    expect(browser.conditionalAvailable).toHaveBeenCalledOnce();
    expect(browser.requests[0].options.signal?.aborted).toBe(false);
    expect(browser.get).toHaveBeenCalledOnce();
    await browser.succeed(0);
    await waitFor(() => expect(newSuccess).toHaveBeenCalledOnce());
    expect(oldSuccess).not.toHaveBeenCalled();
  });

  it('serializes autofill restarts after disabling and re-enabling it', async () => {
    const browser = mockBrowser();
    const { rerender } = render(<LoginForm components={components} enablePasskeys />);
    await waitFor(() => expect(browser.get).toHaveBeenCalledOnce());
    rerender(<LoginForm components={components} enablePasskeys enablePasskeyAutofill={false} />);
    rerender(<LoginForm components={components} enablePasskeys />);
    await waitFor(() => expect(browser.conditionalAvailable).toHaveBeenCalledTimes(2));
    expect(browser.get).toHaveBeenCalledOnce();
    await browser.abort(0);
    await waitFor(() => expect(browser.get).toHaveBeenCalledTimes(2));
    expect(browser.requests[1].options.mediation).toBe('conditional');
  });

  it('starts only one credentials request under StrictMode', async () => {
    const browser = mockBrowser();
    render(<React.StrictMode><LoginForm components={components} enablePasskeys /></React.StrictMode>);
    await waitFor(() => expect(browser.get).toHaveBeenCalledOnce());
    expect(browser.requests[0].options.signal?.aborted).toBe(false);
  });

  it('cancels autofill before password submission and pauses it after the attempt', async () => {
    const browser = mockBrowser();
    const onSuccess = vi.fn();
    const onError = vi.fn();
    const { rerender } = render(<LoginForm components={components} enablePasskeys onSuccess={onSuccess} onError={onError} />);
    await waitFor(() => expect(browser.get).toHaveBeenCalledOnce());
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'synthetic@example.test' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'synthetic-password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));
    expect(screen.getByRole('button', { name: 'Sign in with Passkey' })).toHaveProperty('disabled', true);
    expect(browser.fetchMock).toHaveBeenCalledOnce();
    await browser.abort(0);
    await waitFor(() => expect(onSuccess).toHaveBeenCalledOnce());
    expect(browser.fetchMock).toHaveBeenLastCalledWith('/login', expect.anything());
    rerender(<LoginForm components={components} enablePasskeys endpoints={{ passkeyAuthOptions: '/new/options' }} onSuccess={onSuccess} onError={onError} />);
    expect(browser.get).toHaveBeenCalledOnce();
    expect(onError).not.toHaveBeenCalled();
  });

  it('cancels explicit login before submitting a password without reporting an abort error', async () => {
    const browser = mockBrowser();
    const onSuccess = vi.fn();
    const onError = vi.fn();
    render(<LoginForm components={components} enablePasskeys enablePasskeyAutofill={false} onSuccess={onSuccess} onError={onError} />);
    fireEvent.click(screen.getByRole('button', { name: 'Sign in with Passkey' }));
    await waitFor(() => expect(browser.get).toHaveBeenCalledOnce());
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'synthetic@example.test' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'synthetic-password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));
    expect(browser.fetchMock).toHaveBeenCalledOnce();
    await browser.abort(0);
    await waitFor(() => expect(onSuccess).toHaveBeenCalledOnce());
    expect(onError).not.toHaveBeenCalled();
  });

  it('does not start late autofill after a password attempt during the availability check', async () => {
    const browser = mockBrowser();
    const availability = deferred<boolean>();
    browser.conditionalAvailable.mockReturnValue(availability.promise);
    render(<LoginForm components={components} enablePasskeys onSuccess={() => undefined} />);
    fireEvent.submit(screen.getByRole('button', { name: 'Sign In' }).closest('form')!);
    await waitFor(() => expect(browser.fetchMock).toHaveBeenCalledOnce());
    await act(async () => availability.resolve(true));
    expect(browser.get).not.toHaveBeenCalled();
  });

  it.each(['conditional', 'explicit'] as const)('cancels %s login on unmount without invoking callbacks', async (mode) => {
    const browser = mockBrowser();
    const onSuccess = vi.fn();
    const onError = vi.fn();
    const { unmount } = render(<LoginForm components={components} enablePasskeys enablePasskeyAutofill={mode === 'conditional'} onPasskeySuccess={onSuccess} onError={onError} />);
    if (mode === 'explicit') fireEvent.click(screen.getByRole('button', { name: 'Sign in with Passkey' }));
    await waitFor(() => expect(browser.get).toHaveBeenCalledOnce());
    unmount();
    await browser.abort(0);
    expect(onSuccess).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });

  it('does not verify a credential that resolves normally after cancellation', async () => {
    const browser = mockBrowser();
    const onSuccess = vi.fn();
    const onError = vi.fn();
    const { unmount } = render(<LoginForm components={components} enablePasskeys onPasskeySuccess={onSuccess} onError={onError} />);
    await waitFor(() => expect(browser.get).toHaveBeenCalledOnce());
    unmount();
    expect(browser.requests[0].options.signal?.aborted).toBe(true);
    await browser.succeed(0);
    expect(browser.fetchMock).toHaveBeenCalledOnce();
    expect(onSuccess).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });

  it('ignores repeated explicit clicks even when the consumer button ignores disabled', async () => {
    const browser = mockBrowser();
    const Button: AuthComponentSet['Button'] = ({ disabled: _disabled, variant: _variant, ...props }) => <button {...props} />;
    render(<PasskeyLoginButton components={{ Button }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Sign in with Passkey' }));
    fireEvent.click(screen.getByRole('button', { name: 'Verifying...' }));
    await waitFor(() => expect(browser.get).toHaveBeenCalledOnce());
    expect(browser.requests[0].options.signal?.aborted).toBe(false);
  });

  it('lets the consumer display an explicit error once and uses its latest callback', async () => {
    const browser = mockBrowser();
    const oldError = vi.fn();
    function Consumer({ first = false }: { first?: boolean }) {
      const [error, setError] = React.useState('');
      return <><p>{error}</p><LoginForm components={components} enablePasskeys enablePasskeyAutofill={false} onError={first ? oldError : setError} /></>;
    }
    const { rerender } = render(<Consumer first />);
    fireEvent.click(screen.getByRole('button', { name: 'Sign in with Passkey' }));
    await waitFor(() => expect(browser.get).toHaveBeenCalledOnce());
    rerender(<Consumer />);
    await act(async () => browser.requests[0].reject(new Error('Synthetic passkey failure')));
    await waitFor(() => expect(screen.getAllByText('Synthetic passkey failure')).toHaveLength(1));
    expect(oldError).not.toHaveBeenCalled();
  });

  it('renders its own error when no consumer callback is supplied', async () => {
    const browser = mockBrowser();
    render(<PasskeyLoginButton components={{ Button: components.Button }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Sign in with Passkey' }));
    await waitFor(() => expect(browser.get).toHaveBeenCalledOnce());
    await act(async () => browser.requests[0].reject(new Error('Synthetic passkey failure')));
    await waitFor(() => expect(screen.getAllByText('Synthetic passkey failure')).toHaveLength(1));
  });
});
