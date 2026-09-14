/**
 * Chomsky Grammar & Semi-Thue System - Grammar Model & Classification
 * File: js/grammar.js
 */

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
    // Normalize epsilon representations
    const r = (rhs !== undefined && rhs !== null) ? String(rhs).trim() : '';
    this.rhs = (r === 'ε' || r === 'eps' || r === 'epsilon' || r === 'λ' || r === 'lambda') ? '' : r;
  }

  /** Display representation for RHS */
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

  /**
   * Identifies non-terminals: By standard formal language convention,
   * uppercase ASCII characters [A-Z] are treated as non-terminals.
   * If startSymbol contains characters, those are also non-terminals.
   */
  getNonTerminals() {
    const nonTerminals = new Set();
    // Any uppercase character in LHS or RHS
    for (const rule of this.rules) {
      for (const char of rule.lhs) {
        if (/[A-Z]/.test(char)) nonTerminals.add(char);
      }
      for (const char of rule.rhs) {
        if (/[A-Z]/.test(char)) nonTerminals.add(char);
      }
    }
    // Start symbol
    for (const char of this.startSymbol) {
      if (/[A-Z]/.test(char)) nonTerminals.add(char);
    }
    // Default fallback: if no uppercase found, all LHS symbols are non-terminals
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

  /**
   * Check if grammar rules are monotonic (non-contracting, |LHS| <= |RHS|).
   * Used for length-based search pruning.
   */
  isLengthNonDecreasing() {
    if (this.rules.length === 0) return true;
    for (const rule of this.rules) {
      // Epsilon productions contract length (|LHS| >= 1 > |RHS|=0)
      if (rule.rhs.length < rule.lhs.length) {
        return false;
      }
    }
    return true;
  }

  /**
   * Comprehensive classification of the grammar according to Chomsky Hierarchy:
   * - Type 3: Regular Grammar (Right-Linear or Left-Linear)
   * - Type 2: Context-Free Grammar (A -> gamma, |A| = 1, A in V_N)
   * - Type 1: Context-Sensitive / Monotonic (|alpha| <= |beta|, alpha contains non-terminal)
   * - Type 0: Unrestricted / Semi-Thue (alpha -> beta, alpha contains non-terminal or general string rewriting)
   */
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

    // Check if valid production system: LHS cannot be empty
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

    // Step 1: Check Type 2 (Context-Free) condition:
    // Every rule LHS must consist of exactly 1 non-terminal.
    let isContextFree = true;
    for (const rule of this.rules) {
      const isSingleNonTerminal = (rule.lhs.length === 1 && nonTerminals.has(rule.lhs));
      if (!isSingleNonTerminal) {
        isContextFree = false;
        details.push(`Rule "${rule.toString()}" has LHS "${rule.lhs}" (length ${rule.lhs.length}), not a single non-terminal.`);
        break;
      }
    }

    // Step 2: Check Type 3 (Regular) conditions if Context-Free:
    // A regular grammar must be either entirely Right-Linear or entirely Left-Linear.
    // Right-Linear: A -> wB or A -> w, where w is terminal string, B is single non-terminal.
    // Left-Linear:  A -> Bw or A -> w, where w is terminal string, B is single non-terminal.
    let isType3 = false;
    let isRightLinear = isContextFree;
    let isLeftLinear = isContextFree;

    if (isContextFree) {
      for (const rule of this.rules) {
        const rhs = rule.rhs;
        if (rhs === '') {
          // Epsilon is allowed in regular grammars
          continue;
        }

        // Count non-terminals in RHS
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
          // For right-linear: NT must be at the very end
          if (ntPos !== rhs.length - 1) {
            isRightLinear = false;
          }
          // For left-linear: NT must be at the very start
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
        description: `Regular Grammar (${form}). Generates regular languages recognized by Finite State Automata (DFA/NFA).`,
        details: [
          `All rules have a single non-terminal on LHS.`,
          `Rules follow ${form} structure (A → wB or A → w).`,
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
        description: 'Context-Free Grammar (CFG). Generates context-free languages recognized by Pushdown Automata (PDA).',
        details: [
          'Every rule LHS is a single non-terminal symbol.',
          'Contains branching / nested patterns not conforming to linear regular constraints.',
          'Can be parsed via CYK or Earley algorithms in polynomial time O(n³).'
        ],
        isRightLinear: false,
        isLeftLinear: false,
        isContextFree: true,
        isContextSensitive: false
      };
    }

    // Step 3: Check Type 1 (Context-Sensitive / Non-contracting)
    // Constraint: |LHS| <= |RHS| for all rules, and LHS contains at least one non-terminal.
    // Exception: S -> epsilon is allowed if S does not appear on RHS of any rule.
    let isContextSensitive = true;
    const startSymbolInRhs = this.rules.some(r => r.rhs.includes(this.startSymbol));

    for (const rule of this.rules) {
      // LHS must contain at least one non-terminal
      const lhsHasNT = Array.from(rule.lhs).some(c => nonTerminals.has(c));
      if (!lhsHasNT) {
        isContextSensitive = false;
        details.push(`Rule "${rule.toString()}" LHS contains no non-terminals.`);
        break;
      }

      // Non-contracting check: |LHS| <= |RHS|
      if (rule.lhs.length > rule.rhs.length) {
        // Exception: S -> epsilon allowed only if S does not appear on any RHS
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
        description: 'Context-Sensitive Grammar (CSG / Monotonic). Recognized by Linear-Bounded Automata (LBA).',
        details: [
          'All rules are non-contracting (|LHS| ≤ |RHS|).',
          'Every LHS contains at least one non-terminal symbol.',
          'Word recognition is decidable (PSPACE-complete).'
        ],
        isRightLinear: false,
        isLeftLinear: false,
        isContextFree: false,
        isContextSensitive: true
      };
    }

    // Otherwise Type 0: Unrestricted / Semi-Thue system
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
