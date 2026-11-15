import assert from 'node:assert/strict';

// Compare the two flat declaration syntaxes emitted by tsup and tsdown.
// TypeScript then checks every exported type/value in both module modes.
export function declarationExports(source) {
    assert.ok(!/from ['"]\./.test(source), 'Declarations must not depend on unpublished local files.');
    assert.ok(!/^export\s+\*/m.test(source), 'Declarations must remain flat.');
    const names = [...source.matchAll(/^export\s*(type\s+)?\{([^}]*)\};?/gm)].flatMap((match) =>
        match[2].split(',').map((name) => name.trim()).filter(Boolean)
            .map((name) => `${match[1] ? 'type ' : ''}${name}`));
    for (const match of source.matchAll(/^export\s+(?:declare\s+)?(interface|type|function|const|let|class)\s+([A-Za-z_$][\w$]*)/gm)) {
        names.push(`${['interface', 'type'].includes(match[1]) ? 'type ' : ''}${match[2]}`);
    }
    assert.ok(names.length > 0, 'Missing declaration exports.');
    for (const name of names) assert.match(name, /^(?:type\s+)?[A-Za-z_$][\w$]*$/);
    assert.equal(new Set(names).size, names.length, 'Duplicate declaration exports.');
    return names.sort();
}
