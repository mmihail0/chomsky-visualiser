export class DerivationTreeVisualizer {
  constructor(containerElement, options = {}) {
    this.container = containerElement;
    this.options = Object.assign({
      nodeWidth: 130,
      nodeHeight: 46,
      levelGap: 55,
      siblingGap: 16,
      onNodeSelect: null
    }, options);

    this.svg = null;
    this.viewportGroup = null;
    this.edgesGroup = null;
    this.nodesGroup = null;
    this.placeholderText = null;

    this.scale = 1;
    this.panX = 30;
    this.panY = 30;
    this.isDragging = false;
    this.dragStartX = 0;
    this.dragStartY = 0;

    this.nodesMap = new Map();
    this.nodePositions = new Map();
    this.renderedNodeIds = new Set();
    this.renderedEdgeIds = new Set();
    this.levelNodeCounts = [];
    this.rootNode = null;
    this.targetNode = null;
    this.selectedNodeId = null;

    this.initDOM();
    this.bindEvents();
    this.showPlaceholder();
  }

  initDOM() {
    this.container.innerHTML = '';
    this.container.style.position = 'relative';
    this.container.style.overflow = 'hidden';
    this.container.style.userSelect = 'none';

    this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.svg.setAttribute('width', '100%');
    this.svg.setAttribute('height', '100%');
    this.svg.style.display = 'block';
    this.svg.style.cursor = 'grab';

    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    defs.innerHTML = `
      <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M 0 1 L 10 5 L 0 9 z" fill="#1f3a60" />
      </marker>
      <marker id="arrow-target" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M 0 1 L 10 5 L 0 9 z" fill="#2e7d32" />
      </marker>
    `;
    this.svg.appendChild(defs);

    this.viewportGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.edgesGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.nodesGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');

    this.viewportGroup.appendChild(this.edgesGroup);
    this.viewportGroup.appendChild(this.nodesGroup);
    this.svg.appendChild(this.viewportGroup);

    this.container.appendChild(this.svg);
    this.updateTransform();
  }

  bindEvents() {
    this.svg.addEventListener('mousedown', (e) => {
      if (e.target.closest('.tree-node')) return;
      this.isDragging = true;
      this.dragStartX = e.clientX - this.panX;
      this.dragStartY = e.clientY - this.panY;
      this.svg.style.cursor = 'grabbing';
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.isDragging) return;
      this.panX = e.clientX - this.dragStartX;
      this.panY = e.clientY - this.dragStartY;
      this.updateTransform();
    });

    window.addEventListener('mouseup', () => {
      if (this.isDragging) {
        this.isDragging = false;
        this.svg.style.cursor = 'grab';
      }
    });

    this.container.addEventListener('wheel', (e) => {
      e.preventDefault();
      const rect = this.container.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const factor = e.deltaY < 0 ? 1.12 : 0.88;
      this.zoomAt(mouseX, mouseY, factor);
    }, { passive: false });
  }

  zoomAt(x, y, factor) {
    const oldScale = this.scale;
    let newScale = this.scale * factor;
    newScale = Math.max(0.12, Math.min(3.0, newScale));

    this.panX = x - (x - this.panX) * (newScale / oldScale);
    this.panY = y - (y - this.panY) * (newScale / oldScale);
    this.scale = newScale;

    this.updateTransform();
  }

  zoomIn() {
    const rect = this.container.getBoundingClientRect();
    this.zoomAt(rect.width / 2, rect.height / 2, 1.25);
  }

  zoomOut() {
    const rect = this.container.getBoundingClientRect();
    this.zoomAt(rect.width / 2, rect.height / 2, 0.8);
  }

  resetZoom() {
    this.scale = 1;
    this.panX = 30;
    this.panY = 30;
    this.updateTransform();
  }

  updateTransform() {
    this.viewportGroup.setAttribute(
      'transform',
      `translate(${this.panX}, ${this.panY}) scale(${this.scale})`
    );
  }

  showPlaceholder() {
    this.clear();
    if (!this.placeholderText) {
      this.placeholderText = document.createElement('div');
      this.placeholderText.className = 'tree-placeholder-msg';
      this.placeholderText.style.position = 'absolute';
      this.placeholderText.style.top = '50%';
      this.placeholderText.style.left = '50%';
      this.placeholderText.style.transform = 'translate(-50%, -50%)';
      this.placeholderText.style.color = '#64748b';
      this.placeholderText.style.fontSize = '12px';
      this.placeholderText.style.fontWeight = 'bold';
      this.placeholderText.style.textAlign = 'center';
      this.placeholderText.style.pointerEvents = 'none';
      this.placeholderText.textContent = 'Derivation tree is empty. Click "Recognise" or "Step" to begin.';
      this.container.appendChild(this.placeholderText);
    } else {
      this.placeholderText.style.display = 'block';
    }
  }

  hidePlaceholder() {
    if (this.placeholderText) {
      this.placeholderText.style.display = 'none';
    }
  }

  clear() {
    this.edgesGroup.innerHTML = '';
    this.nodesGroup.innerHTML = '';
    this.nodesMap.clear();
    this.nodePositions.clear();
    this.renderedNodeIds.clear();
    this.renderedEdgeIds.clear();
    this.levelNodeCounts = [];
    this.rootNode = null;
    this.targetNode = null;
    this.selectedNodeId = null;
    if (this.placeholderText) {
      this.placeholderText.style.display = 'block';
    }
  }

  _getNodePosition(node) {
    if (this.nodePositions.has(node.id)) {
      return this.nodePositions.get(node.id);
    }

    const { nodeWidth, nodeHeight, levelGap, siblingGap } = this.options;
    const d = node.depth;

    if (this.levelNodeCounts[d] === undefined) {
      this.levelNodeCounts[d] = 0;
    }

    const idx = this.levelNodeCounts[d];
    this.levelNodeCounts[d]++;

    const x = 30 + idx * (nodeWidth + siblingGap);
    const y = 30 + d * (nodeHeight + levelGap);

    const pos = { x, y, width: nodeWidth, height: nodeHeight };
    this.nodePositions.set(node.id, pos);
    return pos;
  }

  renderRealTime(nodesMap, rootNode, targetNode = null) {
    this.hidePlaceholder();
    this.nodesMap = nodesMap;
    this.rootNode = rootNode;
    this.targetNode = targetNode;

    if (rootNode && !this.renderedNodeIds.has(rootNode.id)) {
      this._renderNodeElement(rootNode);
    }

    for (const [id, node] of nodesMap.entries()) {
      if (!this.renderedNodeIds.has(id)) {
        if (node.parentId && this.nodePositions.has(node.parentId)) {
          this._renderEdgeElement(node);
        }
        this._renderNodeElement(node);
      }
    }

    if (targetNode) {
      this.highlightTargetPath(targetNode);
    }
  }

  _renderEdgeElement(node) {
    const edgeKey = `${node.parentId}->${node.id}`;
    if (this.renderedEdgeIds.has(edgeKey)) return;

    const parentPos = this.nodePositions.get(node.parentId);
    const childPos = this._getNodePosition(node);
    if (!parentPos || !childPos) return;

    const x1 = parentPos.x + parentPos.width / 2;
    const y1 = parentPos.y + parentPos.height;
    const x2 = childPos.x + childPos.width / 2;
    const y2 = childPos.y;

    const midY = y1 + (y2 - y1) * 0.45;
    const d = `M ${x1} ${y1} L ${x1} ${midY} L ${x2} ${midY} L ${x2} ${y2}`;

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('id', `edge_${node.id}`);
    path.setAttribute('d', d);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', node.isPruned ? '#a0aec0' : '#1f3a60');
    path.setAttribute('stroke-width', node.isPruned ? '1' : '1.5');
    if (node.isPruned) path.setAttribute('stroke-dasharray', '3,3');
    path.setAttribute('marker-end', 'url(#arrow)');

    this.edgesGroup.appendChild(path);

    if (node.ruleApplied) {
      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      label.setAttribute('id', `edge_label_${node.id}`);
      label.setAttribute('x', x2 + 3);
      label.setAttribute('y', midY + 11);
      label.setAttribute('font-family', 'Courier New, monospace');
      label.setAttribute('font-size', '10px');
      label.setAttribute('font-weight', 'bold');
      label.setAttribute('fill', '#475569');
      label.textContent = `${node.ruleApplied.lhs}→${node.ruleApplied.rhsDisplay || 'ε'}`;
      this.edgesGroup.appendChild(label);
    }

    this.renderedEdgeIds.add(edgeKey);
  }

  _renderNodeElement(node) {
    if (this.renderedNodeIds.has(node.id)) return;

    const pos = this._getNodePosition(node);
    const isRoot = node.id === this.rootNode?.id;
    const isTarget = node.isTarget;
    const isPruned = node.isPruned;
    const isSelected = this.selectedNodeId === node.id;

    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('id', `node_g_${node.id}`);
    g.setAttribute('class', 'tree-node');
    g.setAttribute('transform', `translate(${pos.x}, ${pos.y})`);
    g.style.cursor = 'pointer';

    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('id', `node_rect_${node.id}`);
    rect.setAttribute('x', '0');
    rect.setAttribute('y', '0');
    rect.setAttribute('width', pos.width);
    rect.setAttribute('height', pos.height);

    let cardBg = '#ffffff';
    let borderStroke = '#64748b';

    if (isTarget) {
      cardBg = '#f0fff4';
      borderStroke = '#2e7d32';
    } else if (isPruned) {
      cardBg = '#f8fafc';
      borderStroke = '#a0aec0';
    } else if (isRoot) {
      cardBg = '#ffffff';
      borderStroke = '#1f3a60';
    }

    rect.setAttribute('fill', cardBg);
    rect.setAttribute('stroke', isSelected ? '#1f3a60' : borderStroke);
    rect.setAttribute('stroke-width', isSelected ? '2.5' : (isTarget ? '2' : '1.2'));
    if (isPruned) rect.setAttribute('stroke-dasharray', '3,2');
    g.appendChild(rect);

    const header = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    header.setAttribute('id', `node_header_${node.id}`);
    header.setAttribute('x', '1');
    header.setAttribute('y', '1');
    header.setAttribute('width', pos.width - 2);
    header.setAttribute('height', '13');

    let headerColor = '#475569';
    if (isTarget) headerColor = '#2e7d32';
    else if (isPruned) headerColor = '#a0aec0';
    else if (isRoot) headerColor = '#1f3a60';

    header.setAttribute('fill', headerColor);
    g.appendChild(header);

    const hText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    hText.setAttribute('id', `node_htext_${node.id}`);
    hText.setAttribute('x', '4');
    hText.setAttribute('y', '10');
    hText.setAttribute('font-family', 'Segoe UI, Tahoma, sans-serif');
    hText.setAttribute('font-size', '9px');
    hText.setAttribute('font-weight', 'bold');
    hText.setAttribute('fill', '#ffffff');

    let label = `d:${node.depth}`;
    if (isRoot) label += ' [START]';
    else if (isTarget) label += ' [MATCH]';
    else if (isPruned) label += ' [PRUNED]';

    hText.textContent = label;
    g.appendChild(hText);

    const sText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    sText.setAttribute('x', pos.width / 2);
    sText.setAttribute('y', '30');
    sText.setAttribute('text-anchor', 'middle');
    sText.setAttribute('font-family', 'Courier New, monospace');
    sText.setAttribute('font-size', '12px');
    sText.setAttribute('font-weight', 'bold');
    sText.setAttribute('fill', isPruned ? '#64748b' : '#0f172a');

    const disp = node.currentString === '' ? 'ε (empty)' : (node.currentString.length > 14 ? node.currentString.substring(0, 12) + '…' : node.currentString);
    sText.textContent = disp;
    g.appendChild(sText);

    if (node.ruleApplied) {
      const sub = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      sub.setAttribute('x', pos.width / 2);
      sub.setAttribute('y', '41');
      sub.setAttribute('text-anchor', 'middle');
      sub.setAttribute('font-family', 'Segoe UI, Tahoma, sans-serif');
      sub.setAttribute('font-size', '9px');
      sub.setAttribute('fill', '#64748b');
      sub.textContent = `@ idx ${node.matchIndex}`;
      g.appendChild(sub);
    }

    g.addEventListener('click', (e) => {
      e.stopPropagation();
      this.selectNode(node.id);
    });

    this.nodesGroup.appendChild(g);
    this.renderedNodeIds.add(node.id);
  }

  highlightTargetPath(targetNode) {
    let curr = targetNode;
    while (curr) {
      const edge = document.getElementById(`edge_${curr.id}`);
      if (edge) {
        edge.setAttribute('stroke', '#2e7d32');
        edge.setAttribute('stroke-width', '2.5');
        edge.setAttribute('marker-end', 'url(#arrow-target)');
      }
      const edgeLabel = document.getElementById(`edge_label_${curr.id}`);
      if (edgeLabel) {
        edgeLabel.setAttribute('fill', '#2e7d32');
        edgeLabel.setAttribute('font-weight', 'bold');
      }

      const rect = document.getElementById(`node_rect_${curr.id}`);
      if (rect) {
        rect.setAttribute('stroke', '#2e7d32');
        rect.setAttribute('stroke-width', '2.2');
        rect.setAttribute('fill', '#f0fff4');
      }
      const header = document.getElementById(`node_header_${curr.id}`);
      if (header) {
        header.setAttribute('fill', '#2e7d32');
      }

      curr = curr.parentId ? this.nodesMap.get(curr.parentId) : null;
    }
  }

  selectNode(nodeId) {
    if (this.selectedNodeId) {
      const prevSel = document.getElementById(`sel_${this.selectedNodeId}`);
      if (prevSel) prevSel.remove();
    }

    this.selectedNodeId = nodeId;
    const node = this.nodesMap.get(nodeId);
    const pos = this.nodePositions.get(nodeId);

    if (node && pos) {
      const g = document.getElementById(`node_g_${nodeId}`);
      if (g) {
        const sel = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        sel.setAttribute('id', `sel_${nodeId}`);
        sel.setAttribute('x', '-2');
        sel.setAttribute('y', '-2');
        sel.setAttribute('width', pos.width + 4);
        sel.setAttribute('height', pos.height + 4);
        sel.setAttribute('fill', 'none');
        sel.setAttribute('stroke', '#1f3a60');
        sel.setAttribute('stroke-width', '2');
        sel.setAttribute('stroke-dasharray', '2,2');
        g.appendChild(sel);
      }

      if (this.options.onNodeSelect) {
        this.options.onNodeSelect(node);
      }
    }
  }

  fitToScreen() {
    if (this.nodePositions.size === 0) return;

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const pos of this.nodePositions.values()) {
      minX = Math.min(minX, pos.x);
      maxX = Math.max(maxX, pos.x + pos.width);
      minY = Math.min(minY, pos.y);
      maxY = Math.max(maxY, pos.y + pos.height);
    }

    const rect = this.container.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const contentWidth = maxX - minX + 60;
    const contentHeight = maxY - minY + 60;

    const scaleX = rect.width / contentWidth;
    const scaleY = rect.height / contentHeight;
    this.scale = Math.max(0.15, Math.min(1.2, Math.min(scaleX, scaleY)));

    this.panX = (rect.width - contentWidth * this.scale) / 2 - minX * this.scale + 30 * this.scale;
    this.panY = 25;

    this.updateTransform();
  }
}
