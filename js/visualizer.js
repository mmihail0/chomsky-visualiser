/**
 * Chomsky Grammar & Semi-Thue System - Tree & Graph Visualizer (SVG)
 * File: js/visualizer.js
 */

export class DerivationTreeVisualizer {
  constructor(containerElement, options = {}) {
    this.container = containerElement;
    this.options = Object.assign({
      nodeWidth: 140,
      nodeHeight: 52,
      levelGap: 70,
      siblingGap: 24,
      onNodeSelect: null
    }, options);

    this.svg = null;
    this.viewportGroup = null;
    this.edgesGroup = null;
    this.nodesGroup = null;

    // Pan & Zoom state
    this.scale = 1;
    this.panX = 0;
    this.panY = 0;
    this.isDragging = false;
    this.dragStartX = 0;
    this.dragStartY = 0;

    // Tree data
    this.nodesMap = new Map();
    this.rootNode = null;
    this.targetNode = null;
    this.selectedNodeId = null;

    this.initDOM();
    this.bindEvents();
  }

  initDOM() {
    this.container.innerHTML = '';
    this.container.style.position = 'relative';
    this.container.style.overflow = 'hidden';
    this.container.style.userSelect = 'none';

    // Create SVG
    this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.svg.setAttribute('width', '100%');
    this.svg.setAttribute('height', '100%');
    this.svg.style.display = 'block';
    this.svg.style.cursor = 'grab';

    // SVG Defs (markers for arrows, patterns for pruned hatch)
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    defs.innerHTML = `
      <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M 0 1 L 10 5 L 0 9 z" fill="#000080" />
      </marker>
      <marker id="arrow-target" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M 0 1 L 10 5 L 0 9 z" fill="#008000" />
      </marker>
      <pattern id="pruned-hatch" width="8" height="8" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
        <line x1="0" y1="0" x2="0" y2="8" stroke="#a0a0a0" stroke-width="1.5" />
      </pattern>
    `;
    this.svg.appendChild(defs);

    // Viewport group for pan/zoom
    this.viewportGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.edgesGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.nodesGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');

    this.viewportGroup.appendChild(this.edgesGroup);
    this.viewportGroup.appendChild(this.nodesGroup);
    this.svg.appendChild(this.viewportGroup);

    this.container.appendChild(this.svg);
  }

  bindEvents() {
    // Pan via mouse drag
    this.svg.addEventListener('mousedown', (e) => {
      // Ignore if clicked on a node directly (let node click handle selection)
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

    // Zoom via wheel
    this.container.addEventListener('wheel', (e) => {
      e.preventDefault();
      const rect = this.container.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
      this.zoomAt(mouseX, mouseY, zoomFactor);
    }, { passive: false });

    // Window resize
    window.addEventListener('resize', () => {
      // Keep viewport updated
    });
  }

  zoomAt(x, y, factor) {
    const oldScale = this.scale;
    let newScale = this.scale * factor;
    newScale = Math.max(0.15, Math.min(3.5, newScale));

    // Keep point under cursor stationary
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
    this.panX = 40;
    this.panY = 40;
    this.updateTransform();
  }

  updateTransform() {
    this.viewportGroup.setAttribute(
      'transform',
      `translate(${this.panX}, ${this.panY}) scale(${this.scale})`
    );
  }

  /**
   * Set and render new tree data
   */
  setData(nodesMap, rootNode, targetNode = null) {
    this.nodesMap = nodesMap;
    this.rootNode = rootNode;
    this.targetNode = targetNode;

    if (!rootNode) {
      this.clear();
      return;
    }

    this.layoutAndRender();
  }

  clear() {
    this.edgesGroup.innerHTML = '';
    this.nodesGroup.innerHTML = '';
  }

  /**
   * Calculate node positions using depth-layer horizontal distribution
   */
  calculatePositions() {
    if (!this.rootNode || this.nodesMap.size === 0) return { positions: new Map(), bounds: { minX: 0, maxX: 0, minY: 0, maxY: 0 } };

    const { nodeWidth, nodeHeight, levelGap, siblingGap } = this.options;
    const positions = new Map();

    // Group nodes by depth
    const levels = [];
    for (const [id, node] of this.nodesMap.entries()) {
      const d = node.depth;
      if (!levels[d]) levels[d] = [];
      levels[d].push(node);
    }

    // Assign positions depth by depth
    let maxOverallX = 0;

    // Bottom-up / Layer-based spacing
    for (let d = 0; d < levels.length; d++) {
      const rowNodes = levels[d];
      const y = 30 + d * (nodeHeight + levelGap);

      // Width of row
      const totalRowWidth = rowNodes.length * nodeWidth + (rowNodes.length - 1) * siblingGap;
      let startX = 40;

      for (let i = 0; i < rowNodes.length; i++) {
        const node = rowNodes[i];
        let x = startX + i * (nodeWidth + siblingGap);

        positions.set(node.id, { x, y, width: nodeWidth, height: nodeHeight });
        if (x + nodeWidth > maxOverallX) {
          maxOverallX = x + nodeWidth;
        }
      }
    }

    // Center parents over children where feasible for cleaner tree visual
    for (let d = levels.length - 2; d >= 0; d--) {
      const rowNodes = levels[d];
      for (const parent of rowNodes) {
        if (parent.children && parent.children.length > 0) {
          let sumChildX = 0;
          let validChildCount = 0;
          for (const childId of parent.children) {
            const childPos = positions.get(childId);
            if (childPos) {
              sumChildX += (childPos.x + nodeWidth / 2);
              validChildCount++;
            }
          }
          if (validChildCount > 0) {
            const desiredX = (sumChildX / validChildCount) - (nodeWidth / 2);
            // Don't shift if it collides with siblings
            const parentPos = positions.get(parent.id);
            if (parentPos) {
              parentPos.x = desiredX;
            }
          }
        }
      }
    }

    // Resolve any horizontal overlaps on each level
    for (let d = 0; d < levels.length; d++) {
      const rowNodes = levels[d];
      // Sort by x
      rowNodes.sort((a, b) => (positions.get(a.id)?.x || 0) - (positions.get(b.id)?.x || 0));

      for (let i = 1; i < rowNodes.length; i++) {
        const prev = positions.get(rowNodes[i - 1].id);
        const curr = positions.get(rowNodes[i].id);
        const minAllowedX = prev.x + nodeWidth + siblingGap;
        if (curr.x < minAllowedX) {
          curr.x = minAllowedX;
        }
      }
    }

    // Find bounding box
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const [id, pos] of positions.entries()) {
      minX = Math.min(minX, pos.x);
      maxX = Math.max(maxX, pos.x + pos.width);
      minY = Math.min(minY, pos.y);
      maxY = Math.max(maxY, pos.y + pos.height);
    }

    return {
      positions,
      bounds: {
        minX: minX === Infinity ? 0 : minX,
        maxX: maxX === -Infinity ? 500 : maxX,
        minY: minY === Infinity ? 0 : minY,
        maxY: maxY === -Infinity ? 500 : maxY
      }
    };
  }

  layoutAndRender() {
    const { positions, bounds } = this.calculatePositions();
    this.clear();

    const isPathToTarget = new Set();
    if (this.targetNode) {
      let curr = this.targetNode;
      while (curr) {
        isPathToTarget.add(curr.id);
        curr = curr.parentId ? this.nodesMap.get(curr.parentId) : null;
      }
    }

    // 1. Draw Edges
    const fragmentEdges = document.createDocumentFragment();
    for (const [id, node] of this.nodesMap.entries()) {
      if (!node.parentId) continue;
      const parentPos = positions.get(node.parentId);
      const childPos = positions.get(id);
      if (!parentPos || !childPos) continue;

      const x1 = parentPos.x + parentPos.width / 2;
      const y1 = parentPos.y + parentPos.height;
      const x2 = childPos.x + childPos.width / 2;
      const y2 = childPos.y;

      const isTargetPathEdge = isPathToTarget.has(node.id) && isPathToTarget.has(node.parentId);

      // Orthogonal connector
      const midY = y1 + (y2 - y1) * 0.45;
      const pathD = `M ${x1} ${y1} L ${x1} ${midY} L ${x2} ${midY} L ${x2} ${y2}`;

      const pathElem = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      pathElem.setAttribute('d', pathD);
      pathElem.setAttribute('fill', 'none');
      pathElem.setAttribute('stroke', isTargetPathEdge ? '#008000' : (node.isPruned ? '#808080' : '#000080'));
      pathElem.setAttribute('stroke-width', isTargetPathEdge ? '2.5' : (node.isPruned ? '1' : '1.5'));
      if (node.isPruned) {
        pathElem.setAttribute('stroke-dasharray', '3,3');
      }
      pathElem.setAttribute('marker-end', isTargetPathEdge ? 'url(#arrow-target)' : 'url(#arrow)');

      fragmentEdges.appendChild(pathElem);

      // Rule label on edge
      if (node.ruleApplied) {
        const textElem = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textElem.setAttribute('x', x2 + 4);
        textElem.setAttribute('y', midY + 12);
        textElem.setAttribute('font-family', 'Courier New, monospace');
        textElem.setAttribute('font-size', '10px');
        textElem.setAttribute('font-weight', 'bold');
        textElem.setAttribute('fill', isTargetPathEdge ? '#008000' : '#444444');
        const ruleTxt = `${node.ruleApplied.lhs}→${node.ruleApplied.rhsDisplay || 'ε'}`;
        textElem.textContent = ruleTxt;
        fragmentEdges.appendChild(textElem);
      }
    }
    this.edgesGroup.appendChild(fragmentEdges);

    // 2. Draw Nodes (Windows 95 Classic Card)
    const fragmentNodes = document.createDocumentFragment();
    for (const [id, node] of this.nodesMap.entries()) {
      const pos = positions.get(id);
      if (!pos) continue;

      const isRoot = node.id === this.rootNode?.id;
      const isTarget = node.isTarget;
      const isPruned = node.isPruned;
      const isSelected = this.selectedNodeId === node.id;
      const isOnTargetPath = isPathToTarget.has(node.id);

      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('class', `tree-node ${isTarget ? 'target-node' : ''} ${isSelected ? 'selected-node' : ''}`);
      g.setAttribute('data-id', id);
      g.setAttribute('transform', `translate(${pos.x}, ${pos.y})`);
      g.style.cursor = 'pointer';

      // Outer Card Background with Win95 3D bevel look
      const bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      bgRect.setAttribute('x', '0');
      bgRect.setAttribute('y', '0');
      bgRect.setAttribute('width', pos.width);
      bgRect.setAttribute('height', pos.height);

      let fillColor = '#ffffff';
      let strokeColor = '#000000';

      if (isTarget) {
        fillColor = '#e6ffe6';
        strokeColor = '#008000';
      } else if (isPruned) {
        fillColor = '#f0f0f0';
        strokeColor = '#808080';
      } else if (isRoot) {
        fillColor = '#ffffff';
        strokeColor = '#000080';
      }

      bgRect.setAttribute('fill', fillColor);
      bgRect.setAttribute('stroke', isSelected ? '#000080' : strokeColor);
      bgRect.setAttribute('stroke-width', isSelected ? '2.5' : (isOnTargetPath ? '2' : '1.5'));
      if (isPruned) {
        bgRect.setAttribute('stroke-dasharray', '4,2');
      }

      g.appendChild(bgRect);

      // Title Banner Bar (Win95 style)
      const bannerRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      bannerRect.setAttribute('x', '1.5');
      bannerRect.setAttribute('y', '1.5');
      bannerRect.setAttribute('width', pos.width - 3);
      bannerRect.setAttribute('height', '16');

      let bannerFill = '#000080';
      let bannerTextColor = '#ffffff';

      if (isTarget) {
        bannerFill = '#008000';
      } else if (isPruned) {
        bannerFill = '#808080';
      } else if (!isRoot && !isOnTargetPath) {
        bannerFill = '#7b95b8';
      }

      bannerRect.setAttribute('fill', bannerFill);
      g.appendChild(bannerRect);

      // Banner Text: Depth & Status
      const bannerText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      bannerText.setAttribute('x', '5');
      bannerText.setAttribute('y', '13');
      bannerText.setAttribute('font-family', 'MS Sans Serif, Tahoma, sans-serif');
      bannerText.setAttribute('font-size', '10px');
      bannerText.setAttribute('font-weight', 'bold');
      bannerText.setAttribute('fill', bannerTextColor);

      let bannerLabel = `d:${node.depth}`;
      if (isRoot) bannerLabel += ' [START]';
      else if (isTarget) bannerLabel += ' [MATCH!]';
      else if (isPruned) bannerLabel += ' [PRUNED]';

      bannerText.textContent = bannerLabel;
      g.appendChild(bannerText);

      // Main String Text (Courier New monospace)
      const stringText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      stringText.setAttribute('x', pos.width / 2);
      stringText.setAttribute('y', '36');
      stringText.setAttribute('text-anchor', 'middle');
      stringText.setAttribute('font-family', 'Courier New, monospace');
      stringText.setAttribute('font-size', '13px');
      stringText.setAttribute('font-weight', 'bold');
      stringText.setAttribute('fill', isPruned ? '#666666' : '#000000');

      const displayStr = node.currentString === '' ? 'ε (empty)' : (node.currentString.length > 15 ? node.currentString.substring(0, 13) + '…' : node.currentString);
      stringText.textContent = displayStr;
      g.appendChild(stringText);

      // Rule info at bottom of card
      if (node.ruleApplied) {
        const subText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        subText.setAttribute('x', pos.width / 2);
        subText.setAttribute('y', '47');
        subText.setAttribute('text-anchor', 'middle');
        subText.setAttribute('font-family', 'Segoe UI, Tahoma, sans-serif');
        subText.setAttribute('font-size', '9px');
        subText.setAttribute('fill', '#555555');
        subText.textContent = `@ idx ${node.matchIndex}`;
        g.appendChild(subText);
      }

      // Selection outline
      if (isSelected) {
        const selRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        selRect.setAttribute('x', '-3');
        selRect.setAttribute('y', '-3');
        selRect.setAttribute('width', pos.width + 6);
        selRect.setAttribute('height', pos.height + 6);
        selRect.setAttribute('fill', 'none');
        selRect.setAttribute('stroke', '#000080');
        selRect.setAttribute('stroke-width', '1.5');
        selRect.setAttribute('stroke-dasharray', '2,2');
        g.appendChild(selRect);
      }

      // Event listener for node selection
      g.addEventListener('click', (e) => {
        e.stopPropagation();
        this.selectNode(node.id);
      });

      fragmentNodes.appendChild(g);
    }
    this.nodesGroup.appendChild(fragmentNodes);
  }

  selectNode(nodeId) {
    this.selectedNodeId = nodeId;
    const node = this.nodesMap.get(nodeId);

    // Re-render selection highlighting
    this.layoutAndRender();

    if (this.options.onNodeSelect && node) {
      this.options.onNodeSelect(node);
    }
  }

  fitToScreen() {
    const { bounds } = this.calculatePositions();
    const rect = this.container.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const contentWidth = bounds.maxX - bounds.minX + 80;
    const contentHeight = bounds.maxY - bounds.minY + 80;

    const scaleX = rect.width / contentWidth;
    const scaleY = rect.height / contentHeight;
    this.scale = Math.max(0.2, Math.min(1.2, Math.min(scaleX, scaleY)));

    this.panX = (rect.width - contentWidth * this.scale) / 2 - bounds.minX * this.scale + 40 * this.scale;
    this.panY = 30;

    this.updateTransform();
  }
}
