import type { GraphData } from '../types/domain';
import { isLikelyVehicleName } from '../services/fileParser';

/**
 * Build the Network Graph view: every case remains visible, including isolated
 * cases, while only evidence-backed case-to-person links and their people are
 * included. Other entity types remain in the complete knowledge graph.
 */
export function casePersonGraph(graph: GraphData): GraphData {
  const nodeType = new Map(graph.nodes.map((node) => [node.id, node.type]));
  const invalidPersonIds = new Set(
    graph.nodes
      .filter((node) => node.type === 'person' && isLikelyVehicleName(node.label))
      .map((node) => node.id),
  );
  const edges = graph.edges.filter((edge) => {
    if (invalidPersonIds.has(edge.source) || invalidPersonIds.has(edge.target)) return false;
    const sourceType = nodeType.get(edge.source);
    const targetType = nodeType.get(edge.target);
    return (sourceType === 'case' && targetType === 'person') ||
      (sourceType === 'person' && targetType === 'case');
  });
  const visibleNodeIds = new Set(
    graph.nodes.filter((node) => node.type === 'case').map((node) => node.id),
  );
  edges.forEach((edge) => {
    visibleNodeIds.add(edge.source);
    visibleNodeIds.add(edge.target);
  });

  return {
    nodes: graph.nodes.filter((node) => visibleNodeIds.has(node.id)),
    edges,
  };
}
