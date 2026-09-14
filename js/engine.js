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
    if (this.head > 300 && this.head > (this.elements.length / 2)) {
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

    this.status = EngineStatus.IDLE;
    this.failureReason = null;
    this.grammar = null;
    this.targetString = '';
    this.queue = new Deque();
    this.visited = new Set();
    this.nodesMap = new Map();
    this.nodeCounter = 0;
    this.rootNode = null;
    this.targetNode = null;
    this.startTime = 0;
    this.elapsedTime = 0;
    this.isMonotonic = false;

    this.timerId = null;
    this.isRunningAsync = false;

    this.onStateChange = null;
    this.onMetricsChange = null;
    this.onTreeUpdate = null;
  }

  configure(options) {
    if (options.maxDepth !== undefined) this.maxDepth = Number(options.maxDepth);
    if (options.maxVisitedNodes !== undefined) this.maxVisitedNodes = Number(options.maxVisitedNodes);
    if (options.enableLengthPruning !== undefined) this.enableLengthPruning = Boolean(options.enableLengthPruning);
  }

  init(grammar, targetString, notify = true) {
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

    if (notify) {
      this._notifyUpdate();
    }
  }

  reset() {
    if (this.timerId) {
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

  step(notify = true) {
    if (this.status === EngineStatus.SUCCESS || this.status === EngineStatus.FAILURE) {
      return { done: true, success: this.status === EngineStatus.SUCCESS };
    }

    if (this.queue.length === 0) {
      this.status = EngineStatus.FAILURE;
      this.failureReason = 'Search queue exhausted. Target string is unreachable with these production rules.';
      this._updateElapsed();
      if (notify) this._notifyUpdate();
      return { done: true, success: false, reason: this.failureReason };
    }

    this.status = EngineStatus.SEARCHING;
    this._updateElapsed();

    const currentNode = this.queue.shift();
    const newChildren = [];

    if (currentNode.currentString === this.targetString) {
      this.status = EngineStatus.SUCCESS;
      this.targetNode = currentNode;
      if (notify) this._notifyUpdate();
      return { done: true, success: true, targetNode: currentNode };
    }

    if (currentNode.depth >= this.maxDepth) {
      currentNode.isPruned = true;
      currentNode.pruneReason = `Depth limit (${this.maxDepth}) reached`;
      if (notify) this._notifyUpdate();
      return { done: false, success: false, nodeProcessed: currentNode, newNodes: [] };
    }

    const str = currentNode.currentString;
    const derivedCandidates = [];

    for (const rule of this.grammar.rules) {
      const lhs = rule.lhs;
      const rhs = rule.rhs;

      if (!lhs || lhs.length === 0) continue;

      let matchIdx = str.indexOf(lhs, 0);
      while (matchIdx !== -1) {
        const newStr = str.substring(0, matchIdx) + rhs + str.substring(matchIdx + lhs.length);

        derivedCandidates.push({
          rule,
          lhs,
          rhs,
          matchIndex: matchIdx,
          matchLength: lhs.length,
          newString: newStr
        });

        matchIdx = str.indexOf(lhs, matchIdx + 1);
      }
    }

    for (const cand of derivedCandidates) {
      if (this.nodesMap.size >= this.maxVisitedNodes) {
        this.status = EngineStatus.FAILURE;
        this.failureReason = `Max visited nodes limit (${this.maxVisitedNodes}) reached. Increase limit in settings if required.`;
        if (notify) this._notifyUpdate();
        return { done: true, success: false, reason: this.failureReason };
      }

      const childId = `node_${this.nodeCounter++}`;
      const childDepth = currentNode.depth + 1;
      const isTarget = cand.newString === this.targetString;

      let isPruned = false;
      let pruneReason = null;

      if (this.enableLengthPruning && this.isMonotonic && cand.newString.length > this.targetString.length) {
        isPruned = true;
        pruneReason = `Pruned: Length (${cand.newString.length}) > Target (${this.targetString.length})`;
      }

      const alreadyVisited = this.visited.has(cand.newString);
      if (alreadyVisited && !isTarget) {
        isPruned = true;
        pruneReason = `Pruned: State already visited`;
      }

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

      if (isTarget) {
        this.status = EngineStatus.SUCCESS;
        this.targetNode = childNode;
        this._updateElapsed();
        if (notify) this._notifyUpdate();
        return { done: true, success: true, targetNode: childNode, nodeProcessed: currentNode, newNodes: newChildren };
      }

      if (!isPruned) {
        this.visited.add(cand.newString);
        this.queue.push(childNode);
      }
    }

    this._updateElapsed();
    if (notify) {
      this._notifyUpdate();
    }

    return {
      done: false,
      success: false,
      nodeProcessed: currentNode,
      newNodes: newChildren
    };
  }

  run(onProgress = null, chunkSize = 40) {
    if (this.status === EngineStatus.SUCCESS || this.status === EngineStatus.FAILURE) {
      return Promise.resolve(this.getResult());
    }

    this.isRunningAsync = true;
    this.status = EngineStatus.SEARCHING;
    let lastProgressTime = performance.now();

    return new Promise((resolve) => {
      const executeChunk = () => {
        if (!this.isRunningAsync) {
          this._notifyUpdate();
          resolve(this.getResult());
          return;
        }

        let iterations = 0;
        while (iterations < chunkSize && this.isRunningAsync) {
          const res = this.step(false);
          iterations++;

          if (res.done) {
            this.isRunningAsync = false;
            this._notifyUpdate();
            resolve(this.getResult());
            return;
          }
        }

        const now = performance.now();
        if (now - lastProgressTime > 50) {
          lastProgressTime = now;
          if (onProgress) onProgress(this.getMetrics());
        }

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
