import fs from 'node:fs';
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import betterTailwindcss from 'eslint-plugin-better-tailwindcss';

const betterTailwindcssSettings = {
  // tailwindcss 4: the path to the entry file of the css based tailwind config (eg: `src/styles/globals.css`)
  entryPoint: 'src/styles/globals.css',
  // tailwindcss 3: the path to the tailwind config file (eg: `tailwind.config.js`)
  ...(fs.existsSync('tailwind.config.js') ? { tailwindConfig: 'tailwind.config.js' } : {}),
};

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'coverage/**',
      'docs/**',
      'versions/**',
      'node_modules/**',
      'ref-docs/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    ...betterTailwindcss.configs.recommended,
    rules: {
      // Groovy/PowerShell snippets often contain escape sequences that are valid for those languages
      // but look "useless" to ESLint when embedded in JS strings.
      'no-useless-escape': 'off',

      // Prefer the TS-aware rule and allow intentionally-unused variables prefixed with "_".
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
    },
    settings: {
      'better-tailwindcss': betterTailwindcssSettings,
    },
  }
);

