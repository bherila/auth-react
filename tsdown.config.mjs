import { defineConfig } from 'tsdown';

export default defineConfig({
    entry: ['src/index.ts'],
    format: ['esm', 'cjs'],
    platform: 'browser',
    target: 'es2022',
    tsconfig: 'tsconfig.build.json',
    sourcemap: false,
    dts: { generator: 'tsgo', sourcemap: false },
});
