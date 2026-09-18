import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import type { ForceGraphMethods, LinkObject, NodeObject } from 'react-force-graph-2d';
import styles from './GraphPage.module.css';
import { useInvestigation } from '../context/InvestigationContext';
import { useSearchParams } from 'react-router-dom';
import { Link } from 'react-router-dom';

const entityColors: Record<string, string> = {
  case: '#f59e0b', person: '#2563eb', phone: '#8b5cf6', vehicle: '#0f766e',
  location: '#16a34a', account: '#dc2626', transaction: '#db2777', evidence: '#64748b',
};

interface GraphNodeDatum {
  id: string;
  name: string;
  type: string;
  x?: number;
  y?: number;
  fx?: number;
  fy?: number;
}

interface GraphLinkDatum {
  source: string | GraphNodeDatum;
  target: string | GraphNodeDatum;
  type: string;
  weight: number;
}

interface ConfigurableForce {
  strength?: (value: number) => unknown;
  distance?: (value: number) => unknown;
}

function endpointId(endpoint: GraphLinkDatum['source'] | undefined): string | undefined {
  return typeof endpoint === 'string' ? endpoint : endpoint?.id;
}

export function GraphPage() {
  const { dataset } = useInvestigation();
  const [searchParams] = useSearchParams();
  const scopedCaseId = searchParams.get('caseId');
  const [caseFilter, setCaseFilter] = useState(scopedCaseId ?? '');
  const [typeFilter, setTypeFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedNode, setSelectedNode] = useState<GraphNodeDatum | null>(null);
  const [rankings, setRankings] = useState<Array<{ id: string; name: string; score: number }>>([]);
  const fgRef = useRef<ForceGraphMethods<GraphNodeDatum, GraphLinkDatum> | undefined>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  useEffect(() => {
    // Keep direct case links in sync when React Router updates only the query string.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCaseFilter(scopedCaseId ?? '');
  }, [scopedCaseId]);

  const sourceOptions = useMemo(() => [...new Set([
    ...dataset.graphData.nodes.map(node => node.provenance?.sourceDataset),
    ...dataset.graphData.edges.map(edge => edge.provenance?.sourceDataset),
  ].filter((value): value is string => Boolean(value)))].sort(), [dataset.graphData]);
  
  const graphData = useMemo(() => {
    const datasetNodes = Array.isArray(dataset.graphData?.nodes) ? dataset.graphData.nodes : [];
    const datasetEdges = Array.isArray(dataset.graphData?.edges) ? dataset.graphData.edges : [];
    const nodeById = new Map(datasetNodes.map(node => [node.id, node]));
    const caseScopedIds = new Set(caseFilter ? [caseFilter] : datasetNodes.map(node => node.id));
    if (caseFilter) {
      let changed = true;
      while (changed) {
        changed = false;
        datasetEdges.forEach(edge => {
          if (!caseScopedIds.has(edge.source) && !caseScopedIds.has(edge.target)) return;
          if (!caseScopedIds.has(edge.source) || !caseScopedIds.has(edge.target)) changed = true;
          caseScopedIds.add(edge.source);
          caseScopedIds.add(edge.target);
        });
      }
    }
    const visibleRelationships = datasetEdges.filter(
      edge => {
        if (!caseScopedIds.has(edge.source) || !caseScopedIds.has(edge.target)) return false;
        if (typeFilter !== 'all' && nodeById.get(edge.source)?.type !== typeFilter && nodeById.get(edge.target)?.type !== typeFilter) return false;
        const edgeSource = edge.provenance?.sourceDataset;
        const sourceMatches = sourceFilter === 'all' || edgeSource === sourceFilter ||
          nodeById.get(edge.source)?.provenance?.sourceDataset === sourceFilter ||
          nodeById.get(edge.target)?.provenance?.sourceDataset === sourceFilter;
        if (!sourceMatches) return false;
        if (dateFrom && (!edge.timestamp || edge.timestamp.slice(0, 10) < dateFrom)) return false;
        if (dateTo && (!edge.timestamp || edge.timestamp.slice(0, 10) > dateTo)) return false;
        return true;
      }
    );
    const visibleNodeIds = new Set(visibleRelationships.flatMap(edge => [edge.source, edge.target]));
    if (typeFilter === 'all' && sourceFilter === 'all' && !dateFrom && !dateTo) {
      caseScopedIds.forEach(id => visibleNodeIds.add(id));
    }

    const nodes = datasetNodes.filter(node => visibleNodeIds.has(node.id)).map(n => ({
        id: n.id,
        name: n.label || n.id,
        type: n.type,
        x: undefined as number | undefined,
        y: undefined as number | undefined,
        fx: undefined as number | undefined,
        fy: undefined as number | undefined,
      }));
    const links = visibleRelationships.map((e) => ({
        source: e.source,
        target: e.target,
        type: e.relationship,
        weight: 1
      }));

    return { nodes, links };
  }, [caseFilter, dataset.graphData, dateFrom, dateTo, sourceFilter, typeFilter]);

  const visibleTypes = useMemo(
    () => [...new Set(graphData.nodes.map(node => node.type))],
    [graphData.nodes],
  );

  const exportGraph = useCallback(() => {
    const blob = new Blob([JSON.stringify(graphData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `nexusnet-graph${caseFilter ? `-${caseFilter}` : ''}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }, [caseFilter, graphData]);

  const runPageRank = useCallback(() => {
    const nodeIds = graphData.nodes.map(node => node.id);
    if (!nodeIds.length) return;
    const neighbors = new Map(nodeIds.map(id => [id, [] as string[]]));
    graphData.links.forEach(link => {
      const source = typeof link.source === 'string' ? link.source : (link.source as unknown as { id: string }).id;
      const target = typeof link.target === 'string' ? link.target : (link.target as unknown as { id: string }).id;
      neighbors.get(source)?.push(target);
      neighbors.get(target)?.push(source);
    });
    let scores = new Map(nodeIds.map(id => [id, 1 / nodeIds.length]));
    for (let iteration = 0; iteration < 30; iteration += 1) {
      const next = new Map(nodeIds.map(id => [id, (1 - 0.85) / nodeIds.length]));
      nodeIds.forEach(id => {
        const adjacent = neighbors.get(id) ?? [];
        if (!adjacent.length) return;
        const share = (0.85 * (scores.get(id) ?? 0)) / adjacent.length;
        adjacent.forEach(target => next.set(target, (next.get(target) ?? 0) + share));
      });
      scores = next;
    }
    const ranked = graphData.nodes
      .map(node => ({ id: node.id, name: node.name, score: scores.get(node.id) ?? 0 }))
      .sort((left, right) => right.score - left.score)
      .slice(0, 5);
    setRankings(ranked);
    const topNode = graphData.nodes.find(node => node.id === ranked[0]?.id);
    if (topNode) setSelectedNode(topNode);
  }, [graphData]);

  const [isLoading] = useState(false);

  useEffect(() => {
    if (containerRef.current) {
      setDimensions({
        width: containerRef.current.clientWidth,
        height: containerRef.current.clientHeight
      });
      
      const resizeObserver = new ResizeObserver(entries => {
        for (const entry of entries) {
          setDimensions({
            width: entry.contentRect.width,
            height: entry.contentRect.height
          });
        }
      });
      
      resizeObserver.observe(containerRef.current);
      return () => resizeObserver.disconnect();
    }
  }, []);

  useEffect(() => {
    if (graphData.nodes.length > 0) {
      setTimeout(() => {
        if (fgRef.current) {
          (fgRef.current.d3Force('charge') as ConfigurableForce | undefined)?.strength?.(-800);
          (fgRef.current.d3Force('link') as ConfigurableForce | undefined)?.distance?.(130);
          fgRef.current.d3ReheatSimulation();
          fgRef.current.zoomToFit(0, 110);
          const fittedZoom = fgRef.current.zoom();
          if (fittedZoom > 1.15) fgRef.current.zoom(1.15, 0);
        }
      }, 100);
    }
  }, [graphData]);

  const handleNodeClick = useCallback((node: NodeObject<GraphNodeDatum>) => {
    setSelectedNode(node as GraphNodeDatum);
    
    // Optional: center view on clicked node
    if (fgRef.current) {
      fgRef.current.centerAt(node.x, node.y, 1000);
      fgRef.current.zoom(2, 1000);
    }
  }, []);

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div>
          <h1>Relationship Mapping</h1>
          <p>Hidden Network Discovery & Key Influencer Identification</p>
        </div>
        <div className={styles.actions}>
          <Link className="btn-secondary" to="/hidden-connections">Find Connection</Link>
          <Link className="btn-secondary" to="/cross-case">Compare Cases</Link>
          <button className="btn-secondary" onClick={exportGraph} disabled={!graphData.nodes.length}>Export Graph</button>
          <button className="btn-primary" onClick={runPageRank} disabled={!graphData.nodes.length}>Run PageRank Algorithm</button>
        </div>
      </header>

      <div className={styles.graphLayout}>
        <div className={`glass-panel ${styles.graphContainer}`}>
          <div className={styles.graphToolbar}>
            <div className={styles.legend}>
              {visibleTypes.map(type => <span className={styles.legendItem} key={type}><span className={styles.dot} style={{backgroundColor: entityColors[type] ?? '#64748b'}}></span>{type}</span>)}
            </div>
            <div className={styles.filters}>
              <select className={styles.filterSelect} value={caseFilter} onChange={event => setCaseFilter(event.target.value)} aria-label="Filter graph by case">
                <option value="">All cases</option>
                {dataset.cases.map(item => <option value={item.case_id} key={item.case_id}>{item.case_id}</option>)}
              </select>
              <select className={styles.filterSelect} value={typeFilter} onChange={event => setTypeFilter(event.target.value)} aria-label="Filter graph by entity type">
                <option value="all">All entity types</option>
                {[...new Set(dataset.graphData.nodes.map(node => node.type))].map(type => <option value={type} key={type}>{type}</option>)}
              </select>
              <select className={styles.filterSelect} value={sourceFilter} onChange={event => setSourceFilter(event.target.value)} aria-label="Filter graph by source">
                <option value="all">All sources</option>
                {sourceOptions.map(source => <option value={source} key={source}>{source}</option>)}
              </select>
              <input className={styles.filterSelect} type="date" value={dateFrom} onChange={event => setDateFrom(event.target.value)} aria-label="Graph date from" />
              <input className={styles.filterSelect} type="date" value={dateTo} onChange={event => setDateTo(event.target.value)} aria-label="Graph date to" />
            </div>
          </div>
          
          <div className={styles.canvasWrapper} ref={containerRef}>
            {isLoading ? (
              <div style={{ color: 'var(--text-muted)' }}>Loading network graph...</div>
            ) : graphData.nodes.length === 0 ? (
              <div className={styles.emptyState}>
                No extracted relationships are available in this scope.
              </div>
            ) : (
              <ForceGraph2D
                ref={fgRef}
                graphData={graphData}
                nodeLabel="name"
                nodeRelSize={14}
                linkColor={() => '#718096'}
                linkWidth={link => (link.weight || 1) * 2}
                linkDirectionalArrowLength={6}
                linkDirectionalArrowRelPos={1}
                linkCurvature={0.06}
                linkLabel={(link: LinkObject<GraphNodeDatum, GraphLinkDatum>) => link.type || 'Relationship'}
                onNodeClick={handleNodeClick}
                width={dimensions.width}
                height={dimensions.height}
                nodeCanvasObject={(node: NodeObject<GraphNodeDatum>, ctx, globalScale) => {
                  const label = node.name || 'Unknown';
                  const nodeX = node.x ?? 0;
                  const nodeY = node.y ?? 0;
                  const fontSize = 12.5 / globalScale;
                  ctx.font = `600 ${fontSize}px Inter, Sans-Serif`;
                  
                  const isCase = node.type === 'case';
                  const isSelected = selectedNode?.id === node.id;
                  const r = (isCase ? 9 : 10) / Math.max(0.82, Math.min(1.08, globalScale));

                  if (isSelected) {
                    ctx.beginPath();
                    ctx.arc(nodeX, nodeY, r + 5 / globalScale, 0, 2 * Math.PI, false);
                    ctx.fillStyle = `${entityColors[node.type] ?? '#64748b'}2e`;
                    ctx.fill();
                  }
                  
                  // Draw circle
                  ctx.beginPath();
                  ctx.arc(nodeX, nodeY, r, 0, 2 * Math.PI, false);
                  ctx.fillStyle = entityColors[node.type] ?? '#64748b';
                  ctx.fill();
                  
                  // Draw border
                  ctx.lineWidth = (isSelected ? 2.5 : 1.75) / globalScale;
                  ctx.strokeStyle = '#ffffff';
                  ctx.stroke();

                  // Draw label
                  const labelWidth = ctx.measureText(label).width;
                  const labelX = nodeX;
                  const labelY = nodeY + r + fontSize * 1.45;
                  const padX = 5 / globalScale;
                  const padY = 3 / globalScale;
                  ctx.fillStyle = 'rgba(255, 255, 255, 0.94)';
                  ctx.strokeStyle = 'rgba(203, 213, 225, 0.9)';
                  ctx.lineWidth = 0.75 / globalScale;
                  ctx.beginPath();
                  ctx.roundRect(
                    labelX - labelWidth / 2 - padX,
                    labelY - fontSize / 2 - padY,
                    labelWidth + padX * 2,
                    fontSize + padY * 2,
                    4 / globalScale
                  );
                  ctx.fill();
                  ctx.stroke();
                  ctx.textAlign = 'center';
                  ctx.textBaseline = 'middle';
                  ctx.fillStyle = '#1e293b';
                  ctx.fillText(label, labelX, labelY);
                }}
                onEngineStop={() => {
                  if (fgRef.current) {
                    fgRef.current.zoomToFit(0, 110);
                    const fittedZoom = fgRef.current.zoom();
                    if (fittedZoom > 1.15) fgRef.current.zoom(1.15, 0);
                  }
                }}
              />
            )}
          </div>
        </div>

        <div className={`glass-panel ${styles.sidebar}`}>
          <h3>Entity Details</h3>
          {selectedNode ? (
            <div className={styles.entityDetails}>
              <div className={styles.entityHeader}>
                <div className={styles.avatar} style={{
                  backgroundColor: selectedNode.type === 'case' ? '#fef3c7' : '#dbeafe',
                  color: selectedNode.type === 'case' ? '#b45309' : '#1d4ed8'
                }}>
                  {selectedNode.type === 'person' ? '👤' : '📁'}
                </div>
                <div>
                  <h4>{selectedNode.name}</h4>
                  <span className={styles.entityType}>{selectedNode.type}</span>
                </div>
              </div>
              
              <div className={styles.detailSection}>
                <h5>Relationship Summary</h5>
                <div className={styles.metric}>
                  <span>Direct relationships:</span>
                  <strong>
                    {graphData.links.filter((link) =>
                      endpointId(link.source) === selectedNode.id || endpointId(link.target) === selectedNode.id
                    ).length}
                  </strong>
                </div>
              </div>
              {rankings.length > 0 && (
                <div className={styles.detailSection}>
                  <h5>PageRank — key influencers</h5>
                  {rankings.map((item, index) => <div className={styles.metric} key={item.id}><span>{index + 1}. {item.name}</span><strong>{item.score.toFixed(3)}</strong></div>)}
                </div>
              )}
            </div>
          ) : (
            <div className={styles.emptyState}>
              <p>Select an entity from the graph to view its profile and direct relationships.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
