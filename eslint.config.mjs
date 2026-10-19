import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
    { ignores: ['dist/**', 'release/**', 'node_modules/**', 'artifacts/**'] },
    js.configs.recommended,
    ...tseslint.configs.recommended,
    {
        files: ['**/*.ts', '**/*.cts', '**/*.cjs', '**/*.mjs'],
        languageOptions: {
            globals: {
                document: 'readonly',
                window: 'readonly',
                console: 'readonly',
                setTimeout: 'readonly',
                clearTimeout: 'readonly',
                MutationObserver: 'readonly',
                ResizeObserver: 'readonly',
                HTMLInputElement: 'readonly',
                HTMLElement: 'readonly',
                getComputedStyle: 'readonly',
                innerWidth: 'readonly',
                innerHeight: 'readonly',
                require: 'readonly',
                __dirname: 'readonly',
                process: 'readonly',
                global: 'readonly',
            },
        },
        rules: {
            'no-empty': ['error', { allowEmptyCatch: true }],
            '@typescript-eslint/no-require-imports': 'off',
            '@typescript-eslint/no-unused-vars': [
                'error',
                { argsIgnorePattern: '^_' },
            ],
        },
    },
    prettier,
);
