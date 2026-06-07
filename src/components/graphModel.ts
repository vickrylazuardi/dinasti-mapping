import {
  ValidDataSet,
  DynastyNode,
  Relationship,
  Issue,
  NodeId,
  RelationshipId,
  GraphModel,
} from '../models/types';

/**
 * Error thrown when graph construction fails due to a cycle.
 */
export class GraphCycleError extends Error {
  constructor(public readonly cycleNodeIds: NodeId[]) {
    super(`Cycle detected involving nodes: ${cycleNodeIds.join(', ')}`);
    this.name = 'GraphCycleError';
  }
}

/**
 * Error thrown when graph construction finds unreachable nodes.
 */
export class UnreachableNodesError extends Error {
  constructor(public readonly unreachableNodeIds: NodeId[]) {
    super(`Unreachable nodes found: ${unreachableNodeIds.join(', ')}`);
    this.name = 'UnreachableNodesError';
  }
}

/**
 * Detects cycles in a directed graph using DFS.
 * Returns the list of node IDs participating in cycles, or empty if no cycles exist.
 */
function detectCycles(
  nodes: DynastyNode[],
  adjacency: Map<string, string[]>
): NodeId[] {
  const WHITE = 0; // unvisited
  const GRAY = 1;  // in current DFS path
  const BLACK = 2; // fully processed

  const color = new Map<string, number>();
  const cycleNodes = new Set<string>();

  for (const node of nodes) {
    color.set(node.id, WHITE);
  }

  function dfs(nodeId: string, path: string[]): boolean {
    color.set(nodeId, GRAY);
    path.push(nodeId);

    const neighbors = adjacency.get(nodeId) || [];
    for (const neighbor of neighbors) {
      const neighborColor = color.get(neighbor);
      if (neighborColor === GRAY) {
        // Found a cycle - mark all nodes in the cycle
        const cycleStart = path.indexOf(neighbor);
        for (let i = cycleStart; i < path.length; i++) {
          cycleNodes.add(path[i]);
        }
        cycleNodes.add(neighbor);
        return true;
      }
      if (neighborColor === WHITE) {
        dfs(neighbor, path);
      }
    }

    path.pop();
    color.set(nodeId, BLACK);
    return false;
  }

  for (const node of nodes) {
    if (color.get(node.id) === WHITE) {
      dfs(node.id, []);
    }
  }

  return Array.from(cycleNodes) as NodeId[];
}

/**
 * Finds all nodes reachable from root nodes via BFS.
 */
function findReachableNodes(
  rootNodes: DynastyNode[],
  adjacency: Map<string, string[]>
): Set<string> {
  const reachable = new Set<string>();
  const queue: string[] = rootNodes.map(n => n.id);

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (reachable.has(current)) continue;
    reachable.add(current);

    const neighbors = adjacency.get(current) || [];
    for (const neighbor of neighbors) {
      if (!reachable.has(neighbor)) {
        queue.push(neighbor);
      }
    }
  }

  return reachable;
}

/**
 * Builds a GraphModel from validated data.
 *
 * Preconditions:
 * - data has passed all validation checks
 * - All referential integrity constraints are satisfied
 *
 * Postconditions:
 * - Returns a GraphModel where every node is reachable from a root
 * - Root nodes (level 0) are the initial visible set
 * - Graph is a DAG (directed acyclic graph)
 *
 * Throws:
 * - GraphCycleError if a cycle is detected
 * - UnreachableNodesError if any node is not reachable from a root
 */
export function buildGraph(data: ValidDataSet): GraphModel {
  // Build lookup maps
  const nodeById = new Map<string, DynastyNode>();
  for (const node of data.nodes) {
    nodeById.set(node.id, node);
  }

  // Build adjacency list (source -> targets)
  const adjacency = new Map<string, string[]>();
  for (const node of data.nodes) {
    adjacency.set(node.id, []);
  }
  for (const rel of data.relationships) {
    const neighbors = adjacency.get(rel.sourceId) || [];
    neighbors.push(rel.targetId);
    adjacency.set(rel.sourceId, neighbors);
  }

  // Detect cycles
  const cycleNodes = detectCycles(data.nodes, adjacency);
  if (cycleNodes.length > 0) {
    throw new GraphCycleError(cycleNodes);
  }

  // Identify root nodes
  const rootNodes = data.nodes.filter(n => n.level === 0);

  // Check reachability
  const reachable = findReachableNodes(rootNodes, adjacency);
  const unreachableNodes = data.nodes.filter(n => !reachable.has(n.id));
  if (unreachableNodes.length > 0) {
    throw new UnreachableNodesError(unreachableNodes.map(n => n.id));
  }

  // Build relationship lookup maps
  // Key: "sourceId|targetId" -> Relationship
  const relationshipByPair = new Map<string, Relationship>();
  for (const rel of data.relationships) {
    relationshipByPair.set(`${rel.sourceId}|${rel.targetId}`, rel);
  }

  // Build issues lookup by relationship ID
  const issuesByRelationship = new Map<string, Issue[]>();
  for (const issue of data.issues) {
    const existing = issuesByRelationship.get(issue.relationshipId) || [];
    existing.push(issue);
    issuesByRelationship.set(issue.relationshipId, existing);
  }

  // Expansion state tracking
  const expandedNodes = new Set<string>();

  // GraphModel implementation
  const model: GraphModel = {
    rootNodes,

    getNode(id: NodeId): DynastyNode | undefined {
      return nodeById.get(id);
    },

    getChildren(id: NodeId): DynastyNode[] {
      const childIds = adjacency.get(id) || [];
      return childIds
        .map(childId => nodeById.get(childId))
        .filter((n): n is DynastyNode => n !== undefined);
    },

    getRelationship(sourceId: NodeId, targetId: NodeId): Relationship | undefined {
      return relationshipByPair.get(`${sourceId}|${targetId}`);
    },

    getIssues(relId: RelationshipId): Issue[] {
      return issuesByRelationship.get(relId) || [];
    },

    isExpanded(id: NodeId): boolean {
      return expandedNodes.has(id);
    },

    expandNode(id: NodeId): void {
      const node = nodeById.get(id);
      if (!node) return;
      // Idempotent: no change if already expanded
      // No-op for leaf nodes (nodes with no children)
      const children = adjacency.get(id) || [];
      if (children.length === 0) return;
      expandedNodes.add(id);
    },

    collapseNode(id: NodeId): void {
      const node = nodeById.get(id);
      if (!node) return;
      if (!expandedNodes.has(id)) return;

      // Recursively collapse all expanded descendants
      const childIds = adjacency.get(id) || [];
      for (const childId of childIds) {
        if (expandedNodes.has(childId)) {
          model.collapseNode(childId as NodeId);
        }
      }
      expandedNodes.delete(id);
    },

    getVisibleNodes(): DynastyNode[] {
      const visible: DynastyNode[] = [...rootNodes];
      const visited = new Set<string>(rootNodes.map(n => n.id));

      function addVisibleChildren(nodeId: string): void {
        if (!expandedNodes.has(nodeId)) return;
        const childIds = adjacency.get(nodeId) || [];
        for (const childId of childIds) {
          if (!visited.has(childId)) {
            visited.add(childId);
            const childNode = nodeById.get(childId);
            if (childNode) {
              visible.push(childNode);
              addVisibleChildren(childId);
            }
          }
        }
      }

      for (const root of rootNodes) {
        addVisibleChildren(root.id);
      }

      return visible;
    },

    getVisibleRelationships(): Relationship[] {
      const visibleNodeIds = new Set(model.getVisibleNodes().map(n => n.id));
      return data.relationships.filter(
        rel => visibleNodeIds.has(rel.sourceId) && visibleNodeIds.has(rel.targetId)
      );
    },
  };

  return model;
}
