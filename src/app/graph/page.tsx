"use client";

import dynamic from 'next/dynamic';
import { useState, useCallback, useRef, useEffect } from 'react';
import styles from './page.module.css';

// Dynamically import ForceGraph2D to avoid SSR issues with canvas
const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), { ssr: false });

export default function GraphExplorer() {
  const [selectedNode, setSelectedNode] = useState<any>(null);
  const [graphData, setGraphData] = useState<{ nodes: any[], links: any[] }>({ nodes: [], links: [] });
  const [isLoading, setIsLoading] = useState(true);
  const fgRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

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
    fetch('/api/graph')
      .then(res => res.json())
      .then(data => {
        if (data.nodes && data.links) {
          setGraphData(data);
          
          // Apply custom forces after data is loaded
          setTimeout(() => {
            if (fgRef.current) {
              fgRef.current.d3Force('charge').strength(-400); // Stronger repulsion
              fgRef.current.d3Force('link').distance(60); // Longer links
            }
          }, 100);
        }
        setIsLoading(false);
      })
      .catch(err => {
        console.error("Failed to fetch graph data", err);
        setIsLoading(false);
      });
  }, []);

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
              <span className={styles.legendItem}><span className={styles.dot} style={{backgroundColor: '#ef4444'}}></span> High Risk</span>
              <span className={styles.legendItem}><span className={styles.dot} style={{backgroundColor: '#f59e0b'}}></span> Medium Risk</span>
              <span className={styles.legendItem}><span className={styles.dot} style={{backgroundColor: '#10b981'}}></span> Low Risk</span>
            </div>
            <div className={styles.filters}>
              <select className={styles.filterSelect}>
                <option>All Entities</option>
                <option>Only People</option>
                <option>Only Organizations</option>
              </select>
            </div>
          </div>
          
          <div className={styles.canvasWrapper} ref={containerRef}>
            {isLoading ? (
              <div style={{ color: 'var(--text-muted)' }}>Loading network graph...</div>
            ) : (
              <ForceGraph2D
                ref={fgRef}
                graphData={graphData}
                nodeLabel="name"
                nodeRelSize={6}
                linkColor={() => '#cbd5e1'}
                linkWidth={link => (link.weight || 1) * 1.5}
                linkDirectionalArrowLength={3.5}
                linkDirectionalArrowRelPos={1}
                linkCurvature={0.1}
                onNodeClick={handleNodeClick}
                width={dimensions.width}
                height={dimensions.height}
                nodeCanvasObject={(node: any, ctx, globalScale) => {
                  const label = node.name || 'Unknown';
                  const fontSize = 12 / globalScale;
                  ctx.font = `${fontSize}px Sans-Serif`;
                  
                  // Calculate radius based on node val
                  const val = node.val || 10;
                  const r = Math.sqrt(val) * 2;
                  
                  // Draw circle
                  ctx.beginPath();
                  ctx.arc(node.x, node.y, r, 0, 2 * Math.PI, false);
                  ctx.fillStyle = node.risk === 'high' ? '#ef4444' : node.risk === 'medium' ? '#f59e0b' : '#10b981';
                  ctx.fill();
                  
                  // Draw border
                  ctx.lineWidth = 1 / globalScale;
                  ctx.strokeStyle = '#ffffff';
                  ctx.stroke();

                  // Draw label
                  ctx.textAlign = 'center';
                  ctx.textBaseline = 'middle';
                  ctx.fillStyle = '#1e293b';
                  ctx.fillText(label, node.x, node.y + r + fontSize);
                }}
                onEngineStop={() => {
                  if (fgRef.current) {
                    fgRef.current.zoomToFit(400, 50);
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
                  backgroundColor: selectedNode.risk === 'high' ? 'var(--danger-light)' : 'var(--bg-tertiary)',
                  color: selectedNode.risk === 'high' ? 'var(--danger)' : 'var(--text-primary)'
                }}>
                  {selectedNode.type === 'person' ? '👤' : selectedNode.type === 'organization' ? '🏢' : '📍'}
                </div>
                <div>
                  <h4>{selectedNode.name}</h4>
                  <span className={styles.entityType}>{selectedNode.type}</span>
                </div>
              </div>
              
              <div className={styles.detailSection}>
                <h5>Risk Profile</h5>
                <div className={styles.riskBadge} data-risk={selectedNode.risk}>
                  {selectedNode.risk.toUpperCase()}
                </div>
              </div>

              <div className={styles.detailSection}>
                <h5>Network Influence</h5>
                <div className={styles.metric}>
                  <span>Centrality Score:</span>
                  <strong>{selectedNode.val * 3.5}</strong>
                </div>
                <div className={styles.metric}>
                  <span>Direct Connections:</span>
                  <strong>
                    {graphData.links.filter((l: any) => 
                      // @ts-ignore
                      l.source.id === selectedNode.id || l.target.id === selectedNode.id || 
                      l.source === selectedNode.id || l.target === selectedNode.id
                    ).length}
                  </strong>
                </div>
              </div>

              {selectedNode.risk === 'high' && (
                <div className={styles.alertBox}>
                  <strong>Action Recommended</strong>
                  <p>This entity acts as a central hub. Investigating this node could disrupt network operations.</p>
                </div>
              )}
            </div>
          ) : (
            <div className={styles.emptyState}>
              <p>No entities found in the graph. Connect Neo4j database to load relationships.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
