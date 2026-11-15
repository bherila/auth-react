import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { assertPackageIdentity, assertLockIdentities, inspectActiveGraph } from './check-toolchain.mjs';

test('only native 7.0.2 is accepted; pure rule packages remain valid', () => {
    assert.equal(assertPackageIdentity({ name: 'typescript', version: '7.0.2' }), '7.0.2');
    assert.equal(assertPackageIdentity({ name: 'eslint-plugin-react-hooks', version: '7.1.1' }), null);
    for (const manifest of [
        { name: 'typescript', version: '6.0.3' },
        { name: '@typescript/typescript6', version: '6.0.3' },
        { name: '@typescript/old', version: '5.9.3' },
        { name: 'eslint', version: '10.14.0' },
    ]) assert.throws(() => assertPackageIdentity(manifest));
});

test('resolved package identities fail, while peer range mentions do not', () => {
    const native = 'packages:\n  typescript@7.0.2: {}\n';
    assert.doesNotThrow(() => assertLockIdentities(native + "  plugin@1.0.0:\n    peerDependencies:\n      eslint: ^9\n      typescript: ^6\n"));
    for (const identity of ['typescript@6.0.3', '@typescript/typescript6@6.0.3', '@typescript/old@5.9.3', 'eslint@10.14.0']) {
        for (const quote of ['', "'", '"']) {
            assert.throws(() => assertLockIdentities(native + `  ${quote}${identity}${quote}: {}\n`));
        }
    }
    assert.throws(() => assertLockIdentities('packages:\n  plugin@1.0.0: {}\n'));
});

test('active graph reads alias identities, ignores ambient packages and only skips absent optional binaries', () => {
    const root = mkdtempSync(join(tmpdir(), 'auth-react-toolchain-'));
    function manifest(name, data) {
        const path = join(root, name);
        mkdirSync(path);
        writeFileSync(join(path, 'package.json'), JSON.stringify(data));
        return { path };
    }
    try {
        const native = manifest('native', { name: 'typescript', version: '7.0.2', optionalDependencies: { 'other-platform': '7.0.2' } });
        native.dependencies = { 'other-platform': { path: join(root, 'absent-platform') } };
        const project = manifest('project', { name: 'bwh-auth', version: '0.6.4' });
        project.devDependencies = { typescript: native };
        const old = manifest('hidden-compiler', { name: '@typescript/typescript6', version: '6.0.3' });
        manifest('ambient-eslint', { name: 'eslint', version: '10.14.0' });
        assert.equal(inspectActiveGraph([project]), 2);
        project.devDependencies['harmless-alias'] = old;
        assert.throws(() => inspectActiveGraph([project]), /Classic compiler/);
        delete project.devDependencies['harmless-alias'];
        project.dependencies = { missing: { path: join(root, 'missing-required') } };
        assert.throws(() => inspectActiveGraph([project]), /ENOENT/);
        assert.throws(() => inspectActiveGraph([]), /native compiler must actually/);
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
});
