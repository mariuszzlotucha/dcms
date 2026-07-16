import boundaries from 'eslint-plugin-boundaries';
import tseslint from 'typescript-eslint';

export default [
    ...tseslint.configs.recommended,
    {
        files: ['apps/api/src/platform/**/*.config.ts'],
        rules: {
            '@typescript-eslint/no-explicit-any': 'off',
        },
    },
    {
        files: ['**/*.ts', '**/*.tsx'],
        ignores: ['**/dist/**', '**/node_modules/**'],
        languageOptions: {
            parserOptions: {
                ecmaFeatures: { jsx: true },
            },
        },
        plugins: { boundaries },
        settings: {
            'boundaries/elements': [
                { type: 'api-domain', pattern: 'apps/api/src/domain/*' },
                { type: 'api-platform', pattern: 'apps/api/src/platform/*' },
                { type: 'api-app', pattern: 'apps/api/src/app/*' },
                { type: 'web-domain', pattern: 'apps/web/src/domain/*' },
                { type: 'web-platform', pattern: 'apps/web/src/platform/*' },
                { type: 'web-app', pattern: 'apps/web/src/app/*' },
                { type: 'shared', pattern: 'shared/*' }
            ]
        },
        rules: {
            'boundaries/element-types': ['error', {
                default: 'disallow',
                rules: [
                    { from: 'api-domain', allow: ['api-platform', 'shared', 'api-domain'] },
                    { from: 'api-platform', allow: ['shared', 'api-platform'] },
                    { from: 'api-app', allow: ['api-platform', 'api-domain', 'shared'] },
                    { from: 'web-domain', allow: ['web-platform', 'shared', 'web-domain'] },
                    { from: 'web-platform', allow: ['shared', 'web-platform'] },
                    { from: 'web-app', allow: ['web-platform', 'web-domain', 'shared'] }
                ]
            }]
        }
    }
];