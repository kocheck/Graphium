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
    // TODO: Upgrade to 'error' after migrating existing 'any' types
    '@typescript-eslint/no-explicit-any': 'warn',

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
    // TODO: Upgrade to 'error' after wrapping async event handlers
    '@typescript-eslint/no-misused-promises': 'warn',

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
    // TODO: Upgrade to 'error' after adding proper types to JSON parsing and IPC calls
    '@typescript-eslint/no-unsafe-member-access': 'warn',

    // No unsafe calls
    '@typescript-eslint/no-unsafe-call': 'warn',

    // No unsafe assignment
    '@typescript-eslint/no-unsafe-assignment': 'warn',

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
    // plan 004 palette ratchet: every file migrated onto the primitives is appended here and
    // may never regain a raw Tailwind palette class. Plan 006b extends it to the whole tree.
    {
      files: [
        'src/components/Tooltip.tsx',
        'src/components/ToggleSwitch.tsx',
        'src/components/CollapsibleSection.tsx',
        'src/components/ConfirmDialog.tsx',
        'src/components/MapSettingsSheet.tsx',
        'src/components/AssetLibrary/AddToLibraryDialog.tsx',
        'src/components/ImageCropper.tsx',
        'src/components/SessionConsole/SessionConsoleEditorSheet.tsx',
        'src/components/SessionConsole/SessionConsoleSettingsSheet.tsx',
        'src/components/MobileSidebarDrawer.tsx',
        'src/components/MobileBottomSheet.tsx',
        'src/components/AssetLibrary/LibraryManager.tsx',
        'src/components/AssetLibrary/TokenMetadataEditor.tsx',
        'src/components/UpdateManager.tsx',
        'src/components/AboutModal.tsx',
        'src/components/DungeonGeneratorDialog.tsx',
        'src/components/Toolbar.tsx',
        'src/components/MobileToolbar.tsx',
        'src/components/SessionConsole/SessionConsolePanel.tsx',
        'src/components/SessionConsole/TrackGroupList.tsx',
        'src/components/SessionConsole/sessionConsoleSettingsSections.tsx',
        'src/components/SessionConsole/SessionConsoleBoard.tsx',
        'src/components/SessionConsole/ImageSetBoard.tsx',
        'src/components/SessionConsole/SessionConsoleMasterBar.tsx',
        'src/components/Sidebar.tsx',
        'src/components/MapNavigator.tsx',
        'src/components/QuickTokenSidebar.tsx',
      ],
      rules: {
        'no-restricted-syntax': [
          'error',
          {
            selector:
              'Literal[value=/\\b(bg|text|border|ring)-(white|black|slate|gray|zinc|neutral|blue|red|green|amber|orange|yellow|purple|indigo)(-[0-9]{2,3})?\\b/]',
            message: 'Hardcoded Tailwind palette class; use an --app-* token or a primitive.',
          },
          {
            selector:
              'TemplateElement[value.raw=/\\b(bg|text|border|ring)-(white|black|slate|gray|zinc|neutral|blue|red|green|amber|orange|yellow|purple|indigo)(-[0-9]{2,3})?\\b/]',
            message: 'Hardcoded Tailwind palette class; use an --app-* token or a primitive.',
          },
        ],
      },
    },
    // Main entry points can have console
    {
      files: ['electron/main.ts', 'electron/preload.ts'],
      rules: {
        'no-console': 'off',
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
    // Plan 003: shadcn-generated primitives. They have no consumers until plan 004 (unused
    // exports), export non-component helpers (buttonVariants), and omit return types.
    {
      files: ['src/components/ui/**/*.tsx', 'src/lib/utils.ts'],
      excludedFiles: ['src/components/ui/**/*.test.tsx'],
      rules: {
        'import/no-unused-modules': 'off',
        'prettier/prettier': 'off',
        'react-refresh/only-export-components': 'off',
        '@typescript-eslint/explicit-function-return-type': 'off',
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              {
                group: [
                  '../*',
                  '../../*',
                  '@/store/*',
                  '@/utils/*',
                  '@/components/*',
                  '@/services/*',
                  '@components/*',
                  '@store/*',
                  '@utils/*',
                ],
                message:
                  'Primitives import only react, @radix-ui/*, class-variance-authority, lucide-react, @remixicon/react, ./siblings and @/lib/utils.',
              },
            ],
          },
        ],
      },
    },
  ],
};
