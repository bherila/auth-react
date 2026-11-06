// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

import { PasswordResetRequestForm, ResetPasswordForm } from '../forms';
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

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function response(body: Record<string, unknown>, ok = true) {
  return { ok, json: async () => body } as Response;
}

it('opts into confirmation and minimum length without sending invalid reset requests', () => {
  const request = vi.fn();
  const onError = vi.fn();
  vi.stubGlobal('fetch', request);
  render(<ResetPasswordForm components={components} minPasswordLength={8} validatePasswordConfirmation onError={onError} />);
  const password = screen.getByLabelText('Password');
  const confirmation = screen.getByLabelText('Confirm Password');
  expect(password.getAttribute('minlength')).toBe('8');
  expect(confirmation.getAttribute('autocomplete')).toBe('new-password');
  fireEvent.change(password, { target: { value: 'short' } });
  fireEvent.change(confirmation, { target: { value: 'different' } });
  fireEvent.submit(password.closest('form')!);
  expect(onError).toHaveBeenLastCalledWith('Passwords do not match.');
  fireEvent.change(confirmation, { target: { value: 'short' } });
  fireEvent.submit(password.closest('form')!);
  expect(onError).toHaveBeenLastCalledWith('Password must be at least 8 characters long.');
  expect(request).not.toHaveBeenCalled();
});

it('keeps password policy on the server unless a caller opts into client checks', async () => {
  const request = vi.fn(async () => response({ success: true }));
  vi.stubGlobal('fetch', request);
  render(<ResetPasswordForm components={components} />);
  const password = screen.getByLabelText('Password');
  expect(password.hasAttribute('minlength')).toBe(false);
  fireEvent.change(password, { target: { value: 'short' } });
  fireEvent.submit(password.closest('form')!);
  await waitFor(() => expect(request).toHaveBeenCalledOnce());
});

it('posts bootstrap values and CSRF once, stays busy, then permits a retry after failure', async () => {
  let finish!: (result: Response) => void;
  const request = vi.fn(() => new Promise<Response>((resolve) => { finish = resolve; }));
  const onError = vi.fn();
  const onSubmitStart = vi.fn();
  vi.stubGlobal('fetch', request);
  render(<div id="reset-password"><ResetPasswordForm components={components} idPrefix="new-password" token="synthetic-token" email="person@example.test"
    endpoints={{ resetPassword: '/custom/reset', csrfToken: 'synthetic-csrf' }} onError={onError} onSubmitStart={onSubmitStart}
    passwordLabel="New Password" passwordConfirmationLabel="Confirm New Password" passwordHelpText="Choose a new secret" /></div>);
  const password = screen.getByLabelText('New Password');
  fireEvent.change(password, { target: { value: 'new-password' } });
  fireEvent.change(screen.getByLabelText('Confirm New Password'), { target: { value: 'new-password' } });
  fireEvent.submit(password.closest('form')!);
  fireEvent.submit(password.closest('form')!);
  expect(request).toHaveBeenCalledOnce();
  expect(onSubmitStart).toHaveBeenCalledOnce();
  expect(screen.getByRole('button', { name: 'Resetting...' })).toHaveProperty('disabled', true);
  const [url, options] = request.mock.calls[0] as unknown as [string, RequestInit];
  expect(url).toBe('/custom/reset');
  expect(options.headers).toMatchObject({ 'X-CSRF-TOKEN': 'synthetic-csrf', Accept: 'application/json' });
  expect(JSON.parse(String(options.body))).toEqual({ token: 'synthetic-token', email: 'person@example.test', password: 'new-password', password_confirmation: 'new-password' });
  finish(response({ message: 'Expired token' }, false));
  await waitFor(() => expect(onError).toHaveBeenCalledWith('Expired token'));
  expect(screen.getByRole('button', { name: 'Reset Password' })).toHaveProperty('disabled', false);
  fireEvent.submit(password.closest('form')!);
  expect(request).toHaveBeenCalledTimes(2);
});

it('deduplicates reset-link requests and releases loading state on transport failure', async () => {
  let fail!: (error: Error) => void;
  const request = vi.fn(() => new Promise<Response>((_resolve, reject) => { fail = reject; }));
  const onError = vi.fn();
  vi.stubGlobal('fetch', request);
  render(<PasswordResetRequestForm components={components} onError={onError} endpoints={{ csrfToken: 'synthetic-csrf' }} />);
  const email = screen.getByLabelText('Email');
  fireEvent.change(email, { target: { value: 'person@example.test' } });
  fireEvent.submit(email.closest('form')!);
  fireEvent.submit(email.closest('form')!);
  expect(request).toHaveBeenCalledOnce();
  expect(screen.getByRole('button', { name: 'Sending...' })).toHaveProperty('disabled', true);
  fail(new Error('Offline'));
  await waitFor(() => expect(onError).toHaveBeenCalledWith('Offline'));
  expect(screen.getByRole('button', { name: 'Send Reset Link' })).toHaveProperty('disabled', false);
});
