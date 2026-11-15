import * as React from "react";
export interface AuthEndpointConfig {
  csrfToken?: string;
  login?: string;
  signup?: string;
  forgotPassword?: string;
  resetPassword?: string;
  changePassword?: string;
  twoFactorVerify?: string;
  twoFactorResend?: string;
  twoFactorReport?: (token: string) => string;
  passkeyList?: string;
  passkeyRegisterOptions?: string;
  passkeyRegister?: string;
  passkeyDelete?: (id: number | string) => string;
  passkeyAuthOptions?: string;
  passkeyAuth?: string;
}
export type AuthValidationErrors = Record<string, string[]>;
export type AuthSignupValues = Record<string, string | boolean>;
export interface AuthSignupField {
  name: string;
  label: React.ReactNode;
  type?: React.HTMLInputTypeAttribute;
  placeholder?: string;
  required?: boolean;
  autoComplete?: string;
  initialValue?: string | boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
  helpText?: React.ReactNode;
  className?: string;
  containerClassName?: string;
  hiddenWhen?: (values: AuthSignupValues) => boolean;
}
export interface Passkey {
  id: number;
  name: string;
  aaguid: string | null;
  created_at: string;
  updated_at: string;
}
export interface AuthJsonResponse {
  success?: boolean;
  message?: string;
  error?: string;
  redirect?: string;
  requires_2fa?: boolean;
  attempt_token?: string;
  [key: string]: unknown;
}
export type AuthButtonVariant = 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
export type AuthButtonSize = 'default' | 'sm' | 'lg' | 'icon' | 'icon-sm' | 'icon-lg';
export type AuthButtonComponentProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: AuthButtonVariant;
  size?: AuthButtonSize;
};
export type AuthInputComponentProps = React.InputHTMLAttributes<HTMLInputElement>;
export type AuthLabelComponentProps = React.LabelHTMLAttributes<HTMLLabelElement>;
export type AuthContainerComponentProps = React.HTMLAttributes<HTMLDivElement>;
export type AuthTextareaComponentProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;
/** A controlled checkbox: the app's own, e.g. a design-system `Checkbox` with `onCheckedChange`. */
export interface AuthCheckboxComponentProps {
  id: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}
/** A small inline label, e.g. a design-system `Badge`. */
export type AuthBadgeComponentProps = React.HTMLAttributes<HTMLSpanElement>;
export interface AuthRadioGroupOption {
  value: string;
  label: React.ReactNode;
}
/** A controlled set of radio options, rendered however the app renders radio groups. */
export interface AuthRadioGroupComponentProps {
  name: string;
  value: string;
  onValueChange: (value: string) => void;
  options: AuthRadioGroupOption[];
}
export interface AuthComponentSet {
  Button: React.ComponentType<AuthButtonComponentProps>;
  Card: React.ComponentType<AuthContainerComponentProps>;
  CardContent: React.ComponentType<AuthContainerComponentProps>;
  CardDescription: React.ComponentType<AuthContainerComponentProps>;
  CardHeader: React.ComponentType<AuthContainerComponentProps>;
  CardTitle: React.ComponentType<AuthContainerComponentProps>;
  Input: React.ComponentType<AuthInputComponentProps>;
  Label: React.ComponentType<AuthLabelComponentProps>;
  /** Optional; native elements are rendered when omitted. */
  Textarea?: React.ComponentType<AuthTextareaComponentProps>;
  Checkbox?: React.ComponentType<AuthCheckboxComponentProps>;
  RadioGroup?: React.ComponentType<AuthRadioGroupComponentProps>;
  /** Optional: the "Sensitive" badge in the scope picker. A `<span>` is rendered when omitted. */
  Badge?: React.ComponentType<AuthBadgeComponentProps>;
  /** Optional: the warning shown for a sensitive scope group. A styled `<p>` is rendered when omitted. */
  Alert?: React.ComponentType<AuthContainerComponentProps>;
}
export type AuthComponents = AuthComponentSet;
export type AuthComponentOverrides = Partial<AuthComponentSet>;
export type AuthButtonComponent = AuthComponentSet['Button'];
export type AuthComponentSuperset = AuthComponentSet & Record<string, React.ComponentType<any>>;
export type AuthComponentInput = AuthComponentSet | AuthComponentSuperset;
export type AuthButtonComponentInput = Pick<AuthComponentSet, 'Button'> & Record<string, React.ComponentType<any>>;
interface AuthFormProps {
  endpoints?: AuthEndpointConfig;
  components: AuthComponentInput;
  onSuccess?: (result: AuthJsonResponse) => void;
  onError?: (message: string) => void;
}
export interface LoginRememberMeCheckboxProps {
  id: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  'aria-labelledby'?: string;
  'data-test'?: string;
}
export interface LoginFormProps extends AuthFormProps {
  /** Render only the controls when the consumer owns the card and heading. */
  unwrapped?: boolean;
  passkeySeparator?: React.ReactNode;
  enablePasskeys?: boolean;
  enablePasskeyAutofill?: boolean;
  initialEmail?: string;
  onEmailChange?: (email: string) => void;
  rememberMeCheckbox?: React.ComponentType<LoginRememberMeCheckboxProps>;
  rememberMeLabel?: React.ReactNode;
  rememberMeDataTest?: string;
  onSubmitStart?: () => void;
  onTwoFactorRequired?: (result: AuthJsonResponse & {
    attempt_token?: string;
  }) => void;
  onPasskeySuccess?: (redirectUrl: string, result: AuthJsonResponse) => void;
}
interface SignupFormProps extends Omit<AuthFormProps, 'onSuccess'> {
  fields?: AuthSignupField[];
  initialValues?: AuthSignupValues;
  errors?: AuthValidationErrors;
  submitMode?: 'fetch' | 'native';
  title?: React.ReactNode;
  description?: React.ReactNode;
  submitLabel?: React.ReactNode;
  submittingLabel?: React.ReactNode;
  onSuccess?: (result: AuthJsonResponse, values: AuthSignupValues) => void | Promise<void>;
}
export interface PasswordResetRequestFormProps extends AuthFormProps {
  onSubmitStart?: () => void;
  submitClassName?: string;
}
export interface ResetPasswordFormProps extends PasswordResetRequestFormProps {
  token?: string;
  email?: string;
  /** Override field IDs when the embedding page already uses the default ID. */
  idPrefix?: string;
  minPasswordLength?: number;
  validatePasswordConfirmation?: boolean;
  passwordLabel?: React.ReactNode;
  passwordConfirmationLabel?: React.ReactNode;
  passwordHelpText?: React.ReactNode;
}
interface TwoFactorFormProps extends AuthFormProps {
  attemptToken: string;
  appEnv?: string;
  onReportSuspicious?: (result: AuthJsonResponse) => void;
}
export declare function LoginForm({ endpoints, components, onSuccess, onError, initialEmail, onEmailChange, rememberMeCheckbox: RememberMeCheckbox, rememberMeLabel, rememberMeDataTest, onSubmitStart, onTwoFactorRequired, onPasskeySuccess, unwrapped, passkeySeparator, enablePasskeys, enablePasskeyAutofill }: LoginFormProps): React.JSX.Element;
export declare function SignupForm({ endpoints, components, onSuccess, onError, fields, initialValues, errors, submitMode, title, description, submitLabel, submittingLabel }: SignupFormProps): React.JSX.Element;
export declare function PasswordResetRequestForm({ endpoints, components, onSuccess, onError, onSubmitStart, submitClassName }: PasswordResetRequestFormProps): React.JSX.Element;
export declare function ResetPasswordForm({ endpoints, components, onSuccess, onError, onSubmitStart, submitClassName, token: initialToken, email: initialEmail, idPrefix, minPasswordLength, validatePasswordConfirmation, passwordLabel, passwordConfirmationLabel, passwordHelpText }: ResetPasswordFormProps): React.JSX.Element;
export declare function ChangePasswordForm({ endpoints, components, onSuccess, onError }: AuthFormProps): React.JSX.Element;
export declare function TwoFactorForm({ endpoints, components, attemptToken, appEnv, onSuccess, onError, onReportSuspicious }: TwoFactorFormProps): React.JSX.Element;
interface PasskeyLoginButtonProps {
  endpoints?: AuthEndpointConfig;
  components: AuthButtonComponentInput;
  className?: string;
  disabled?: boolean;
  remember?: boolean | (() => boolean);
  onSuccess?: (redirectUrl: string, result: AuthJsonResponse) => void;
  onError?: (message: string) => void;
}
export declare function PasskeyLoginButton({ endpoints, components, className, disabled, remember, onSuccess, onError }: PasskeyLoginButtonProps): React.JSX.Element | null;
interface PasskeySectionProps {
  endpoints?: AuthEndpointConfig;
  components: AuthComponentInput;
  onSuccess?: (message: string) => void;
  onError?: (field: string, message: string) => void;
}
export declare function PasskeySection({ endpoints, components, onSuccess, onError }: PasskeySectionProps): React.JSX.Element;
/**
 * The sibling applications an identity provider reports for the signed-in person.
 *
 * Every relying party receives this list the same way — server-side, injected per request
 * from the session rather than compiled into a bundle — but each one carries it into the
 * page differently: a `#app-initial-data` script tag, an Inertia shared prop, a Blade loop.
 * What they cannot afford to do differently is decide which entries are safe to render, so
 * that decision lives here and the transport stays the application's business.
 */
export interface RelyingApplication {
  key: string;
  name: string;
  url: string;
}
/**
 * Reduce a URL from the wire to one that is safe to put in an `href`, or reject it.
 *
 * These arrive as text in the page and end up as a link the browser will follow, so the
 * scheme is what matters: `javascript:` and `data:` both pass a server-side URL validity
 * check but execute rather than navigate. Parsing and allowing only http(s) is stronger
 * than matching a prefix — it normalises away the leading control characters, mixed case,
 * and escapes that a hand-rolled test can be walked past — and it returns the *parsed*
 * form, so what gets rendered is exactly what was validated.
 *
 * Absolute URLs only, deliberately. These point at other origins; a relative one means the
 * provider told us something unexpected, and guessing a base for it would be inventing a
 * destination rather than validating one.
 */
export declare function safeApplicationHref(url: string): string | null;
/**
 * Validate whatever the page handed over into a list that is safe to render.
 *
 * Unrecognised entries are dropped rather than throwing. This is navigation chrome: one
 * malformed entry, or a provider that has grown a field, must not be able to take down the
 * page it appears on. Anything that is not a well-formed list degrades to an empty menu.
 */
export declare function relyingApplicationsFrom(value: unknown): RelyingApplication[];
export declare function getCsrfToken(explicitToken?: string): string;
export declare function base64urlToArrayBuffer(b64: string): ArrayBuffer;
export declare function arrayBufferToBase64url(buffer: ArrayBuffer): string;
export declare function isAbortError(error: unknown): boolean;
interface AuthenticateWithPasskeyOptions {
  endpoints?: AuthEndpointConfig;
  mediation?: CredentialMediationRequirement;
  signal?: AbortSignal;
  /** Read after the browser ceremony, immediately before the sign-in request. */
  remember?: boolean | (() => boolean);
}
interface PasskeyAuthenticationResult {
  redirectUrl: string;
  result: AuthJsonResponse;
}
interface RegisterPasskeyOptions {
  endpoints?: AuthEndpointConfig;
  name?: string;
  signal?: AbortSignal;
}
interface PasskeyRegistrationResult {
  result: AuthJsonResponse;
}
export declare function getDefaultPasskeyName(): string;
export declare function isConditionalMediationAvailable(): Promise<boolean>;
export declare function authenticateWithPasskey({ endpoints, mediation, signal, remember }?: AuthenticateWithPasskeyOptions): Promise<PasskeyAuthenticationResult>;
export declare function registerPasskey({ endpoints, name, signal }?: RegisterPasskeyOptions): Promise<PasskeyRegistrationResult>;
/**
 * Pure selection logic for the scope picker. Implications are a picker-only
 * cascade: the credential still stores exactly the ids that end up selected,
 * and the server never infers one scope from another.
 */
/** scope id => scope ids it needs, e.g. `{ 'billing:write': ['billing:read'] }`. */
export type ScopeImplications = Record<string, string[]>;
/** Transitive closure of `implications`, with self-references and cycles dropped. */
export declare function closeImplications(implications: ScopeImplications): ScopeImplications;
/** Keeps only entries whose key and every requirement are offered; drops entries left empty. */
export declare function restrictImplications(implications: ScopeImplications | undefined, offered: Set<string>): ScopeImplications;
/** Orders `ids` by `catalog`, removing duplicates and ids not in it. */
export declare function inCatalogOrder(ids: Iterable<string>, catalog: string[]): string[];
/** Ticking: adds the ids and everything they need. */
export declare function withScopes(selected: string[], ids: string[], closed: ScopeImplications): Set<string>;
/** Unticking: removes the ids and every selected scope that needs one of them. */
export declare function withoutScopes(selected: string[], ids: string[], closed: ScopeImplications): Set<string>;
/** Selected scopes that need `id`, in catalog order: why `id` is ticked beyond the person's own choice. */
export declare function neededBy(id: string, selected: string[], closed: ScopeImplications): string[];
export declare function sameSelection(a: string[], b: string[]): boolean;
/** A named set of related scopes (`scopes` are ids from the sibling scope list). */
export interface ApiCredentialScopeGroup {
  id: string;
  label: string;
  description: string | null;
  /** A sensitive group is one parent checkbox, with its scopes behind a disclosure. */
  sensitive: boolean;
  scopes: string[];
}
/** A one-click selection: choosing it replaces the selection with exactly `scopes`. */
export interface ApiCredentialScopePreset {
  id: string;
  label: string;
  description: string;
  scopes: string[];
}
export interface ScopePickerProps {
  idPrefix: string;
  scopes: ApiCredentialScope[];
  /** Absent or empty: a flat list, as before groups existed. */
  groups?: ApiCredentialScopeGroup[];
  presets?: ApiCredentialScopePreset[];
  implications?: ScopeImplications;
  selected: string[];
  onChange: (next: string[]) => void;
  components: AuthComponentInput;
}
export declare function ScopePicker({ idPrefix, scopes, groups, presets, implications, selected, onChange, components }: ScopePickerProps): React.JSX.Element;
export interface ApiCredentialScope {
  id: string;
  description: string;
}
export interface ApiCredentialToken {
  id: string;
  name: string;
  scopes: string[];
  created_at: string | null;
  expires_at: string | null;
  revoke_href: string;
  /** True for a token that carries an MCP connection scope. */
  connection?: boolean;
}
export interface ApiCredentialApp {
  id: string;
  name: string;
  confidential: boolean;
  redirect_uris: string[];
  scopes: string[];
  created_at: string | null;
  delete_href: string;
}
/** The server's index response (`data`): every URL is finished; this component assembles none. */
export interface ApiCredentialIndex {
  scopes: ApiCredentialScope[];
  token_lifetimes: string[];
  /** Null while issuing is unavailable (the OAuth server is switched off). Revocation stays available. */
  issue_token_href: string | null;
  register_app_href: string | null;
  tokens: ApiCredentialToken[];
  apps: ApiCredentialApp[];
  /**
   * Grouped picker data, all optional and presentation only: the credential still
   * stores explicit scope ids. `scope_*` serves the OAuth-app form and, unless the
   * matching `token_*` key is present, the token form. Without groups the picker is a flat list.
   */
  scope_groups?: ApiCredentialScopeGroup[];
  scope_presets?: ApiCredentialScopePreset[];
  /** scope id => scope ids it needs: ticking a scope ticks them, unticking one unticks what needs it. */
  scope_implications?: ScopeImplications;
  /** A narrower scope list for personal tokens, when the server offers one. */
  token_scopes?: ApiCredentialScope[];
  token_scope_groups?: ApiCredentialScopeGroup[];
  token_scope_presets?: ApiCredentialScopePreset[];
  token_scope_implications?: ScopeImplications;
  /** Offered to personal tokens only: MCP connection scopes, listed after the token scopes. */
  token_connection_scopes?: ApiCredentialScope[];
  /** The lifetimes a token carrying a connection scope may have; replaces `token_lifetimes` for it. */
  connection_token_lifetimes?: string[];
}
export type IssuedApiCredential = {
  kind: 'token';
  name: string;
  token: string;
  expires_at?: string;
} | {
  kind: 'app';
  name: string;
  client_id: string;
  client_secret: string | null;
};
export interface ApiCredentialEndpointLink {
  label: string;
  url: string;
}
/**
 * The outcome of one credential request: on success the parsed JSON body
 * (the component reads its `data` when present), on failure the message to show.
 */
export type ApiCredentialRequestResult = {
  ok: true;
  status: number;
  payload: unknown;
} | {
  ok: false;
  status: number;
  message: string;
};
/**
 * Performs one credential request in place of the built-in `fetch`, so an app
 * can route it through its own client (session-expiry redirect, CSRF, retries).
 */
export type ApiCredentialRequest = (method: 'GET' | 'POST' | 'DELETE', url: string, body?: object) => Promise<ApiCredentialRequestResult>;
export interface ApiCredentialsSectionProps {
  /** The credential service's index URL (GET). */
  indexUrl: string;
  components: AuthComponentInput;
  /** Values a connector needs: the OpenAPI document, API base, OAuth authorize/token URLs, MCP URL. */
  links?: ApiCredentialEndpointLink[];
  csrfToken?: string;
  /** Replaces the built-in `fetch` for every credential request; `csrfToken` is then the app's to send. */
  request?: ApiCredentialRequest;
  onSuccess?: (message: string) => void;
  onError?: (field: string, message: string) => void;
  /**
   * `stacked` (default) puts the token and OAuth-app sections one under the other.
   * `columns` lays them side by side when the container is wide enough (about 960px);
   * narrower containers stack them.
   */
  layout?: 'stacked' | 'columns';
}
/**
 * A person's credentials for apps that use the API: personal API tokens (for
 * connectors that ask for a key) and OAuth apps (for connectors that run the
 * authorization-code flow).
 *
 * Each secret arrives once, in the response that created it, and lives only
 * in this component's memory; afterwards only the lists are reloaded, so it is
 * never part of page props or browser history.
 */
export declare function ApiCredentialsSection({ indexUrl, components, links, csrfToken, request, onSuccess, onError, layout }: ApiCredentialsSectionProps): React.JSX.Element;
/** PT4H → "4 hours", P30D → "30 days", P1Y → "1 year". Unknown shapes are shown as given. */
export declare function describeDuration(spec: string): string;
export {};