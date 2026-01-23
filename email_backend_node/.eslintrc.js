// =============================================================================
// ESLint Configuration
// =============================================================================
// TypeScript linting rules for code quality and consistency
// =============================================================================

module.exports = {
    parser: '@typescript-eslint/parser',
    parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        project: './tsconfig.json',
    },
    extends: [
        'eslint:recommended',
        'plugin:@typescript-eslint/recommended',
        'plugin:@typescript-eslint/recommended-requiring-type-checking',
    ],
    plugins: ['@typescript-eslint'],
    rules: {
        // Enforce no console.log in production code
        'no-console': 'warn',

        // TypeScript specific rules
        '@typescript-eslint/no-explicit-any': 'warn',
        '@typescript-eslint/explicit-function-return-type': [
            'warn',
            {
                allowExpressions: true,
                allowTypedFunctionExpressions: true,
            },
        ],
        '@typescript-eslint/no-unused-vars': [
            'error',
            {
                argsIgnorePattern: '^_',
                varsIgnorePattern: '^_',
            },
        ],
        '@typescript-eslint/no-floating-promises': 'error',
        '@typescript-eslint/await-thenable': 'error',
        '@typescript-eslint/no-misused-promises': 'error',

        // General code quality
        'no-debugger': 'error',
        'no-duplicate-imports': 'error',
        'prefer-const': 'error',
        'no-var': 'error',
        'eqeqeq': ['error', 'always'],
        'curly': ['error', 'all'],
        'brace-style': ['error', '1tbs'],

        // Allow empty catch blocks with comment
        'no-empty': ['error', { allowEmptyCatch: true }],
    },
    env: {
        node: true,
        es2022: true,
    },
    ignorePatterns: ['dist', 'node_modules', '*.js', '!.*.js'],
};
