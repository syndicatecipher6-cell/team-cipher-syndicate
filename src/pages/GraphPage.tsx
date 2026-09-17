import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import styles from './GraphPage.module.css';
import { useInvestigation } from '../context/InvestigationContext';
import { useSearchParams } from 'react-router-dom';

export function GraphPage() {
  const { dataset } = useInvestigation();
  const [searchParams] = useSearchParams();
  const scopedCaseId = searchParams.get('caseId');
  const [selectedNode, setSelectedNode] = useState<any>(null);
  const fgRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  
  const graphData = useMemo(() => {
    const datasetNodes = Array.isArray(dataset.graphData?.nodes) ? dataset.graphData.nodes : [];
    const datasetEdges = Array.isArray(dataset.graphData?.edges) ? dataset.graphData.edges : [];
    const entityById = new Map(datasetNodes.map(node => [node.id, node]));
    const directCasePersonEdges = datasetEdges.flatMap(edge => {
      const source = entityById.get(edge.source);
      const target = entityById.get(edge.target);
      if (source?.type === 'case' && target?.type === 'person') {
        return [{ edge, caseId: source.id, personId: target.id }];
      }
      if (source?.type === 'person' && target?.type === 'case') {
        return [{ edge, caseId: target.id, personId: source.id }];
      }
      return [];
    });
    const casesByPerson = new Map<string, Set<string>>();
    directCasePersonEdges.forEach(({ caseId, personId }) => {
      const caseIds = casesByPerson.get(personId) ?? new Set<string>();
      caseIds.add(caseId);
      casesByPerson.set(personId, caseIds);
    });
    const commonPersonIds = new Set(
      [...casesByPerson.entries()]
        .filter(([, caseIds]) => caseIds.size >= 2)
        .map(([personId]) => personId)
    );
    const visibleRelationships = scopedCaseId
      ? directCasePersonEdges.filter(({ caseId }) => caseId === scopedCaseId)
      : directCasePersonEdges.filter(({ personId }) => commonPersonIds.has(personId));
    const visibleNodeIds = new Set<string>();
    visibleRelationships.forEach(({ caseId, personId }) => {
      visibleNodeIds.add(caseId);
      visibleNodeIds.add(personId);
    });

    const nodes = datasetNodes.filter(node => visibleNodeIds.has(node.id)).map(n => ({
        id: n.id,
        name: n.label || n.id,
        type: n.type,
        x: undefined as number | undefined,
        y: undefined as number | undefined,
        fx: undefined as number | undefined,
        fy: undefined as number | undefined,
      }));
    const links = visibleRelationships.map(({ edge: e }) => ({
        source: e.source,
        target: e.target,
        type: e.relationship,
        weight: 1
      }));

    // Shared case networks read more clearly as stable components: cases above
    // and their common resolved person below.
    if (nodes.length <= 30) {
      const adjacency = new Map(nodes.map(node => [node.id, [] as string[]]));
      links.forEach(link => {
        adjacency.get(link.source)?.push(link.target);
        adjacency.get(link.target)?.push(link.source);
      });
      const remaining = new Set(nodes.map(node => node.id));
      const components: string[][] = [];
      while (remaining.size) {
        const start = remaining.values().next().value as string;
        const component: string[] = [];
        const queue = [start];
        remaining.delete(start);
        while (queue.length) {
          const current = queue.shift()!;
          component.push(current);
          for (const neighbor of adjacency.get(current) ?? []) {
            if (remaining.delete(neighbor)) queue.push(neighbor);
          }
        }
        components.push(component.sort());
      }
      components.sort((left, right) => left[0].localeCompare(right[0]));
      const nodeById = new Map(nodes.map(node => [node.id, node]));
      const layoutWidth = Math.max(320, Math.min(1000, dimensions.width * 0.82));
      const componentWidth = layoutWidth / Math.max(1, components.length);
      const positionRow = (ids: string[], centerX: number, y: number) => {
        const spacing = Math.min(180, componentWidth / Math.max(1.6, ids.length));
        ids.forEach((id, index) => {
          const node = nodeById.get(id);
          if (!node) return;
          const x = centerX + (index - (ids.length - 1) / 2) * spacing;
          node.x = x;
          node.y = y;
          node.fx = x;
          node.fy = y;
        });
      };
      components.forEach((component, index) => {
        const centerX = -layoutWidth / 2 + componentWidth * (index + 0.5);
        positionRow(component.filter(id => nodeById.get(id)?.type === 'case'), centerX, -70);
        positionRow(component.filter(id => nodeById.get(id)?.type === 'person'), centerX, 95);
      });
    }

    return { nodes, links };
  }, [dataset.graphData, dimensions.width, scopedCaseId]);

  const [isLoading] = useState(false);

  useEffect(() => {
    if (containerRef.current) {
      setDimensions({
        width: containerRef.current.clientWidth,
        height: containerRef.current.clientHeight
      });
      
      const resizeObserver = new ResizeObserver(entries => {
        for (let entry of entries) {
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
          fgRef.current.d3Force('charge').strength(-800);
          fgRef.current.d3Force('link').distance(130);
          fgRef.current.d3ReheatSimulation();
          fgRef.current.zoomToFit(0, 110);
          const fittedZoom = fgRef.current.zoom();
          if (fittedZoom > 1.15) fgRef.current.zoom(1.15, 0);
        }
      }, 100);
    }
  }, [graphData]);

  const handleNodeClick = useCallback((node: any) => {
    setSelectedNode(node);
    
    // Optional: center view on clicked node
    if (fgRef.current) {
      // @ts-ignore
      fgRef.current.centerAt(node.x, node.y, 1000);
      // @ts-ignore
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
          <button className="btn-secondary">Export Graph</button>
          <button className="btn-primary">Run PageRank Algorithm</button>
        </div>
      </header>

      <div className={styles.graphLayout}>
        <div className={`glass-panel ${styles.graphContainer}`}>
          <div className={styles.graphToolbar}>
            <div className={styles.legend}>
              <span className={styles.legendItem}><span className={styles.dot} style={{backgroundColor: '#f59e0b'}}></span> Case</span>
              <span className={styles.legendItem}><span className={styles.dot} style={{backgroundColor: '#2563eb'}}></span> Common Person</span>
            </div>
            <div className={styles.filters}>
              <select className={styles.filterSelect} disabled aria-label="Graph scope">
                <option>Shared Case Networks</option>
              </select>
            </div>
          </div>
          
          <div className={styles.canvasWrapper} ref={containerRef}>
            {isLoading ? (
              <div style={{ color: 'var(--text-muted)' }}>Loading network graph...</div>
            ) : graphData.nodes.length === 0 ? (
              <div className={styles.emptyState}>
                No common person is linked to two or more cases yet.
              </div>
            ) : (
              <ForceGraph2D
                ref={fgRef}
                graphData={graphData}
                nodeLabel="name"
                nodeRelSize={14}
                linkColor={() => '#718096'}
                linkWidth={link => ((link as any).weight || 1) * 2}
                linkDirectionalArrowLength={6}
                linkDirectionalArrowRelPos={1}
                linkCurvature={0.06}
                linkLabel={(link: any) => link.type || 'Relationship'}
                onNodeClick={handleNodeClick}
                width={dimensions.width}
                height={dimensions.height}
                nodeCanvasObject={(node: any, ctx, globalScale) => {
                  const label = node.name || 'Unknown';
                  const fontSize = 12.5 / globalScale;
                  ctx.font = `600 ${fontSize}px Inter, Sans-Serif`;
                  
                  const isCase = node.type === 'case';
                  const isSelected = selectedNode?.id === node.id;
                  const r = (isCase ? 9 : 10) / Math.max(0.82, Math.min(1.08, globalScale));

                  if (isSelected) {
                    ctx.beginPath();
                    ctx.arc(node.x, node.y, r + 5 / globalScale, 0, 2 * Math.PI, false);
                    ctx.fillStyle = isCase ? 'rgba(245, 158, 11, 0.18)' : 'rgba(37, 99, 235, 0.16)';
                    ctx.fill();
                  }
                  
                  // Draw circle
                  ctx.beginPath();
                  ctx.arc(node.x, node.y, r, 0, 2 * Math.PI, false);
                  ctx.fillStyle = isCase ? '#f59e0b' : '#2563eb';
                  ctx.fill();
                  
                  // Draw border
                  ctx.lineWidth = (isSelected ? 2.5 : 1.75) / globalScale;
                  ctx.strokeStyle = '#ffffff';
                  ctx.stroke();

                  // Draw label
                  const labelWidth = ctx.measureText(label).width;
                  const labelX = node.x;
                  const labelY = node.y + r + fontSize * 1.45;
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
                  <span>{selectedNode.type === 'person' ? 'Connected Cases:' : 'Connected Common People:'}</span>
                  <strong>
                    {graphData.links.filter((l: any) => 
                      l.source.id === selectedNode.id || l.target.id === selectedNode.id || 
                      l.source === selectedNode.id || l.target === selectedNode.id
                    ).length}
                  </strong>
                </div>
              </div>
            </div>
          ) : (
            <div className={styles.emptyState}>
              <p>Select an entity from the graph to view its profile and shared-case connections.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
