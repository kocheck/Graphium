module.exports = {
  root: true,
  env: {
    browser: true,
    es2020: true,
    node: true,
  },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking',
    'plugin:react/recommended',
    'plugin:react/jsx-runtime',
    'plugin:react-hooks/recommended',
    'plugin:import/recommended',
    'plugin:import/typescript',
    'plugin:jsx-a11y/recommended',
    'plugin:prettier/recommended',
  ],
  ignorePatterns: [
    'dist',
    'dist-electron',
    'release',
    'node_modules',
    '.eslintrc.cjs',
    '**/*.test.ts',
    '**/*.test.tsx',
    '**/*.spec.ts',
    '**/*.spec.tsx',
    'playwright.config.ts',
    'vite.config.ts',
    'vitest.config.ts',
    'src/test/**',
    'tests/**',
    'docs/**',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    project: ['./tsconfig.json'],
    tsconfigRootDir: __dirname,
  },
  plugins: ['react-refresh', '@typescript-eslint', 'import'],
  settings: {
    react: {
      version: 'detect',
    },
    'import/resolver': {
      typescript: {
        alwaysTryTypes: true,
        project: './tsconfig.json',
      },
      node: {
        extensions: ['.js', '.jsx', '.ts', '.tsx'],
      },
    },
  },
  rules: {
    // ==========================================
    // CRITICAL: Prevent AI Agent Errors
    // ==========================================

    // No unused variables - AI often adds unused imports/vars
    '@typescript-eslint/no-unused-vars': [
      'error',
      {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
        destructuredArrayIgnorePattern: '^_',
      },
    ],

    // Require explicit return types on functions - prevent type hallucinations
    '@typescript-eslint/explicit-function-return-type': [
      'warn',
      {
        allowExpressions: true,
        allowTypedFunctionExpressions: true,
        allowHigherOrderFunctions: true,
        allowDirectConstAssertionInArrowFunctions: true,
      },
    ],

    // Disallow 'any' type - forces explicit typing
    '@typescript-eslint/no-explicit-any': 'error',

    // Require type annotations for function parameters
    '@typescript-eslint/no-inferrable-types': 'off',

    // ==========================================
    // TypeScript Strict Rules
    // ==========================================

    // Prevent floating promises - common async/await mistake
    '@typescript-eslint/no-floating-promises': 'error',

    // Require await in async functions
    '@typescript-eslint/require-await': 'error',

    // No misused promises (e.g., in conditionals)
    '@typescript-eslint/no-misused-promises': 'error',

    // Enforce consistent type imports
    '@typescript-eslint/consistent-type-imports': [
      'error',
      {
        prefer: 'type-imports',
        disallowTypeAnnotations: true,
        fixStyle: 'separate-type-imports',
      },
    ],

    // Enforce consistent type exports
    '@typescript-eslint/consistent-type-exports': [
      'error',
      {
        fixMixedExportsWithInlineTypeSpecifier: true,
      },
    ],

    // No unsafe member access
    '@typescript-eslint/no-unsafe-member-access': 'error',

    // No unsafe calls
    '@typescript-eslint/no-unsafe-call': 'error',

    // No unsafe assignment
    '@typescript-eslint/no-unsafe-assignment': 'error',

    // No unsafe return
    '@typescript-eslint/no-unsafe-return': 'warn',

    // No unsafe argument
    '@typescript-eslint/no-unsafe-argument': 'warn',

    // Prefer nullish coalescing
    '@typescript-eslint/prefer-nullish-coalescing': 'warn',

    // Prefer optional chain
    '@typescript-eslint/prefer-optional-chain': 'warn',

    // No non-null assertion
    '@typescript-eslint/no-non-null-assertion': 'warn',

    // Array type consistent
    '@typescript-eslint/array-type': ['error', { default: 'array-simple' }],

    // ==========================================
    // Code Quality & Complexity
    // ==========================================

    // Limit cyclomatic complexity
    complexity: ['warn', { max: 15 }],

    // Limit max lines per function
    'max-lines-per-function': [
      'warn',
      {
        max: 150,
        skipBlankLines: true,
        skipComments: true,
        IIFEs: true,
      },
    ],

    // Limit max depth of nested blocks
    'max-depth': ['warn', 4],

    // Limit max nested callbacks
    'max-nested-callbacks': ['warn', 3],

    // Limit max parameters
    'max-params': ['warn', 5],

    // Enforce consistent naming conventions
    '@typescript-eslint/naming-convention': [
      'error',
      {
        selector: 'variable',
        format: ['camelCase', 'UPPER_CASE', 'PascalCase'],
        leadingUnderscore: 'allow',
      },
      {
        selector: 'function',
        format: ['camelCase', 'PascalCase'],
      },
      {
        selector: 'typeLike',
        format: ['PascalCase'],
      },
      {
        selector: 'interface',
        format: ['PascalCase'],
        custom: {
          regex: '^I[A-Z]',
          match: false,
        },
      },
    ],

    // ==========================================
    // Import Organization
    // ==========================================

    // Enforce import order
    'import/order': [
      'error',
      {
        groups: [
          'builtin', // Node built-in modules
          'external', // npm packages
          'internal', // Internal modules
          ['parent', 'sibling', 'index'], // Relative imports
          'type', // Type imports
        ],
        pathGroups: [
          {
            pattern: 'react',
            group: 'external',
            position: 'before',
          },
          {
            pattern: '@/**',
            group: 'internal',
          },
        ],
        pathGroupsExcludedImportTypes: ['react'],
        'newlines-between': 'always',
        alphabetize: {
          order: 'asc',
          caseInsensitive: true,
        },
      },
    ],

    // No duplicate imports
    'import/no-duplicates': 'error',

    // No unused modules
    'import/no-unused-modules': [
      'warn',
      {
        unusedExports: true,
        ignoreExports: ['src/main.tsx', 'electron/main.ts', 'vite.config.ts'],
      },
    ],

    // No default export (prefer named exports for better refactoring)
    'import/no-default-export': 'off', // Turned off for React components, but consider enabling

    // No cycle dependencies
    'import/no-cycle': ['error', { maxDepth: 3, ignoreExternal: true }],

    // No self imports
    'import/no-self-import': 'error',

    // ==========================================
    // Module Boundary Enforcement
    // ==========================================
    // See CLAUDE.md "Design System Contract" for boundary rules.
    'import/no-restricted-paths': [
      'error',
      {
        zones: [
          // Primitives cannot import from store or services
          {
            target: './src/components/primitives',
            from: './src/store',
            message: 'Primitives must not import from store (Design System Contract)',
          },
          {
            target: './src/components/primitives',
            from: './src/services',
            message: 'Primitives must not import from services (Design System Contract)',
          },
          // Store cannot import from components
          {
            target: './src/store',
            from: './src/components',
            message: 'Store must not import from components (Design System Contract)',
          },
          // Services cannot import from components or store
          {
            target: './src/services',
            from: './src/components',
            message: 'Services must not import from components (Design System Contract)',
          },
          // Utils cannot import from React components
          {
            target: './src/utils',
            from: './src/components',
            message: 'Utils must not import from components (Design System Contract)',
          },
        ],
      },
    ],

    // ==========================================
    // React Specific Rules
    // ==========================================

    // Enforce React component refresh
    'react-refresh/only-export-components': [
      'warn',
      { allowConstantExport: true, allowExportNames: ['loader', 'action'] },
    ],

    // Require React hooks dependencies
    'react-hooks/exhaustive-deps': 'error',

    // Enforce rules of hooks
    'react-hooks/rules-of-hooks': 'error',

    // Prevent missing props validation
    'react/prop-types': 'off', // Using TypeScript instead

    // Prevent missing displayName
    'react/display-name': 'warn',

    // Enforce consistent boolean attribute notation
    'react/jsx-boolean-value': ['error', 'never'],

    // Prevent duplicate props
    'react/jsx-no-duplicate-props': 'error',

    // Prevent usage of dangerous JSX props
    'react/no-danger': 'warn',

    // Prevent usage of findDOMNode
    'react/no-find-dom-node': 'error',

    // Prevent usage of deprecated methods
    'react/no-deprecated': 'error',

    // Prevent children for void DOM elements
    'react/void-dom-elements-no-children': 'error',

    // Enforce consistent function component definition
    'react/function-component-definition': [
      'error',
      {
        namedComponents: 'function-declaration',
        unnamedComponents: 'arrow-function',
      },
    ],

    // ==========================================
    // Accessibility (jsx-a11y) Overrides
    // ==========================================

    // autoFocus is intentional within dialogs and search inputs (WCAG dialog pattern)
    'jsx-a11y/no-autofocus': 'warn',

    // ==========================================
    // Code Style & Best Practices
    // ==========================================

    // No console statements (use proper logging)
    'no-console': [
      'warn',
      {
        allow: ['warn', 'error'],
      },
    ],

    // No debugger statements
    'no-debugger': 'error',

    // No alert/confirm/prompt
    'no-alert': 'error',

    // Prefer const over let
    'prefer-const': 'error',

    // No var declarations
    'no-var': 'error',

    // Require === and !==
    eqeqeq: ['error', 'always', { null: 'ignore' }],

    // No eval
    'no-eval': 'error',

    // No implied eval
    'no-implied-eval': 'error',

    // No with statement
    'no-with': 'error',

    // No nested ternary
    'no-nested-ternary': 'warn',

    // No unneeded ternary
    'no-unneeded-ternary': 'error',

    // Require curly braces for all control statements
    curly: ['error', 'all'],

    // Enforce default case in switch
    'default-case': 'error',

    // No empty functions
    '@typescript-eslint/no-empty-function': 'warn',

    // No magic numbers
    '@typescript-eslint/no-magic-numbers': [
      'off', // Can be too strict, enable if needed
      {
        ignoreEnums: true,
        ignoreNumericLiteralTypes: true,
        ignoreReadonlyClassProperties: true,
        ignore: [0, 1, -1],
      },
    ],

    // ==========================================
    // Security
    // ==========================================

    // No unsafe innerHTML
    'react/no-danger-with-children': 'error',

    // Detect unsafe targets
    'react/jsx-no-target-blank': ['error', { enforceDynamicLinks: 'always' }],

    // No script URL
    'react/jsx-no-script-url': 'error',

    // ==========================================
    // Prettier Integration
    // ==========================================
    'prettier/prettier': [
      'error',
      {
        endOfLine: 'lf', // Enforce LF line endings
      },
    ],
  },

  // ==========================================
  // File-Specific Overrides
  // ==========================================
  overrides: [
    // Test files - disable type-aware linting completely
    {
      files: [
        '**/*.test.ts',
        '**/*.test.tsx',
        '**/*.spec.ts',
        '**/*.spec.tsx',
        'src/test/**/*',
        'tests/**/*',
      ],
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        // No project - disables all type-aware rules
      },
      rules: {
        // Disable ALL TypeScript type-aware rules
        '@typescript-eslint/await-thenable': 'off',
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/no-unsafe-assignment': 'off',
        '@typescript-eslint/no-unsafe-member-access': 'off',
        '@typescript-eslint/no-unsafe-call': 'off',
        '@typescript-eslint/no-unsafe-return': 'off',
        '@typescript-eslint/no-unsafe-argument': 'off',
        '@typescript-eslint/no-floating-promises': 'off',
        '@typescript-eslint/require-await': 'off',
        '@typescript-eslint/no-misused-promises': 'off',
        '@typescript-eslint/explicit-function-return-type': 'off',
        '@typescript-eslint/consistent-type-imports': 'off',
        '@typescript-eslint/consistent-type-exports': 'off',
        '@typescript-eslint/prefer-nullish-coalescing': 'off',
        '@typescript-eslint/prefer-optional-chain': 'off',
        '@typescript-eslint/no-non-null-assertion': 'off',
        '@typescript-eslint/naming-convention': 'off',
        '@typescript-eslint/restrict-template-expressions': 'off',
        '@typescript-eslint/restrict-plus-operands': 'off',
        '@typescript-eslint/unbound-method': 'off',
        '@typescript-eslint/no-unnecessary-type-assertion': 'off',

        // Disable complexity rules for tests
        'max-lines-per-function': 'off',
        'max-nested-callbacks': 'off',
        'complexity': 'off',

        // Keep basic quality rules
        '@typescript-eslint/no-unused-vars': 'warn',
        'no-console': 'off',
      },
    },
    // Config files can use console and require
    {
      files: ['*.config.js', '*.config.ts', 'vite.config.ts', 'vitest.config.ts', '.eslintrc.cjs'],
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        // No project - config files don't need type checking
      },
      rules: {
        'no-console': 'off',
        '@typescript-eslint/no-var-requires': 'off',
        'import/no-default-export': 'off',
        // Disable type-aware rules for config files
        '@typescript-eslint/naming-convention': 'off',
        '@typescript-eslint/no-unsafe-assignment': 'off',
        '@typescript-eslint/no-unsafe-member-access': 'off',
        '@typescript-eslint/no-unsafe-call': 'off',
      },
    },
    // Electron main process — system boundary with many untyped Electron/Node APIs
    {
      files: ['electron/main.ts', 'electron/preload.ts'],
      rules: {
        'no-console': 'off',
        '@typescript-eslint/no-unsafe-assignment': 'off',
        '@typescript-eslint/no-unsafe-member-access': 'off',
        '@typescript-eslint/no-unsafe-call': 'off',
        '@typescript-eslint/no-unsafe-return': 'off',
        '@typescript-eslint/no-unsafe-argument': 'off',
        '@typescript-eslint/no-explicit-any': 'off',
      },
    },
    // Files with deep typing issues scheduled for refactoring in later sessions.
    // SyncManager: Session 7 (store separation) + Session 9 (campaign service)
    // CanvasManager: Session 10 (decomposition)
    // ResourceMonitor: needs typed browser API wrappers
    // ImageCropper: needs typed canvas API wrappers
    {
      files: [
        'src/components/Managers/SyncManager.tsx',
        'src/components/Canvas/CanvasManager.tsx',
        'src/components/ResourceMonitor.tsx',
        'src/components/Dialogs/ImageCropper.tsx',
      ],
      rules: {
        '@typescript-eslint/no-explicit-any': 'warn',
        '@typescript-eslint/no-unsafe-assignment': 'warn',
        '@typescript-eslint/no-unsafe-member-access': 'warn',
        '@typescript-eslint/no-unsafe-call': 'warn',
        '@typescript-eslint/no-unsafe-return': 'warn',
        '@typescript-eslint/no-unsafe-argument': 'warn',
      },
    },
    // Allow looser rules in docs/examples
    {
      files: ['docs/**/*'],
      rules: {
        'no-console': 'off',
        '@typescript-eslint/no-unused-vars': 'warn',
        '@typescript-eslint/explicit-function-return-type': 'off',
      },
    },
  ],
};
