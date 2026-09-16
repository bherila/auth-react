import { KeyRound } from 'lucide-react';
import * as React from 'react';

import { resolveAuthButtonComponent } from './components';
import { PasskeyAuthenticationContext, usePasskeyAuthentication } from './passkey-authentication';
import type { AuthButtonComponentInput, AuthEndpointConfig, AuthJsonResponse } from './types';
import { isAbortError } from './webauthn-utils';

interface PasskeyLoginButtonProps {
  endpoints?: AuthEndpointConfig;
  components: AuthButtonComponentInput;
  className?: string;
  disabled?: boolean;
  onSuccess?: (redirectUrl: string, result: AuthJsonResponse) => void;
  onError?: (message: string) => void;
}

export function PasskeyLoginButton({ endpoints = {}, components, className, disabled = false, onSuccess, onError }: PasskeyLoginButtonProps) {
  const { Button } = resolveAuthButtonComponent(components);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const localAuthentication = usePasskeyAuthentication();
  const authentication = React.useContext(PasskeyAuthenticationContext) ?? localAuthentication;
  const inFlight = React.useRef(false);
  const mounted = React.useRef(true);
  const callbacks = React.useRef({ onSuccess, onError });
  React.useLayoutEffect(() => {
    callbacks.current = { onSuccess, onError };
  });
  React.useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (inFlight.current) void authentication.cancel();
    };
  }, [authentication]);

  async function handlePasskeyLogin() {
    if (disabled || inFlight.current) return;
    inFlight.current = true;
    setError(null);
    setLoading(true);

    try {
      const { redirectUrl, result } = await authentication.authenticate({ endpoints });
      if (!mounted.current) return;
      if (callbacks.current.onSuccess) {
        callbacks.current.onSuccess(redirectUrl, result);
      } else {
        window.location.href = redirectUrl;
      }
    } catch (caughtError: unknown) {
      if (!mounted.current || isAbortError(caughtError)) {
        return;
      }

      const message = caughtError instanceof Error ? caughtError.message : 'Passkey login failed';
      if (callbacks.current.onError) callbacks.current.onError(message);
      else setError(message);
    } finally {
      inFlight.current = false;
      if (mounted.current) setLoading(false);
    }
  }

  if (typeof window === 'undefined' || !window.PublicKeyCredential) {
    return null;
  }

  return (
    <div className={className}>
      {error ? <p className="mb-2 text-sm text-destructive">{error}</p> : null}
      <Button type="button" variant="outline" className="w-full" disabled={disabled || loading} onClick={handlePasskeyLogin}>
        <KeyRound aria-hidden="true" />
        {loading ? 'Verifying...' : 'Sign in with Passkey'}
      </Button>
    </div>
  );
}
