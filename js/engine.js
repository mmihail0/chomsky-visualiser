/**
 * Chomsky Grammar & Semi-Thue System - BFS Derivation Engine
 * File: js/engine.js
 */

export const EngineStatus = {
  IDLE: 'IDLE',
  SEARCHING: 'SEARCHING',
  PAUSED: 'PAUSED',
  SUCCESS: 'SUCCESS',
  FAILURE: 'FAILURE'
};

export class Deque {
  constructor() {
    this.elements = [];
    this.head = 0;
  }

  push(item) {
    this.elements.push(item);
  }

  shift() {
    if (this.head >= this.elements.length) return undefined;
    const item = this.elements[this.head];
    this.head++;
    // Periodically clean up memory when half consumed
    if (this.head > 500 && this.head > (this.elements.length / 2)) {
      this.elements = this.elements.slice(this.head);
      this.head = 0;
    }
    return item;
  }

  peek() {
    if (this.head >= this.elements.length) return undefined;
    return this.elements[this.head];
  }

  get length() {
    return this.elements.length - this.head;
  }

  clear() {
    this.elements = [];
    this.head = 0;
  }

  toArray() {
    return this.elements.slice(this.head);
  }
}

export class BFSDerivationEngine {
  constructor(options = {}) {
    this.maxDepth = options.maxDepth ?? 15;
    this.maxVisitedNodes = options.maxVisitedNodes ?? 1000;
    this.enableLengthPruning = options.enableLengthPruning ?? true;

    // Search state
    this.status = EngineStatus.IDLE;
    this.failureReason = null;
    this.grammar = null;
    this.targetString = '';
    this.queue = new Deque();
    this.visited = new Set();
    this.nodesMap = new Map(); // id -> node
    this.nodeCounter = 0;
    this.rootNode = null;
    this.targetNode = null;
    this.startTime = 0;
    this.elapsedTime = 0;
    this.isMonotonic = false;

    // Animation / Runner control
    this.timerId = null;
    this.isRunningAsync = false;

    // Listeners
    this.onStateChange = null;
    this.onMetricsChange = null;
    this.onTreeUpdate = null;
  }

  configure(options) {
    if (options.maxDepth !== undefined) this.maxDepth = Number(options.maxDepth);
    if (options.maxVisitedNodes !== undefined) this.maxVisitedNodes = Number(options.maxVisitedNodes);
    if (options.enableLengthPruning !== undefined) this.enableLengthPruning = Boolean(options.enableLengthPruning);
  }

  /**
   * Initializes a new search run with given grammar and target
   */
  init(grammar, targetString) {
    this.reset();

    this.grammar = grammar;
    this.targetString = String(targetString ?? '');
    this.isMonotonic = grammar.isLengthNonDecreasing();

    const rootId = `node_${this.nodeCounter++}`;
    const initialString = grammar.startSymbol;

    this.rootNode = {
      id: rootId,
      currentString: initialString,
      depth: 0,
      parentId: null,
      ruleApplied: null,
      matchIndex: -1,
      matchLength: 0,
      path: [
        {
          step: 0,
          currentString: initialString,
          ruleString: 'Initial Axiom',
          lhs: '',
          rhs: '',
          matchIndex: -1,
          matchLength: 0
        }
      ],
      isTarget: initialString === this.targetString,
      isPruned: false,
      pruneReason: null,
      children: []
    };

    this.nodesMap.set(rootId, this.rootNode);
    this.visited.add(initialString);
    this.queue.push(this.rootNode);

    this.startTime = performance.now();
    this.elapsedTime = 0;

    if (this.rootNode.isTarget) {
      this.status = EngineStatus.SUCCESS;
      this.targetNode = this.rootNode;
    } else {
      this.status = EngineStatus.IDLE;
    }

    this._notifyUpdate();
  }

  reset() {
    if (this.timerId) {
      cancelAnimationFrame(this.timerId);
      clearTimeout(this.timerId);
      this.timerId = null;
    }
    this.isRunningAsync = false;
    this.status = EngineStatus.IDLE;
    this.failureReason = null;
    this.queue.clear();
    this.visited.clear();
    this.nodesMap.clear();
    this.nodeCounter = 0;
    this.rootNode = null;
    this.targetNode = null;
    this.elapsedTime = 0;
  }

  /**
   * Executes a single BFS step: pops next node from queue, expands children.
   * Returns { done: boolean, success: boolean, nodeProcessed: node, newNodes: [] }
   */
  step() {
    if (this.status === EngineStatus.SUCCESS || this.status === EngineStatus.FAILURE) {
      return { done: true, success: this.status === EngineStatus.SUCCESS };
    }

    if (this.queue.length === 0) {
      this.status = EngineStatus.FAILURE;
      this.failureReason = 'Search queue exhausted. Target string is unreachable with these production rules.';
      this._updateElapsed();
      this._notifyUpdate();
      return { done: true, success: false, reason: this.failureReason };
    }

    this.status = EngineStatus.SEARCHING;
    this._updateElapsed();

    const currentNode = this.queue.shift();
    const newChildren = [];

    // Check if target reached already (e.g. from root)
    if (currentNode.currentString === this.targetString) {
      this.status = EngineStatus.SUCCESS;
      this.targetNode = currentNode;
      this._notifyUpdate();
      return { done: true, success: true, targetNode: currentNode };
    }

    // Check max depth pruning for this node's expansion
    if (currentNode.depth >= this.maxDepth) {
      // Cannot expand children past max depth
      currentNode.isPruned = true;
      currentNode.pruneReason = `Depth limit (${this.maxDepth}) reached`;
      this._notifyUpdate();
      return { done: false, success: false, nodeProcessed: currentNode, newNodes: [] };
    }

    // Matching logic:
    // Iterate through all rules L -> R
    // Find all overlapping occurrences of L inside currentNode.currentString
    const str = currentNode.currentString;
    const derivedCandidates = [];

    for (const rule of this.grammar.rules) {
      const lhs = rule.lhs;
      const rhs = rule.rhs;

      if (!lhs || lhs.length === 0) continue;

      // Find ALL overlapping occurrences
      let matchIdx = str.indexOf(lhs, 0);
      while (matchIdx !== -1) {
        // Child string S_new = substring(0, matchIdx) + rhs + substring(matchIdx + |L|)
        const newStr = str.substring(0, matchIdx) + rhs + str.substring(matchIdx + lhs.length);

        derivedCandidates.push({
          rule,
          lhs,
          rhs,
          matchIndex: matchIdx,
          matchLength: lhs.length,
          newString: newStr
        });

        // Search for overlapping match starting 1 char forward
        matchIdx = str.indexOf(lhs, matchIdx + 1);
      }
    }

    // Process candidate child nodes
    for (const cand of derivedCandidates) {
      // Check max visited nodes safety cap
      if (this.nodesMap.size >= this.maxVisitedNodes) {
        this.status = EngineStatus.FAILURE;
        this.failureReason = `Max visited nodes cap (${this.maxVisitedNodes}) exceeded to prevent browser freeze. Increase limit in settings if needed.`;
        this._notifyUpdate();
        return { done: true, success: false, reason: this.failureReason };
      }

      const childId = `node_${this.nodeCounter++}`;
      const childDepth = currentNode.depth + 1;
      const isTarget = cand.newString === this.targetString;

      // Length Pruning check:
      // If grammar is monotonic (all |L| <= |R|) and candidate string is already longer than target string
      let isPruned = false;
      let pruneReason = null;

      if (this.enableLengthPruning && this.isMonotonic && cand.newString.length > this.targetString.length) {
        isPruned = true;
        pruneReason = `Pruned: Length (${cand.newString.length}) > Target (${this.targetString.length}) in monotonic grammar`;
      }

      // Visited cycle check
      const alreadyVisited = this.visited.has(cand.newString);
      if (alreadyVisited && !isTarget) {
        isPruned = true;
        pruneReason = `Pruned: State "${cand.newString}" already visited (cycle prevention)`;
      }

      // Build historical path
      const stepInfo = {
        step: childDepth,
        currentString: cand.newString,
        ruleString: cand.rule.toString(),
        lhs: cand.lhs,
        rhs: cand.rhs,
        matchIndex: cand.matchIndex,
        matchLength: cand.matchLength,
        beforeString: str
      };
      const childPath = [...currentNode.path, stepInfo];

      const childNode = {
        id: childId,
        currentString: cand.newString,
        depth: childDepth,
        parentId: currentNode.id,
        ruleApplied: cand.rule,
        lhs: cand.lhs,
        rhs: cand.rhs,
        matchIndex: cand.matchIndex,
        matchLength: cand.matchLength,
        path: childPath,
        isTarget,
        isPruned,
        pruneReason,
        children: []
      };

      currentNode.children.push(childId);
      this.nodesMap.set(childId, childNode);
      newChildren.push(childNode);

      // If target found!
      if (isTarget) {
        this.status = EngineStatus.SUCCESS;
        this.targetNode = childNode;
        this._updateElapsed();
        this._notifyUpdate();
        return { done: true, success: true, targetNode: childNode, nodeProcessed: currentNode, newNodes: newChildren };
      }

      // If not pruned, record visited and enqueue
      if (!isPruned) {
        this.visited.add(cand.newString);
        this.queue.push(childNode);
      }
    }

    this._updateElapsed();
    this._notifyUpdate();

    return {
      done: false,
      success: false,
      nodeProcessed: currentNode,
      newNodes: newChildren
    };
  }

  /**
   * Run the search to completion or until paused / limit hit.
   * Yields execution in small chunks (e.g. 25 iterations per frame)
   * so UI remains responsive and can animate smoothly.
   */
  run(onProgress = null, chunkSize = 25) {
    if (this.status === EngineStatus.SUCCESS || this.status === EngineStatus.FAILURE) {
      return Promise.resolve(this.getResult());
    }

    this.isRunningAsync = true;
    this.status = EngineStatus.SEARCHING;

    return new Promise((resolve) => {
      const executeChunk = () => {
        if (!this.isRunningAsync) {
          resolve(this.getResult());
          return;
        }

        let iterations = 0;
        while (iterations < chunkSize && this.isRunningAsync) {
          const res = this.step();
          iterations++;

          if (res.done) {
            this.isRunningAsync = false;
            resolve(this.getResult());
            return;
          }
        }

        if (onProgress) onProgress(this.getMetrics());

        // Yield to browser event loop
        this.timerId = setTimeout(executeChunk, 0);
      };

      executeChunk();
    });
  }

  pause() {
    this.isRunningAsync = false;
    if (this.timerId) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
    if (this.status === EngineStatus.SEARCHING) {
      this.status = EngineStatus.PAUSED;
    }
    this._notifyUpdate();
  }

  _updateElapsed() {
    if (this.startTime > 0) {
      this.elapsedTime = performance.now() - this.startTime;
    }
  }

  getMetrics() {
    return {
      status: this.status,
      failureReason: this.failureReason,
      visitedCount: this.visited.size,
      totalNodesCount: this.nodesMap.size,
      queueLength: this.queue.length,
      currentDepth: this.queue.peek() ? this.queue.peek().depth : (this.targetNode ? this.targetNode.depth : 0),
      elapsedTimeMs: Math.round(this.elapsedTime)
    };
  }

  getResult() {
    return {
      status: this.status,
      success: this.status === EngineStatus.SUCCESS,
      failureReason: this.failureReason,
      targetNode: this.targetNode,
      derivationPath: this.targetNode ? this.targetNode.path : null,
      metrics: this.getMetrics()
    };
  }

  _notifyUpdate() {
    if (this.onMetricsChange) {
      this.onMetricsChange(this.getMetrics());
    }
    if (this.onTreeUpdate) {
      this.onTreeUpdate(this.nodesMap, this.rootNode, this.targetNode);
    }
    if (this.onStateChange) {
      this.onStateChange(this.status, this.getResult());
    }
  }
}
