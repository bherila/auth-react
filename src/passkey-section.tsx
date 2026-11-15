import { Key, Plus, Trash2 } from 'lucide-react';
import * as React from 'react';
import { flushSync } from 'react-dom';

import { throwIfAborted } from './abort-utils';
import { resolveAuthComponents } from './components';
import type { AuthComponentInput, AuthEndpointConfig, Passkey } from './types';
import { confirmPasskey, confirmPasswordForPasskey, getCsrfToken, getDefaultPasskeyName, isAbortError, PasswordConfirmationRequiredError, registerPasskey as createPasskey } from './webauthn-utils';

interface PasskeySectionProps {
  endpoints?: AuthEndpointConfig;
  components: AuthComponentInput;
  onSuccess?: (message: string) => void;
  onError?: (field: string, message: string) => void;
}

export function PasskeySection({ endpoints = {}, components, onSuccess, onError }: PasskeySectionProps) {
  const { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label } = resolveAuthComponents(components);
  const [passkeys, setPasskeys] = React.useState<Passkey[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [registering, setRegistering] = React.useState(false);
  const [pendingName, setPendingName] = React.useState('');
  const [needsConfirmation, setNeedsConfirmation] = React.useState(false);
  const [password, setPassword] = React.useState('');
  const [confirmationError, setConfirmationError] = React.useState('');
  const operation = React.useRef<AbortController | null>(null);
  const passwordId = React.useId();

  React.useEffect(() => {
    operation.current = null;
    setRegistering(false);
    setNeedsConfirmation(false);
    setPassword('');
    setConfirmationError('');
    setPendingName('');
    return () => { operation.current?.abort(); operation.current = null; };
  }, [endpoints.confirmPassword, endpoints.passkeyConfirmOptions, endpoints.passkeyConfirm, endpoints.passkeyRegisterOptions, endpoints.passkeyRegister, endpoints.csrfToken]);

  const listUrl = endpoints.passkeyList ?? '/api/passkeys';
  const registerOptionsUrl = endpoints.passkeyRegisterOptions ?? '/api/passkeys/register/options';
  const registerUrl = endpoints.passkeyRegister ?? '/api/passkeys/register';
  const deleteUrl = endpoints.passkeyDelete ?? ((id: number | string) => `/api/passkeys/${id}`);

  const fetchPasskeys = React.useCallback(async () => {
    try {
      const res = await fetch(listUrl);
      if (res.ok) {
        setPasskeys(await res.json());
      }
    } catch {
      onError?.('passkeys', 'Failed to load passkeys');
    } finally {
      setLoading(false);
    }
  }, [listUrl, onError]);

  React.useEffect(() => {
    void fetchPasskeys();
  }, [fetchPasskeys]);

  async function registerPasskey(method?: 'password' | 'passkey') {
    if (operation.current && !operation.current.signal.aborted) return;
    const controller = new AbortController();
    operation.current = controller;
    const name = pendingName || getDefaultPasskeyName();
    const submittedPassword = password;
    setPassword('');
    setConfirmationError('');
    flushSync(() => setPendingName(name));
    setRegistering(true);

    try {
      if (method === 'password') await confirmPasswordForPasskey({ password: submittedPassword, endpoints, signal: controller.signal });
      if (method === 'passkey') await confirmPasskey({ endpoints, signal: controller.signal });
      throwIfAborted(controller.signal);
      await createPasskey({ endpoints: { ...endpoints, passkeyRegisterOptions: registerOptionsUrl, passkeyRegister: registerUrl }, name, signal: controller.signal });
      throwIfAborted(controller.signal);
      setNeedsConfirmation(false);
      setPendingName('');
      onSuccess?.('Passkey registered successfully.');
      await fetchPasskeys();
    } catch (caughtError: unknown) {
      if (!controller.signal.aborted && !isAbortError(caughtError)) {
        if (caughtError instanceof PasswordConfirmationRequiredError) {
          setNeedsConfirmation(true);
          if (method) setConfirmationError('Confirmation is still required. Try again or sign in again.');
        } else {
          const message = caughtError instanceof Error ? caughtError.message : 'Passkey registration failed';
          if (method) setConfirmationError(message);
          onError?.('passkeys', message);
        }
      }
    } finally {
      if (operation.current === controller) {
        operation.current = null;
        if (!controller.signal.aborted) setRegistering(false);
      }
    }
  }

  function cancelConfirmation() {
    operation.current?.abort();
    operation.current = null;
    setRegistering(false);
    setPassword('');
    setConfirmationError('');
    setNeedsConfirmation(false);
  }

  async function deletePasskey(id: number) {
    try {
      const res = await fetch(deleteUrl(id), {
        method: 'DELETE',
        headers: { 'X-CSRF-TOKEN': getCsrfToken(endpoints.csrfToken) },
      });

      if (!res.ok) {
        throw new Error('Delete failed');
      }

      setPasskeys((current) => current.filter((passkey) => passkey.id !== id));
      onSuccess?.('Passkey removed.');
    } catch {
      onError?.('passkeys', 'Failed to delete passkey');
    }
  }

  const isWebAuthnSupported = typeof window !== 'undefined' && !!window.PublicKeyCredential;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Key className="h-5 w-5" />
          Passkeys
        </CardTitle>
        <CardDescription>Manage passkeys for passwordless login.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isWebAuthnSupported ? <p className="text-sm text-muted-foreground">Your browser does not support passkeys.</p> : null}

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading passkeys...</p>
        ) : passkeys.length === 0 ? (
          <p className="text-sm text-muted-foreground">No passkeys registered yet.</p>
        ) : (
          <div className="divide-y rounded-md border">
            {passkeys.map((passkey) => (
              <div key={passkey.id} className="flex items-center justify-between gap-3 p-3">
                <div>
                  <div className="font-medium">{passkey.name}</div>
                  <div className="text-sm text-muted-foreground">{new Date(passkey.created_at).toLocaleDateString()}</div>
                </div>
                <Button type="button" variant="ghost" size="icon" aria-label="Delete passkey" onClick={() => void deletePasskey(passkey.id)}>
                  <Trash2 />
                </Button>
              </div>
            ))}
          </div>
        )}

        {isWebAuthnSupported ? (
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="flex-1 space-y-1">
              <Label htmlFor="passkey-name">Passkey name</Label>
              <Input id="passkey-name" value={pendingName} onChange={(event) => setPendingName(event.target.value)} placeholder={getDefaultPasskeyName()} />
            </div>
            <Button type="button" className="self-end" variant="outline" disabled={registering || needsConfirmation} onClick={() => void registerPasskey()}>
              <Plus />
              {registering ? 'Registering...' : 'Add Passkey'}
            </Button>
          </div>
        ) : null}
        {needsConfirmation ? (
          <div role="group" aria-label="Confirm your identity" className="space-y-3">
            <p>Confirm your identity to add a passkey. Use your password or an existing passkey.</p>
            <div className="space-y-1">
              <Label htmlFor={passwordId}>Current password</Label>
              <Input id={passwordId} type="password" autoComplete="current-password" value={password} disabled={registering} onChange={(event) => setPassword(event.target.value)} />
            </div>
            {confirmationError ? <p role="alert">{confirmationError}</p> : null}
            <div className="flex flex-wrap gap-2">
              <Button type="button" disabled={registering || password.length === 0} onClick={() => void registerPasskey('password')}>Confirm password and continue</Button>
              <Button type="button" variant="outline" disabled={registering} onClick={() => void registerPasskey('passkey')}>Use existing passkey</Button>
              <Button type="button" variant="ghost" onClick={cancelConfirmation}>Cancel</Button>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
