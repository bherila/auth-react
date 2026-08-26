import * as react_jsx_runtime from 'react/jsx-runtime';
import * as React from 'react';

interface AuthEndpointConfig {
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
type AuthValidationErrors = Record<string, string[]>;
type AuthSignupValues = Record<string, string | boolean>;
interface AuthSignupField {
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
interface Passkey {
    id: number;
    name: string;
    aaguid: string | null;
    created_at: string;
    updated_at: string;
}
interface AuthJsonResponse {
    success?: boolean;
    message?: string;
    error?: string;
    redirect?: string;
    requires_2fa?: boolean;
    attempt_token?: string;
    [key: string]: unknown;
}
type AuthButtonVariant = 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
type AuthButtonSize = 'default' | 'sm' | 'lg' | 'icon' | 'icon-sm' | 'icon-lg';
type AuthButtonComponentProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: AuthButtonVariant;
    size?: AuthButtonSize;
};
type AuthInputComponentProps = React.InputHTMLAttributes<HTMLInputElement>;
type AuthLabelComponentProps = React.LabelHTMLAttributes<HTMLLabelElement>;
type AuthContainerComponentProps = React.HTMLAttributes<HTMLDivElement>;
interface AuthComponentSet {
    Button: React.ComponentType<AuthButtonComponentProps>;
    Card: React.ComponentType<AuthContainerComponentProps>;
    CardContent: React.ComponentType<AuthContainerComponentProps>;
    CardDescription: React.ComponentType<AuthContainerComponentProps>;
    CardHeader: React.ComponentType<AuthContainerComponentProps>;
    CardTitle: React.ComponentType<AuthContainerComponentProps>;
    Input: React.ComponentType<AuthInputComponentProps>;
    Label: React.ComponentType<AuthLabelComponentProps>;
}
type AuthComponents = AuthComponentSet;
type AuthComponentOverrides = Partial<AuthComponentSet>;
type AuthButtonComponent = AuthComponentSet['Button'];
type AuthComponentSuperset = AuthComponentSet & Record<string, React.ComponentType<any>>;
type AuthComponentInput = AuthComponentSet | AuthComponentSuperset;
type AuthButtonComponentInput = Pick<AuthComponentSet, 'Button'> & Record<string, React.ComponentType<any>>;

interface AuthFormProps {
    endpoints?: AuthEndpointConfig;
    components: AuthComponentInput;
    onSuccess?: (result: AuthJsonResponse) => void;
    onError?: (message: string) => void;
}
interface LoginFormProps extends AuthFormProps {
    enablePasskeys?: boolean;
    enablePasskeyAutofill?: boolean;
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
interface ResetPasswordFormProps extends AuthFormProps {
    token?: string;
    email?: string;
}
interface TwoFactorFormProps extends AuthFormProps {
    attemptToken: string;
    appEnv?: string;
    onReportSuspicious?: (result: AuthJsonResponse) => void;
}
declare function LoginForm({ endpoints, components, onSuccess, onError, onTwoFactorRequired, onPasskeySuccess, enablePasskeys, enablePasskeyAutofill, }: LoginFormProps): react_jsx_runtime.JSX.Element;
declare function SignupForm({ endpoints, components, onSuccess, onError, fields, initialValues, errors, submitMode, title, description, submitLabel, submittingLabel, }: SignupFormProps): react_jsx_runtime.JSX.Element;
declare function PasswordResetRequestForm({ endpoints, components, onSuccess, onError }: AuthFormProps): react_jsx_runtime.JSX.Element;
declare function ResetPasswordForm({ endpoints, components, onSuccess, onError, token: initialToken, email: initialEmail }: ResetPasswordFormProps): react_jsx_runtime.JSX.Element;
declare function ChangePasswordForm({ endpoints, components, onSuccess, onError }: AuthFormProps): react_jsx_runtime.JSX.Element;
declare function TwoFactorForm({ endpoints, components, attemptToken, appEnv, onSuccess, onError, onReportSuspicious }: TwoFactorFormProps): react_jsx_runtime.JSX.Element;

interface PasskeyLoginButtonProps {
    endpoints?: AuthEndpointConfig;
    components: AuthButtonComponentInput;
    className?: string;
    onSuccess?: (redirectUrl: string, result: AuthJsonResponse) => void;
    onError?: (message: string) => void;
}
declare function PasskeyLoginButton({ endpoints, components, className, onSuccess, onError }: PasskeyLoginButtonProps): react_jsx_runtime.JSX.Element | null;

interface PasskeySectionProps {
    endpoints?: AuthEndpointConfig;
    components: AuthComponentInput;
    onSuccess?: (message: string) => void;
    onError?: (field: string, message: string) => void;
}
declare function PasskeySection({ endpoints, components, onSuccess, onError }: PasskeySectionProps): react_jsx_runtime.JSX.Element;

/**
 * The sibling applications an identity provider reports for the signed-in person.
 *
 * Every relying party receives this list the same way — server-side, injected per request
 * from the session rather than compiled into a bundle — but each one carries it into the
 * page differently: a `#app-initial-data` script tag, an Inertia shared prop, a Blade loop.
 * What they cannot afford to do differently is decide which entries are safe to render, so
 * that decision lives here and the transport stays the application's business.
 */
interface RelyingApplication {
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
declare function safeApplicationHref(url: string): string | null;
/**
 * Validate whatever the page handed over into a list that is safe to render.
 *
 * Unrecognised entries are dropped rather than throwing. This is navigation chrome: one
 * malformed entry, or a provider that has grown a field, must not be able to take down the
 * page it appears on. Anything that is not a well-formed list degrades to an empty menu.
 */
declare function relyingApplicationsFrom(value: unknown): RelyingApplication[];

declare function getCsrfToken(explicitToken?: string): string;
declare function base64urlToArrayBuffer(b64: string): ArrayBuffer;
declare function arrayBufferToBase64url(buffer: ArrayBuffer): string;
declare function isAbortError(error: unknown): boolean;
interface AuthenticateWithPasskeyOptions {
    endpoints?: AuthEndpointConfig;
    mediation?: CredentialMediationRequirement;
    signal?: AbortSignal;
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
declare function getDefaultPasskeyName(): string;
declare function isConditionalMediationAvailable(): Promise<boolean>;
declare function authenticateWithPasskey({ endpoints, mediation, signal }?: AuthenticateWithPasskeyOptions): Promise<PasskeyAuthenticationResult>;
declare function registerPasskey({ endpoints, name, signal }?: RegisterPasskeyOptions): Promise<PasskeyRegistrationResult>;

export { type AuthButtonComponent, type AuthButtonComponentInput, type AuthButtonComponentProps, type AuthButtonSize, type AuthButtonVariant, type AuthComponentInput, type AuthComponentOverrides, type AuthComponentSet, type AuthComponentSuperset, type AuthComponents, type AuthContainerComponentProps, type AuthEndpointConfig, type AuthInputComponentProps, type AuthJsonResponse, type AuthLabelComponentProps, type AuthSignupField, type AuthSignupValues, type AuthValidationErrors, ChangePasswordForm, LoginForm, type Passkey, PasskeyLoginButton, PasskeySection, PasswordResetRequestForm, type RelyingApplication, ResetPasswordForm, SignupForm, TwoFactorForm, arrayBufferToBase64url, authenticateWithPasskey, base64urlToArrayBuffer, getCsrfToken, getDefaultPasskeyName, isAbortError, isConditionalMediationAvailable, registerPasskey, relyingApplicationsFrom, safeApplicationHref };
