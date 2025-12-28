export interface AppliesToOperator {
  symbol: string;
  alternatives?: string[]; // e.g., 'and' -> ['&&']
  description: string;
  example: string;
  category: 'comparison' | 'logical' | 'grouping';
}

export const APPLIES_TO_OPERATORS: AppliesToOperator[] = [
  // Comparison operators
  {
    symbol: '==',
    description: 'Equal to - checks if two values are equal',
    example: 'getPropValue("version") == "2.0"',
    category: 'comparison',
  },
  {
    symbol: '!=',
    description: 'Not equal to - checks if two values are not equal',
    example: 'getPropValue("status") != "down"',
    category: 'comparison',
  },
  {
    symbol: '>',
    description: 'Greater than - checks if left value is greater than right value',
    example: 'getCollectorVersion() > 30000',
    category: 'comparison',
  },
  {
    symbol: '>=',
    description: 'Greater than or equal to - checks if left value is greater than or equal to right value',
    example: 'getCollectorVersion() >= 30000',
    category: 'comparison',
  },
  {
    symbol: '<',
    description: 'Less than - checks if left value is less than right value',
    example: 'sum(1, 2, 3) < 10',
    category: 'comparison',
  },
  {
    symbol: '<=',
    description: 'Less than or equal to - checks if left value is less than or equal to right value',
    example: 'getCollectorVersion() <= 30000',
    category: 'comparison',
  },
  {
    symbol: '=~',
    description: 'Regular expression equality (case insensitive) - matches pattern',
    example: 'getPropValue("hostname") =~ "web-.*"',
    category: 'comparison',
  },
  {
    symbol: '!~',
    description: 'Regular expression inequality (case insensitive) - does not match pattern',
    example: 'getPropValue("hostname") !~ "test-.*"',
    category: 'comparison',
  },
  
  // Logical operators
  {
    symbol: 'and',
    alternatives: ['&&'],
    description: 'Logical AND - both conditions must be true',
    example: 'isLinux() && hasCategory("Production")',
    category: 'logical',
  },
  {
    symbol: '&&',
    alternatives: ['and'],
    description: 'Logical AND - both conditions must be true (alternative to "and")',
    example: 'isLinux() && hasCategory("Production")',
    category: 'logical',
  },
  {
    symbol: 'or',
    alternatives: ['||'],
    description: 'Logical OR - at least one condition must be true',
    example: 'isWindows() || isLinux()',
    category: 'logical',
  },
  {
    symbol: '||',
    alternatives: ['or'],
    description: 'Logical OR - at least one condition must be true (alternative to "or")',
    example: 'isWindows() || isLinux()',
    category: 'logical',
  },
  {
    symbol: '!',
    description: 'Logical NOT - negates the condition',
    example: '!isCollectorDevice()',
    category: 'logical',
  },
  
  // Grouping operators
  {
    symbol: '(',
    description: 'Opening parenthesis - groups expressions',
    example: '(isLinux() || isWindows()) && hasCategory("Production")',
    category: 'grouping',
  },
  {
    symbol: ')',
    description: 'Closing parenthesis - closes expression group',
    example: '(isLinux() || isWindows()) && hasCategory("Production")',
    category: 'grouping',
  },
];

// Get operator by symbol (case-insensitive for text operators)
export function getAppliesToOperator(symbol: string): AppliesToOperator | undefined {
  return APPLIES_TO_OPERATORS.find(
    op => op.symbol.toLowerCase() === symbol.toLowerCase() ||
          op.alternatives?.some(alt => alt.toLowerCase() === symbol.toLowerCase())
  );
}

// Get all operator symbols for autocomplete
export function getAppliesToOperatorSymbols(): string[] {
  return APPLIES_TO_OPERATORS.map(op => op.symbol);
}

// Get operators by category
export function getOperatorsByCategory(category: AppliesToOperator['category']): AppliesToOperator[] {
  return APPLIES_TO_OPERATORS.filter(op => op.category === category);
}


