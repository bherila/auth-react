"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  ApiCredentialsSection: () => ApiCredentialsSection,
  ChangePasswordForm: () => ChangePasswordForm,
  LoginForm: () => LoginForm,
  PasskeyLoginButton: () => PasskeyLoginButton,
  PasskeySection: () => PasskeySection,
  PasswordResetRequestForm: () => PasswordResetRequestForm,
  ResetPasswordForm: () => ResetPasswordForm,
  SignupForm: () => SignupForm,
  TwoFactorForm: () => TwoFactorForm,
  arrayBufferToBase64url: () => arrayBufferToBase64url,
  authenticateWithPasskey: () => authenticateWithPasskey,
  base64urlToArrayBuffer: () => base64urlToArrayBuffer,
  describeDuration: () => describeDuration,
  getCsrfToken: () => getCsrfToken,
  getDefaultPasskeyName: () => getDefaultPasskeyName,
  isAbortError: () => isAbortError,
  isConditionalMediationAvailable: () => isConditionalMediationAvailable,
  registerPasskey: () => registerPasskey,
  relyingApplicationsFrom: () => relyingApplicationsFrom,
  safeApplicationHref: () => safeApplicationHref
});
module.exports = __toCommonJS(index_exports);

// src/forms.tsx
var React3 = __toESM(require("react"), 1);

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
var React = __toESM(require("react"), 1);

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
var import_lucide_react = require("lucide-react");
var React2 = __toESM(require("react"), 1);
var import_jsx_runtime = require("react/jsx-runtime");
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
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className, children: [
    error ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "mb-2 text-sm text-destructive", children: error }) : null,
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, { type: "button", variant: "outline", className: "w-full", disabled: disabled || loading, onClick: handlePasskeyLogin, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_lucide_react.KeyRound, { "aria-hidden": "true" }),
      loading ? "Verifying..." : "Sign in with Passkey"
    ] })
  ] });
}

// src/forms.tsx
var import_jsx_runtime2 = require("react/jsx-runtime");
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
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
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
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(Card, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(CardHeader, { children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(CardTitle, { children: "Sign In" }) }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(CardContent, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("form", { className: "space-y-4", onSubmit: (event) => void onSubmit(event), children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "space-y-1", children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Label, { htmlFor: "login-email", children: "Email" }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
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
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "space-y-1", children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Label, { htmlFor: "login-password", children: "Password" }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Input, { id: "login-password", type: "password", autoComplete: "current-password", required: true, value: password, onChange: (event) => setPassword(event.target.value) })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "flex items-center gap-2 text-sm", children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
            RememberMeCheckbox,
            {
              id: "login-remember",
              "aria-labelledby": "login-remember-label",
              "data-test": rememberMeDataTest,
              checked: remember,
              onCheckedChange: setRemember
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Label, { id: "login-remember-label", htmlFor: "login-remember", children: rememberMeLabel })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Button, { type: "submit", className: "w-full", disabled: loading, children: loading ? "Signing in..." : "Sign In" })
      ] }),
      enablePasskeys ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "mt-4", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(PasskeyAuthenticationContext.Provider, { value: coordinatedAuthentication, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
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
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(Card, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(CardHeader, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(CardTitle, { children: title }),
      description ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(CardDescription, { children: description }) : null
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(CardContent, { children: /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("form", { className: "space-y-4", method: submitMode === "native" ? "POST" : void 0, action: endpoints.signup ?? "/register", onSubmit: (event) => void onSubmit(event), children: [
      submitMode === "native" ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("input", { type: "hidden", name: "_token", value: getCsrfToken(endpoints.csrfToken) }) : null,
      fields.map((field) => {
        if (field.hiddenWhen?.(values)) return null;
        const error = fieldErrors[field.name]?.[0];
        const value = values[field.name];
        if (field.type === "checkbox") {
          return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: field.containerClassName ?? "space-y-1", children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("label", { className: "flex items-start gap-2 text-sm", children: [
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
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
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: field.label })
            ] }),
            field.helpText ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "text-xs text-muted-foreground", children: field.helpText }) : null,
            error ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "text-sm text-destructive", children: error }) : null
          ] }, field.name);
        }
        return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: field.containerClassName ?? "space-y-1", children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Label, { htmlFor: `signup-${field.name}`, children: field.label }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
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
          field.helpText ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "text-xs text-muted-foreground", children: field.helpText }) : null,
          error ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "text-sm text-destructive", children: error }) : null
        ] }, field.name);
      }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Button, { type: "submit", className: "w-full", disabled: loading, children: loading ? submittingLabel : submitLabel })
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
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("form", { className: "space-y-4", onSubmit: (event) => void onSubmit(event), children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "space-y-1", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Label, { htmlFor: "reset-email", children: "Email" }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Input, { id: "reset-email", type: "email", autoComplete: "email", required: true, value: email, onChange: (event) => setEmail(event.target.value) })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Button, { type: "submit", disabled: loading, children: loading ? "Sending..." : "Send Reset Link" })
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
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("form", { className: "space-y-4", onSubmit: (event) => void onSubmit(event), children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Input, { type: "hidden", value: token, onChange: (event) => setToken(event.target.value) }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "space-y-1", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Label, { htmlFor: "reset-password-email", children: "Email" }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Input, { id: "reset-password-email", type: "email", required: true, value: email, onChange: (event) => setEmail(event.target.value) })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "space-y-1", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Label, { htmlFor: "reset-password", children: "Password" }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Input, { id: "reset-password", type: "password", required: true, value: password, onChange: (event) => setPassword(event.target.value) })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "space-y-1", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Label, { htmlFor: "reset-password-confirmation", children: "Confirm Password" }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Input, { id: "reset-password-confirmation", type: "password", required: true, value: passwordConfirmation, onChange: (event) => setPasswordConfirmation(event.target.value) })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Button, { type: "submit", children: "Reset Password" })
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
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("form", { className: "space-y-4", onSubmit: (event) => void onSubmit(event), children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "space-y-1", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Label, { htmlFor: "current-password", children: "Current Password" }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Input, { id: "current-password", type: "password", autoComplete: "current-password", required: true, value: currentPassword, onChange: (event) => setCurrentPassword(event.target.value) })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "space-y-1", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Label, { htmlFor: "new-password", children: "New Password" }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Input, { id: "new-password", type: "password", autoComplete: "new-password", minLength: 8, required: true, value: password, onChange: (event) => setPassword(event.target.value) })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "space-y-1", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Label, { htmlFor: "confirm-password", children: "Confirm New Password" }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Input, { id: "confirm-password", type: "password", autoComplete: "new-password", minLength: 8, required: true, value: passwordConfirmation, onChange: (event) => setPasswordConfirmation(event.target.value) })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Button, { type: "submit", disabled: loading, children: loading ? "Changing..." : "Change Password" })
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
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(Card, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(CardHeader, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(CardTitle, { children: "Verify Your Login" }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(CardDescription, { children: "Enter the 6-digit code sent to your email address." })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(CardContent, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("form", { className: "space-y-4", onSubmit: (event) => void onSubmit(event), children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "space-y-1", children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Label, { htmlFor: "two-factor-code", children: "Verification Code" }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
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
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Button, { type: "submit", className: "w-full", disabled: loading || code.length !== 6, children: loading ? "Verifying..." : "Verify Code" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "mt-4 space-y-2 text-sm", children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Button, { type: "button", variant: "outline", className: "w-full", disabled: resending, onClick: () => void resend(), children: resending ? "Sending..." : "Send a new code" }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { type: "button", className: "text-sm underline", onClick: () => void reportSuspicious(), children: "This was not me" }),
        message ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { children: message }) : null,
        appEnv && appEnv !== "production" ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { children: "Dev mode: use 999999 to bypass 2FA." }) : null
      ] })
    ] })
  ] });
}

// src/passkey-section.tsx
var import_lucide_react2 = require("lucide-react");
var React4 = __toESM(require("react"), 1);
var import_react_dom = require("react-dom");
var import_jsx_runtime3 = require("react/jsx-runtime");
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
    (0, import_react_dom.flushSync)(() => setPendingName(name));
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
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(Card, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(CardHeader, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(CardTitle, { className: "flex items-center gap-2", children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_lucide_react2.Key, { className: "h-5 w-5" }),
        "Passkeys"
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(CardDescription, { children: "Manage passkeys for passwordless login." })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(CardContent, { className: "space-y-4", children: [
      !isWebAuthnSupported ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { className: "text-sm text-muted-foreground", children: "Your browser does not support passkeys." }) : null,
      loading ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { className: "text-sm text-muted-foreground", children: "Loading passkeys..." }) : passkeys.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { className: "text-sm text-muted-foreground", children: "No passkeys registered yet." }) : /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "divide-y rounded-md border", children: passkeys.map((passkey) => /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "flex items-center justify-between gap-3 p-3", children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "font-medium", children: passkey.name }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "text-sm text-muted-foreground", children: new Date(passkey.created_at).toLocaleDateString() })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Button, { type: "button", variant: "ghost", size: "icon", "aria-label": "Delete passkey", onClick: () => void deletePasskey(passkey.id), children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_lucide_react2.Trash2, {}) })
      ] }, passkey.id)) }),
      isWebAuthnSupported ? /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "flex flex-col gap-2 sm:flex-row", children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "flex-1 space-y-1", children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Label, { htmlFor: "passkey-name", children: "Passkey name" }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Input, { id: "passkey-name", value: pendingName, onChange: (event) => setPendingName(event.target.value), placeholder: getDefaultPasskeyName() })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(Button, { type: "button", className: "self-end", variant: "outline", disabled: registering, onClick: () => void registerPasskey2(), children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_lucide_react2.Plus, {}),
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
var React5 = __toESM(require("react"), 1);
var import_jsx_runtime4 = require("react/jsx-runtime");
function ApiCredentialsSection({ indexUrl, components, links = [], csrfToken, onSuccess, onError }) {
  const { Card, CardContent, CardDescription, CardHeader, CardTitle } = resolveAuthComponents(components);
  const [index, setIndex] = React5.useState(null);
  const [issued, setIssued] = React5.useState([]);
  const issuedKey = React5.useRef(0);
  const addIssued = React5.useCallback((credential) => {
    issuedKey.current += 1;
    const key = issuedKey.current;
    setIssued((current) => [...current, { key, credential }]);
  }, []);
  const [loadError, setLoadError] = React5.useState(null);
  const onErrorRef = React5.useRef(onError);
  onErrorRef.current = onError;
  const generation = React5.useRef(0);
  const reload = React5.useCallback(async () => {
    generation.current += 1;
    const mine = generation.current;
    const result = await credentialRequest("GET", indexUrl, void 0, csrfToken);
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
  }, [indexUrl, csrfToken]);
  React5.useEffect(() => {
    setIndex(null);
    void reload();
  }, [reload]);
  const removeLocally = React5.useCallback((list, id) => {
    setIndex(
      (current) => current === null ? current : list === "tokens" ? { ...current, tokens: current.tokens.filter((token) => token.id !== id) } : { ...current, apps: current.apps.filter((app) => app.id !== id) }
    );
  }, []);
  const shared = { components, csrfToken, onError, onSuccess, removeLocally };
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(Card, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(CardHeader, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(CardTitle, { children: "API access" }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(CardDescription, { children: "Connect apps that use the API. Register an OAuth app for apps that sign you in, or create an API token for apps that ask for a key. Each carries only the permissions you choose, and never more than your own access." })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(CardContent, { children: /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { style: { display: "grid", gap: "1.5rem", minWidth: 0 }, children: [
      links.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("dl", { style: { display: "grid", gap: "0.5rem", minWidth: 0 }, children: links.map((link) => /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { style: { minWidth: 0 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("dt", { children: link.label }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("dd", { style: { margin: 0, overflowWrap: "anywhere" }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("code", { children: link.url }),
          " ",
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(CopyButton, { text: link.url, label: link.label, components })
        ] })
      ] }, link.label)) }),
      issued.map(({ key, credential }) => /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
        IssuedNotice,
        {
          issued: credential,
          components,
          onDismiss: () => setIssued((current) => current.filter((entry) => entry.key !== key))
        },
        key
      )),
      loadError !== null && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("p", { role: "alert", children: loadError }),
      index !== null && /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(import_jsx_runtime4.Fragment, { children: [
        (index.issue_token_href === null || index.register_app_href === null) && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("p", { role: "status", children: "Creating new credentials is unavailable right now. You can still revoke existing ones." }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(TokenSection, { index, ...shared, onIssued: addIssued, reload }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(AppSection, { index, ...shared, onIssued: addIssued, reload })
      ] })
    ] }) })
  ] });
}
function TokenSection({ index, components, csrfToken, onIssued, reload, onSuccess, onError, removeLocally }) {
  const { Button, Input, Label } = resolveAuthComponents(components);
  const [name, setName] = React5.useState("");
  const [scopes, setScopes] = React5.useState([]);
  const [lifetime, setLifetime] = React5.useState(index.token_lifetimes[0] ?? "");
  const [busy, setBusy] = React5.useState(false);
  const [error, setError] = React5.useState(null);
  async function create(event) {
    event.preventDefault();
    if (index.issue_token_href === null) {
      return;
    }
    setBusy(true);
    const result = await credentialRequest("POST", index.issue_token_href, { name, scopes, lifetime }, csrfToken);
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
  const [pending, setPending] = React5.useState([]);
  async function revoke(token) {
    if (pending.includes(token.id)) {
      return;
    }
    setPending((current) => [...current, token.id]);
    const result = await credentialRequest("DELETE", token.revoke_href, void 0, csrfToken);
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
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("section", { style: { display: "grid", gap: "0.75rem", minWidth: 0 }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("h3", { children: "API tokens" }),
    index.issue_token_href !== null && /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("form", { onSubmit: create, style: { display: "grid", gap: "0.75rem" }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { style: { display: "grid", gap: "0.25rem" }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Label, { htmlFor: "api-token-name", children: "Token name" }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Input, { id: "api-token-name", value: name, maxLength: 120, onChange: (event) => setName(event.target.value) })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(ScopePicker, { idPrefix: "api-token-scope", scopes: index.scopes, selected: scopes, onChange: setScopes }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("fieldset", { style: { display: "grid", gap: "0.25rem", border: 0, padding: 0 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("legend", { children: "Expires after" }),
        index.token_lifetimes.map((spec) => /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("label", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("input", { type: "radio", name: "api-token-lifetime", checked: lifetime === spec, onChange: () => setLifetime(spec) }),
          " ",
          describeDuration(spec)
        ] }, spec))
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Button, { type: "submit", disabled: busy || name.trim() === "" || scopes.length === 0 || lifetime === "", children: "Create API token" }) })
    ] }),
    error !== null && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("p", { role: "alert", children: error }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("ul", { style: { display: "grid", gap: "0.5rem", listStyle: "none", padding: 0, margin: 0, minWidth: 0 }, children: index.tokens.map((token) => /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("li", { style: { minWidth: 0, overflowWrap: "anywhere" }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("strong", { children: token.name }),
      " \xB7 ",
      token.scopes.join(", "),
      token.expires_at !== null && /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(import_jsx_runtime4.Fragment, { children: [
        " \xB7 expires ",
        new Date(token.expires_at).toLocaleString()
      ] }),
      " ",
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Button, { type: "button", disabled: pending.includes(token.id), onClick: () => void revoke(token), children: "Revoke" })
    ] }, token.id)) })
  ] });
}
function AppSection({ index, components, csrfToken, onIssued, reload, onSuccess, onError, removeLocally }) {
  const { Button, Input, Label } = resolveAuthComponents(components);
  const [name, setName] = React5.useState("");
  const [redirects, setRedirects] = React5.useState("");
  const [confidential, setConfidential] = React5.useState(true);
  const [scopes, setScopes] = React5.useState([]);
  const [busy, setBusy] = React5.useState(false);
  const [error, setError] = React5.useState(null);
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
      csrfToken
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
  const [pending, setPending] = React5.useState([]);
  async function remove(app) {
    if (pending.includes(app.id)) {
      return;
    }
    setPending((current) => [...current, app.id]);
    const result = await credentialRequest("DELETE", app.delete_href, void 0, csrfToken);
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
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("section", { style: { display: "grid", gap: "0.75rem", minWidth: 0 }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("h3", { children: "OAuth apps" }),
    index.register_app_href !== null && /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("form", { onSubmit: register, style: { display: "grid", gap: "0.75rem" }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { style: { display: "grid", gap: "0.25rem" }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Label, { htmlFor: "oauth-app-name", children: "App name" }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Input, { id: "oauth-app-name", value: name, maxLength: 120, onChange: (event) => setName(event.target.value) })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { style: { display: "grid", gap: "0.25rem" }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Label, { htmlFor: "oauth-app-redirects", children: "Redirect URIs (one per line)" }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("textarea", { id: "oauth-app-redirects", rows: 3, value: redirects, onChange: (event) => setRedirects(event.target.value) })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("fieldset", { style: { display: "grid", gap: "0.25rem", border: 0, padding: 0 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("legend", { children: "Client type" }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("label", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("input", { type: "radio", name: "oauth-app-type", checked: confidential, onChange: () => setConfidential(true) }),
          " Confidential: the app keeps a client secret on its server"
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("label", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("input", { type: "radio", name: "oauth-app-type", checked: !confidential, onChange: () => setConfidential(false) }),
          " Public: no secret, PKCE only"
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(ScopePicker, { idPrefix: "oauth-app-scope", scopes: index.scopes, selected: scopes, onChange: setScopes }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Button, { type: "submit", disabled: busy || name.trim() === "" || redirectUris.length === 0 || scopes.length === 0, children: "Register OAuth app" }) })
    ] }),
    error !== null && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("p", { role: "alert", children: error }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("ul", { style: { display: "grid", gap: "0.5rem", listStyle: "none", padding: 0, margin: 0, minWidth: 0 }, children: index.apps.map((app) => /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("li", { style: { minWidth: 0, overflowWrap: "anywhere" }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("strong", { children: app.name }),
      " \xB7 client ID ",
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("code", { children: app.id }),
      " \xB7 ",
      app.confidential ? "confidential" : "public",
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("br", {}),
      app.redirect_uris.join(", "),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("br", {}),
      "May request: ",
      app.scopes.join(", "),
      " ",
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Button, { type: "button", disabled: pending.includes(app.id), onClick: () => void remove(app), children: "Delete" })
    ] }, app.id)) })
  ] });
}
function ScopePicker({
  idPrefix,
  scopes,
  selected,
  onChange
}) {
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("fieldset", { style: { display: "grid", gap: "0.25rem", border: 0, padding: 0, minWidth: 0 }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("legend", { children: "Permissions" }),
    scopes.map((scope) => {
      const id = `${idPrefix}-${scope.id}`;
      return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("label", { htmlFor: id, style: { overflowWrap: "anywhere" }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
          "input",
          {
            id,
            type: "checkbox",
            checked: selected.includes(scope.id),
            onChange: (event) => onChange(event.target.checked ? [...selected, scope.id] : selected.filter((value) => value !== scope.id))
          }
        ),
        " ",
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("code", { children: scope.id }),
        " ",
        scope.description
      ] }, scope.id);
    })
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
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { role: "status", style: { display: "grid", gap: "0.5rem", minWidth: 0 }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("p", { style: { overflowWrap: "anywhere" }, children: [
      issued.kind === "token" ? `API token \u201C${issued.name}\u201D created.` : `OAuth app \u201C${issued.name}\u201D registered.`,
      " Copy it now: it will not be shown again."
    ] }),
    values.map((value) => /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { style: { minWidth: 0, overflowWrap: "anywhere" }, children: [
      value.label,
      ": ",
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("code", { children: value.url }),
      " ",
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(CopyButton, { text: value.url, label: value.label, components })
    ] }, value.label)),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Button, { type: "button", onClick: onDismiss, children: "Done" }) })
  ] });
}
function CopyButton({ text, label, components }) {
  const { Button } = resolveAuthComponents(components);
  const [state, setState] = React5.useState("idle");
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(import_jsx_runtime4.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
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
    state === "failed" && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { role: "status", children: " Copying is unavailable here; select the text and copy it manually." })
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
async function credentialRequest(method, url, body, csrfToken) {
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
    const data = typeof payload === "object" && payload !== null && "data" in payload ? payload.data : payload;
    return { ok: true, status: response.status, data };
  }
  return { ok: false, status: response.status, message: refusalMessage(response.status, payload) };
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
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  ApiCredentialsSection,
  ChangePasswordForm,
  LoginForm,
  PasskeyLoginButton,
  PasskeySection,
  PasswordResetRequestForm,
  ResetPasswordForm,
  SignupForm,
  TwoFactorForm,
  arrayBufferToBase64url,
  authenticateWithPasskey,
  base64urlToArrayBuffer,
  describeDuration,
  getCsrfToken,
  getDefaultPasskeyName,
  isAbortError,
  isConditionalMediationAvailable,
  registerPasskey,
  relyingApplicationsFrom,
  safeApplicationHref
});
