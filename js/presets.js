export const PRESETS = [
  {
    id: 'anbn',
    name: 'Context-Free (Type-2): aⁿbⁿ',
    category: 'Context-Free',
    chomskyType: 'Type-2',
    startSymbol: 'S',
    targetString: 'aabb',
    description: 'Generates the classic non-regular language { aⁿbⁿ | n >= 0 }. Uses recursive nesting.',
    rules: [
      { lhs: 'S', rhs: 'aSb' },
      { lhs: 'S', rhs: 'ε' }
    ]
  },
  {
    id: 'balanced_parens',
    name: 'Context-Free (Type-2): Balanced Parentheses (Dyck Language)',
    category: 'Context-Free',
    chomskyType: 'Type-2',
    startSymbol: 'S',
    targetString: '()(())',
    description: 'Generates well-formed nested and sequential matching parentheses strings.',
    rules: [
      { lhs: 'S', rhs: '(S)S' },
      { lhs: 'S', rhs: 'ε' }
    ]
  },
  {
    id: 'palindromes',
    name: 'Context-Free (Type-2): Palindromes over {a, b}',
    category: 'Context-Free',
    chomskyType: 'Type-2',
    startSymbol: 'S',
    targetString: 'ababa',
    description: 'Generates all symmetric even and odd palindromic strings over the alphabet {a, b}.',
    rules: [
      { lhs: 'S', rhs: 'aSa' },
      { lhs: 'S', rhs: 'bSb' },
      { lhs: 'S', rhs: 'a' },
      { lhs: 'S', rhs: 'b' },
      { lhs: 'S', rhs: 'ε' }
    ]
  },
  {
    id: 'regular_ab',
    name: 'Regular (Type-3): Alternating (ab)⁺',
    category: 'Regular',
    chomskyType: 'Type-3',
    startSymbol: 'S',
    targetString: 'abab',
    description: 'Strictly right-linear regular grammar generating alternating "ab" tokens.',
    rules: [
      { lhs: 'S', rhs: 'aA' },
      { lhs: 'A', rhs: 'bS' },
      { lhs: 'A', rhs: 'b' }
    ]
  },
  {
    id: 'anbncn',
    name: 'Context-Sensitive (Type-1): aⁿbⁿcⁿ',
    category: 'Context-Sensitive',
    chomskyType: 'Type-1',
    startSymbol: 'S',
    targetString: 'aabbcc',
    description: 'Textbook non-contracting Context-Sensitive Grammar generating { aⁿbⁿcⁿ | n >= 1 } using contextual swapping.',
    rules: [
      { lhs: 'S', rhs: 'aSBC' },
      { lhs: 'S', rhs: 'aBC' },
      { lhs: 'CB', rhs: 'BC' },
      { lhs: 'aB', rhs: 'ab' },
      { lhs: 'bB', rhs: 'bb' },
      { lhs: 'bC', rhs: 'bc' },
      { lhs: 'cC', rhs: 'cc' }
    ]
  },
  {
    id: 'semi_thue_increment',
    name: 'Semi-Thue System (Type-0): Binary Incrementer',
    category: 'Semi-Thue / Type-0',
    chomskyType: 'Type-0',
    startSymbol: '>1011+',
    targetString: '1100',
    description: 'Simulates binary addition of 1 to "1011" (11 in decimal) producing "1100" (12) via ripple-carry string rewriting.',
    rules: [
      { lhs: '0+', rhs: '1' },
      { lhs: '1+', rhs: '+0' },
      { lhs: '>+', rhs: '>1' },
      { lhs: '>', rhs: 'ε' }
    ]
  },
  {
    id: 'semi_thue_reversal',
    name: 'Semi-Thue System (Type-0): String Reversal with Marker',
    category: 'Semi-Thue / Type-0',
    chomskyType: 'Type-0',
    startSymbol: '#abc',
    targetString: 'cba',
    description: 'Rewrites a marked string "#abc" character-by-character into reverse order "cba".',
    rules: [
      { lhs: '#a', rhs: 'A#' },
      { lhs: '#b', rhs: 'B#' },
      { lhs: '#c', rhs: 'C#' },
      { lhs: 'A#', rhs: '#A' },
      { lhs: 'B#', rhs: '#B' },
      { lhs: 'C#', rhs: '#C' },
      { lhs: '#', rhs: 'ε' },
      { lhs: 'A', rhs: 'a' },
      { lhs: 'B', rhs: 'b' },
      { lhs: 'C', rhs: 'c' }
    ]
  }
];
