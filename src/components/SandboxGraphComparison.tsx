import type { GraphData, GraphEdge, GraphNode, SandboxModification } from '../types/domain';

type Position = { x: number; y: number };

const WIDTH = 560;
const HEIGHT = 330;

const edgeKey = (edge: GraphEdge) => `${edge.source}|${edge.relationship}|${edge.target}`;

const shortLabel = (value: string) => value.length > 18 ? `${value.slice(0, 16)}…` : value;

function positionsFor(nodes: GraphNode[]): Map<string, Position> {
  const ordered = [...nodes].sort((a, b) => {
    if (a.type === 'case' && b.type !== 'case') return -1;
    if (a.type !== 'case' && b.type === 'case') return 1;
    return a.id.localeCompare(b.id);
  });
  const positions = new Map<string, Position>();
  ordered.forEach((node, index) => {
    const angle = -Math.PI / 2 + (index * Math.PI * 2) / Math.max(ordered.length, 1);
    positions.set(node.id, {
      x: WIDTH / 2 + Math.cos(angle) * 215,
      y: HEIGHT / 2 + Math.sin(angle) * 120,
    });
  });
  return positions;
}

function nodeColour(type: GraphNode['type']) {
  if (type === 'case') return '#d8922d';
  if (type === 'person') return '#2f7f7b';
  if (type === 'phone') return '#4f7fa3';
  if (type === 'vehicle') return '#667985';
  return '#718895';
}

function relationshipText(edge: GraphEdge, labels: Map<string, string>) {
  return `${labels.get(edge.source) ?? edge.source} —[${edge.relationship}]→ ${labels.get(edge.target) ?? edge.target}`;
}

function GraphSnapshot({
  title,
  graph,
  original,
  positions,
  addedEdgeKeys,
  removedEdges,
  addedNodeIds,
  removedNodeIds,
  disputedEdgeIds,
  after,
}: {
  title: string;
  graph: GraphData;
  original: GraphData;
  positions: Map<string, Position>;
  addedEdgeKeys: Set<string>;
  removedEdges: GraphEdge[];
  addedNodeIds: Set<string>;
  removedNodeIds: Set<string>;
  disputedEdgeIds: Set<string>;
  after?: boolean;
}) {
  const visibleNodes = after
    ? [...graph.nodes, ...original.nodes.filter((node) => removedNodeIds.has(node.id))]
    : graph.nodes;

  const drawEdge = (edge: GraphEdge, className: string, key: string) => {
    const source = positions.get(edge.source);
    const target = positions.get(edge.target);
    if (!source || !target) return null;
    return <line key={key} className={className} x1={source.x} y1={source.y} x2={target.x} y2={target.y} />;
  };

  return (
    <figure className="sandbox-graph-card">
      <figcaption>{title}</figcaption>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={`${title} investigation graph`}>
        {graph.edges.map((edge) => drawEdge(
          edge,
          after && addedEdgeKeys.has(edgeKey(edge))
            ? 'sandbox-edge sandbox-edge--added'
            : after && disputedEdgeIds.has(edge.id)
              ? 'sandbox-edge sandbox-edge--disputed'
              : 'sandbox-edge',
          `${title}-${edge.id}-${edgeKey(edge)}`,
        ))}
        {after && removedEdges.map((edge) => drawEdge(edge, 'sandbox-edge sandbox-edge--removed', `removed-${edgeKey(edge)}`))}
        {visibleNodes.map((node) => {
          const position = positions.get(node.id);
          if (!position) return null;
          const removed = after && removedNodeIds.has(node.id);
          const added = after && addedNodeIds.has(node.id);
          return (
            <g key={`${title}-${node.id}`} className={removed ? 'sandbox-node sandbox-node--removed' : added ? 'sandbox-node sandbox-node--added' : 'sandbox-node'}>
              <circle cx={position.x} cy={position.y} r="11" fill={nodeColour(node.type)} />
              <text x={position.x} y={position.y + 25} textAnchor="middle">{shortLabel(node.label)}</text>
            </g>
          );
        })}
      </svg>
    </figure>
  );
}

export function SandboxGraphComparison({
  before,
  after,
  modifications,
}: {
  before: GraphData;
  after: GraphData;
  modifications: SandboxModification[];
}) {
  const unionNodes = [...before.nodes];
  after.nodes.forEach((node) => {
    if (!unionNodes.some((item) => item.id === node.id)) unionNodes.push(node);
  });
  const positions = positionsFor(unionNodes);
  const labels = new Map(unionNodes.map((node) => [node.id, node.label]));
  const beforeKeys = new Set(before.edges.map(edgeKey));
  const afterKeys = new Set(after.edges.map(edgeKey));
  const addedEdges = after.edges.filter((edge) => !beforeKeys.has(edgeKey(edge)));
  const removedEdges = before.edges.filter((edge) => !afterKeys.has(edgeKey(edge)));
  const beforeNodeIds = new Set(before.nodes.map((node) => node.id));
  const afterNodeIds = new Set(after.nodes.map((node) => node.id));
  const addedNodeIds = new Set(after.nodes.filter((node) => !beforeNodeIds.has(node.id)).map((node) => node.id));
  const removedNodeIds = new Set(before.nodes.filter((node) => !afterNodeIds.has(node.id)).map((node) => node.id));
  const disputedEvidence = new Set(
    modifications
      .filter((item) => item.operation === 'EVIDENCE_DISPUTE')
      .map((item) => String(item.parameters.evidence_id)),
  );
  const disputedEdgeIds = new Set(
    before.edges
      .filter((edge) => edge.evidenceIds.some((id) => disputedEvidence.has(id)))
      .map((edge) => edge.id),
  );

  const changeDescriptions = new Set<string>();
  addedEdges.forEach((edge) => changeDescriptions.add(`Added connection: ${relationshipText(edge, labels)}.`));
  removedEdges.forEach((edge) => changeDescriptions.add(`Removed or redirected connection: ${relationshipText(edge, labels)}.`));
  before.edges
    .filter((edge) => disputedEdgeIds.has(edge.id))
    .forEach((edge) => changeDescriptions.add(`Disputed evidence affects: ${relationshipText(edge, labels)}.`));
  modifications.forEach((item) => {
    if (item.operation === 'IDENTITY_MERGE') {
      const source = String(item.parameters.source_entity_id);
      const target = String(item.parameters.target_entity_id);
      changeDescriptions.add(`Identity merge: ${labels.get(source) ?? source} is hypothetically merged into ${labels.get(target) ?? target}; its connections are redirected to the retained identity.`);
    } else if (item.operation === 'ENTITY_SPLIT') {
      const source = String(item.parameters.entity_id);
      const created = String(item.parameters.new_entity_id);
      changeDescriptions.add(`Entity split: ${labels.get(source) ?? source} is separated into a new hypothetical identity, ${labels.get(created) ?? created}.`);
    } else if (item.operation === 'TIMELINE_CHANGE') {
      changeDescriptions.add(`Timeline change: event ${String(item.parameters.event_id)} is moved to ${String(item.parameters.timestamp)}; graph connections remain unchanged.`);
    }
  });
  if (!changeDescriptions.size) changeDescriptions.add('No graph connection has changed in this sandbox yet.');

  return (
    <section className="sandbox-graph-comparison" aria-label="Before and after sandbox graphs">
      <div className="sandbox-graph-grid">
        <GraphSnapshot
          title="Before · Original graph"
          graph={before}
          original={before}
          positions={positions}
          addedEdgeKeys={new Set()}
          removedEdges={[]}
          addedNodeIds={new Set()}
          removedNodeIds={new Set()}
          disputedEdgeIds={new Set()}
        />
        <GraphSnapshot
          title="After · Hypothetical graph"
          graph={after}
          original={before}
          positions={positions}
          addedEdgeKeys={new Set(addedEdges.map(edgeKey))}
          removedEdges={removedEdges}
          addedNodeIds={addedNodeIds}
          removedNodeIds={removedNodeIds}
          disputedEdgeIds={disputedEdgeIds}
          after
        />
      </div>
      <div className="sandbox-graph-legend" aria-label="Graph change legend">
        <span><i className="unchanged" />Unchanged</span>
        <span><i className="added" />Added or redirected</span>
        <span><i className="removed" />Removed</span>
        <span><i className="disputed" />Disputed evidence</span>
      </div>
      <div className="sandbox-connection-changes">
        <h3>Connection changes</h3>
        {[...changeDescriptions].map((description) => <p key={description}>{description}</p>)}
      </div>
    </section>
  );
}
