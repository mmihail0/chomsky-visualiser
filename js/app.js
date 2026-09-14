import { RuleModel, GrammarModel, ChomskyType } from './grammar.js';
import { BFSDerivationEngine, EngineStatus } from './engine.js';
import { DerivationTreeVisualizer } from './visualizer.js';
import { PRESETS } from './presets.js';

class ChomskyApp {
  constructor() {
    this.engine = new BFSDerivationEngine();
    this.visualizer = null;
    this.searchTimer = null;
    this.isSearching = false;
    this.isInitialized = false;
    this.autoPlaySpeedMs = 250;
    this.debounceTimer = null;

    this.initElements();
    this.initVisualizer();
    this.initPresetsDropdown();
    this.bindEvents();

    this.loadPreset('anbn');
  }

  initElements() {
    this.tabVisualizer = document.getElementById('tab-visualizer');
    this.tabTheory = document.getElementById('tab-theory');
    this.panelVisualizer = document.getElementById('panel-visualizer');
    this.panelTheory = document.getElementById('panel-theory');

    this.inputStartSymbol = document.getElementById('input-start-symbol');
    this.inputTargetString = document.getElementById('input-target-string');
    this.selectPresets = document.getElementById('select-presets');
    this.rulesTableBody = document.getElementById('rules-tbody');
    this.btnAddRule = document.getElementById('btn-add-rule');
    this.btnResetRules = document.getElementById('btn-reset-rules');
    this.btnClearRules = document.getElementById('btn-clear-rules');
    this.btnInsertEpsilon = document.getElementById('btn-insert-epsilon');
    this.badgeChomskyType = document.getElementById('chomsky-badge');
    this.btnBadgeDetails = document.getElementById('btn-badge-details');
    this.btnQuickDiagnostics = document.getElementById('btn-quick-diagnostics');

    this.inputMaxDepth = document.getElementById('input-max-depth');
    this.inputMaxNodes = document.getElementById('input-max-nodes');
    this.checkLengthPruning = document.getElementById('check-length-pruning');

    this.btnRecognize = document.getElementById('btn-recognize');
    this.btnStep = document.getElementById('btn-step');
    this.btnAutoPlay = document.getElementById('btn-autoplay');
    this.btnPause = document.getElementById('btn-pause');
    this.btnClearTree = document.getElementById('btn-clear-tree');
    this.sliderSpeed = document.getElementById('slider-speed');
    this.speedDisplay = document.getElementById('speed-display');

    this.metricVisited = document.getElementById('metric-visited');
    this.metricQueue = document.getElementById('metric-queue');
    this.metricDepth = document.getElementById('metric-depth');
    this.metricTime = document.getElementById('metric-time');
    this.statusIndicator = document.getElementById('status-indicator');

    this.btnZoomIn = document.getElementById('btn-zoom-in');
    this.btnZoomOut = document.getElementById('btn-zoom-out');
    this.btnZoomReset = document.getElementById('btn-zoom-reset');
    this.btnZoomFit = document.getElementById('btn-zoom-fit');

    this.tracerContainer = document.getElementById('tracer-container');
    this.queueContainer = document.getElementById('queue-container');
    this.nodeInspectorContainer = document.getElementById('node-inspector-container');

    this.modalOverlay = document.getElementById('modal-overlay');
    this.modalTitle = document.getElementById('modal-title');
    this.modalContent = document.getElementById('modal-content');
    this.btnModalClose = document.getElementById('btn-modal-close');
    this.btnModalOk = document.getElementById('btn-modal-ok');
  }

  initVisualizer() {
    const canvasContainer = document.getElementById('tree-canvas');
    this.visualizer = new DerivationTreeVisualizer(canvasContainer, {
      onNodeSelect: (node) => this.displayNodeDetails(node)
    });
  }

  initPresetsDropdown() {
    this.selectPresets.innerHTML = '<option value="" disabled selected>-- Select a Pre-configured System --</option>';
    let currentCat = '';
    let optgroup = null;

    PRESETS.forEach(p => {
      if (p.category !== currentCat) {
        currentCat = p.category;
        optgroup = document.createElement('optgroup');
        optgroup.label = currentCat;
        this.selectPresets.appendChild(optgroup);
      }
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.name;
      optgroup.appendChild(opt);
    });
  }

  bindEvents() {
    this.tabVisualizer.addEventListener('click', () => this.switchTab('visualizer'));
    this.tabTheory.addEventListener('click', () => this.switchTab('theory'));

    this.selectPresets.addEventListener('change', (e) => {
      if (e.target.value) this.loadPreset(e.target.value);
    });

    this.btnAddRule.addEventListener('click', () => {
      this.addRuleRow('', '');
      this.debouncedGrammarUpdate();
    });

    this.btnResetRules.addEventListener('click', () => this.resetRulesToDefault());

    this.btnClearRules.addEventListener('click', () => {
      this.rulesTableBody.innerHTML = '';
      this.addRuleRow('', '');
      this.debouncedGrammarUpdate();
    });

    this.btnInsertEpsilon.addEventListener('click', () => {
      const inputs = this.rulesTableBody.querySelectorAll('.rule-rhs-input');
      if (inputs.length > 0) {
        const lastInput = inputs[inputs.length - 1];
        lastInput.value = 'ε';
        lastInput.focus();
        this.debouncedGrammarUpdate();
      }
    });

    this.inputStartSymbol.addEventListener('input', () => this.debouncedGrammarUpdate());
    this.inputTargetString.addEventListener('input', () => {
      this.engine.targetString = this.inputTargetString.value.trim();
    });

    this.inputMaxDepth.addEventListener('change', () => this.syncSearchConfig());
    this.inputMaxNodes.addEventListener('change', () => this.syncSearchConfig());
    this.checkLengthPruning.addEventListener('change', () => this.syncSearchConfig());

    this.btnRecognize.addEventListener('click', () => this.startRealtimeSearch());
    this.btnStep.addEventListener('click', () => this.stepSearch());
    this.btnAutoPlay.addEventListener('click', () => this.toggleAutoPlay());
    this.btnPause.addEventListener('click', () => this.pauseSearch());
    this.btnClearTree.addEventListener('click', () => this.clearTree());

    this.sliderSpeed.addEventListener('input', (e) => {
      this.autoPlaySpeedMs = Number(e.target.value);
      this.speedDisplay.textContent = `${this.autoPlaySpeedMs}ms`;
    });

    this.btnZoomIn.addEventListener('click', () => this.visualizer.zoomIn());
    this.btnZoomOut.addEventListener('click', () => this.visualizer.zoomOut());
    this.btnZoomReset.addEventListener('click', () => this.visualizer.resetZoom());
    this.btnZoomFit.addEventListener('click', () => this.visualizer.fitToScreen());

    this.btnBadgeDetails.addEventListener('click', () => this.showGrammarClassificationModal());
    if (this.btnQuickDiagnostics) {
      this.btnQuickDiagnostics.addEventListener('click', () => this.showGrammarClassificationModal());
    }

    this.btnModalClose.addEventListener('click', () => this.closeModal());
    this.btnModalOk.addEventListener('click', () => this.closeModal());
    this.modalOverlay.addEventListener('click', (e) => {
      if (e.target === this.modalOverlay) this.closeModal();
    });

    document.querySelectorAll('[data-load-preset]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const presetId = e.currentTarget.getAttribute('data-load-preset');
        this.loadPreset(presetId);
        this.switchTab('visualizer');
      });
    });
  }

  switchTab(tabKey) {
    if (tabKey === 'visualizer') {
      this.tabVisualizer.classList.add('active');
      this.tabTheory.classList.remove('active');
      this.panelVisualizer.classList.add('active');
      this.panelTheory.classList.remove('active');
      setTimeout(() => this.visualizer.fitToScreen(), 60);
    } else {
      this.tabVisualizer.classList.remove('active');
      this.tabTheory.classList.add('active');
      this.panelVisualizer.classList.remove('active');
      this.panelTheory.classList.add('active');
    }
  }

  loadPreset(presetId) {
    const preset = PRESETS.find(p => p.id === presetId);
    if (!preset) return;

    this.selectPresets.value = presetId;
    this.inputStartSymbol.value = preset.startSymbol;
    this.inputTargetString.value = preset.targetString;

    this.rulesTableBody.innerHTML = '';
    preset.rules.forEach(rule => {
      this.addRuleRow(rule.lhs, rule.rhs);
    });

    this.updateGrammarModel();
    this.clearTree();
  }

  resetRulesToDefault() {
    this.loadPreset('anbn');
  }

  addRuleRow(lhs = '', rhs = '') {
    const tr = document.createElement('tr');
    tr.className = 'rule-row';
    tr.innerHTML = `
      <td>
        <input type="text" class="rule-input rule-lhs-input" value="${lhs}" placeholder="LHS (e.g. S)" spellcheck="false" />
      </td>
      <td style="text-align: center; font-weight: bold; color: var(--color-navy);">→</td>
      <td>
        <input type="text" class="rule-input rule-rhs-input" value="${rhs}" placeholder="RHS (e.g. aSb or ε)" spellcheck="false" />
      </td>
      <td style="text-align: center;">
        <button class="rule-delete-btn" title="Delete Rule">Remove</button>
      </td>
    `;

    const lhsInput = tr.querySelector('.rule-lhs-input');
    const rhsInput = tr.querySelector('.rule-rhs-input');
    const deleteBtn = tr.querySelector('.rule-delete-btn');

    lhsInput.addEventListener('input', () => this.debouncedGrammarUpdate());
    rhsInput.addEventListener('input', () => this.debouncedGrammarUpdate());

    deleteBtn.addEventListener('click', () => {
      tr.remove();
      if (this.rulesTableBody.children.length === 0) {
        this.addRuleRow('', '');
      }
      this.debouncedGrammarUpdate();
    });

    this.rulesTableBody.appendChild(tr);
  }

  debouncedGrammarUpdate() {
    clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this.updateGrammarModel();
    }, 200);
  }

  getRulesFromUI() {
    const rules = [];
    const rows = this.rulesTableBody.querySelectorAll('.rule-row');
    rows.forEach(row => {
      const lhs = row.querySelector('.rule-lhs-input').value.trim();
      const rhs = row.querySelector('.rule-rhs-input').value.trim();
      if (lhs.length > 0) {
        rules.push(new RuleModel(lhs, rhs));
      }
    });
    return rules;
  }

  getGrammarFromUI() {
    const startSymbol = this.inputStartSymbol.value.trim() || 'S';
    const rules = this.getRulesFromUI();
    return new GrammarModel(startSymbol, rules);
  }

  updateGrammarModel() {
    this.currentGrammar = this.getGrammarFromUI();
    this.classification = this.currentGrammar.classify();

    this.badgeChomskyType.textContent = this.classification.typeName;
    this.badgeChomskyType.className = `tier-badge badge-type${this.classification.type}`;

    this.syncSearchConfig();
  }

  syncSearchConfig() {
    const maxDepth = Number(this.inputMaxDepth.value) || 15;
    const maxNodes = Number(this.inputMaxNodes.value) || 1000;
    const lengthPruning = this.checkLengthPruning.checked;

    this.engine.configure({
      maxDepth,
      maxVisitedNodes: maxNodes,
      enableLengthPruning: lengthPruning
    });
  }

  clearTree() {
    this.pauseSearch();

    this.visualizer.clear();
    this.engine.reset();
    this.isInitialized = false;

    this.metricVisited.textContent = '0';
    this.metricQueue.textContent = '0';
    this.metricDepth.textContent = '0';
    this.metricTime.textContent = '0 ms';
    this.statusIndicator.className = 'status-badge status-idle';
    this.statusIndicator.textContent = 'IDLE';

    this.tracerContainer.innerHTML = '<div style="color: #64748b; font-style: italic; padding: 6px;">Tree cleared. Click Recognize or Step to begin.</div>';
    this.queueContainer.innerHTML = '<div style="color: #64748b; font-style: italic; padding: 6px;">Queue cleared.</div>';
    if (this.nodeInspectorContainer) {
      this.nodeInspectorContainer.innerHTML = '<div style="color: #64748b; font-style: italic; padding: 6px;">No node selected.</div>';
    }
  }

  ensureInitialized() {
    if (!this.isInitialized || this.engine.status === EngineStatus.SUCCESS || this.engine.status === EngineStatus.FAILURE) {
      this.syncSearchConfig();
      const grammar = this.getGrammarFromUI();
      const target = this.inputTargetString.value.trim();

      this.engine.init(grammar, target, false);
      this.isInitialized = true;

      this.visualizer.renderRealTime(this.engine.nodesMap, this.engine.rootNode);
      this.renderMetrics(this.engine.getMetrics());
      this.renderQueueList();
      this.renderTracer(this.engine.rootNode);
      this.displayNodeDetails(this.engine.rootNode);
    }
  }

  startRealtimeSearch() {
    if (this.isSearching) {
      this.pauseSearch();
      return;
    }

    this.ensureInitialized();
    this.isSearching = true;

    this.btnRecognize.classList.add('pressed');
    this.btnAutoPlay.textContent = 'Pause';
    this.btnAutoPlay.classList.add('pressed');
    this.statusIndicator.className = 'status-badge status-searching';
    this.statusIndicator.textContent = 'SEARCHING';

    const tick = () => {
      if (!this.isSearching) return;

      const res = this.engine.step(true);

      this.visualizer.renderRealTime(this.engine.nodesMap, this.engine.rootNode, res.targetNode);
      this.renderMetrics(this.engine.getMetrics());
      this.renderQueueList();

      if (res.done) {
        this.stopRealtimeSearch();

        if (res.success && res.targetNode) {
          this.visualizer.selectNode(res.targetNode.id);
          this.renderTracer(res.targetNode);
          this.displayNodeDetails(res.targetNode);
          this.statusIndicator.className = 'status-badge status-success';
          this.statusIndicator.textContent = 'SUCCESS';
        } else {
          this.renderFailureInTracer(res.reason || 'Target string unreachable');
          this.statusIndicator.className = 'status-badge status-failure';
          this.statusIndicator.textContent = 'FAILED';
        }

        this.visualizer.fitToScreen();
        return;
      }

      this.searchTimer = setTimeout(tick, this.autoPlaySpeedMs);
    };

    this.searchTimer = setTimeout(tick, this.autoPlaySpeedMs);
  }

  stopRealtimeSearch() {
    this.isSearching = false;
    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
      this.searchTimer = null;
    }
    this.btnRecognize.classList.remove('pressed');
    this.btnAutoPlay.textContent = 'Auto-Play';
    this.btnAutoPlay.classList.remove('pressed');
  }

  stepSearch() {
    this.pauseSearch();
    this.ensureInitialized();

    const res = this.engine.step(true);

    this.visualizer.renderRealTime(this.engine.nodesMap, this.engine.rootNode, res.targetNode);
    this.renderMetrics(this.engine.getMetrics());
    this.renderQueueList();

    if (res.targetNode) {
      this.visualizer.selectNode(res.targetNode.id);
      this.renderTracer(res.targetNode);
      this.displayNodeDetails(res.targetNode);
      this.statusIndicator.className = 'status-badge status-success';
      this.statusIndicator.textContent = 'SUCCESS';
      this.visualizer.fitToScreen();
    } else if (res.done && !res.success) {
      this.renderFailureInTracer(res.reason || 'Target string unreachable');
      this.statusIndicator.className = 'status-badge status-failure';
      this.statusIndicator.textContent = 'FAILED';
    }
  }

  toggleAutoPlay() {
    if (this.isSearching) {
      this.pauseSearch();
    } else {
      this.startRealtimeSearch();
    }
  }

  pauseSearch() {
    this.stopRealtimeSearch();
    this.engine.pause();
    this.statusIndicator.className = 'status-badge status-paused';
    this.statusIndicator.textContent = 'PAUSED';
  }

  renderMetrics(metrics) {
    this.metricVisited.textContent = metrics.visitedCount;
    this.metricQueue.textContent = metrics.queueLength;
    this.metricDepth.textContent = metrics.currentDepth;
    this.metricTime.textContent = `${metrics.elapsedTimeMs} ms`;
  }

  renderTracer(node) {
    if (!node || !node.path) {
      this.tracerContainer.innerHTML = '<div style="color: #64748b; font-style: italic; padding: 6px;">No derivation path to display.</div>';
      return;
    }

    const path = node.path;
    let html = '';

    for (let i = 0; i < path.length; i++) {
      const step = path[i];
      let displayString = step.currentString === '' ? 'ε' : step.currentString;

      if (i > 0 && step.matchIndex >= 0 && step.beforeString !== undefined) {
        const newPrefix = step.currentString.substring(0, step.matchIndex);
        const inserted = step.rhs === '' ? 'ε' : step.rhs;
        const newSuffix = step.currentString.substring(step.matchIndex + step.rhs.length);

        displayString = `<span>${newPrefix}</span><span class="trace-highlight" title="Inserted: ${inserted}">${inserted}</span><span>${newSuffix}</span>`;
      }

      html += `
        <div class="trace-step">
          <span class="trace-step-num">Step ${step.step}:</span>
          <span class="trace-step-str">${displayString}</span>
          <span class="trace-step-rule">${step.step === 0 ? '(Start Axiom)' : `(Applied: ${step.lhs} → ${step.rhs === '' ? 'ε' : step.rhs} at idx ${step.matchIndex})`}</span>
        </div>
      `;
    }

    this.tracerContainer.innerHTML = html;
  }

  renderFailureInTracer(reason) {
    this.tracerContainer.innerHTML = `
      <div style="padding: 10px; color: #b91c1c; font-weight: bold; background-color: #fee2e2; border: 1px solid #f87171;">
        [SEARCH TERMINATED]
        <div style="font-weight: normal; margin-top: 4px; color: #374151;">${reason}</div>
      </div>
    `;
  }

  renderQueueList() {
    const queueElements = this.engine.queue.toArray();
    if (queueElements.length === 0) {
      this.queueContainer.innerHTML = '<div style="color: #64748b; font-style: italic; padding: 6px;">Queue is empty.</div>';
      return;
    }

    const displayItems = queueElements.slice(0, 30);
    let html = '<div class="queue-list">';
    displayItems.forEach((node, idx) => {
      html += `
        <div class="queue-item" data-node-id="${node.id}">
          <span><strong>#${idx + 1}</strong> [d:${node.depth}] "${node.currentString === '' ? 'ε' : node.currentString}"</span>
          <span style="color: #64748b; font-size: 10px;">ID: ${node.id}</span>
        </div>
      `;
    });

    if (queueElements.length > 30) {
      html += `<div style="text-align: center; color: #64748b; padding: 4px; font-size: 10px;">... and ${queueElements.length - 30} more pending states</div>`;
    }
    html += '</div>';

    this.queueContainer.innerHTML = html;

    this.queueContainer.querySelectorAll('.queue-item').forEach(el => {
      el.addEventListener('click', () => {
        const id = el.getAttribute('data-node-id');
        this.visualizer.selectNode(id);
      });
    });
  }

  displayNodeDetails(node) {
    if (!node) return;

    let html = `
      <div style="font-size: 11px; line-height: 1.6;">
        <div><strong>Node ID:</strong> ${node.id}</div>
        <div><strong>String:</strong> <span style="font-family: var(--font-mono); font-weight: bold; background: #e2e8f0; padding: 1px 4px;">${node.currentString === '' ? 'ε (empty)' : node.currentString}</span></div>
        <div><strong>Depth:</strong> ${node.depth}</div>
        <div><strong>Parent:</strong> ${node.parentId || 'None (Root Axiom)'}</div>
        <div><strong>Applied Rule:</strong> ${node.ruleApplied ? `${node.ruleApplied.lhs} → ${node.ruleApplied.rhsDisplay} at index ${node.matchIndex}` : 'None (Start)'}</div>
        <div><strong>Status:</strong> ${node.isTarget ? '<span style="color: #15803d; font-weight: bold;">TARGET MATCH!</span>' : (node.isPruned ? `<span style="color: #b91c1c;">${node.pruneReason}</span>` : 'Active / Valid')}</div>
      </div>
    `;

    if (this.nodeInspectorContainer) {
      this.nodeInspectorContainer.innerHTML = html;
    }
  }

  showGrammarClassificationModal() {
    if (!this.classification) return;

    this.modalTitle.textContent = `Classification: ${this.classification.typeName}`;

    let detailsList = '';
    this.classification.details.forEach(d => {
      detailsList += `<li>${d}</li>`;
    });

    this.modalContent.innerHTML = `
      <p style="margin-bottom: 8px;"><strong>Result:</strong> ${this.classification.typeName}</p>
      <p style="margin-bottom: 8px;">${this.classification.description}</p>
      <div style="margin-top: 10px; background: #f8fafc; padding: 10px; border: 1px solid var(--border-mid);">
        <strong>Diagnostic Analysis:</strong>
        <ul style="margin-left: 20px; margin-top: 4px;">${detailsList}</ul>
      </div>
    `;

    this.modalOverlay.style.display = 'flex';
  }

  closeModal() {
    this.modalOverlay.style.display = 'none';
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.app = new ChomskyApp();
});
