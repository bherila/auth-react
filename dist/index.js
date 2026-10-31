// src/forms.tsx
import * as React3 from "react";

// src/components.ts
var requiredComponentKeys = [
  "Button",
  "Card",
  "CardContent",
  "CardDescription",
  "CardHeader",
  "CardTitle",
  "Input",
  "Label"
];
function resolveAuthComponents(components) {
  const missing = requiredComponentKeys.filter((key) => !components?.[key]);
  if (missing.length > 0) {
    throw new Error(`bwh-auth requires injected components: ${missing.join(", ")}`);
  }
  return components;
}
function resolveAuthButtonComponent(components) {
  if (!components?.Button) {
    throw new Error("bwh-auth requires an injected Button component");
  }
  return { Button: components.Button };
}

// src/passkey-authentication.ts
import * as React from "react";

// src/abort-utils.ts
function throwIfAborted(signal) {
  if (!signal?.aborted) return;
  const error = new Error("Passkey authentication was cancelled");
  error.name = "AbortError";
  throw error;
}

// src/webauthn-utils.ts
function getCsrfToken(explicitToken) {
  if (explicitToken) {
    return explicitToken;
  }
  return document.querySelector('meta[name="csrf-token"]')?.content ?? "";
}
function base64urlToArrayBuffer(b64) {
  const base64 = b64.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(base64.length + (4 - base64.length % 4) % 4, "=");
  const binary = window.atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}
function arrayBufferToBase64url(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i += 1) {
    binary += String.fromCharCode(bytes[i] ?? 0);
  }
  return window.btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}
function isAbortError(error) {
  return error !== null && typeof error === "object" && "name" in error && error.name === "AbortError";
}
function getDefaultPasskeyName() {
  if (typeof window === "undefined") return "Passkey";
  const ua = window.navigator.userAgent;
  let browser = "Unknown Browser";
  let os = "Unknown OS";
  if (ua.includes("Firefox")) browser = "Firefox";
  else if (ua.includes("Edg")) browser = "Edge";
  else if (ua.includes("Chrome")) browser = "Chrome";
  else if (ua.includes("Safari")) browser = "Safari";
  if (ua.includes("Mac OS X")) os = "macOS";
  else if (ua.includes("Windows")) os = "Windows";
  else if (ua.includes("Android")) os = "Android";
  else if (ua.includes("iPhone") || ua.includes("iPad")) os = "iOS";
  else if (ua.includes("Linux")) os = "Linux";
  return `Passkey (${browser} on ${os})`;
}
async function isConditionalMediationAvailable() {
  if (typeof window === "undefined" || !window.PublicKeyCredential) return false;
  const credentialConstructor = window.PublicKeyCredential;
  if (!credentialConstructor.isConditionalMediationAvailable) return false;
  try {
    return await credentialConstructor.isConditionalMediationAvailable();
  } catch {
    return false;
  }
}
async function authenticateWithPasskey({ endpoints = {}, mediation, signal } = {}) {
  const authOptionsUrl = endpoints.passkeyAuthOptions ?? "/api/passkeys/auth/options";
  const authUrl = endpoints.passkeyAuth ?? "/api/passkeys/auth";
  const optRes = await fetch(authOptionsUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-TOKEN": getCsrfToken(endpoints.csrfToken)
    },
    signal
  });
  if (!optRes.ok) {
    throw new Error("Failed to get authentication options");
  }
  const options = await optRes.json();
  throwIfAborted(signal);
  const publicKey = {
    ...options,
    challenge: base64urlToArrayBuffer(options.challenge),
    allowCredentials: (options.allowCredentials || []).map((credential2) => ({
      ...credential2,
      id: base64urlToArrayBuffer(credential2.id)
    }))
  };
  const credential = await navigator.credentials.get({ publicKey, mediation, signal });
  throwIfAborted(signal);
  if (!credential || credential.type !== "public-key") {
    throw new Error("No passkey selected");
  }
  const pkCredential = credential;
  const response = pkCredential.response;
  const credentialData = {
    id: pkCredential.id,
    rawId: arrayBufferToBase64url(pkCredential.rawId),
    type: pkCredential.type,
    response: {
      clientDataJSON: arrayBufferToBase64url(response.clientDataJSON),
      authenticatorData: arrayBufferToBase64url(response.authenticatorData),
      signature: arrayBufferToBase64url(response.signature),
      userHandle: response.userHandle ? arrayBufferToBase64url(response.userHandle) : null
    }
  };
  const authRes = await fetch(authUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-TOKEN": getCsrfToken(endpoints.csrfToken)
    },
    body: JSON.stringify({ credential: credentialData }),
    signal
  });
  const result = await authRes.json();
  if (!authRes.ok) {
    throw new Error(result.error || result.message || "Authentication failed");
  }
  return {
    result,
    redirectUrl: result.redirect || "/"
  };
}
async function registerPasskey({ endpoints = {}, name, signal } = {}) {
  const registerOptionsUrl = endpoints.passkeyRegisterOptions ?? "/api/passkeys/register/options";
  const registerUrl = endpoints.passkeyRegister ?? "/api/passkeys/register";
  const passkeyName = name || getDefaultPasskeyName();
  const optRes = await fetch(registerOptionsUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-TOKEN": getCsrfToken(endpoints.csrfToken)
    },
    signal
  });
  if (!optRes.ok) {
    throw new Error("Failed to get registration options");
  }
  const options = await optRes.json();
  const publicKey = {
    ...options,
    challenge: base64urlToArrayBuffer(options.challenge),
    user: {
      ...options.user,
      id: base64urlToArrayBuffer(options.user.id)
    },
    excludeCredentials: (options.excludeCredentials || []).map((credential2) => ({
      ...credential2,
      id: base64urlToArrayBuffer(credential2.id)
    }))
  };
  const credential = await navigator.credentials.create({ publicKey, signal });
  if (!credential || credential.type !== "public-key") {
    throw new Error("Failed to create credential");
  }
  const pkCredential = credential;
  const response = pkCredential.response;
  const credentialData = {
    id: pkCredential.id,
    rawId: arrayBufferToBase64url(pkCredential.rawId),
    type: pkCredential.type,
    response: {
      clientDataJSON: arrayBufferToBase64url(response.clientDataJSON),
      attestationObject: arrayBufferToBase64url(response.attestationObject),
      transports: response.getTransports ? response.getTransports() : []
    }
  };
  const verifyRes = await fetch(registerUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-TOKEN": getCsrfToken(endpoints.csrfToken)
    },
    body: JSON.stringify({ credential: credentialData, name: passkeyName }),
    signal
  });
  const result = await verifyRes.json();
  if (!verifyRes.ok) {
    throw new Error(result.error || result.message || "Registration failed");
  }
  return { result };
}

// src/passkey-authentication.ts
var PasskeyAuthenticationContext = React.createContext(null);
function usePasskeyAuthentication() {
  const pending = React.useRef(null);
  const cancel = React.useCallback(async (conditionalOnly = false) => {
    const request = pending.current;
    if (!request || conditionalOnly && !request.conditional) return;
    request.controller.abort();
    await request.promise.catch(() => void 0);
  }, []);
  const authenticate = React.useCallback(async (options = {}) => {
    const previous = pending.current;
    const controller = new AbortController();
    previous?.controller.abort();
    const promise = (async () => {
      if (previous) await previous.promise.catch(() => void 0);
      throwIfAborted(controller.signal);
      const result = await authenticateWithPasskey({ ...options, signal: controller.signal });
      throwIfAborted(controller.signal);
      return result;
    })();
    const request = { controller, promise, conditional: options.mediation === "conditional" };
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

// src/passkey-login-button.tsx
import { KeyRound } from "lucide-react";
import * as React2 from "react";
import { jsx, jsxs } from "react/jsx-runtime";
function PasskeyLoginButton({ endpoints = {}, components, className, disabled = false, onSuccess, onError }) {
  const { Button } = resolveAuthButtonComponent(components);
  const [loading, setLoading] = React2.useState(false);
  const [error, setError] = React2.useState(null);
  const localAuthentication = usePasskeyAuthentication();
  const authentication = React2.useContext(PasskeyAuthenticationContext) ?? localAuthentication;
  const inFlight = React2.useRef(false);
  const mounted = React2.useRef(true);
  const callbacks = React2.useRef({ onSuccess, onError });
  React2.useLayoutEffect(() => {
    callbacks.current = { onSuccess, onError };
  });
  React2.useEffect(() => {
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
    } catch (caughtError) {
      if (!mounted.current || isAbortError(caughtError)) {
        return;
      }
      const message = caughtError instanceof Error ? caughtError.message : "Passkey login failed";
      if (callbacks.current.onError) callbacks.current.onError(message);
      else setError(message);
    } finally {
      inFlight.current = false;
      if (mounted.current) setLoading(false);
    }
  }
  if (typeof window === "undefined" || !window.PublicKeyCredential) {
    return null;
  }
  return /* @__PURE__ */ jsxs("div", { className, children: [
    error ? /* @__PURE__ */ jsx("p", { className: "mb-2 text-sm text-destructive", children: error }) : null,
    /* @__PURE__ */ jsxs(Button, { type: "button", variant: "outline", className: "w-full", disabled: disabled || loading, onClick: handlePasskeyLogin, children: [
      /* @__PURE__ */ jsx(KeyRound, { "aria-hidden": "true" }),
      loading ? "Verifying..." : "Sign in with Passkey"
    ] })
  ] });
}

// src/forms.tsx
import { jsx as jsx2, jsxs as jsxs2 } from "react/jsx-runtime";
var AuthRequestError = class extends Error {
  constructor(message, result) {
    super(message);
    this.result = result;
    this.name = "AuthRequestError";
  }
  result;
};
async function postForm(url, body, csrfToken) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "X-CSRF-TOKEN": getCsrfToken(csrfToken)
    },
    body: JSON.stringify(body)
  });
  let decoded;
  try {
    decoded = await response.json();
  } catch {
    throw new AuthRequestError("The server returned an unexpected response. Please try again.", {});
  }
  if (decoded === null || typeof decoded !== "object" || Array.isArray(decoded)) {
    throw new AuthRequestError("The server returned an unexpected response. Please try again.", {});
  }
  const result = decoded;
  if (!response.ok) {
    throw new AuthRequestError(result.message || result.error || "Request failed", result);
  }
  return result;
}
function DefaultRememberMeCheckbox({ checked, onCheckedChange, ...props }) {
  return /* @__PURE__ */ jsx2(
    "input",
    {
      ...props,
      type: "checkbox",
      checked,
      onChange: (event) => onCheckedChange(event.target.checked)
    }
  );
}
function LoginForm({
  endpoints = {},
  components,
  onSuccess,
  onError,
  initialEmail = "",
  onEmailChange,
  rememberMeCheckbox: RememberMeCheckbox = DefaultRememberMeCheckbox,
  rememberMeLabel = "Keep me signed in",
  rememberMeDataTest,
  onSubmitStart,
  onTwoFactorRequired,
  onPasskeySuccess,
  enablePasskeys = false,
  enablePasskeyAutofill = enablePasskeys
}) {
  const { Button, Card, CardContent, CardHeader, CardTitle, Input, Label } = resolveAuthComponents(components);
  const [email, setEmail] = React3.useState(initialEmail);
  const [password, setPassword] = React3.useState("");
  const [remember, setRemember] = React3.useState(false);
  const [loading, setLoading] = React3.useState(false);
  const [conditionalPasskeyAvailable, setConditionalPasskeyAvailable] = React3.useState(false);
  const passkeyAuthentication = usePasskeyAuthentication();
  const conditionalInterrupted = React3.useRef(false);
  const submitting = React3.useRef(false);
  const callbacks = React3.useRef({ onError, onPasskeySuccess });
  React3.useLayoutEffect(() => {
    callbacks.current = { onError, onPasskeySuccess };
  });
  const coordinatedAuthentication = React3.useMemo(() => ({
    ...passkeyAuthentication,
    authenticate: (options) => {
      if (options?.mediation !== "conditional") conditionalInterrupted.current = true;
      return passkeyAuthentication.authenticate(options);
    }
  }), [passkeyAuthentication]);
  const passkeyEndpoints = React3.useMemo(() => ({
    csrfToken: endpoints.csrfToken,
    passkeyAuth: endpoints.passkeyAuth,
    passkeyAuthOptions: endpoints.passkeyAuthOptions
  }), [endpoints.csrfToken, endpoints.passkeyAuth, endpoints.passkeyAuthOptions]);
  React3.useEffect(() => {
    setConditionalPasskeyAvailable(false);
    if (!enablePasskeyAutofill || conditionalInterrupted.current) return;
    let active = true;
    async function startConditionalPasskeyLogin() {
      const available = await isConditionalMediationAvailable();
      if (!available || !active || conditionalInterrupted.current) return;
      setConditionalPasskeyAvailable(true);
      try {
        const { redirectUrl, result } = await coordinatedAuthentication.authenticate({
          endpoints: passkeyEndpoints,
          mediation: "conditional"
        });
        if (!active) return;
        if (callbacks.current.onPasskeySuccess) {
          callbacks.current.onPasskeySuccess(redirectUrl, result);
        } else {
          window.location.href = redirectUrl;
        }
      } catch (error) {
        if (!isAbortError(error) && active) {
          callbacks.current.onError?.(error instanceof Error ? error.message : "Passkey login failed");
        }
      }
    }
    void startConditionalPasskeyLogin();
    return () => {
      active = false;
      void coordinatedAuthentication.cancel(true);
    };
  }, [enablePasskeyAutofill, coordinatedAuthentication, passkeyEndpoints]);
  async function onSubmit(event) {
    event.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    conditionalInterrupted.current = true;
    onSubmitStart?.();
    setLoading(true);
    try {
      await passkeyAuthentication.cancel();
      const result = await postForm(endpoints.login ?? "/login", { email, password, remember }, endpoints.csrfToken);
      if (result.requires_2fa) {
        onTwoFactorRequired?.(result);
        if (!onTwoFactorRequired && typeof result.attempt_token === "string") {
          window.location.href = `/login/two-factor/${encodeURIComponent(result.attempt_token)}`;
        }
        return;
      }
      onSuccess?.(result);
      if (!onSuccess && result.redirect) window.location.href = result.redirect;
    } catch (error) {
      onError?.(error instanceof Error ? error.message : "Login failed");
    } finally {
      submitting.current = false;
      setLoading(false);
    }
  }
  return /* @__PURE__ */ jsxs2(Card, { children: [
    /* @__PURE__ */ jsx2(CardHeader, { children: /* @__PURE__ */ jsx2(CardTitle, { children: "Sign In" }) }),
    /* @__PURE__ */ jsxs2(CardContent, { children: [
      /* @__PURE__ */ jsxs2("form", { className: "space-y-4", onSubmit: (event) => void onSubmit(event), children: [
        /* @__PURE__ */ jsxs2("div", { className: "space-y-1", children: [
          /* @__PURE__ */ jsx2(Label, { htmlFor: "login-email", children: "Email" }),
          /* @__PURE__ */ jsx2(
            Input,
            {
              id: "login-email",
              type: "email",
              autoComplete: conditionalPasskeyAvailable ? "username webauthn" : "email",
              required: true,
              value: email,
              onChange: (event) => {
                setEmail(event.target.value);
                onEmailChange?.(event.target.value);
              }
            }
          )
        ] }),
        /* @__PURE__ */ jsxs2("div", { className: "space-y-1", children: [
          /* @__PURE__ */ jsx2(Label, { htmlFor: "login-password", children: "Password" }),
          /* @__PURE__ */ jsx2(Input, { id: "login-password", type: "password", autoComplete: "current-password", required: true, value: password, onChange: (event) => setPassword(event.target.value) })
        ] }),
        /* @__PURE__ */ jsxs2("div", { className: "flex items-center gap-2 text-sm", children: [
          /* @__PURE__ */ jsx2(
            RememberMeCheckbox,
            {
              id: "login-remember",
              "aria-labelledby": "login-remember-label",
              "data-test": rememberMeDataTest,
              checked: remember,
              onCheckedChange: setRemember
            }
          ),
          /* @__PURE__ */ jsx2(Label, { id: "login-remember-label", htmlFor: "login-remember", children: rememberMeLabel })
        ] }),
        /* @__PURE__ */ jsx2(Button, { type: "submit", className: "w-full", disabled: loading, children: loading ? "Signing in..." : "Sign In" })
      ] }),
      enablePasskeys ? /* @__PURE__ */ jsx2("div", { className: "mt-4", children: /* @__PURE__ */ jsx2(PasskeyAuthenticationContext.Provider, { value: coordinatedAuthentication, children: /* @__PURE__ */ jsx2(
        PasskeyLoginButton,
        {
          components: { Button },
          endpoints,
          disabled: loading,
          onSuccess: (redirectUrl, result) => {
            if (onPasskeySuccess) {
              onPasskeySuccess(redirectUrl, result);
            } else {
              window.location.href = redirectUrl;
            }
          },
          onError
        }
      ) }) }) : null
    ] })
  ] });
}
function defaultSignupFields() {
  return [
    { name: "name", label: "Name", required: true, autoComplete: "name" },
    { name: "email", label: "Email", type: "email", required: true, autoComplete: "email" },
    { name: "password", label: "Password", type: "password", required: true, autoComplete: "new-password" },
    { name: "password_confirmation", label: "Confirm Password", type: "password", required: true, autoComplete: "new-password" }
  ];
}
function initialSignupValue(field, initialValues) {
  if (Object.prototype.hasOwnProperty.call(initialValues, field.name)) return initialValues[field.name];
  if (field.initialValue !== void 0) return field.initialValue;
  return field.type === "checkbox" ? false : "";
}
function SignupForm({
  endpoints = {},
  components,
  onSuccess,
  onError,
  fields = defaultSignupFields(),
  initialValues = {},
  errors = {},
  submitMode = "fetch",
  title = "Create Account",
  description,
  submitLabel = "Create Account",
  submittingLabel = "Creating account..."
}) {
  const { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label } = resolveAuthComponents(components);
  const [values, setValues] = React3.useState(() => Object.fromEntries(
    fields.map((field) => [field.name, initialSignupValue(field, initialValues)])
  ));
  const [fieldErrors, setFieldErrors] = React3.useState(errors);
  const [loading, setLoading] = React3.useState(false);
  async function onSubmit(event) {
    setLoading(true);
    if (submitMode === "native") {
      return;
    }
    event.preventDefault();
    setFieldErrors({});
    try {
      const result = await postForm(endpoints.signup ?? "/register", values, endpoints.csrfToken);
      await onSuccess?.(result, values);
      if (!onSuccess && result.redirect) window.location.href = result.redirect;
    } catch (error) {
      if (error instanceof AuthRequestError && error.result.errors && typeof error.result.errors === "object") {
        setFieldErrors(error.result.errors);
      }
      onError?.(error instanceof Error ? error.message : "Signup failed");
    } finally {
      setLoading(false);
    }
  }
  function setValue(name, value) {
    setValues((current) => ({ ...current, [name]: value }));
  }
  return /* @__PURE__ */ jsxs2(Card, { children: [
    /* @__PURE__ */ jsxs2(CardHeader, { children: [
      /* @__PURE__ */ jsx2(CardTitle, { children: title }),
      description ? /* @__PURE__ */ jsx2(CardDescription, { children: description }) : null
    ] }),
    /* @__PURE__ */ jsx2(CardContent, { children: /* @__PURE__ */ jsxs2("form", { className: "space-y-4", method: submitMode === "native" ? "POST" : void 0, action: endpoints.signup ?? "/register", onSubmit: (event) => void onSubmit(event), children: [
      submitMode === "native" ? /* @__PURE__ */ jsx2("input", { type: "hidden", name: "_token", value: getCsrfToken(endpoints.csrfToken) }) : null,
      fields.map((field) => {
        if (field.hiddenWhen?.(values)) return null;
        const error = fieldErrors[field.name]?.[0];
        const value = values[field.name];
        if (field.type === "checkbox") {
          return /* @__PURE__ */ jsxs2("div", { className: field.containerClassName ?? "space-y-1", children: [
            /* @__PURE__ */ jsxs2("label", { className: "flex items-start gap-2 text-sm", children: [
              /* @__PURE__ */ jsx2(
                "input",
                {
                  id: `signup-${field.name}`,
                  name: field.name,
                  type: "checkbox",
                  value: "1",
                  checked: Boolean(value),
                  onChange: (event) => setValue(field.name, event.target.checked),
                  required: field.required
                }
              ),
              /* @__PURE__ */ jsx2("span", { children: field.label })
            ] }),
            field.helpText ? /* @__PURE__ */ jsx2("p", { className: "text-xs text-muted-foreground", children: field.helpText }) : null,
            error ? /* @__PURE__ */ jsx2("p", { className: "text-sm text-destructive", children: error }) : null
          ] }, field.name);
        }
        return /* @__PURE__ */ jsxs2("div", { className: field.containerClassName ?? "space-y-1", children: [
          /* @__PURE__ */ jsx2(Label, { htmlFor: `signup-${field.name}`, children: field.label }),
          /* @__PURE__ */ jsx2(
            Input,
            {
              id: `signup-${field.name}`,
              name: field.name,
              type: field.type ?? "text",
              placeholder: field.placeholder,
              required: field.required,
              autoComplete: field.autoComplete,
              minLength: field.minLength,
              maxLength: field.maxLength,
              pattern: field.pattern,
              inputMode: field.inputMode,
              className: field.className,
              "aria-invalid": Boolean(error),
              value: String(value ?? ""),
              onChange: (event) => setValue(field.name, event.target.value)
            }
          ),
          field.helpText ? /* @__PURE__ */ jsx2("p", { className: "text-xs text-muted-foreground", children: field.helpText }) : null,
          error ? /* @__PURE__ */ jsx2("p", { className: "text-sm text-destructive", children: error }) : null
        ] }, field.name);
      }),
      /* @__PURE__ */ jsx2(Button, { type: "submit", className: "w-full", disabled: loading, children: loading ? submittingLabel : submitLabel })
    ] }) })
  ] });
}
function PasswordResetRequestForm({ endpoints = {}, components, onSuccess, onError }) {
  const { Button, Input, Label } = resolveAuthComponents(components);
  const [email, setEmail] = React3.useState("");
  const [loading, setLoading] = React3.useState(false);
  async function onSubmit(event) {
    event.preventDefault();
    setLoading(true);
    try {
      const result = await postForm(endpoints.forgotPassword ?? "/api/auth/forgot-password", { email }, endpoints.csrfToken);
      onSuccess?.(result);
    } catch (error) {
      onError?.(error instanceof Error ? error.message : "Password reset request failed");
    } finally {
      setLoading(false);
    }
  }
  return /* @__PURE__ */ jsxs2("form", { className: "space-y-4", onSubmit: (event) => void onSubmit(event), children: [
    /* @__PURE__ */ jsxs2("div", { className: "space-y-1", children: [
      /* @__PURE__ */ jsx2(Label, { htmlFor: "reset-email", children: "Email" }),
      /* @__PURE__ */ jsx2(Input, { id: "reset-email", type: "email", autoComplete: "email", required: true, value: email, onChange: (event) => setEmail(event.target.value) })
    ] }),
    /* @__PURE__ */ jsx2(Button, { type: "submit", disabled: loading, children: loading ? "Sending..." : "Send Reset Link" })
  ] });
}
function ResetPasswordForm({ endpoints = {}, components, onSuccess, onError, token: initialToken = "", email: initialEmail = "" }) {
  const { Button, Input, Label } = resolveAuthComponents(components);
  const [email, setEmail] = React3.useState(initialEmail);
  const [token, setToken] = React3.useState(initialToken);
  const [password, setPassword] = React3.useState("");
  const [passwordConfirmation, setPasswordConfirmation] = React3.useState("");
  async function onSubmit(event) {
    event.preventDefault();
    try {
      const result = await postForm(endpoints.resetPassword ?? "/api/auth/reset-password", {
        email,
        token,
        password,
        password_confirmation: passwordConfirmation
      }, endpoints.csrfToken);
      onSuccess?.(result);
    } catch (error) {
      onError?.(error instanceof Error ? error.message : "Password reset failed");
    }
  }
  return /* @__PURE__ */ jsxs2("form", { className: "space-y-4", onSubmit: (event) => void onSubmit(event), children: [
    /* @__PURE__ */ jsx2(Input, { type: "hidden", value: token, onChange: (event) => setToken(event.target.value) }),
    /* @__PURE__ */ jsxs2("div", { className: "space-y-1", children: [
      /* @__PURE__ */ jsx2(Label, { htmlFor: "reset-password-email", children: "Email" }),
      /* @__PURE__ */ jsx2(Input, { id: "reset-password-email", type: "email", required: true, value: email, onChange: (event) => setEmail(event.target.value) })
    ] }),
    /* @__PURE__ */ jsxs2("div", { className: "space-y-1", children: [
      /* @__PURE__ */ jsx2(Label, { htmlFor: "reset-password", children: "Password" }),
      /* @__PURE__ */ jsx2(Input, { id: "reset-password", type: "password", required: true, value: password, onChange: (event) => setPassword(event.target.value) })
    ] }),
    /* @__PURE__ */ jsxs2("div", { className: "space-y-1", children: [
      /* @__PURE__ */ jsx2(Label, { htmlFor: "reset-password-confirmation", children: "Confirm Password" }),
      /* @__PURE__ */ jsx2(Input, { id: "reset-password-confirmation", type: "password", required: true, value: passwordConfirmation, onChange: (event) => setPasswordConfirmation(event.target.value) })
    ] }),
    /* @__PURE__ */ jsx2(Button, { type: "submit", children: "Reset Password" })
  ] });
}
function ChangePasswordForm({ endpoints = {}, components, onSuccess, onError }) {
  const { Button, Input, Label } = resolveAuthComponents(components);
  const [currentPassword, setCurrentPassword] = React3.useState("");
  const [password, setPassword] = React3.useState("");
  const [passwordConfirmation, setPasswordConfirmation] = React3.useState("");
  const [loading, setLoading] = React3.useState(false);
  async function onSubmit(event) {
    event.preventDefault();
    setLoading(true);
    if (password !== passwordConfirmation) {
      onError?.("New passwords do not match.");
      setLoading(false);
      return;
    }
    try {
      const result = await postForm(endpoints.changePassword ?? "/api/change-password", {
        current_password: currentPassword,
        password,
        password_confirmation: passwordConfirmation
      }, endpoints.csrfToken);
      setCurrentPassword("");
      setPassword("");
      setPasswordConfirmation("");
      onSuccess?.(result);
    } catch (error) {
      onError?.(error instanceof Error ? error.message : "Password change failed");
    } finally {
      setLoading(false);
    }
  }
  return /* @__PURE__ */ jsxs2("form", { className: "space-y-4", onSubmit: (event) => void onSubmit(event), children: [
    /* @__PURE__ */ jsxs2("div", { className: "space-y-1", children: [
      /* @__PURE__ */ jsx2(Label, { htmlFor: "current-password", children: "Current Password" }),
      /* @__PURE__ */ jsx2(Input, { id: "current-password", type: "password", autoComplete: "current-password", required: true, value: currentPassword, onChange: (event) => setCurrentPassword(event.target.value) })
    ] }),
    /* @__PURE__ */ jsxs2("div", { className: "space-y-1", children: [
      /* @__PURE__ */ jsx2(Label, { htmlFor: "new-password", children: "New Password" }),
      /* @__PURE__ */ jsx2(Input, { id: "new-password", type: "password", autoComplete: "new-password", minLength: 8, required: true, value: password, onChange: (event) => setPassword(event.target.value) })
    ] }),
    /* @__PURE__ */ jsxs2("div", { className: "space-y-1", children: [
      /* @__PURE__ */ jsx2(Label, { htmlFor: "confirm-password", children: "Confirm New Password" }),
      /* @__PURE__ */ jsx2(Input, { id: "confirm-password", type: "password", autoComplete: "new-password", minLength: 8, required: true, value: passwordConfirmation, onChange: (event) => setPasswordConfirmation(event.target.value) })
    ] }),
    /* @__PURE__ */ jsx2(Button, { type: "submit", disabled: loading, children: loading ? "Changing..." : "Change Password" })
  ] });
}
function TwoFactorForm({ endpoints = {}, components, attemptToken, appEnv, onSuccess, onError, onReportSuspicious }) {
  const { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label } = resolveAuthComponents(components);
  const [currentAttemptToken, setCurrentAttemptToken] = React3.useState(attemptToken);
  const [code, setCode] = React3.useState("");
  const [loading, setLoading] = React3.useState(false);
  const [resending, setResending] = React3.useState(false);
  const [message, setMessage] = React3.useState("");
  React3.useEffect(() => setCurrentAttemptToken(attemptToken), [attemptToken]);
  async function onSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      const result = await postForm(endpoints.twoFactorVerify ?? "/api/auth/two-factor/verify", {
        attempt_token: currentAttemptToken,
        code: code.trim()
      }, endpoints.csrfToken);
      onSuccess?.(result);
      if (!onSuccess && result.redirect) window.location.href = result.redirect;
    } catch (error) {
      setCode("");
      onError?.(error instanceof Error ? error.message : "Verification failed");
    } finally {
      setLoading(false);
    }
  }
  async function resend() {
    setResending(true);
    setMessage("");
    try {
      const result = await postForm(endpoints.twoFactorResend ?? "/api/auth/two-factor/resend", {
        attempt_token: currentAttemptToken
      }, endpoints.csrfToken);
      if (typeof result.attempt_token === "string") setCurrentAttemptToken(result.attempt_token);
      setMessage(result.message ?? "A new verification code has been sent.");
    } catch (error) {
      onError?.(error instanceof Error ? error.message : "Could not resend verification code");
    } finally {
      setResending(false);
    }
  }
  async function reportSuspicious() {
    const url = endpoints.twoFactorReport?.(currentAttemptToken) ?? `/api/auth/two-factor/report/${encodeURIComponent(currentAttemptToken)}`;
    try {
      const result = await postForm(url, {}, endpoints.csrfToken);
      setMessage(result.message ?? "This login attempt has been reported.");
      onReportSuspicious?.(result);
    } catch (error) {
      onError?.(error instanceof Error ? error.message : "Could not report the login attempt");
    }
  }
  return /* @__PURE__ */ jsxs2(Card, { children: [
    /* @__PURE__ */ jsxs2(CardHeader, { children: [
      /* @__PURE__ */ jsx2(CardTitle, { children: "Verify Your Login" }),
      /* @__PURE__ */ jsx2(CardDescription, { children: "Enter the 6-digit code sent to your email address." })
    ] }),
    /* @__PURE__ */ jsxs2(CardContent, { children: [
      /* @__PURE__ */ jsxs2("form", { className: "space-y-4", onSubmit: (event) => void onSubmit(event), children: [
        /* @__PURE__ */ jsxs2("div", { className: "space-y-1", children: [
          /* @__PURE__ */ jsx2(Label, { htmlFor: "two-factor-code", children: "Verification Code" }),
          /* @__PURE__ */ jsx2(
            Input,
            {
              id: "two-factor-code",
              type: "text",
              inputMode: "numeric",
              pattern: "[0-9]{6}",
              maxLength: 6,
              autoComplete: "one-time-code",
              required: true,
              value: code,
              onChange: (event) => setCode(event.target.value.replace(/\D/g, ""))
            }
          )
        ] }),
        /* @__PURE__ */ jsx2(Button, { type: "submit", className: "w-full", disabled: loading || code.length !== 6, children: loading ? "Verifying..." : "Verify Code" })
      ] }),
      /* @__PURE__ */ jsxs2("div", { className: "mt-4 space-y-2 text-sm", children: [
        /* @__PURE__ */ jsx2(Button, { type: "button", variant: "outline", className: "w-full", disabled: resending, onClick: () => void resend(), children: resending ? "Sending..." : "Send a new code" }),
        /* @__PURE__ */ jsx2("button", { type: "button", className: "text-sm underline", onClick: () => void reportSuspicious(), children: "This was not me" }),
        message ? /* @__PURE__ */ jsx2("p", { children: message }) : null,
        appEnv && appEnv !== "production" ? /* @__PURE__ */ jsx2("p", { children: "Dev mode: use 999999 to bypass 2FA." }) : null
      ] })
    ] })
  ] });
}

// src/passkey-section.tsx
import { Key, Plus, Trash2 } from "lucide-react";
import * as React4 from "react";
import { flushSync } from "react-dom";
import { jsx as jsx3, jsxs as jsxs3 } from "react/jsx-runtime";
function PasskeySection({ endpoints = {}, components, onSuccess, onError }) {
  const { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label } = resolveAuthComponents(components);
  const [passkeys, setPasskeys] = React4.useState([]);
  const [loading, setLoading] = React4.useState(true);
  const [registering, setRegistering] = React4.useState(false);
  const [pendingName, setPendingName] = React4.useState("");
  const listUrl = endpoints.passkeyList ?? "/api/passkeys";
  const registerOptionsUrl = endpoints.passkeyRegisterOptions ?? "/api/passkeys/register/options";
  const registerUrl = endpoints.passkeyRegister ?? "/api/passkeys/register";
  const deleteUrl = endpoints.passkeyDelete ?? ((id) => `/api/passkeys/${id}`);
  const fetchPasskeys = React4.useCallback(async () => {
    try {
      const res = await fetch(listUrl);
      if (res.ok) {
        setPasskeys(await res.json());
      }
    } catch {
      onError?.("passkeys", "Failed to load passkeys");
    } finally {
      setLoading(false);
    }
  }, [listUrl, onError]);
  React4.useEffect(() => {
    void fetchPasskeys();
  }, [fetchPasskeys]);
  async function registerPasskey2() {
    const name = pendingName || getDefaultPasskeyName();
    flushSync(() => setPendingName(name));
    setRegistering(true);
    try {
      await registerPasskey({ endpoints: { ...endpoints, passkeyRegisterOptions: registerOptionsUrl, passkeyRegister: registerUrl }, name });
      setPendingName("");
      onSuccess?.("Passkey registered successfully.");
      await fetchPasskeys();
    } catch (caughtError) {
      if (!isAbortError(caughtError)) {
        onError?.("passkeys", caughtError instanceof Error ? caughtError.message : "Passkey registration failed");
      }
    } finally {
      setRegistering(false);
    }
  }
  async function deletePasskey(id) {
    try {
      const res = await fetch(deleteUrl(id), {
        method: "DELETE",
        headers: { "X-CSRF-TOKEN": getCsrfToken(endpoints.csrfToken) }
      });
      if (!res.ok) {
        throw new Error("Delete failed");
      }
      setPasskeys((current) => current.filter((passkey) => passkey.id !== id));
      onSuccess?.("Passkey removed.");
    } catch {
      onError?.("passkeys", "Failed to delete passkey");
    }
  }
  const isWebAuthnSupported = typeof window !== "undefined" && !!window.PublicKeyCredential;
  return /* @__PURE__ */ jsxs3(Card, { children: [
    /* @__PURE__ */ jsxs3(CardHeader, { children: [
      /* @__PURE__ */ jsxs3(CardTitle, { className: "flex items-center gap-2", children: [
        /* @__PURE__ */ jsx3(Key, { className: "h-5 w-5" }),
        "Passkeys"
      ] }),
      /* @__PURE__ */ jsx3(CardDescription, { children: "Manage passkeys for passwordless login." })
    ] }),
    /* @__PURE__ */ jsxs3(CardContent, { className: "space-y-4", children: [
      !isWebAuthnSupported ? /* @__PURE__ */ jsx3("p", { className: "text-sm text-muted-foreground", children: "Your browser does not support passkeys." }) : null,
      loading ? /* @__PURE__ */ jsx3("p", { className: "text-sm text-muted-foreground", children: "Loading passkeys..." }) : passkeys.length === 0 ? /* @__PURE__ */ jsx3("p", { className: "text-sm text-muted-foreground", children: "No passkeys registered yet." }) : /* @__PURE__ */ jsx3("div", { className: "divide-y rounded-md border", children: passkeys.map((passkey) => /* @__PURE__ */ jsxs3("div", { className: "flex items-center justify-between gap-3 p-3", children: [
        /* @__PURE__ */ jsxs3("div", { children: [
          /* @__PURE__ */ jsx3("div", { className: "font-medium", children: passkey.name }),
          /* @__PURE__ */ jsx3("div", { className: "text-sm text-muted-foreground", children: new Date(passkey.created_at).toLocaleDateString() })
        ] }),
        /* @__PURE__ */ jsx3(Button, { type: "button", variant: "ghost", size: "icon", "aria-label": "Delete passkey", onClick: () => void deletePasskey(passkey.id), children: /* @__PURE__ */ jsx3(Trash2, {}) })
      ] }, passkey.id)) }),
      isWebAuthnSupported ? /* @__PURE__ */ jsxs3("div", { className: "flex flex-col gap-2 sm:flex-row", children: [
        /* @__PURE__ */ jsxs3("div", { className: "flex-1 space-y-1", children: [
          /* @__PURE__ */ jsx3(Label, { htmlFor: "passkey-name", children: "Passkey name" }),
          /* @__PURE__ */ jsx3(Input, { id: "passkey-name", value: pendingName, onChange: (event) => setPendingName(event.target.value), placeholder: getDefaultPasskeyName() })
        ] }),
        /* @__PURE__ */ jsxs3(Button, { type: "button", className: "self-end", variant: "outline", disabled: registering, onClick: () => void registerPasskey2(), children: [
          /* @__PURE__ */ jsx3(Plus, {}),
          registering ? "Registering..." : "Add Passkey"
        ] })
      ] }) : null
    ] })
  ] });
}

// src/relying-applications.ts
function safeApplicationHref(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}
function relyingApplicationsFrom(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((entry) => {
    if (typeof entry !== "object" || entry === null) {
      return [];
    }
    const { key, name, url } = entry;
    if (typeof key !== "string" || typeof name !== "string" || typeof url !== "string") {
      return [];
    }
    if (key === "" || name.trim() === "") {
      return [];
    }
    const href = safeApplicationHref(url);
    return href === null ? [] : [{ key, name: name.trim(), url: href }];
  });
}

// src/api-credentials-section.tsx
import * as React6 from "react";

// src/scope-picker.tsx
import { ChevronRight, TriangleAlert } from "lucide-react";
import * as React5 from "react";

// src/scope-selection.ts
function closeImplications(implications) {
  const closed = {};
  for (const key of Object.keys(implications)) {
    const seen = /* @__PURE__ */ new Set();
    const walk = (id) => {
      for (const needed of implications[id] ?? []) {
        if (needed !== key && !seen.has(needed)) {
          seen.add(needed);
          walk(needed);
        }
      }
    };
    walk(key);
    if (seen.size > 0) {
      closed[key] = [...seen];
    }
  }
  return closed;
}
function restrictImplications(implications, offered) {
  const result = {};
  for (const [key, needed] of Object.entries(implications ?? {})) {
    if (!offered.has(key) || !Array.isArray(needed)) {
      continue;
    }
    const kept = needed.filter((id) => offered.has(id));
    if (kept.length > 0) {
      result[key] = kept;
    }
  }
  return result;
}
function inCatalogOrder(ids, catalog) {
  const wanted = new Set(ids);
  return catalog.filter((id) => wanted.has(id));
}
function withScopes(selected, ids, closed) {
  const next = new Set(selected);
  for (const id of ids) {
    next.add(id);
    for (const needed of closed[id] ?? []) {
      next.add(needed);
    }
  }
  return next;
}
function withoutScopes(selected, ids, closed) {
  const removed = new Set(ids);
  const next = new Set(selected);
  for (const id of ids) {
    next.delete(id);
  }
  for (const [scope, needed] of Object.entries(closed)) {
    if (needed.some((id) => removed.has(id))) {
      next.delete(scope);
    }
  }
  return next;
}
function neededBy(id, selected, closed) {
  return selected.filter((scope) => scope !== id && (closed[scope] ?? []).includes(id));
}
function sameSelection(a, b) {
  if (a.length !== b.length) {
    return false;
  }
  const set = new Set(a);
  return b.every((id) => set.has(id));
}

// src/scope-picker.tsx
import { Fragment, jsx as jsx4, jsxs as jsxs4 } from "react/jsx-runtime";
function resolveGroups(scopes, groups) {
  if (!Array.isArray(groups) || groups.length === 0) {
    return null;
  }
  const byId = new Map(scopes.map((scope) => [scope.id, scope]));
  const placed = /* @__PURE__ */ new Set();
  const resolved = [];
  for (const group of groups) {
    const members = [];
    for (const id of group.scopes ?? []) {
      const scope = byId.get(id);
      if (scope && !placed.has(id)) {
        placed.add(id);
        members.push(scope);
      }
    }
    if (members.length > 0) {
      resolved.push({ id: group.id, label: group.label, description: group.description ?? null, sensitive: group.sensitive === true, scopes: members });
    }
  }
  const rest = scopes.filter((scope) => !placed.has(scope.id));
  if (rest.length > 0) {
    resolved.push({ id: "other", label: "Other permissions", description: null, sensitive: false, scopes: rest });
  }
  return resolved.length > 0 ? resolved : null;
}
function DefaultBadge(props) {
  return /* @__PURE__ */ jsx4("span", { ...props });
}
var touchRow = {
  display: "flex",
  gap: "0.625rem",
  alignItems: "flex-start",
  minHeight: 44,
  padding: "0.5rem 0",
  boxSizing: "border-box",
  overflowWrap: "anywhere"
};
var mutedStyle = { opacity: 0.7 };
var gridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 300px), 1fr))",
  gap: "1rem",
  alignItems: "start"
};
var boxStyle = { margin: 0, minWidth: 0, border: "1px solid rgba(128, 128, 128, 0.35)", borderRadius: 10, padding: "0.25rem 1rem 0.75rem" };
function ScopePicker({ idPrefix, scopes, groups, presets, implications, selected, onChange, components }) {
  const { Checkbox, Button, Badge, Alert } = resolveAuthComponents(components);
  const [open, setOpen] = React5.useState({});
  const catalog = React5.useMemo(() => scopes.map((scope) => scope.id), [scopes]);
  const closed = React5.useMemo(() => closeImplications(restrictImplications(implications, new Set(catalog))), [implications, catalog]);
  const layout = React5.useMemo(() => resolveGroups(scopes, groups), [scopes, groups]);
  const offeredPresets = React5.useMemo(
    () => (presets ?? []).filter((preset) => preset.scopes.length > 0 && preset.scopes.every((id) => catalog.includes(id))),
    [presets, catalog]
  );
  const cascades = Object.keys(closed).length > 0;
  const chosen = new Set(selected);
  const commit = (next) => onChange(inCatalogOrder(next, catalog));
  const toggle = (id, checked) => {
    if (layout === null && !cascades) {
      onChange(checked ? [...selected, id] : selected.filter((value) => value !== id));
      return;
    }
    commit(checked ? withScopes(selected, [id], closed) : withoutScopes(selected, [id], closed));
  };
  const renderRow = (scope, grouped) => {
    const id = `${idPrefix}-${scope.id}`;
    const needers = neededBy(scope.id, selected, closed);
    const noteId = `${id}-needed`;
    const row = /* @__PURE__ */ jsxs4("label", { htmlFor: id, style: grouped ? { ...touchRow, cursor: "pointer" } : { overflowWrap: "anywhere" }, children: [
      Checkbox ? /* @__PURE__ */ jsx4(Checkbox, { id, checked: chosen.has(scope.id), onCheckedChange: (checked) => toggle(scope.id, checked) }) : /* @__PURE__ */ jsx4(
        "input",
        {
          id,
          type: "checkbox",
          checked: chosen.has(scope.id),
          "aria-describedby": needers.length > 0 ? noteId : void 0,
          onChange: (event) => toggle(scope.id, event.target.checked),
          style: grouped ? { flex: "none", width: 16, height: 16, margin: "2px 0 0" } : void 0
        }
      ),
      " ",
      /* @__PURE__ */ jsxs4("span", { style: { minWidth: 0, overflowWrap: "anywhere" }, children: [
        /* @__PURE__ */ jsx4("code", { children: scope.id }),
        " ",
        /* @__PURE__ */ jsx4("span", { style: mutedStyle, children: scope.description })
      ] })
    ] }, scope.id);
    if (needers.length === 0) {
      return row;
    }
    return /* @__PURE__ */ jsxs4("div", { style: { minWidth: 0 }, children: [
      row,
      /* @__PURE__ */ jsxs4("small", { id: noteId, style: { ...mutedStyle, display: "block", paddingLeft: grouped ? 26 : 0, overflowWrap: "anywhere" }, children: [
        "needed by ",
        needers.join(", ")
      ] })
    ] }, scope.id);
  };
  if (layout === null) {
    return /* @__PURE__ */ jsxs4("fieldset", { style: { display: "grid", gap: "0.25rem", border: 0, padding: 0, minWidth: 0 }, children: [
      /* @__PURE__ */ jsx4("legend", { children: "Permissions" }),
      scopes.map((scope) => renderRow(scope, false))
    ] });
  }
  const pressed = offeredPresets.find((preset) => sameSelection(selected, preset.scopes));
  const plain = layout.filter((group) => !group.sensitive);
  const sensitive = layout.filter((group) => group.sensitive);
  const Chip = Badge ?? DefaultBadge;
  return /* @__PURE__ */ jsxs4("div", { style: { display: "grid", gap: "1rem", minWidth: 0 }, children: [
    /* @__PURE__ */ jsxs4("div", { style: { display: "grid", gap: "0.25rem" }, children: [
      /* @__PURE__ */ jsx4("strong", { children: "Permissions" }),
      offeredPresets.length > 0 && /* @__PURE__ */ jsx4("span", { style: mutedStyle, children: "Start from a preset, then adjust any permission below. The credential stores exactly the permissions you tick." })
    ] }),
    offeredPresets.length > 0 && /* @__PURE__ */ jsxs4("div", { style: { display: "grid", gap: "0.625rem" }, children: [
      /* @__PURE__ */ jsx4("div", { role: "group", "aria-label": "Presets", style: { display: "flex", flexWrap: "wrap", gap: "0.5rem" }, children: offeredPresets.map((preset) => {
        const isPressed = pressed?.id === preset.id;
        return /* @__PURE__ */ jsx4(
          Button,
          {
            type: "button",
            variant: isPressed ? "default" : "outline",
            "aria-pressed": isPressed,
            style: { minHeight: 44, maxWidth: "100%", overflowWrap: "anywhere", whiteSpace: "normal", textAlign: "left" },
            onClick: () => commit(withScopes([], preset.scopes, closed)),
            children: preset.label
          },
          preset.id
        );
      }) }),
      /* @__PURE__ */ jsx4("p", { "aria-live": "polite", style: { margin: 0, ...mutedStyle, overflowWrap: "anywhere" }, children: pressed ? pressed.description : "Custom selection. Pick a preset to replace it, or keep adjusting below." })
    ] }),
    plain.length > 0 && /* @__PURE__ */ jsx4("div", { style: gridStyle, children: plain.map((group) => /* @__PURE__ */ jsxs4("fieldset", { style: { ...boxStyle, display: "grid", gridTemplateColumns: "minmax(0, 1fr)" }, children: [
      /* @__PURE__ */ jsx4("legend", { style: { padding: "0 0.375rem", fontWeight: 600, overflowWrap: "anywhere" }, children: group.label }),
      group.scopes.map((scope) => renderRow(scope, true))
    ] }, group.id)) }),
    sensitive.map((group) => {
      const ids = group.scopes.map((scope) => scope.id);
      const count = ids.filter((id) => chosen.has(id)).length;
      const state = count === 0 ? "none" : count === ids.length ? "all" : "some";
      const parentId = `${idPrefix}-group-${group.id}`;
      const listId = `${parentId}-scopes`;
      const isOpen = open[group.id] === true;
      const warning = group.description !== null && group.description !== "" ? group.description : null;
      return /* @__PURE__ */ jsxs4("fieldset", { style: { ...boxStyle, display: "grid", gap: "0.375rem", paddingBottom: "0.875rem" }, children: [
        /* @__PURE__ */ jsxs4("legend", { style: { padding: "0 0.375rem", fontWeight: 600, display: "flex", alignItems: "center", gap: "0.5rem" }, children: [
          /* @__PURE__ */ jsx4("span", { style: { overflowWrap: "anywhere" }, children: group.label }),
          /* @__PURE__ */ jsx4(Chip, { style: { fontSize: 12, fontWeight: 500, border: "1px solid currentColor", borderRadius: 999, padding: "3px 8px", lineHeight: 1 }, children: "Sensitive" })
        ] }),
        warning !== null && (() => {
          const content = /* @__PURE__ */ jsxs4(Fragment, { children: [
            /* @__PURE__ */ jsx4(TriangleAlert, { "aria-hidden": "true", size: 16, style: { flex: "none", marginTop: 2 } }),
            /* @__PURE__ */ jsx4("span", { style: { minWidth: 0, overflowWrap: "anywhere" }, children: warning })
          ] });
          const style = { margin: "0.25rem 0 0", display: "flex", gap: "0.5rem", alignItems: "flex-start" };
          return Alert ? /* @__PURE__ */ jsx4(Alert, { style, children: content }) : /* @__PURE__ */ jsx4("p", { style: { ...style, color: "#b45309" }, children: content });
        })(),
        /* @__PURE__ */ jsxs4("label", { htmlFor: parentId, style: { ...touchRow, cursor: "pointer" }, children: [
          /* @__PURE__ */ jsx4(
            "input",
            {
              id: parentId,
              type: "checkbox",
              checked: state === "all",
              "aria-checked": state === "some" ? "mixed" : state === "all",
              ref: (element) => {
                if (element) {
                  element.indeterminate = state === "some";
                }
              },
              onChange: () => commit(state === "all" ? withoutScopes(selected, ids, closed) : withScopes(selected, ids, closed)),
              style: { flex: "none", width: 16, height: 16, margin: "2px 0 0" }
            }
          ),
          " ",
          /* @__PURE__ */ jsxs4("span", { style: { minWidth: 0, overflowWrap: "anywhere" }, children: [
            /* @__PURE__ */ jsx4("strong", { children: group.label }),
            " ",
            /* @__PURE__ */ jsx4("span", { style: mutedStyle, children: state === "all" ? `All ${ids.length} ${group.label} permissions are selected.` : state === "some" ? `${count} of ${ids.length} ${group.label} permissions are selected.` : `Selects all ${ids.length} ${group.label} permissions.` })
          ] })
        ] }),
        /* @__PURE__ */ jsx4("div", { children: /* @__PURE__ */ jsxs4(
          Button,
          {
            type: "button",
            variant: "ghost",
            "aria-expanded": isOpen,
            "aria-controls": listId,
            style: { minHeight: 44, whiteSpace: "normal", textAlign: "left" },
            onClick: () => setOpen((current) => ({ ...current, [group.id]: !isOpen })),
            children: [
              /* @__PURE__ */ jsx4(ChevronRight, { "aria-hidden": "true", size: 16, style: { flex: "none", transition: "transform 120ms", transform: isOpen ? "rotate(90deg)" : "none" } }),
              isOpen ? "Hide" : "Adjust",
              " individual ",
              group.label,
              " permissions"
            ]
          }
        ) }),
        isOpen && /* @__PURE__ */ jsx4("div", { id: listId, style: { ...gridStyle, columnGap: "1.5rem", gap: "0 1.5rem", paddingLeft: "1.5rem", marginLeft: 7, borderLeft: "2px solid rgba(128, 128, 128, 0.35)" }, children: group.scopes.map((scope) => renderRow(scope, true)) })
      ] }, group.id);
    }),
    /* @__PURE__ */ jsxs4("div", { style: { borderTop: "1px solid rgba(128, 128, 128, 0.35)", paddingTop: "0.875rem", display: "grid", gap: "0.5rem" }, children: [
      /* @__PURE__ */ jsx4("p", { style: { margin: 0, fontWeight: 500 }, role: "status", children: selected.length === 0 ? "No permissions selected." : `This credential will request ${selected.length} ${selected.length === 1 ? "permission" : "permissions"}:` }),
      selected.length > 0 && /* @__PURE__ */ jsx4("p", { style: { margin: 0, display: "flex", flexWrap: "wrap", gap: "0.375rem" }, children: selected.map((id) => /* @__PURE__ */ jsx4("code", { style: { overflowWrap: "anywhere" }, children: id }, id)) })
    ] })
  ] });
}

// src/api-credentials-section.tsx
import { Fragment as Fragment2, jsx as jsx5, jsxs as jsxs5 } from "react/jsx-runtime";
function ApiCredentialsSection({ indexUrl, components, links = [], csrfToken, request, onSuccess, onError }) {
  const { Card, CardContent, CardDescription, CardHeader, CardTitle } = resolveAuthComponents(components);
  const [index, setIndex] = React6.useState(null);
  const [issued, setIssued] = React6.useState([]);
  const issuedKey = React6.useRef(0);
  const addIssued = React6.useCallback((credential) => {
    issuedKey.current += 1;
    const key = issuedKey.current;
    setIssued((current) => [...current, { key, credential }]);
  }, []);
  const [loadError, setLoadError] = React6.useState(null);
  const onErrorRef = React6.useRef(onError);
  onErrorRef.current = onError;
  const generation = React6.useRef(0);
  const context = React6.useRef({ indexUrl, csrfToken, request });
  context.current = { indexUrl, csrfToken, request };
  const reload = React6.useCallback(async () => {
    generation.current += 1;
    const mine = generation.current;
    const { indexUrl: url, csrfToken: token, request: send } = context.current;
    const result = await credentialRequest("GET", url, void 0, token, send);
    if (mine !== generation.current) {
      return;
    }
    if (result.ok) {
      setIndex(result.data);
      setLoadError(null);
    } else {
      setLoadError(result.message);
      onErrorRef.current?.("api-credentials", result.message);
    }
  }, []);
  React6.useEffect(() => {
    setIndex(null);
    void reload();
  }, [indexUrl, csrfToken, reload]);
  const removeLocally = React6.useCallback((list, id) => {
    setIndex(
      (current) => current === null ? current : list === "tokens" ? { ...current, tokens: current.tokens.filter((token) => token.id !== id) } : { ...current, apps: current.apps.filter((app) => app.id !== id) }
    );
  }, []);
  const shared = { components, csrfToken, request, onError, onSuccess, removeLocally };
  return /* @__PURE__ */ jsxs5(Card, { children: [
    /* @__PURE__ */ jsxs5(CardHeader, { children: [
      /* @__PURE__ */ jsx5(CardTitle, { children: "API access" }),
      /* @__PURE__ */ jsx5(CardDescription, { children: "Connect apps that use the API. Register an OAuth app for apps that sign you in, or create an API token for apps that ask for a key. Each carries only the permissions you choose, and never more than your own access." })
    ] }),
    /* @__PURE__ */ jsx5(CardContent, { children: /* @__PURE__ */ jsxs5("div", { style: { display: "grid", gap: "1.5rem", minWidth: 0 }, children: [
      links.length > 0 && /* @__PURE__ */ jsx5("dl", { style: { display: "grid", gap: "0.5rem", minWidth: 0 }, children: links.map((link) => /* @__PURE__ */ jsxs5("div", { style: { minWidth: 0 }, children: [
        /* @__PURE__ */ jsx5("dt", { children: link.label }),
        /* @__PURE__ */ jsxs5("dd", { style: { margin: 0, overflowWrap: "anywhere" }, children: [
          /* @__PURE__ */ jsx5("code", { children: link.url }),
          " ",
          /* @__PURE__ */ jsx5(CopyButton, { text: link.url, label: link.label, components })
        ] })
      ] }, link.label)) }),
      issued.map(({ key, credential }) => /* @__PURE__ */ jsx5(
        IssuedNotice,
        {
          issued: credential,
          components,
          onDismiss: () => setIssued((current) => current.filter((entry) => entry.key !== key))
        },
        key
      )),
      loadError !== null && /* @__PURE__ */ jsx5("p", { role: "alert", children: loadError }),
      index !== null && /* @__PURE__ */ jsxs5(Fragment2, { children: [
        (index.issue_token_href === null || index.register_app_href === null) && /* @__PURE__ */ jsx5("p", { role: "status", children: "Creating new credentials is unavailable right now. You can still revoke existing ones." }),
        /* @__PURE__ */ jsx5(TokenSection, { index, ...shared, onIssued: addIssued, reload }),
        /* @__PURE__ */ jsx5(AppSection, { index, ...shared, onIssued: addIssued, reload })
      ] })
    ] }) })
  ] });
}
function TokenSection({ index, components, csrfToken, request, onIssued, reload, onSuccess, onError, removeLocally }) {
  const { Button, Input, Label, RadioGroup } = resolveAuthComponents(components);
  const [name, setName] = React6.useState("");
  const [scopes, setScopes] = React6.useState([]);
  const [lifetime, setLifetime] = React6.useState(index.token_lifetimes[0] ?? "");
  const tokenScopes = React6.useMemo(
    () => [...index.token_scopes ?? index.scopes, ...index.token_connection_scopes ?? []],
    [index.token_scopes, index.scopes, index.token_connection_scopes]
  );
  const connectionIds = new Set((index.token_connection_scopes ?? []).map((scope) => scope.id));
  const lifetimes = index.connection_token_lifetimes && index.connection_token_lifetimes.length > 0 && scopes.some((id) => connectionIds.has(id)) ? index.connection_token_lifetimes : index.token_lifetimes;
  const effectiveLifetime = lifetimes.includes(lifetime) ? lifetime : lifetimes[0] ?? "";
  const [busy, setBusy] = React6.useState(false);
  const [error, setError] = React6.useState(null);
  async function create(event) {
    event.preventDefault();
    if (index.issue_token_href === null) {
      return;
    }
    setBusy(true);
    const result = await credentialRequest("POST", index.issue_token_href, { name, scopes, lifetime: effectiveLifetime }, csrfToken, request);
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      onError?.("api-tokens", result.message);
      return;
    }
    setError(null);
    setName("");
    setScopes([]);
    onIssued(result.data);
    onSuccess?.("API token created.");
    await reload();
  }
  const [pending, setPending] = React6.useState([]);
  async function revoke(token) {
    if (pending.includes(token.id)) {
      return;
    }
    setPending((current) => [...current, token.id]);
    const result = await credentialRequest("DELETE", token.revoke_href, void 0, csrfToken, request);
    if (!result.ok) {
      setPending((current) => current.filter((id) => id !== token.id));
      setError(result.message);
      onError?.("api-tokens", result.message);
      return;
    }
    setError(null);
    removeLocally("tokens", token.id);
    onSuccess?.("API token revoked.");
    await reload();
    setPending((current) => current.filter((id) => id !== token.id));
  }
  return /* @__PURE__ */ jsxs5("section", { style: { display: "grid", gap: "0.75rem", minWidth: 0 }, children: [
    /* @__PURE__ */ jsx5("h3", { children: "API tokens" }),
    index.issue_token_href !== null && /* @__PURE__ */ jsxs5("form", { onSubmit: create, style: { display: "grid", gap: "0.75rem" }, children: [
      /* @__PURE__ */ jsxs5("div", { style: { display: "grid", gap: "0.25rem" }, children: [
        /* @__PURE__ */ jsx5(Label, { htmlFor: "api-token-name", children: "Token name" }),
        /* @__PURE__ */ jsx5(Input, { id: "api-token-name", value: name, maxLength: 120, onChange: (event) => setName(event.target.value) })
      ] }),
      /* @__PURE__ */ jsx5(
        ScopePicker,
        {
          idPrefix: "api-token-scope",
          scopes: tokenScopes,
          groups: index.token_scope_groups ?? index.scope_groups,
          presets: index.token_scope_presets ?? index.scope_presets,
          implications: index.token_scope_implications ?? index.scope_implications,
          selected: scopes,
          onChange: setScopes,
          components
        }
      ),
      /* @__PURE__ */ jsxs5("fieldset", { style: { display: "grid", gap: "0.25rem", border: 0, padding: 0 }, children: [
        /* @__PURE__ */ jsx5("legend", { children: "Expires after" }),
        RadioGroup ? /* @__PURE__ */ jsx5(
          RadioGroup,
          {
            name: "api-token-lifetime",
            value: effectiveLifetime,
            onValueChange: setLifetime,
            options: lifetimes.map((spec) => ({ value: spec, label: describeDuration(spec) }))
          }
        ) : lifetimes.map((spec) => /* @__PURE__ */ jsxs5("label", { children: [
          /* @__PURE__ */ jsx5("input", { type: "radio", name: "api-token-lifetime", checked: effectiveLifetime === spec, onChange: () => setLifetime(spec) }),
          " ",
          describeDuration(spec)
        ] }, spec))
      ] }),
      /* @__PURE__ */ jsx5("div", { children: /* @__PURE__ */ jsx5(Button, { type: "submit", disabled: busy || name.trim() === "" || scopes.length === 0 || effectiveLifetime === "", children: "Create API token" }) })
    ] }),
    error !== null && /* @__PURE__ */ jsx5("p", { role: "alert", children: error }),
    /* @__PURE__ */ jsx5("ul", { style: { display: "grid", gap: "0.5rem", listStyle: "none", padding: 0, margin: 0, minWidth: 0 }, children: index.tokens.map((token) => /* @__PURE__ */ jsxs5("li", { style: { minWidth: 0, overflowWrap: "anywhere" }, children: [
      /* @__PURE__ */ jsx5("strong", { children: token.name }),
      " \xB7 ",
      token.scopes.join(", "),
      token.connection === true && /* @__PURE__ */ jsx5(Fragment2, { children: " \xB7 MCP connection" }),
      token.expires_at !== null && /* @__PURE__ */ jsxs5(Fragment2, { children: [
        " \xB7 expires ",
        new Date(token.expires_at).toLocaleString()
      ] }),
      " ",
      /* @__PURE__ */ jsx5(Button, { type: "button", disabled: pending.includes(token.id), onClick: () => void revoke(token), children: "Revoke" })
    ] }, token.id)) })
  ] });
}
function AppSection({ index, components, csrfToken, request, onIssued, reload, onSuccess, onError, removeLocally }) {
  const { Button, Input, Label, Textarea, RadioGroup } = resolveAuthComponents(components);
  const [name, setName] = React6.useState("");
  const [redirects, setRedirects] = React6.useState("");
  const [confidential, setConfidential] = React6.useState(true);
  const [scopes, setScopes] = React6.useState([]);
  const [busy, setBusy] = React6.useState(false);
  const [error, setError] = React6.useState(null);
  const redirectUris = redirects.split("\n").map((line) => line.trim()).filter((line) => line !== "");
  async function register(event) {
    event.preventDefault();
    if (index.register_app_href === null) {
      return;
    }
    setBusy(true);
    const result = await credentialRequest(
      "POST",
      index.register_app_href,
      { name, redirect_uris: redirectUris, confidential, scopes },
      csrfToken,
      request
    );
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      onError?.("oauth-apps", result.message);
      return;
    }
    setError(null);
    setName("");
    setRedirects("");
    setScopes([]);
    onIssued(result.data);
    onSuccess?.("OAuth app registered.");
    await reload();
  }
  const [pending, setPending] = React6.useState([]);
  async function remove(app) {
    if (pending.includes(app.id)) {
      return;
    }
    setPending((current) => [...current, app.id]);
    const result = await credentialRequest("DELETE", app.delete_href, void 0, csrfToken, request);
    if (!result.ok) {
      setPending((current) => current.filter((id) => id !== app.id));
      setError(result.message);
      onError?.("oauth-apps", result.message);
      return;
    }
    setError(null);
    removeLocally("apps", app.id);
    onSuccess?.("OAuth app deleted and its tokens revoked.");
    await reload();
    setPending((current) => current.filter((id) => id !== app.id));
  }
  return /* @__PURE__ */ jsxs5("section", { style: { display: "grid", gap: "0.75rem", minWidth: 0 }, children: [
    /* @__PURE__ */ jsx5("h3", { children: "OAuth apps" }),
    index.register_app_href !== null && /* @__PURE__ */ jsxs5("form", { onSubmit: register, style: { display: "grid", gap: "0.75rem" }, children: [
      /* @__PURE__ */ jsxs5("div", { style: { display: "grid", gap: "0.25rem" }, children: [
        /* @__PURE__ */ jsx5(Label, { htmlFor: "oauth-app-name", children: "App name" }),
        /* @__PURE__ */ jsx5(Input, { id: "oauth-app-name", value: name, maxLength: 120, onChange: (event) => setName(event.target.value) })
      ] }),
      /* @__PURE__ */ jsxs5("div", { style: { display: "grid", gap: "0.25rem" }, children: [
        /* @__PURE__ */ jsx5(Label, { htmlFor: "oauth-app-redirects", children: "Redirect URIs (one per line)" }),
        Textarea ? /* @__PURE__ */ jsx5(Textarea, { id: "oauth-app-redirects", rows: 3, value: redirects, onChange: (event) => setRedirects(event.target.value) }) : /* @__PURE__ */ jsx5("textarea", { id: "oauth-app-redirects", rows: 3, value: redirects, onChange: (event) => setRedirects(event.target.value) })
      ] }),
      /* @__PURE__ */ jsxs5("fieldset", { style: { display: "grid", gap: "0.25rem", border: 0, padding: 0 }, children: [
        /* @__PURE__ */ jsx5("legend", { children: "Client type" }),
        RadioGroup ? /* @__PURE__ */ jsx5(
          RadioGroup,
          {
            name: "oauth-app-type",
            value: confidential ? "confidential" : "public",
            onValueChange: (value) => setConfidential(value === "confidential"),
            options: [
              { value: "confidential", label: "Confidential: the app keeps a client secret on its server" },
              { value: "public", label: "Public: no secret, PKCE only" }
            ]
          }
        ) : /* @__PURE__ */ jsxs5(Fragment2, { children: [
          /* @__PURE__ */ jsxs5("label", { children: [
            /* @__PURE__ */ jsx5("input", { type: "radio", name: "oauth-app-type", checked: confidential, onChange: () => setConfidential(true) }),
            " Confidential: the app keeps a client secret on its server"
          ] }),
          /* @__PURE__ */ jsxs5("label", { children: [
            /* @__PURE__ */ jsx5("input", { type: "radio", name: "oauth-app-type", checked: !confidential, onChange: () => setConfidential(false) }),
            " Public: no secret, PKCE only"
          ] })
        ] })
      ] }),
      /* @__PURE__ */ jsx5(
        ScopePicker,
        {
          idPrefix: "oauth-app-scope",
          scopes: index.scopes,
          groups: index.scope_groups,
          presets: index.scope_presets,
          implications: index.scope_implications,
          selected: scopes,
          onChange: setScopes,
          components
        }
      ),
      /* @__PURE__ */ jsx5("div", { children: /* @__PURE__ */ jsx5(Button, { type: "submit", disabled: busy || name.trim() === "" || redirectUris.length === 0 || scopes.length === 0, children: "Register OAuth app" }) })
    ] }),
    error !== null && /* @__PURE__ */ jsx5("p", { role: "alert", children: error }),
    /* @__PURE__ */ jsx5("ul", { style: { display: "grid", gap: "0.5rem", listStyle: "none", padding: 0, margin: 0, minWidth: 0 }, children: index.apps.map((app) => /* @__PURE__ */ jsxs5("li", { style: { minWidth: 0, overflowWrap: "anywhere" }, children: [
      /* @__PURE__ */ jsx5("strong", { children: app.name }),
      " \xB7 client ID ",
      /* @__PURE__ */ jsx5("code", { children: app.id }),
      " \xB7 ",
      app.confidential ? "confidential" : "public",
      /* @__PURE__ */ jsx5("br", {}),
      app.redirect_uris.join(", "),
      /* @__PURE__ */ jsx5("br", {}),
      "May request: ",
      app.scopes.join(", "),
      " ",
      /* @__PURE__ */ jsx5(Button, { type: "button", disabled: pending.includes(app.id), onClick: () => void remove(app), children: "Delete" })
    ] }, app.id)) })
  ] });
}
function IssuedNotice({
  issued,
  components,
  onDismiss
}) {
  const { Button } = resolveAuthComponents(components);
  const values = issued.kind === "token" ? [{ label: "API token", url: issued.token }] : [
    { label: "Client ID", url: issued.client_id },
    ...issued.client_secret !== null ? [{ label: "Client secret", url: issued.client_secret }] : []
  ];
  return /* @__PURE__ */ jsxs5("div", { role: "status", style: { display: "grid", gap: "0.5rem", minWidth: 0 }, children: [
    /* @__PURE__ */ jsxs5("p", { style: { overflowWrap: "anywhere" }, children: [
      issued.kind === "token" ? `API token \u201C${issued.name}\u201D created.` : `OAuth app \u201C${issued.name}\u201D registered.`,
      " Copy it now: it will not be shown again."
    ] }),
    values.map((value) => /* @__PURE__ */ jsxs5("div", { style: { minWidth: 0, overflowWrap: "anywhere" }, children: [
      value.label,
      ": ",
      /* @__PURE__ */ jsx5("code", { children: value.url }),
      " ",
      /* @__PURE__ */ jsx5(CopyButton, { text: value.url, label: value.label, components })
    ] }, value.label)),
    /* @__PURE__ */ jsx5("div", { children: /* @__PURE__ */ jsx5(Button, { type: "button", onClick: onDismiss, children: "Done" }) })
  ] });
}
function CopyButton({ text, label, components }) {
  const { Button } = resolveAuthComponents(components);
  const [state, setState] = React6.useState("idle");
  return /* @__PURE__ */ jsxs5(Fragment2, { children: [
    /* @__PURE__ */ jsx5(
      Button,
      {
        type: "button",
        "aria-label": `Copy ${label}`,
        onClick: async () => {
          if (typeof navigator === "undefined" || typeof navigator.clipboard?.writeText !== "function") {
            setState("failed");
            return;
          }
          try {
            await navigator.clipboard.writeText(text);
            setState("copied");
          } catch {
            setState("failed");
          }
        },
        children: state === "copied" ? "Copied" : "Copy"
      }
    ),
    state === "failed" && /* @__PURE__ */ jsx5("span", { role: "status", children: " Copying is unavailable here; select the text and copy it manually." })
  ] });
}
function describeDuration(spec) {
  const match = /^P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?)?$/.exec(spec);
  if (!match) {
    return spec;
  }
  const units = ["year", "month", "week", "day", "hour", "minute"];
  const parts = match.slice(1).map((value, position) => value ? `${Number(value)} ${units[position]}${Number(value) === 1 ? "" : "s"}` : null).filter((part) => part !== null);
  return parts.length > 0 ? parts.join(" ") : spec;
}
async function credentialRequest(method, url, body, csrfToken, request) {
  if (request !== void 0) {
    let result;
    try {
      result = await request(method, url, body);
    } catch {
      return { ok: false, status: 0, message: "The server could not be reached. Check the connection and try again." };
    }
    return result.ok ? { ok: true, status: result.status, data: unwrapData(result.payload) } : result;
  }
  let response;
  try {
    response = await fetch(url, {
      method,
      credentials: "same-origin",
      headers: {
        Accept: "application/json",
        ...body !== void 0 ? { "Content-Type": "application/json" } : {},
        ...method !== "GET" ? { "X-CSRF-TOKEN": getCsrfToken(csrfToken) } : {}
      },
      body: body !== void 0 ? JSON.stringify(body) : void 0
    });
  } catch {
    return { ok: false, status: 0, message: "The server could not be reached. Check the connection and try again." };
  }
  const payload = await response.json().catch(() => null);
  if (response.ok) {
    return { ok: true, status: response.status, data: unwrapData(payload) };
  }
  return { ok: false, status: response.status, message: refusalMessage(response.status, payload) };
}
function unwrapData(payload) {
  return typeof payload === "object" && payload !== null && "data" in payload ? payload.data : payload;
}
function refusalMessage(status, payload) {
  if (status === 401 || status === 419) {
    return "Your session has expired. Reload the page and sign in again.";
  }
  if (typeof payload === "object" && payload !== null) {
    const errors = payload.errors;
    if (errors && typeof errors === "object") {
      const first = Object.values(errors)[0];
      if (Array.isArray(first) && typeof first[0] === "string") {
        return first[0];
      }
    }
    const message = payload.message;
    if (typeof message === "string" && message !== "") {
      return message;
    }
  }
  if (status === 403) {
    return "You do not have permission to do that.";
  }
  if (status === 404) {
    return "That credential no longer exists, or creating credentials is unavailable right now.";
  }
  return "That action could not be completed.";
}
export {
  ApiCredentialsSection,
  ChangePasswordForm,
  LoginForm,
  PasskeyLoginButton,
  PasskeySection,
  PasswordResetRequestForm,
  ResetPasswordForm,
  ScopePicker,
  SignupForm,
  TwoFactorForm,
  arrayBufferToBase64url,
  authenticateWithPasskey,
  base64urlToArrayBuffer,
  closeImplications,
  describeDuration,
  getCsrfToken,
  getDefaultPasskeyName,
  inCatalogOrder,
  isAbortError,
  isConditionalMediationAvailable,
  neededBy,
  registerPasskey,
  relyingApplicationsFrom,
  restrictImplications,
  safeApplicationHref,
  sameSelection,
  withScopes,
  withoutScopes
};
