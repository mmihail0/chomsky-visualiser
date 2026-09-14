export const ChomskyType = {
  TYPE_3: 'Type-3 (Regular)',
  TYPE_2: 'Type-2 (Context-Free)',
  TYPE_1: 'Type-1 (Context-Sensitive)',
  TYPE_0: 'Type-0 (Unrestricted / Semi-Thue)'
};

export class RuleModel {
  constructor(lhs, rhs, id = null) {
    this.id = id || 'rule_' + Math.random().toString(36).substring(2, 9);
    this.lhs = (lhs !== undefined && lhs !== null) ? String(lhs).trim() : '';
    const r = (rhs !== undefined && rhs !== null) ? String(rhs).trim() : '';
    this.rhs = (r === 'ε' || r === 'eps' || r === 'epsilon' || r === 'λ' || r === 'lambda') ? '' : r;
  }

  get rhsDisplay() {
    return this.rhs === '' ? 'ε' : this.rhs;
  }

  toString() {
    return `${this.lhs} → ${this.rhsDisplay}`;
  }
}

export class GrammarModel {
  constructor(startSymbol = 'S', rules = []) {
    this.startSymbol = startSymbol.trim();
    this.rules = rules;
  }

  getNonTerminals() {
    const nonTerminals = new Set();
    for (const rule of this.rules) {
      for (const char of rule.lhs) {
        if (/[A-Z]/.test(char)) nonTerminals.add(char);
      }
      for (const char of rule.rhs) {
        if (/[A-Z]/.test(char)) nonTerminals.add(char);
      }
    }
    for (const char of this.startSymbol) {
      if (/[A-Z]/.test(char)) nonTerminals.add(char);
    }
    if (nonTerminals.size === 0 && this.rules.length > 0) {
      for (const rule of this.rules) {
        for (const char of rule.lhs) {
          nonTerminals.add(char);
        }
      }
    }
    return nonTerminals;
  }

  getTerminals() {
    const nonTerminals = this.getNonTerminals();
    const terminals = new Set();
    for (const rule of this.rules) {
      for (const char of rule.lhs) {
        if (!nonTerminals.has(char)) terminals.add(char);
      }
      for (const char of rule.rhs) {
        if (!nonTerminals.has(char)) terminals.add(char);
      }
    }
    return terminals;
  }

  isLengthNonDecreasing() {
    if (this.rules.length === 0) return true;
    for (const rule of this.rules) {
      if (rule.rhs.length < rule.lhs.length) {
        return false;
      }
    }
    return true;
  }

  classify() {
    if (!this.rules || this.rules.length === 0) {
      return {
        type: 3,
        typeName: ChomskyType.TYPE_3,
        level: 'Type-3',
        description: 'Empty rule set (Trivially Regular).',
        details: ['No production rules provided.'],
        isRightLinear: true,
        isLeftLinear: true,
        isContextFree: true,
        isContextSensitive: true
      };
    }

    const nonTerminals = this.getNonTerminals();
    const details = [];

    for (const rule of this.rules) {
      if (!rule.lhs || rule.lhs.length === 0) {
        return {
          type: 0,
          typeName: ChomskyType.TYPE_0,
          level: 'Type-0',
          description: 'Invalid rule with empty LHS detected. Classified as Unrestricted / Semi-Thue.',
          details: ['LHS must not be empty.']
        };
      }
    }

    let isContextFree = true;
    for (const rule of this.rules) {
      const isSingleNonTerminal = (rule.lhs.length === 1 && nonTerminals.has(rule.lhs));
      if (!isSingleNonTerminal) {
        isContextFree = false;
        details.push(`Rule "${rule.toString()}" has LHS "${rule.lhs}" (length ${rule.lhs.length}), not a single non-terminal.`);
        break;
      }
    }

    let isType3 = false;
    let isRightLinear = isContextFree;
    let isLeftLinear = isContextFree;

    if (isContextFree) {
      for (const rule of this.rules) {
        const rhs = rule.rhs;
        if (rhs === '') {
          continue;
        }

        const rhsNTs = [];
        for (let i = 0; i < rhs.length; i++) {
          if (nonTerminals.has(rhs[i])) {
            rhsNTs.push({ char: rhs[i], index: i });
          }
        }

        if (rhsNTs.length > 1) {
          isRightLinear = false;
          isLeftLinear = false;
          break;
        }

        if (rhsNTs.length === 1) {
          const ntPos = rhsNTs[0].index;
          if (ntPos !== rhs.length - 1) {
            isRightLinear = false;
          }
          if (ntPos !== 0) {
            isLeftLinear = false;
          }
        }
      }

      if (isRightLinear || isLeftLinear) {
        isType3 = true;
      }
    }

    if (isType3) {
      const form = isRightLinear && isLeftLinear ? 'Right-Linear & Left-Linear' : (isRightLinear ? 'Right-Linear' : 'Left-Linear');
      return {
        type: 3,
        typeName: ChomskyType.TYPE_3,
        level: 'Type-3',
        description: `Regular Grammar (${form}). Generates regular languages recognised by Finite State Automata (DFA/NFA).`,
        details: [
          `All rules have a single non-terminal on LHS.`,
          `Rules follow ${form} structure (A -> wB or A -> w).`,
          `Can be parsed linearly in O(n) time.`
        ],
        isRightLinear,
        isLeftLinear,
        isContextFree: true,
        isContextSensitive: true
      };
    }

    if (isContextFree) {
      return {
        type: 2,
        typeName: ChomskyType.TYPE_2,
        level: 'Type-2',
        description: 'Context-Free Grammar (CFG). Generates context-free languages recognised by Pushdown Automata (PDA).',
        details: [
          'Every rule LHS is a single non-terminal symbol.',
          'Contains branching / nested patterns not conforming to linear regular constraints.',
          'Can be parsed via CYK or Earley algorithms in polynomial time O(n^3).'
        ],
        isRightLinear: false,
        isLeftLinear: false,
        isContextFree: true,
        isContextSensitive: false
      };
    }

    let isContextSensitive = true;
    const startSymbolInRhs = this.rules.some(r => r.rhs.includes(this.startSymbol));

    for (const rule of this.rules) {
      const lhsHasNT = Array.from(rule.lhs).some(c => nonTerminals.has(c));
      if (!lhsHasNT) {
        isContextSensitive = false;
        details.push(`Rule "${rule.toString()}" LHS contains no non-terminals.`);
        break;
      }

      if (rule.lhs.length > rule.rhs.length) {
        if (rule.lhs === this.startSymbol && rule.rhs === '' && !startSymbolInRhs) {
          continue;
        }
        isContextSensitive = false;
        details.push(`Rule "${rule.toString()}" contracts length (${rule.lhs.length} > ${rule.rhs.length}).`);
        break;
      }
    }

    if (isContextSensitive) {
      return {
        type: 1,
        typeName: ChomskyType.TYPE_1,
        level: 'Type-1',
        description: 'Context-Sensitive Grammar (CSG / Monotonic). Recognised by Linear-Bounded Automata (LBA).',
        details: [
          'All rules are non-contracting (|LHS| <= |RHS|).',
          'Every LHS contains at least one non-terminal symbol.',
          'Word recognition is decidable (PSPACE-complete).'
        ],
        isRightLinear: false,
        isLeftLinear: false,
        isContextFree: false,
        isContextSensitive: true
      };
    }

    return {
      type: 0,
      typeName: ChomskyType.TYPE_0,
      level: 'Type-0',
      description: 'Type-0 Unrestricted Grammar / Semi-Thue System. Computationally equivalent to a Turing Machine.',
      details: [
        'No restriction on rule lengths or context structure.',
        'Length contracting rules allow arbitrary string replacement.',
        'Word problem is undecidable in the general case (equivalent to Halting Problem).'
      ],
      isRightLinear: false,
      isLeftLinear: false,
      isContextFree: false,
      isContextSensitive: false
    };
  }
}
