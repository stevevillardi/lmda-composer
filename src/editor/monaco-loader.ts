import { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';

// Configure Monaco environment to disable web workers
// This is required for Chrome extensions due to CSP restrictions that block worker-src
// We return a mock Worker object instead of null to prevent "postMessage on null" errors
self.MonacoEnvironment = {
  getWorker: function () {
    // Return a mock worker that satisfies Monaco's interface
    // without triggering CSP errors or null reference errors
    return {
      postMessage: () => {},
      onmessage: null,
      onerror: null,
      terminate: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => true,
    } as unknown as Worker;
  },
};

// Configure Monaco to use the bundled version instead of CDN
// This is required for Chrome extensions due to CSP restrictions
loader.config({ monaco });

// Register Groovy language (Monaco doesn't have built-in support)
// We'll define a Groovy language based on Java with Groovy-specific additions
loader.init().then((monaco) => {
  // Register the Groovy language
  monaco.languages.register({ id: 'groovy' });

  // Define Groovy tokens (based on Java with Groovy additions)
  monaco.languages.setMonarchTokensProvider('groovy', {
    defaultToken: '',
    tokenPostfix: '.groovy',

    keywords: [
      'abstract', 'as', 'assert', 'boolean', 'break', 'byte', 'case', 'catch',
      'char', 'class', 'const', 'continue', 'def', 'default', 'do', 'double',
      'else', 'enum', 'extends', 'false', 'final', 'finally', 'float', 'for',
      'goto', 'if', 'implements', 'import', 'in', 'instanceof', 'int', 'interface',
      'long', 'native', 'new', 'null', 'package', 'private', 'protected', 'public',
      'return', 'short', 'static', 'strictfp', 'super', 'switch', 'synchronized',
      'this', 'throw', 'throws', 'trait', 'transient', 'true', 'try', 'void',
      'volatile', 'while', 'with'
    ],

    typeKeywords: [
      'boolean', 'byte', 'char', 'double', 'float', 'int', 'long', 'short', 'void',
      'String', 'Integer', 'Long', 'Double', 'Float', 'Boolean', 'List', 'Map', 'Set',
      'Object', 'Class', 'Closure', 'GString'
    ],

    operators: [
      '=', '>', '<', '!', '~', '?', ':', '==', '<=', '>=', '!=', '===', '!==',
      '&&', '||', '++', '--', '+', '-', '*', '/', '&', '|', '^', '%', '<<',
      '>>', '>>>', '+=', '-=', '*=', '/=', '&=', '|=', '^=', '%=', '<<=',
      '>>=', '>>>=', '->', '*.', '?.', '?:', '<=>', '=~', '==~', '**', '**='
    ],

    symbols: /[=><!~?:&|+\-*\/\^%]+/,

    escapes: /\\(?:[abfnrtv\\"']|x[0-9A-Fa-f]{1,4}|u[0-9A-Fa-f]{4}|U[0-9A-Fa-f]{8})/,

    tokenizer: {
      root: [
        // Identifiers and keywords
        [/[a-zA-Z_$][\w$]*/, {
          cases: {
            '@typeKeywords': 'type.identifier',
            '@keywords': 'keyword',
            '@default': 'identifier'
          }
        }],

        // Whitespace
        { include: '@whitespace' },

        // Delimiters and operators
        [/[{}()\[\]]/, '@brackets'],
        [/[<>](?!@symbols)/, '@brackets'],
        [/@symbols/, {
          cases: {
            '@operators': 'operator',
            '@default': ''
          }
        }],

        // Numbers
        [/\d*\.\d+([eE][\-+]?\d+)?[fFdD]?/, 'number.float'],
        [/0[xX][0-9a-fA-F]+[lL]?/, 'number.hex'],
        [/\d+[lLgG]?/, 'number'],

        // Delimiter: after number because of .\d floats
        [/[;,.]/, 'delimiter'],

        // Strings
        [/"""/, 'string', '@multistring'],
        [/"([^"\\]|\\.)*$/, 'string.invalid'],
        [/"/, 'string', '@string'],
        [/'([^'\\]|\\.)*$/, 'string.invalid'],
        [/'/, 'string', '@stringsingle'],

        // GStrings with interpolation
        [/\$\{/, 'string.interpolation', '@interpolation'],
        [/\$[a-zA-Z_]\w*/, 'string.interpolation'],

        // Characters
        [/'[^\\']'/, 'string'],
        [/(')(@escapes)(')/, ['string', 'string.escape', 'string']],
        [/'/, 'string.invalid']
      ],

      whitespace: [
        [/[ \t\r\n]+/, ''],
        [/\/\*/, 'comment', '@comment'],
        [/\/\/.*$/, 'comment'],
      ],

      comment: [
        [/[^\/*]+/, 'comment'],
        [/\*\//, 'comment', '@pop'],
        [/[\/*]/, 'comment']
      ],

      string: [
        [/[^\\"$]+/, 'string'],
        [/\$\{/, 'string.interpolation', '@interpolation'],
        [/\$[a-zA-Z_]\w*/, 'string.interpolation'],
        [/@escapes/, 'string.escape'],
        [/\\./, 'string.escape.invalid'],
        [/"/, 'string', '@pop']
      ],

      stringsingle: [
        [/[^\\']+/, 'string'],
        [/@escapes/, 'string.escape'],
        [/\\./, 'string.escape.invalid'],
        [/'/, 'string', '@pop']
      ],

      multistring: [
        [/[^\\"$]+/, 'string'],
        [/\$\{/, 'string.interpolation', '@interpolation'],
        [/\$[a-zA-Z_]\w*/, 'string.interpolation'],
        [/@escapes/, 'string.escape'],
        [/\\./, 'string.escape.invalid'],
        [/"""/, 'string', '@pop'],
        [/"/, 'string']
      ],

      interpolation: [
        [/[^{}]+/, 'string.interpolation'],
        [/\{/, 'string.interpolation', '@push'],
        [/\}/, 'string.interpolation', '@pop']
      ]
    }
  });

  // Set Groovy language configuration
  monaco.languages.setLanguageConfiguration('groovy', {
    comments: {
      lineComment: '//',
      blockComment: ['/*', '*/']
    },
    brackets: [
      ['{', '}'],
      ['[', ']'],
      ['(', ')']
    ],
    autoClosingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '"', close: '"', notIn: ['string'] },
      { open: "'", close: "'", notIn: ['string', 'comment'] },
    ],
    surroundingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '"', close: '"' },
      { open: "'", close: "'" },
    ],
    folding: {
      markers: {
        start: /^\s*\/\/\s*#?region\b/,
        end: /^\s*\/\/\s*#?endregion\b/
      }
    }
  });
});

export { monaco };
