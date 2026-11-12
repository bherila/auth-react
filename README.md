# bwh-auth

Shared headless React auth components for BWH applications.

This package owns auth-specific React behavior and browser helpers. It does not import
or bundle a UI kit, Blade page wrappers, or application Vite entrypoints. Consumers must inject their own UI components and mount these components from app-owned pages/entrypoints.

The companion Laravel API package is
[`bherila/auth-laravel`](https://github.com/bherila/auth-laravel).

## Ownership boundary

`bwh-auth` exports React components only. Laravel apps should keep their own Blade files such as `resources/views/auth/login.blade.php` and Vite entrypoints such as `resources/js/auth/login.tsx`; those app files import and mount these shared components.

## Components

- `LoginForm`
- `SignupForm`
- `PasswordResetRequestForm`
- `ResetPasswordForm`
- `ChangePasswordForm`
- `TwoFactorForm`
- `PasskeyLoginButton`
- `PasskeySection`
- `ApiCredentialsSection`

## Relying-party helpers

`relyingApplicationsFrom(value)` validates the sibling-application list an identity provider
reports into one that is safe to render, and `safeApplicationHref(url)` is the scheme check
behind it. Neither touches the DOM, so an app can feed them a `#app-initial-data` payload, an
Inertia shared prop, or anything else it already has.

```ts
import { relyingApplicationsFrom } from 'bwh-auth';

const applications = relyingApplicationsFrom(initialData.applications);
```

Rendering these entries means putting provider-supplied text into an `href`. `javascript:`
and `data:` URLs pass a server-side URL-validity check but execute rather than navigate, so
the scheme is parsed rather than prefix-matched — a `startsWith` test can be walked past with
leading control characters or unexpected case — and the **parsed** form is returned, so what
is rendered is exactly what was validated. Unrecognised entries are dropped rather than
throwing: this is navigation chrome, and one malformed entry must not take down the page it
appears on.

## Install

Install the published package from npm:

```sh
pnpm add bwh-auth
```

For a deliberately pinned version:

```sh
pnpm add bwh-auth@0.2.0
```

Commit `pnpm-lock.yaml`; consumers do not need a GitHub tarball URL.

When installing locally during package development, a path dependency is still useful:

```sh
pnpm add bwh-auth@file:../auth-react
```

Install peer dependencies in the consuming app:

```sh
pnpm add lucide-react react react-dom
```

React and React DOM are usually already present in Laravel/Vite apps.

## Component Injection

Higher-level components require injected components so each app can use its own
shadcn/Base UI components and Vite can tree-shake cleanly.

```tsx
import { LoginForm, type AuthComponentInput } from "bwh-auth"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function getShadcnComponents() {
  return {
    Button,
    Card,
    CardContent,
    CardDescription: ({ ...props }) => <div {...props} />,
    CardHeader,
    CardTitle,
    Input,
    Label,
    // Extra keys are allowed so this helper can be shared across features.
    Textarea,
    Dialog,
  } satisfies AuthComponentInput
}

export function LoginPage() {
  return <LoginForm components={getShadcnComponents()} />
}
```

## Custom Signup Fields

`SignupForm` is field-driven so apps can keep app-specific registration concepts, such as invite codes or policy checkboxes, while reusing the shared auth form behavior.

```tsx
<SignupForm
  components={getShadcnComponents()}
  submitMode="native"
  fields={[
    { name: 'first_name', label: 'First Name', required: true, autoComplete: 'given-name' },
    { name: 'last_name', label: 'Last Name', required: true, autoComplete: 'family-name' },
    { name: 'email', label: 'Email', type: 'email', required: true, autoComplete: 'email' },
    { name: 'password', label: 'Password', type: 'password', required: true, minLength: 8, autoComplete: 'new-password' },
    { name: 'password_confirmation', label: 'Confirm Password', type: 'password', required: true, minLength: 8, autoComplete: 'new-password' },
    { name: 'invite_code', label: 'Season Invite Code', required: true },
    { name: 'agreement', label: 'I agree to keep this program confidential.', type: 'checkbox', required: true },
  ]}
/>
```

Signup fields can use `hiddenWhen` for flows such as passwordless signup, where the app submits `passwordless=1` and hides password fields:

```tsx
const fields = [
  { name: 'email', label: 'Email', type: 'email', required: true },
  { name: 'passwordless', label: 'Use a passkey instead of a password', type: 'checkbox' },
  { name: 'password', label: 'Password', type: 'password', required: true, hiddenWhen: (values) => Boolean(values.passwordless) },
  { name: 'password_confirmation', label: 'Confirm Password', type: 'password', required: true, hiddenWhen: (values) => Boolean(values.passwordless) },
]
```

For fetch-based signup flows, `onSuccess` receives both the server result and submitted values. That lets apps create the user first, then enroll a passkey through the shared WebAuthn helper:

```tsx
import { SignupForm, registerPasskey } from 'bwh-auth'

<SignupForm
  components={getShadcnComponents()}
  submitMode="fetch"
  fields={fields}
  onSuccess={async (result, values) => {
    if (values.passwordless) {
      await registerPasskey({ endpoints: { csrfToken } })
    }

    window.location.assign(result.redirect || '/')
  }}
/>
```

## Passkey sign-in

`LoginForm` can include an explicit passkey sign-in button and can opt into WebAuthn conditional UI so passkeys appear in the browser autofill menu for the email field. Conditional UI uses `PublicKeyCredential.isConditionalMediationAvailable()`, starts a conditional `navigator.credentials.get()` request, and sets the email input autocomplete to `username webauthn` when supported.

```tsx
<LoginForm
  components={getShadcnComponents()}
  enablePasskeys
  enablePasskeyAutofill
/>
```

Within `LoginForm`, explicit passkey login cancels and waits for conditional autofill before requesting a credential. Password submission and unmount also cancel pending passkey authentication. Autofill pauses after a manual sign-in attempt until the form is remounted. Changing consumer callbacks does not restart autofill.

As of 0.6.2, both passkey paths honor the form's current "Keep me signed in"
choice. Standalone `PasskeyLoginButton` and `authenticateWithPasskey` accept an
optional `remember` boolean or getter. The getter runs after the browser returns
a credential, immediately before posting it, so a long-running autofill request
uses the person's latest choice. Omitted helper options keep the previous
request shape. The server must support the optional `remember` field to issue a
persistent login cookie; older servers continue to authenticate per session.

When `PasskeyLoginButton` receives `onError`, the consumer owns error display; without it, the button displays its own error.

Consumers can preserve app-specific login state and design-system checkboxes
without rebuilding the form:

```tsx
<LoginForm
  components={getShadcnComponents()}
  initialEmail={verifiedEmail}
  onEmailChange={setForgotPasswordEmail}
  rememberMeCheckbox={Checkbox}
  rememberMeLabel="Remember me"
  rememberMeDataTest="login-remember-me"
  onSubmitStart={clearLoginMessages}
/>
```

The explicit passkey button and conditional autofill both default to the Laravel package routes:

- `POST /api/passkeys/auth/options`
- `POST /api/passkeys/auth`

## Composing login and password recovery

As of 0.6.3, `LoginForm` accepts `unwrapped` to render its controls without the
built-in card and heading. The consumer can keep its own page shell, notices and
links. `passkeySeparator` supplies optional content before the passkey button;
both props leave the existing layout unchanged when omitted.

`PasswordResetRequestForm` and `ResetPasswordForm` accept `onSubmitStart` to clear
consumer messages and `submitClassName` to style the submit button. Both forms
ignore duplicate submissions and disable that button while a request is pending.

`ResetPasswordForm` keeps server validation authoritative. Consumers may opt into
client confirmation matching and a minimum length:

```tsx
<ResetPasswordForm
  components={getShadcnComponents()}
  token={resetToken}
  email={resetEmail}
  minPasswordLength={8}
  validatePasswordConfirmation
  passwordLabel="New Password"
  passwordConfirmationLabel="Confirm New Password"
  passwordHelpText="Use at least 8 characters"
  idPrefix="account-new-password"
  onError={setError}
/>
```

The policy props are unset by default. Labels retain their existing defaults;
`idPrefix` defaults to `reset-password` and changes the field IDs and associated
labels together, avoiding a collision when the embedding page already uses that
ID. The consumer owns success/error messages, navigation and any generic
reset-request acknowledgement needed to protect account privacy. Endpoint and
CSRF overrides remain available through `endpoints`.

## Password Change

`ChangePasswordForm` is intended for authenticated settings pages or dialogs. The consuming app owns the wrapper and backend endpoint; the form posts to `/api/change-password` by default and accepts `endpoints.changePassword` for apps that use a different route.

```tsx
<ChangePasswordForm
  components={getShadcnComponents()}
  endpoints={{ csrfToken }}
  onSuccess={() => setMessage('Password changed successfully.')}
  onError={setError}
/>
```

## API credentials

`ApiCredentialsSection` lets a signed-in person create credentials for apps that use the API:
- **API tokens**, for connectors that ask for a key;
- **OAuth apps**, for connectors that run the authorization-code flow.

It talks to the auth package's credential service (`oauth_server.credentials`) through its JSON index URL. The server sends every action URL, so the component assembles none.

```tsx
<ApiCredentialsSection
  indexUrl="/account/api-credentials"
  components={components}
  links={[
    { label: 'OpenAPI document', url: openApiUrl },
    { label: 'OAuth authorize URL', url: authorizeUrl },
    { label: 'OAuth token URL', url: tokenUrl },
  ]}
/>
```

- **Each new secret is shown once.** It comes from the creation response and is kept only in component memory. Afterwards only the lists are reloaded, so it never enters page props or history.
- **Requests** send the session cookie and `X-CSRF-TOKEN`. A 401 or 419 response becomes "sign in again".
- **While the server reports issuing unavailable** (OAuth switched off), the create forms are hidden, and revoke and delete still work.
- **Token lifetimes** are ISO-8601 durations from the server, displayed as text (`PT4H` shows as "4 hours").
- **Your own HTTP client:** pass `request` to send every credential request through it, so it gets the same session-expiry handling as the rest of the app. `request(method, url, body)` resolves with `{ ok: true, status, payload }` (the parsed JSON; the component reads its `data` when present) or `{ ok: false, status, message }`, and the message is shown. With `request`, sending the CSRF token is the client's job; without it, the built-in `fetch` is used as above.
- **Your own form controls:** besides the required components, `components` may include `Textarea`, `Checkbox` (`{ id, checked, onCheckedChange }`) and `RadioGroup` (`{ name, value, onValueChange, options: [{ value, label }] }`). Each one you omit is rendered as the native element.

```tsx
<ApiCredentialsSection
  indexUrl="/account/api-credentials"
  components={{ ...components, Textarea, Checkbox: AppCheckbox, RadioGroup: AppRadioGroup }}
  request={(method, url, body) => myClient.send(method, url, body)}
/>
```

### Grouped scope picker

When the index carries scope groups, both forms replace the flat checkbox list with a grouped picker. Every key is optional, and everything here is presentation: the credential stores exactly the scope ids that end up ticked, and the form posts `scopes` as explicit ids only (never a group or preset id).

| Index key | Shape | Used by |
| --- | --- | --- |
| `scope_groups` | `[{ id, label, description \| null, sensitive, scopes: [ids] }]` | OAuth-app form; token form unless `token_scope_groups` is present |
| `scope_presets` | `[{ id, label, description, scopes: [ids] }]` | likewise, with `token_scope_presets` |
| `scope_implications` | `{ "billing:write": ["billing:read"] }` | likewise, with `token_scope_implications` |
| `token_scopes` | `[{ id, description }]` | A narrower scope list for the token form (default: `scopes`) |
| `token_scope_groups`, `token_scope_presets`, `token_scope_implications` | as above | Token form |
| `token_connection_scopes`, `connection_token_lifetimes` | `[{ id, description }]`, ISO-8601 durations | Token form only: connection scopes are listed after the token scopes, and a token carrying one is offered `connection_token_lifetimes` instead of `token_lifetimes` |

- **No groups: nothing changes.** The picker renders the flat list exactly as before (no presets, no summary).
- **Presets** are a row of buttons. Clicking one replaces the selection with exactly that preset's scopes. `aria-pressed` is true only while the selection equals the preset exactly; a line below shows its description, or "Custom selection" otherwise. There is no "select all".
- **Groups** render as one `<fieldset>` each, in an auto-fill grid (`minmax(min(100%, 300px), 1fr)`, so phones get one column) with 44px touch targets. Scopes the groups do not name collect in a final "Other permissions" group. A preset that names a scope the surface does not offer is not shown.
- **Sensitive groups** render as one parent checkbox (checked when all its scopes are ticked, `indeterminate` and `aria-checked="mixed"` when some are), a "Sensitive" badge and the group description as a warning. Clicking the parent ticks or clears every scope in the group. An "Adjust individual ... permissions" button (`aria-expanded`) reveals the group's scopes as ordinary checkboxes.
- **Implications** are a picker-only cascade. Ticking a scope also ticks everything it needs (transitively); unticking a scope also unticks every scope that needs it. Presets and the sensitive parent apply the cascade too. A scope that a ticked scope needs shows a muted "needed by ..." note. The server never infers one scope from another, so existing grants do not widen.
- **Summary:** "This credential will request N permissions:" followed by the explicit ids.

New optional `components` for the picker, each falling back to a native element: `Badge` (the "Sensitive" label) and `Alert` (the sensitive-group warning). Presets and the disclosure use your `Button` (`variant="default"`/`"outline"`/`"ghost"`, `aria-pressed`, `aria-expanded`). Scope checkboxes use `Checkbox` when injected; the sensitive parent is always a native `<input type="checkbox">`, because it needs `indeterminate` and `aria-checked="mixed"`.

`ScopePicker`, the group and preset types, and the pure helpers in `scope-selection` (`closeImplications`, `withScopes`, `withoutScopes`, ...) are exported for apps that build their own forms.

## Endpoint Defaults

Auth forms default to the Laravel package API routes where the Laravel package owns the endpoint:

- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`
- `POST /api/change-password`
- `POST /api/auth/two-factor/verify`
- `POST /api/auth/two-factor/resend`
- `POST /api/auth/two-factor/report/:token`

Passkey components default to the Laravel package routes:

- `GET /api/passkeys`
- `POST /api/passkeys/register/options`
- `POST /api/passkeys/register`
- `DELETE /api/passkeys/:id`
- `POST /api/passkeys/auth/options`
- `POST /api/passkeys/auth`

## Development toolchain

Use pnpm 12.18.0 and Node 22.22.2+, 24.15.0+, or 26+. The supported Node
ranges match the build/test dependencies; CI covers both minimum versions and
Node 26. Run focused checks locally and use CI for the full tests, typecheck,
build and packed-consumer matrix.

Typechecking uses TypeScript 7.0.2 explicitly. The `typescript` dependency is
intentionally an alias to the last JavaScript compiler (`@typescript/typescript6`)
for tsup's declaration bundler only. tsup 9 still calls `createProgram` and
`createCompilerHost`; TypeScript 7.0's main export has neither API. Removing that
alias requires an upstream declaration-bundler migration, not an unchecked swap
to a native compiler. See the [TypeScript 7.0 API notes](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/).

CI installs the packed artifact into isolated consumers with React 18.3.1 /
Lucide 0.468.0 and React 19.3.1 / Lucide 1.72.0. It verifies ESM and CommonJS
runtime exports and compiles `.mts` and `.cts` consumers with TypeScript 7.
React 18/19 peer support and the public entrypoints remain unchanged. The release
workflow repeats the packed-consumer check before publishing.

### 0.6.4 dependency refresh

This patch publishes the pnpm 12.18.0, tsup 9 and TypeScript 7 toolchain refresh,
updates the development and packed-consumer Lucide dependency to 1.72.0, and runs
the packed-consumer checks above. The package's Node engine now requires
`^22.22.2 || ^24.15.0 || >=26.0.0`, matching its supported build dependencies.
React 18/19 and Lucide `>=0.468.0 <2.0.0` peer ranges remain unchanged. There are
no authentication API, component-prop or public-export changes.

## Releasing

Prepare a release from this package directory:

```sh
pnpm release
```

The release script:

- requires a clean git working tree
- bumps `package.json` version, defaulting to `patch`
- runs `pnpm install --lockfile-only`
- runs typecheck and build
- creates `release/bwh-auth-VERSION.tgz`
- commits the version bump
- creates and pushes a signed tag like `bwh-auth-v0.1.1`

The release workflow verifies the tag signature, publishes to npm through its
trusted publisher, and creates a GitHub Release with the tarball as a secondary
artifact.

Version bump options:

```sh
pnpm release patch
pnpm release minor
pnpm release major
pnpm release --version=0.2.0
pnpm release --dry-run
```
