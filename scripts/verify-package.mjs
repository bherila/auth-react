import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
assert.equal(process.argv.length, 3, 'Pass exactly one packed candidate.');
const tarball = resolve(process.argv[2] ?? '');
const expectedVersion = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version;
assert.match(tarball, /bwh-auth-[0-9]+\.[0-9]+\.[0-9]+\.tgz$/);
const compiler = join(root, 'node_modules/typescript/bin/tsc');
const peers = [
  { react: '18.3.1', reactTypes: '18.3.31', domTypes: '18.3.7', lucide: '0.468.0' },
  { react: '19.3.1', reactTypes: '19.3.0', domTypes: '19.3.0', lucide: '1.72.0' },
];

for (const peer of peers) {
  const directory = mkdtempSync(join(tmpdir(), 'bwh-auth-consumer-'));
  try {
    writeFileSync(join(directory, 'package.json'), JSON.stringify({ private: true, type: 'module' }));
    execFileSync('npm', ['install', '--ignore-scripts', '--no-package-lock', '--no-audit', '--no-fund',
      tarball, 'bwh-auth-baseline@npm:bwh-auth@0.6.4', `react@${peer.react}`, `react-dom@${peer.react}`, `lucide-react@${peer.lucide}`,
      `@types/react@${peer.reactTypes}`, `@types/react-dom@${peer.domTypes}`], { cwd: directory, stdio: 'pipe' });
    const installed = join(directory, 'node_modules/bwh-auth');
    const metadata = JSON.parse(readFileSync(join(installed, 'package.json'), 'utf8'));
    assert.equal(metadata.version, expectedVersion);
    assert.deepEqual(metadata.exports['.'], {
      import: { types: './dist/index.d.ts', default: './dist/index.js' },
      require: { types: './dist/index.d.cts', default: './dist/index.cjs' },
    });
    for (const file of ['dist/index.js', 'dist/index.cjs', 'dist/index.d.ts', 'dist/index.d.cts']) {
      assert.ok(readFileSync(join(installed, file)).length > 0);
    }
    const baseline = join(directory, 'node_modules/bwh-auth-baseline');
    // Both bundlers produce one flat named-export list; fail if that contract changes.
    function declarationExports(packagePath, file) {
      const source = readFileSync(join(packagePath, file), 'utf8');
      const exports = [...source.matchAll(/export (type )?\{([^}]+)\};?/g)].flatMap((match) =>
        match[2].split(',').map((name) => `${match[1] ?? ''}${name.trim()}`).filter((name) => name.trim()));
      assert.ok(exports.length > 0, `Missing named declaration exports in ${file}`);
      assert.ok(!/from ['"]\./.test(source), 'Declarations must not depend on unpublished local files.');
      return exports.sort();
    }
    const baselineExports = declarationExports(baseline, 'dist/index.d.ts');
    assert.deepEqual(declarationExports(installed, 'dist/index.d.ts'), baselineExports);
    assert.deepEqual(declarationExports(installed, 'dist/index.d.cts'), baselineExports);
    const typeCompatibility = baselineExports.filter((name) => name.startsWith('type ')).map((entry) => {
      const name = entry.slice(5);
      assert.match(name, /^[A-Za-z_$][\w$]*$/);
      return `declare const candidate${name}: Candidate.${name};
const baseline${name}: Baseline.${name} = candidate${name};
const restored${name}: Candidate.${name} = baseline${name};
void restored${name};`;
    }).join('\n');
    writeFileSync(join(directory, 'runtime.mjs'), `
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import * as esm from 'bwh-auth';
import * as baseline from 'bwh-auth-baseline';
const cjs = createRequire(import.meta.url)('bwh-auth');
assert.deepEqual(Object.keys(esm).sort(), Object.keys(cjs).sort());
assert.deepEqual(Object.keys(esm).sort(), Object.keys(baseline).sort());
for (const name of ['LoginForm', 'SignupForm', 'ScopePicker', 'authenticateWithPasskey', 'safeApplicationHref']) {
  assert.equal(typeof esm[name], 'function');
  assert.equal(typeof cjs[name], 'function');
}
assert.equal(esm.safeApplicationHref('javascript:alert(1)'), null);
assert.equal(cjs.safeApplicationHref('javascript:alert(1)'), null);
`);
    execFileSync(process.execPath, ['runtime.mjs'], { cwd: directory, stdio: 'inherit' });
    writeFileSync(join(directory, 'consumer.mts'), `
import { LoginForm, ScopePicker, safeApplicationHref, type AuthComponentInput } from 'bwh-auth';
import type { ComponentProps } from 'react';
import type * as Candidate from 'bwh-auth';
import type * as Baseline from 'bwh-auth-baseline';
${typeCompatibility}
declare const candidateValues: typeof Candidate;
const baselineValues: typeof Baseline = candidateValues;
const restoredValues: typeof Candidate = baselineValues;
void restoredValues;
declare const components: AuthComponentInput;
const login: ComponentProps<typeof LoginForm> = { components, enablePasskeys: true };
const scopes: ComponentProps<typeof ScopePicker> = {} as ComponentProps<typeof ScopePicker>;
void login; void scopes; void safeApplicationHref('/login');
`);
    writeFileSync(join(directory, 'consumer.cts'), `
import auth = require('bwh-auth');
import type { ComponentProps } from 'react';
declare const components: auth.AuthComponentInput;
const login: ComponentProps<typeof auth.LoginForm> = { components };
void login; void auth.safeApplicationHref('/login');
`);
    writeFileSync(join(directory, 'tsconfig.json'), JSON.stringify({
      compilerOptions: { strict: true, noEmit: true, module: 'NodeNext', moduleResolution: 'NodeNext', target: 'ES2022', jsx: 'react-jsx', types: [] },
      files: ['consumer.mts', 'consumer.cts'],
    }));
    const trace = execFileSync(process.execPath, [compiler, '--project', join(directory, 'tsconfig.json'), '--traceResolution'], {
      cwd: directory, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024,
    });
    for (const extension of ['d.ts', 'd.cts']) {
      assert.ok(trace.split('\n').some((line) => line.includes("Module name 'bwh-auth' was successfully resolved to") &&
        line.includes(`/bwh-auth/dist/index.${extension}'`)), `NodeNext must actually resolve the ${extension} entrypoint.`);
    }
    console.log(`Packed ESM/CJS runtime and TS7 declarations passed with React ${peer.react} / Lucide ${peer.lucide}.`);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}
