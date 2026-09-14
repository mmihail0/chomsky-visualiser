/**
 * Chomsky Grammar & Semi-Thue System - Main Application Controller
 * File: js/app.js
 */

import { RuleModel, GrammarModel, ChomskyType } from './grammar.js';
import { BFSDerivationEngine, EngineStatus } from './engine.js';
import { DerivationTreeVisualizer } from './visualizer.js';
import { PRESETS } from './presets.js';

class ChomskyApp {
  constructor() {
    this.engine = new BFSDerivationEngine();
    this.visualizer = null;
    this.autoPlayInterval = null;
    this.autoPlaySpeedMs = 250;

    this.initElements();
    this.initVisualizer();
    this.initPresetsDropdown();
    this.bindEvents();
    this.startClock();

    // Load initial default preset (aⁿbⁿ)
    this.loadPreset('anbn');
  }

  initElements() {
    // Tabs
    this.tabVisualizer = document.getElementById('tab-visualizer');
    this.tabTheory = document.getElementById('tab-theory');
    this.panelVisualizer = document.getElementById('panel-visualizer');
    this.panelTheory = document.getElementById('panel-theory');

    // Grammar Inputs
    this.inputStartSymbol = document.getElementById('input-start-symbol');
    this.inputTargetString = document.getElementById('input-target-string');
    this.selectPresets = document.getElementById('select-presets');
    this.rulesTableBody = document.getElementById('rules-tbody');
    this.btnAddRule = document.getElementById('btn-add-rule');
    this.btnClearRules = document.getElementById('btn-clear-rules');
    this.btnInsertEpsilon = document.getElementById('btn-insert-epsilon');
    this.badgeChomskyType = document.getElementById('chomsky-badge');
    this.btnBadgeDetails = document.getElementById('btn-badge-details');

    // Search Parameters
    this.inputMaxDepth = document.getElementById('input-max-depth');
    this.inputMaxNodes = document.getElementById('input-max-nodes');
    this.checkLengthPruning = document.getElementById('check-length-pruning');

    // Execution Controls
    this.btnRecognize = document.getElementById('btn-recognize');
    this.btnStep = document.getElementById('btn-step');
    this.btnAutoPlay = document.getElementById('btn-autoplay');
    this.btnPause = document.getElementById('btn-pause');
    this.btnReset = document.getElementById('btn-reset');
    this.sliderSpeed = document.getElementById('slider-speed');
    this.speedDisplay = document.getElementById('speed-display');

    // Metrics Display
    this.metricVisited = document.getElementById('metric-visited');
    this.metricQueue = document.getElementById('metric-queue');
    this.metricDepth = document.getElementById('metric-depth');
    this.metricTime = document.getElementById('metric-time');
    this.statusIndicator = document.getElementById('status-indicator');

    // Toolbar Canvas
    this.btnZoomIn = document.getElementById('btn-zoom-in');
    this.btnZoomOut = document.getElementById('btn-zoom-out');
    this.btnZoomReset = document.getElementById('btn-zoom-reset');
    this.btnZoomFit = document.getElementById('btn-zoom-fit');

    // Bottom Panels
    this.tracerContainer = document.getElementById('tracer-container');
    this.queueContainer = document.getElementById('queue-container');
    this.nodeInspectorContainer = document.getElementById('node-inspector-container');

    // Status Bar
    this.statusMsg = document.getElementById('status-msg');
    this.statusGrammarType = document.getElementById('status-grammar-type');
    this.statusClock = document.getElementById('status-clock');

    // Modal
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

    // Connect Engine updates to Visualizer and Metrics
    this.engine.onMetricsChange = (metrics) => this.renderMetrics(metrics);
    this.engine.onTreeUpdate = (nodesMap, rootNode, targetNode) => {
      this.visualizer.setData(nodesMap, rootNode, targetNode);
      this.renderQueueList();
    };
    this.engine.onStateChange = (status, result) => {
      this.handleEngineStateChange(status, result);
    };
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
    // Tab Navigation
    this.tabVisualizer.addEventListener('click', () => this.switchTab('visualizer'));
    this.tabTheory.addEventListener('click', () => this.switchTab('theory'));

    // Presets Change
    this.selectPresets.addEventListener('change', (e) => {
      if (e.target.value) this.loadPreset(e.target.value);
    });

    // Rule Grid Management
    this.btnAddRule.addEventListener('click', () => {
      this.addRuleRow('', '');
      this.updateGrammarModel();
    });

    this.btnClearRules.addEventListener('click', () => {
      this.rulesTableBody.innerHTML = '';
      this.addRuleRow('', '');
      this.updateGrammarModel();
    });

    this.btnInsertEpsilon.addEventListener('click', () => {
      // Find active or last RHS input
      const inputs = this.rulesTableBody.querySelectorAll('.rule-rhs-input');
      if (inputs.length > 0) {
        const lastInput = inputs[inputs.length - 1];
        lastInput.value = 'ε';
        lastInput.focus();
        this.updateGrammarModel();
      }
    });

    this.inputStartSymbol.addEventListener('input', () => this.updateGrammarModel());
    this.inputTargetString.addEventListener('input', () => this.resetSearch());

    // Search Limits & Settings
    this.inputMaxDepth.addEventListener('change', () => this.syncSearchConfig());
    this.inputMaxNodes.addEventListener('change', () => this.syncSearchConfig());
    this.checkLengthPruning.addEventListener('change', () => this.syncSearchConfig());

    // Execution Controls
    this.btnRecognize.addEventListener('click', () => this.startSearch());
    this.btnStep.addEventListener('click', () => this.stepSearch());
    this.btnAutoPlay.addEventListener('click', () => this.toggleAutoPlay());
    this.btnPause.addEventListener('click', () => this.pauseSearch());
    this.btnReset.addEventListener('click', () => this.resetSearch());

    // Speed Slider
    this.sliderSpeed.addEventListener('input', (e) => {
      this.autoPlaySpeedMs = Number(e.target.value);
      this.speedDisplay.textContent = `${this.autoPlaySpeedMs}ms`;
      if (this.autoPlayInterval) {
        // Restart timer at new interval
        clearInterval(this.autoPlayInterval);
        this.autoPlayInterval = setInterval(() => this.stepSearch(), this.autoPlaySpeedMs);
      }
    });

    // Canvas Toolbar
    this.btnZoomIn.addEventListener('click', () => this.visualizer.zoomIn());
    this.btnZoomOut.addEventListener('click', () => this.visualizer.zoomOut());
    this.btnZoomReset.addEventListener('click', () => this.visualizer.resetZoom());
    this.btnZoomFit.addEventListener('click', () => this.visualizer.fitToScreen());

    // Badge Details Dialog
    this.btnBadgeDetails.addEventListener('click', () => this.showGrammarClassificationModal());

    // Modal Close
    this.btnModalClose.addEventListener('click', () => this.closeModal());
    this.btnModalOk.addEventListener('click', () => this.closeModal());
    this.modalOverlay.addEventListener('click', (e) => {
      if (e.target === this.modalOverlay) this.closeModal();
    });

    // Links inside Theory guide to load examples
    document.querySelectorAll('[data-load-preset]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const presetId = e.currentTarget.getAttribute('data-load-preset');
        this.loadPreset(presetId);
        this.switchTab('visualizer');
      });
    });
  }

  startClock() {
    const updateTime = () => {
      const now = new Date();
      this.statusClock.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };
    updateTime();
    setInterval(updateTime, 1000);
  }

  switchTab(tabKey) {
    if (tabKey === 'visualizer') {
      this.tabVisualizer.classList.add('active');
      this.tabTheory.classList.remove('active');
      this.panelVisualizer.classList.add('active');
      this.panelTheory.classList.remove('active');
      // Redraw canvas if needed
      setTimeout(() => this.visualizer.fitToScreen(), 50);
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

    // Populate rule rows
    this.rulesTableBody.innerHTML = '';
    preset.rules.forEach(rule => {
      this.addRuleRow(rule.lhs, rule.rhs);
    });

    this.updateGrammarModel();
    this.resetSearch();
    this.statusMsg.textContent = `Loaded Preset: ${preset.name}`;
  }

  addRuleRow(lhs = '', rhs = '') {
    const tr = document.createElement('tr');
    tr.className = 'rule-row';
    tr.innerHTML = `
      <td style="width: 38%;">
        <input type="text" class="rule-input rule-lhs-input bevel-inset" value="${lhs}" placeholder="LHS (e.g. S)" spellcheck="false" />
      </td>
      <td style="width: 8%; text-align: center; font-weight: bold; color: #000080;">→</td>
      <td style="width: 38%;">
        <input type="text" class="rule-input rule-rhs-input bevel-inset" value="${rhs}" placeholder="RHS (e.g. aSb or ε)" spellcheck="false" />
      </td>
      <td style="width: 16%; text-align: center;">
        <button class="win-btn rule-action-btn btn-delete-rule" title="Delete Rule">✕</button>
      </td>
    `;

    const lhsInput = tr.querySelector('.rule-lhs-input');
    const rhsInput = tr.querySelector('.rule-rhs-input');
    const deleteBtn = tr.querySelector('.btn-delete-rule');

    lhsInput.addEventListener('input', () => this.updateGrammarModel());
    rhsInput.addEventListener('input', () => this.updateGrammarModel());

    deleteBtn.addEventListener('click', () => {
      tr.remove();
      if (this.rulesTableBody.children.length === 0) {
        this.addRuleRow('', '');
      }
      this.updateGrammarModel();
    });

    this.rulesTableBody.appendChild(tr);
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

    // Update Badge
    this.badgeChomskyType.textContent = this.classification.typeName;
    this.badgeChomskyType.className = `chomsky-badge badge-type${this.classification.type}`;
    this.statusGrammarType.textContent = this.classification.typeName;

    // Sync settings
    this.syncSearchConfig();
    this.resetSearch();
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

  resetSearch() {
    this.pauseSearch();
    this.syncSearchConfig();
    const grammar = this.getGrammarFromUI();
    const target = this.inputTargetString.value.trim();

    this.engine.init(grammar, target);
    this.visualizer.setData(this.engine.nodesMap, this.engine.rootNode, this.engine.targetNode);
    this.visualizer.resetZoom();

    this.renderMetrics(this.engine.getMetrics());
    this.renderTracer(this.engine.rootNode);
    this.renderQueueList();
    this.displayNodeDetails(this.engine.rootNode);

    this.statusMsg.textContent = 'System Ready. Press "Recognize" or "Step" to begin search.';
  }

  startSearch() {
    this.pauseSearch();
    this.syncSearchConfig();

    if (this.engine.status === EngineStatus.SUCCESS || this.engine.status === EngineStatus.FAILURE) {
      this.resetSearch();
    }

    this.statusMsg.textContent = `Running BFS Derivation for target "${this.engine.targetString}"...`;
    this.btnRecognize.disabled = true;

    this.engine.run(
      (metrics) => this.renderMetrics(metrics),
      35 // 35 iterations per async frame
    ).then((result) => {
      this.btnRecognize.disabled = false;
      this.visualizer.fitToScreen();
    });
  }

  stepSearch() {
    if (this.engine.status === EngineStatus.SUCCESS || this.engine.status === EngineStatus.FAILURE) {
      this.resetSearch();
    }

    const res = this.engine.step();
    this.renderMetrics(this.engine.getMetrics());

    if (res.targetNode) {
      this.visualizer.selectNode(res.targetNode.id);
      this.displayNodeDetails(res.targetNode);
    }
  }

  toggleAutoPlay() {
    if (this.autoPlayInterval) {
      this.pauseSearch();
    } else {
      if (this.engine.status === EngineStatus.SUCCESS || this.engine.status === EngineStatus.FAILURE) {
        this.resetSearch();
      }
      this.btnAutoPlay.textContent = '⏸ Pause';
      this.btnAutoPlay.classList.add('pressed');
      this.statusMsg.textContent = 'Auto-play running...';
      this.autoPlayInterval = setInterval(() => {
        const res = this.engine.step();
        if (res.done) {
          this.pauseSearch();
        }
      }, this.autoPlaySpeedMs);
    }
  }

  pauseSearch() {
    if (this.autoPlayInterval) {
      clearInterval(this.autoPlayInterval);
      this.autoPlayInterval = null;
      this.btnAutoPlay.textContent = '⏯ Auto-Play';
      this.btnAutoPlay.classList.remove('pressed');
    }
    this.engine.pause();
    this.btnRecognize.disabled = false;
  }

  handleEngineStateChange(status, result) {
    this.renderMetrics(result.metrics);

    if (status === EngineStatus.SUCCESS) {
      this.pauseSearch();
      this.statusMsg.textContent = `SUCCESS! Target string recognized in ${result.derivationPath.length - 1} steps.`;
      this.renderTracer(result.targetNode);
      this.displayNodeDetails(result.targetNode);
    } else if (status === EngineStatus.FAILURE) {
      this.pauseSearch();
      this.statusMsg.textContent = `SEARCH FAILED: ${result.failureReason}`;
      this.renderFailureInTracer(result.failureReason);
    }
  }

  renderMetrics(metrics) {
    this.metricVisited.textContent = metrics.visitedCount;
    this.metricQueue.textContent = metrics.queueLength;
    this.metricDepth.textContent = metrics.currentDepth;
    this.metricTime.textContent = `${metrics.elapsedTimeMs} ms`;

    this.statusIndicator.className = `status-indicator status-${metrics.status.toLowerCase()}`;
    this.statusIndicator.textContent = metrics.status;
  }

  renderTracer(node) {
    if (!node || !node.path) {
      this.tracerContainer.innerHTML = '<div style="color: #888; font-style: italic; padding: 6px;">No derivation path to display.</div>';
      return;
    }

    const path = node.path;
    let html = '';

    for (let i = 0; i < path.length; i++) {
      const step = path[i];
      let displayString = step.currentString === '' ? 'ε' : step.currentString;

      // Highlighting: if rule applied, show what was substituted
      if (i > 0 && step.matchIndex >= 0 && step.beforeString !== undefined) {
        const before = step.beforeString;
        const prefix = before.substring(0, step.matchIndex);
        const replaced = before.substring(step.matchIndex, step.matchIndex + step.matchLength);
        const suffix = before.substring(step.matchIndex + step.matchLength);

        const newPrefix = step.currentString.substring(0, step.matchIndex);
        const inserted = step.rhs === '' ? 'ε' : step.rhs;
        const newSuffix = step.currentString.substring(step.matchIndex + step.rhs.length);

        displayString = `
          <span>${newPrefix}</span><span class="trace-highlight-after" title="Inserted: ${inserted}">${inserted}</span><span>${newSuffix}</span>
        `;
      }

      html += `
        <div class="trace-step">
          <span class="trace-step-number">Step ${step.step}:</span>
          <span class="trace-step-string">${displayString}</span>
          <span class="trace-step-rule">${step.step === 0 ? '(Initial Axiom)' : `(Applied: ${step.lhs} → ${step.rhs === '' ? 'ε' : step.rhs} at index ${step.matchIndex})`}</span>
        </div>
      `;
    }

    this.tracerContainer.innerHTML = html;
  }

  renderFailureInTracer(reason) {
    this.tracerContainer.innerHTML = `
      <div style="padding: 10px; color: #cc0000; font-weight: bold; background-color: #fff0f0; border: 1px solid #ffcccc;">
        [SEARCH TERMINATED]
        <div style="font-weight: normal; margin-top: 4px; color: #333;">${reason}</div>
      </div>
    `;
  }

  renderQueueList() {
    const queueElements = this.engine.queue.toArray();
    if (queueElements.length === 0) {
      this.queueContainer.innerHTML = '<div style="color: #888; font-style: italic; padding: 6px;">Queue is empty.</div>';
      return;
    }

    // Render first 25 items in queue to avoid DOM bloat
    const displayItems = queueElements.slice(0, 30);
    let html = '<div class="queue-list">';
    displayItems.forEach((node, idx) => {
      html += `
        <div class="queue-item" data-node-id="${node.id}">
          <span><strong>#${idx + 1}</strong> [d:${node.depth}] "${node.currentString === '' ? 'ε' : node.currentString}"</span>
          <span style="color: #666; font-size: 10px;">ID: ${node.id}</span>
        </div>
      `;
    });

    if (queueElements.length > 30) {
      html += `<div style="text-align: center; color: #666; padding: 4px; font-size: 10px;">... and ${queueElements.length - 30} more states in queue</div>`;
    }
    html += '</div>';

    this.queueContainer.innerHTML = html;

    // Clicking queue item highlights node in tree
    this.queueContainer.querySelectorAll('.queue-item').forEach(el => {
      el.addEventListener('click', () => {
        const id = el.getAttribute('data-node-id');
        this.visualizer.selectNode(id);
      });
    });
  }

  displayNodeDetails(node) {
    if (!node) return;
    this.renderTracer(node);

    let html = `
      <div style="font-size: 11px; line-height: 1.5;">
        <div><strong>Node ID:</strong> ${node.id}</div>
        <div><strong>String State:</strong> <span style="font-family: var(--font-mono); font-weight: bold; background: #eee; padding: 1px 4px;">${node.currentString === '' ? 'ε (empty)' : node.currentString}</span></div>
        <div><strong>Tree Depth:</strong> ${node.depth}</div>
        <div><strong>Parent Node:</strong> ${node.parentId || 'None (Root Axiom)'}</div>
        <div><strong>Applied Rule:</strong> ${node.ruleApplied ? `${node.ruleApplied.lhs} → ${node.ruleApplied.rhsDisplay} at index ${node.matchIndex}` : 'None (Start)'}</div>
        <div><strong>Status:</strong> ${node.isTarget ? '<span style="color: green; font-weight: bold;">TARGET MATCH!</span>' : (node.isPruned ? `<span style="color: red;">${node.pruneReason}</span>` : 'Active / Valid')}</div>
      </div>
    `;

    if (this.nodeInspectorContainer) {
      this.nodeInspectorContainer.innerHTML = html;
    }
  }

  showGrammarClassificationModal() {
    if (!this.classification) return;

    this.modalTitle.textContent = `Chomsky Hierarchy Classification: ${this.classification.typeName}`;

    let detailsList = '';
    this.classification.details.forEach(d => {
      detailsList += `<li>${d}</li>`;
    });

    this.modalContent.innerHTML = `
      <p style="margin-bottom: 8px;"><strong>Classification Result:</strong> ${this.classification.typeName}</p>
      <p style="margin-bottom: 8px;">${this.classification.description}</p>
      <div style="margin-top: 10px; background: #fff; padding: 8px; border: 1px solid #808080;">
        <strong>Diagnostic Criteria:</strong>
        <ul style="margin-left: 18px; margin-top: 4px;">${detailsList}</ul>
      </div>
    `;

    this.modalOverlay.style.display = 'flex';
  }

  closeModal() {
    this.modalOverlay.style.display = 'none';
  }
}

// Instantiate on load
window.addEventListener('DOMContentLoaded', () => {
  window.app = new ChomskyApp();
});
