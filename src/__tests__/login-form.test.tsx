// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { LoginForm, type LoginRememberMeCheckboxProps } from '../forms';
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

function DesignSystemCheckbox({ checked, onCheckedChange, ...props }: LoginRememberMeCheckboxProps) {
  return (
    <input
      {...props}
      type="checkbox"
      checked={checked}
      onChange={(event) => onCheckedChange(event.target.checked)}
    />
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('LoginForm consumer hooks', () => {
  it('prefills and reports email changes while rendering the supplied remember-me control', () => {
    const onEmailChange = vi.fn();

    render(
      <LoginForm
        components={components}
        initialEmail="verified@example.test"
        onEmailChange={onEmailChange}
        rememberMeCheckbox={DesignSystemCheckbox}
        rememberMeLabel="Remember me"
        rememberMeDataTest="login-remember-me"
      />,
    );

    const email = screen.getByLabelText('Email');
    expect(email).toHaveProperty('value', 'verified@example.test');
    fireEvent.change(email, { target: { value: 'buyer@example.test' } });
    expect(onEmailChange).toHaveBeenLastCalledWith('buyer@example.test');

    const remember = screen.getByLabelText('Remember me');
    expect(remember.getAttribute('data-test')).toBe('login-remember-me');
    fireEvent.click(screen.getByText('Remember me'));
    expect(remember).toHaveProperty('checked', true);
  });

  it('keeps the default remember-me checkbox and wording for existing callers', () => {
    render(<LoginForm components={components} />);

    expect(screen.getByLabelText('Keep me signed in')).toHaveProperty('type', 'checkbox');
  });

  it('calls onSubmitStart before posting and includes the selected remember value', async () => {
    const calls: string[] = [];
    const fetchMock = vi.fn(async (_url: string, options?: RequestInit) => {
      calls.push('fetch');
      expect(JSON.parse(String(options?.body))).toEqual({
        email: 'verified@example.test',
        password: 'synthetic-password',
        remember: true,
      });

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <LoginForm
        components={components}
        initialEmail="verified@example.test"
        onSubmitStart={() => calls.push('start')}
      />,
    );

    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'synthetic-password' } });
    fireEvent.click(screen.getByLabelText('Keep me signed in'));
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(calls).toEqual(['start', 'fetch']);
  });

  it('reports a stable message when a proxy returns HTML instead of JSON', async () => {
    const onError = vi.fn();
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>Bad gateway</html>', {
      status: 502,
      headers: { 'Content-Type': 'text/html' },
    })));

    render(<LoginForm components={components} onError={onError} />);
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'buyer@example.test' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'synthetic-password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));

    await waitFor(() => expect(onError).toHaveBeenCalledWith(
      'The server returned an unexpected response. Please try again.',
    ));
  });
});
