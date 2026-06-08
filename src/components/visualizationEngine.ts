import * as d3 from 'd3';
import { DynastyNode, Relationship, NodeId, GraphModel } from '../models/types';
import { calculateAggregate } from '../utils/scoreAggregator';
import { computeEdgeStyle } from '../utils/edgeStyle';
import { sanitizeHtml } from '../utils/sanitize';

/**
 * Configuration constants for the visualization
 */
const CONFIG = {
  // Bubble sizing
  MIN_BUBBLE_RADIUS: 25,
  MAX_BUBBLE_RADIUS: 60,
  MAX_CHILDREN_FOR_SCALING: 20,

  // Colors by node type
  NODE_COLORS: {
    person: '#3b82f6',      // blue
    party: '#f97316',       // orange
    organization: '#a855f7', // purple
    institution: '#22c55e',  // green
  } as Record<string, string>,

  // Force simulation
  CHARGE_STRENGTH: -400,
  LINK_DISTANCE: 150,
  COLLISION_PADDING: 10,

  // Animation
  TRANSITION_DURATION: 500, // ms (between 300-800)

  // Zoom
  MIN_ZOOM: 0.25,
  MAX_ZOOM: 4,

  // Label
  MAX_LABEL_LENGTH: 24,

  // Performance
  MAX_VISIBLE_WARNING: 200,
};

export interface SimNode extends d3.SimulationNodeDatum {
  id: string;
  node: DynastyNode;
  radius: number;
}

export interface SimLink extends d3.SimulationLinkDatum<SimNode> {
  relationship: Relationship;
}

/**
 * The VisualizationEngine manages the D3.js force-directed layout,
 * SVG rendering, and animation for the dynasty graph.
 */
export class VisualizationEngine {
  private svg!: d3.Selection<SVGSVGElement, unknown, null, undefined>;
  private container!: d3.Selection<SVGGElement, unknown, null, undefined>;
  private simulation!: d3.Simulation<SimNode, SimLink>;
  private zoom!: d3.ZoomBehavior<SVGSVGElement, unknown>;
  private model!: GraphModel;
  private width: number = 0;
  private height: number = 0;
  private nodeGroup!: d3.Selection<SVGGElement, unknown, null, undefined>;
  private linkGroup!: d3.Selection<SVGGElement, unknown, null, undefined>;
  private warningBanner: HTMLElement | null = null;

  /**
   * Initialize the visualization engine with a DOM container and graph model.
   */
  initialize(element: HTMLElement, model: GraphModel): void {
    this.model = model;
    this.width = element.clientWidth || 800;
    this.height = element.clientHeight || 600;

    // Clear existing content
    d3.select(element).selectAll('*').remove();

    // Create SVG
    this.svg = d3.select(element)
      .append('svg')
      .attr('width', '100%')
      .attr('height', '100%')
      .attr('viewBox', `0 0 ${this.width} ${this.height}`);

    // Add defs for arrowheads and filters
    const defs = this.svg.append('defs');

    // Glow filter for expanded nodes
    const filter = defs.append('filter')
      .attr('id', 'glow')
      .attr('x', '-50%')
      .attr('y', '-50%')
      .attr('width', '200%')
      .attr('height', '200%');
    filter.append('feGaussianBlur')
      .attr('stdDeviation', '3')
      .attr('result', 'coloredBlur');
    const feMerge = filter.append('feMerge');
    feMerge.append('feMergeNode').attr('in', 'coloredBlur');
    feMerge.append('feMergeNode').attr('in', 'SourceGraphic');

    // Arrowhead marker
    defs.append('marker')
      .attr('id', 'arrowhead')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 10)
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', '#9ca3af');

    // Create zoom behavior
    this.zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([CONFIG.MIN_ZOOM, CONFIG.MAX_ZOOM])
      .on('zoom', (event) => {
        this.container.attr('transform', event.transform);
      });

    this.svg.call(this.zoom);

    // Create container group for zoom/pan
    this.container = this.svg.append('g').attr('class', 'graph-container');

    // Links rendered below nodes
    this.linkGroup = this.container.append('g').attr('class', 'links');
    this.nodeGroup = this.container.append('g').attr('class', 'nodes');

    // Initialize force simulation
    this.simulation = d3.forceSimulation<SimNode, SimLink>()
      .force('charge', d3.forceManyBody().strength(CONFIG.CHARGE_STRENGTH))
      .force('center', d3.forceCenter(this.width / 2, this.height / 2))
      .force('collision', d3.forceCollide<SimNode>()
        .radius(d => d.radius + CONFIG.COLLISION_PADDING))
      .force('link', d3.forceLink<SimNode, SimLink>()
        .id(d => d.id)
        .distance(CONFIG.LINK_DISTANCE))
      .on('tick', () => this.onTick());
  }

  /**
   * Calculates bubble radius based on number of children.
   */
  calculateRadius(node: DynastyNode): number {
    const childCount = this.model.getChildren(node.id).length;
    const ratio = Math.min(childCount, CONFIG.MAX_CHILDREN_FOR_SCALING) / CONFIG.MAX_CHILDREN_FOR_SCALING;
    return CONFIG.MIN_BUBBLE_RADIUS + ratio * (CONFIG.MAX_BUBBLE_RADIUS - CONFIG.MIN_BUBBLE_RADIUS);
  }

  /**
   * Truncates a label to MAX_LABEL_LENGTH with ellipsis.
   */
  truncateLabel(name: string): string {
    if (name.length > CONFIG.MAX_LABEL_LENGTH) {
      return name.substring(0, CONFIG.MAX_LABEL_LENGTH - 1) + '\u2026';
    }
    return name;
  }

  /**
   * Updates the visualization with current visible nodes and relationships.
   */
  updateLayout(): void {
    const visibleNodes = this.model.getVisibleNodes();
    const visibleRelationships = this.model.getVisibleRelationships();

    // Performance warning
    if (visibleNodes.length > CONFIG.MAX_VISIBLE_WARNING) {
      this.showPerformanceWarning(visibleNodes.length);
    } else {
      this.hidePerformanceWarning();
    }

    // Create simulation nodes
    const simNodes: SimNode[] = visibleNodes.map(node => ({
      id: node.id,
      node,
      radius: this.calculateRadius(node),
    }));

    // Create simulation links
    const simLinks: SimLink[] = visibleRelationships.map(rel => ({
      source: rel.sourceId as string,
      target: rel.targetId as string,
      relationship: rel,
    }));

    // Update simulation
    this.simulation.nodes(simNodes);
    (this.simulation.force('link') as d3.ForceLink<SimNode, SimLink>)
      .links(simLinks);
    (this.simulation.force('collision') as d3.ForceCollide<SimNode>)
      .radius(d => d.radius + CONFIG.COLLISION_PADDING);

    // Restart simulation
    this.simulation.alpha(0.8).restart();

    // Render nodes and links
    this.renderNodes(simNodes);
    this.renderLinks(simLinks);
  }

  /**
   * Renders bubble nodes as SVG groups.
   */
  private renderNodes(simNodes: SimNode[]): void {
    const nodeSelection = this.nodeGroup
      .selectAll<SVGGElement, SimNode>('.node')
      .data(simNodes, d => d.id);

    // Remove exiting nodes
    nodeSelection.exit()
      .transition()
      .duration(CONFIG.TRANSITION_DURATION)
      .attr('opacity', 0)
      .remove();

    // Enter new nodes
    const nodeEnter = nodeSelection.enter()
      .append('g')
      .attr('class', 'node')
      .attr('cursor', 'pointer')
      .attr('opacity', 0);

    // Circle
    nodeEnter.append('circle')
      .attr('r', d => d.radius)
      .attr('fill', d => CONFIG.NODE_COLORS[d.node.nodeType] || '#6b7280')
      .attr('stroke', '#fff')
      .attr('stroke-width', 2);

    // Label
    nodeEnter.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '0.35em')
      .attr('font-size', '11px')
      .attr('fill', '#fff')
      .attr('pointer-events', 'none')
      .text(d => sanitizeHtml(this.truncateLabel(d.node.name)));

    // Expand indicator for non-leaf nodes
    nodeEnter.each((d, _i, nodes) => {
      const children = this.model.getChildren(d.node.id);
      if (children.length > 0 && !this.model.isExpanded(d.node.id)) {
        d3.select(nodes[_i]).append('text')
          .attr('class', 'expand-indicator')
          .attr('text-anchor', 'middle')
          .attr('dy', d.radius - 8)
          .attr('font-size', '14px')
          .attr('fill', '#fff')
          .text('+');
      }
    });

    // Animate enter
    nodeEnter.transition()
      .duration(CONFIG.TRANSITION_DURATION)
      .attr('opacity', 1);

    // Update existing + new (merge)
    const nodeUpdate = nodeEnter.merge(nodeSelection);

    // Apply glow effect for expanded nodes
    nodeUpdate.select('circle')
      .attr('filter', d => this.model.isExpanded(d.node.id) ? 'url(#glow)' : null);
  }

  /**
   * Renders relationship arrows as SVG paths.
   */
  private renderLinks(simLinks: SimLink[]): void {
    const linkSelection = this.linkGroup
      .selectAll<SVGGElement, SimLink>('.link')
      .data(simLinks, d => d.relationship.id);

    // Remove exiting links
    linkSelection.exit()
      .transition()
      .duration(CONFIG.TRANSITION_DURATION)
      .attr('opacity', 0)
      .remove();

    // Enter new links
    const linkEnter = linkSelection.enter()
      .append('g')
      .attr('class', 'link')
      .attr('opacity', 0);

    // Path for the arrow
    linkEnter.append('path')
      .attr('class', 'link-path')
      .attr('fill', 'none')
      .attr('marker-end', 'url(#arrowhead)')
      .each((d, _i, paths) => {
        const issues = this.model.getIssues(d.relationship.id);
        const aggregate = calculateAggregate(issues);
        const style = computeEdgeStyle(aggregate);
        d3.select(paths[_i])
          .attr('stroke', style.color)
          .attr('stroke-width', style.strokeWidth)
          .attr('stroke-dasharray', style.dashArray === 'none' ? null : style.dashArray);
      });

    // Invisible wider path for click target (minimum 8px)
    linkEnter.append('path')
      .attr('class', 'link-hitarea')
      .attr('fill', 'none')
      .attr('stroke', 'transparent')
      .attr('stroke-width', 8)
      .attr('cursor', 'pointer');

    // Label at midpoint
    linkEnter.append('text')
      .attr('class', 'link-label')
      .attr('text-anchor', 'middle')
      .attr('font-size', '9px')
      .attr('fill', '#6b7280')
      .text(d => sanitizeHtml(d.relationship.label));

    // Animate enter
    linkEnter.transition()
      .duration(CONFIG.TRANSITION_DURATION)
      .attr('opacity', 1);
  }

  /**
   * Called on each simulation tick to update positions.
   */
  private onTick(): void {
    // Update node positions
    this.nodeGroup.selectAll<SVGGElement, SimNode>('.node')
      .attr('transform', d => `translate(${d.x ?? 0},${d.y ?? 0})`);

    // Update link paths
    this.linkGroup.selectAll<SVGGElement, SimLink>('.link').each(function(d) {
      const source = d.source as SimNode;
      const target = d.target as SimNode;
      if (!source.x || !source.y || !target.x || !target.y) return;

      const dx = target.x - source.x;
      const dy = target.y - source.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist === 0) return;

      // Offset start and end to bubble edges
      const sourceRadius = source.radius;
      const targetRadius = target.radius;
      const sx = source.x + (dx / dist) * sourceRadius;
      const sy = source.y + (dy / dist) * sourceRadius;
      const tx = target.x - (dx / dist) * (targetRadius + 10); // +10 for arrowhead
      const ty = target.y - (dy / dist) * (targetRadius + 10);

      const pathData = `M${sx},${sy}L${tx},${ty}`;
      const group = d3.select(this);
      group.selectAll('path').attr('d', pathData);

      // Position label at midpoint
      const mx = (sx + tx) / 2;
      const my = (sy + ty) / 2;
      group.select('text').attr('x', mx).attr('y', my - 8);
    });
  }

  /**
   * Shows a performance warning banner.
   */
  private showPerformanceWarning(nodeCount: number): void {
    if (this.warningBanner) return;
    this.warningBanner = document.createElement('div');
    this.warningBanner.className = 'performance-warning';
    this.warningBanner.textContent = `\u26A0\uFE0F ${nodeCount} nodes visible. Consider collapsing some branches for better performance.`;
    this.warningBanner.style.cssText = 'position:fixed;top:10px;left:50%;transform:translateX(-50%);background:#fef3c7;border:1px solid #f59e0b;border-radius:8px;padding:8px 16px;display:flex;align-items:center;gap:8px;z-index:1000;font-size:14px;';

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '\u2715';
    closeBtn.style.cssText = 'border:none;background:none;cursor:pointer;font-size:16px;';
    closeBtn.addEventListener('click', () => {
      this.hidePerformanceWarning();
    });
    this.warningBanner.appendChild(closeBtn);

    document.body.appendChild(this.warningBanner);
  }

  /**
   * Hides the performance warning banner.
   */
  private hidePerformanceWarning(): void {
    if (this.warningBanner) {
      this.warningBanner.remove();
      this.warningBanner = null;
    }
  }

  /**
   * Centers the view on a specific node.
   */
  centerOnNode(nodeId: NodeId): void {
    const simNodes = this.simulation.nodes();
    const targetNode = simNodes.find(n => n.id === nodeId);
    if (!targetNode || !targetNode.x || !targetNode.y) return;

    const transform = d3.zoomIdentity
      .translate(this.width / 2, this.height / 2)
      .scale(1)
      .translate(-targetNode.x, -targetNode.y);

    this.svg.transition()
      .duration(CONFIG.TRANSITION_DURATION)
      .call(this.zoom.transform, transform);
  }

  /**
   * Returns the SVG element for external event binding.
   */
  getSvg(): SVGSVGElement {
    return this.svg.node()!;
  }

  /**
   * Returns the node group for external event binding.
   */
  getNodeGroup(): d3.Selection<SVGGElement, unknown, null, undefined> {
    return this.nodeGroup;
  }

  /**
   * Returns the link group for external event binding.
   */
  getLinkGroup(): d3.Selection<SVGGElement, unknown, null, undefined> {
    return this.linkGroup;
  }
}
