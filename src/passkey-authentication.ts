import * as React from 'react';

import { throwIfAborted } from './abort-utils';
import { authenticateWithPasskey } from './webauthn-utils';

type AuthenticationOptions = NonNullable<Parameters<typeof authenticateWithPasskey>[0]>;
type AuthenticationResult = Awaited<ReturnType<typeof authenticateWithPasskey>>;

interface PendingAuthentication {
  controller: AbortController;
  promise: Promise<AuthenticationResult>;
  conditional: boolean;
}

interface PasskeyAuthentication {
  authenticate: (options?: AuthenticationOptions) => Promise<AuthenticationResult>;
  cancel: (conditionalOnly?: boolean) => Promise<void>;
}

export const PasskeyAuthenticationContext = React.createContext<PasskeyAuthentication | null>(null);

export function usePasskeyAuthentication(): PasskeyAuthentication {
  const pending = React.useRef<PendingAuthentication | null>(null);

  const cancel = React.useCallback(async (conditionalOnly = false) => {
    const request = pending.current;
    if (!request || (conditionalOnly && !request.conditional)) return;

    request.controller.abort();
    await request.promise.catch(() => undefined);
  }, []);

  const authenticate = React.useCallback(async (options: AuthenticationOptions = {}) => {
    const previous = pending.current;
    const controller = new AbortController();
    previous?.controller.abort();

    const promise = (async () => {
      if (previous) await previous.promise.catch(() => undefined);
      throwIfAborted(controller.signal);
      const result = await authenticateWithPasskey({ ...options, signal: controller.signal });
      throwIfAborted(controller.signal);
      return result;
    })();
    const request = { controller, promise, conditional: options.mediation === 'conditional' };
    pending.current = request;

    try {
      return await promise;
    } finally {
      if (pending.current === request) pending.current = null;
    }
  }, []);

  React.useEffect(() => () => {
    void cancel();
  }, [cancel]);

  return React.useMemo(() => ({ authenticate, cancel }), [authenticate, cancel]);
}
