import type { GraphData } from '../types/domain';

/**
 * Keep the investigation graphs focused on evidence-backed case-to-person links.
 * Other extracted entities remain available to evidence, search, and profiles,
 * but they do not imply that two cases are connected.
 */
export function casePersonGraph(graph: GraphData): GraphData {
  const nodeType = new Map(graph.nodes.map((node) => [node.id, node.type]));
  const edges = graph.edges.filter((edge) => {
    const sourceType = nodeType.get(edge.source);
    const targetType = nodeType.get(edge.target);
    return (sourceType === 'case' && targetType === 'person') ||
      (sourceType === 'person' && targetType === 'case');
  });
  const visibleNodeIds = new Set(edges.flatMap((edge) => [edge.source, edge.target]));

  return {
    nodes: graph.nodes.filter((node) => visibleNodeIds.has(node.id)),
    edges,
  };
}
