import { NodeId, RelationshipId, GraphModel } from '../models/types';
import { VisualizationEngine, SimNode, SimLink } from './visualizationEngine';
import { sanitizeHtml } from '../utils/sanitize';

/**
 * Callback types for interaction events
 */
export interface InteractionCallbacks {
  onIssuesPanelOpen: (relationshipId: RelationshipId) => void;
  onIssuesPanelClose: () => void;
}

/**
 * The InteractionController manages user interactions:
 * - Node clicks (expand/collapse)
 * - Edge clicks (open issue panel)
 * - Hover tooltips
 * - Animation queuing
 */
export class InteractionController {
  private model: GraphModel;
  private engine: VisualizationEngine;
  private callbacks: InteractionCallbacks;
  private animating: boolean = false;
  private clickQueue: (() => void)[] = [];
  private tooltip: HTMLElement | null = null;
  private tooltipTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(
    model: GraphModel,
    engine: VisualizationEngine,
    callbacks: InteractionCallbacks
  ) {
    this.model = model;
    this.engine = engine;
    this.callbacks = callbacks;
    this.createTooltip();
    this.bindEvents();
  }

  /**
   * Creates the tooltip DOM element.
   */
  private createTooltip(): void {
    this.tooltip = document.createElement('div');
    this.tooltip.className = 'graph-tooltip';
    this.tooltip.style.cssText = `
      position: fixed;
      display: none;
      background: #1f2937;
      color: #f9fafb;
      padding: 8px 12px;
      border-radius: 6px;
      font-size: 13px;
      max-width: 250px;
      pointer-events: none;
      z-index: 1001;
      box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
    `;
    document.body.appendChild(this.tooltip);
  }

  /**
   * Binds event listeners to the visualization elements.
   */
  private bindEvents(): void {
    // Node click events
    this.engine.getNodeGroup()
      .on('click', (event: MouseEvent, d: unknown) => {
        event.stopPropagation();
        const simNode = d as SimNode;
        this.handleNodeClick(simNode.node.id);
      });

    // Edge click events (on hit area)
    this.engine.getLinkGroup()
      .on('click', (event: MouseEvent, d: unknown) => {
        event.stopPropagation();
        const simLink = d as SimLink;
        this.handleEdgeClick(simLink.relationship.id);
      });

    // Node hover events
    this.engine.getNodeGroup()
      .on('mouseenter', (event: MouseEvent, d: unknown) => {
        const simNode = d as SimNode;
        this.showTooltip(simNode, event);
      })
      .on('mouseleave', () => {
        this.hideTooltip();
      });

    // Background click to close panel
    this.engine.getSvg().addEventListener('click', () => {
      this.callbacks.onIssuesPanelClose();
    });
  }

  /**
   * Handles a node click event. If animating, queues the click.
   */
  private handleNodeClick(nodeId: NodeId): void {
    if (this.animating) {
      this.clickQueue.push(() => this.handleNodeClick(nodeId));
      return;
    }

    const children = this.model.getChildren(nodeId);

    // Leaf node: no-op
    if (children.length === 0) return;

    this.animating = true;

    if (this.model.isExpanded(nodeId)) {
      this.model.collapseNode(nodeId);
    } else {
      this.model.expandNode(nodeId);
    }

    // Update visualization
    this.engine.updateLayout();

    // Process queued clicks after animation completes (500ms)
    setTimeout(() => {
      this.animating = false;
      if (this.clickQueue.length > 0) {
        const next = this.clickQueue.shift()!;
        next();
      }
    }, 500);
  }

  /**
   * Handles an edge click event to open the issue panel.
   */
  private handleEdgeClick(relationshipId: RelationshipId): void {
    this.callbacks.onIssuesPanelOpen(relationshipId);
  }

  /**
   * Shows a tooltip for a node on hover within 200ms.
   */
  private showTooltip(simNode: SimNode, event: MouseEvent): void {
    if (!this.tooltip) return;

    // Show within 200ms
    this.tooltipTimeout = setTimeout(() => {
      if (!this.tooltip) return;

      const node = simNode.node;
      const content = node.description
        ? `<strong>${sanitizeHtml(node.name)}</strong><br/>${sanitizeHtml(node.description)}`
        : `<strong>${sanitizeHtml(node.name)}</strong>`;

      this.tooltip.innerHTML = content;
      this.tooltip.style.display = 'block';
      this.tooltip.style.left = `${event.clientX + 12}px`;
      this.tooltip.style.top = `${event.clientY + 12}px`;
    }, 200);
  }

  /**
   * Hides the tooltip immediately when cursor leaves.
   */
  private hideTooltip(): void {
    if (this.tooltipTimeout) {
      clearTimeout(this.tooltipTimeout);
      this.tooltipTimeout = null;
    }
    if (this.tooltip) {
      this.tooltip.style.display = 'none';
    }
  }

  /**
   * Cleanup method to remove event listeners and tooltip.
   */
  destroy(): void {
    if (this.tooltip) {
      this.tooltip.remove();
      this.tooltip = null;
    }
    if (this.tooltipTimeout) {
      clearTimeout(this.tooltipTimeout);
    }
  }
}
