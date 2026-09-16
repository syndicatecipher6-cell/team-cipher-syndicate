import cytoscape, { type Core } from 'cytoscape';
import { Expand, List, Maximize2, Minus, Network, Plus, RotateCcw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { EntityType, GraphData, GraphEdge, GraphNode } from '../types/domain';
import { EmptyState, EntityBadge } from './ui';

const colors: Record<EntityType, string> = {
  person: '#2F8F89', case: '#C58A32', phone: '#527A98', vehicle: '#7663B5',
  account: '#315F84', transaction: '#B37A58', location: '#4C956C', evidence: '#837A70',
};

const iconPaths: Record<EntityType, string> = {
  person: '<circle cx="16" cy="10" r="4.5"/><path d="M8 27c.7-6 3.7-9.5 8-9.5s7.3 3.5 8 9.5H8z"/>',
  case: '<path d="M9 5h9l5 5v17H9V5zM18 5v6h5M12 16h8M12 20h8M12 24h6" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  phone: '<path d="M10 6c-1.9 1-2.6 3-1.6 5.8 2.3 6.5 5.4 9.6 11.8 11.8 2.8 1 4.8.3 5.8-1.6l-4-4-3 2c-2.8-1.1-5.7-4-6.8-6.8l2-3-4.2-4.2z" fill="none" stroke="white" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/>',
  vehicle: '<path d="M6 18l2.8-7h14.4L26 18v6h-3v-3H9v3H6v-6zm3-1h14M11 17h.1M21 17h.1" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  account: '<path d="M5 12h22L16 5 5 12zm3 3h3v9H8zm6 0h4v9h-4zm7 0h3v9h-3zM5 26h22v2H5z"/>',
  transaction: '<path d="M6 11h17m-5-5 6 5-6 5M26 21H9m5-5-6 5 6 5" fill="none" stroke="white" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/>',
  location: '<path d="M16 4a9 9 0 0 0-9 9c0 7 9 15 9 15s9-8 9-15a9 9 0 0 0-9-9zm0 13a4 4 0 1 1 0-8 4 4 0 0 1 0 8z"/>',
  evidence: '<path d="M16 4l9 4v7c0 6.4-3.7 10.5-9 13-5.3-2.5-9-6.6-9-13V8l9-4zm-4.5 11 3 3 6-7" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>',
};

function iconDataUri(type: EntityType) {
  return `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="white">${iconPaths[type]}</svg>`)}`;
}

function nodeDetail(node: GraphNode) {
  if (node.type === 'case') return String(node.metadata.crime_type ?? node.id);
  return node.id;
}

export function GraphView({ data, onNodeSelect, onEdgeSelect, selectedPath = [], compact = false }: { data: GraphData; onNodeSelect?: (node: GraphNode) => void; onEdgeSelect?: (edge: GraphEdge) => void; selectedPath?: string[]; compact?: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | undefined>(undefined);
  const [mode, setMode] = useState<'graph' | 'list'>('graph');

  useEffect(() => {
    if (!containerRef.current || mode !== 'graph' || !data.nodes.length) return;
    const graphWidth = containerRef.current.clientWidth;
    const graphHeight = Math.max(300, containerRef.current.clientHeight - 34);
    const degrees = new Map(data.nodes.map((node) => [node.id, data.edges.filter((edge) => edge.source === node.id || edge.target === node.id).length]));
    const hubNode = [...data.nodes].sort((a, b) => (degrees.get(b.id) ?? 0) - (degrees.get(a.id) ?? 0))[0];
    const caseNodes = data.nodes.filter((node) => node.type === 'case').sort((a, b) => a.id.localeCompare(b.id));
    const personNodes = data.nodes.filter((node) => node.type === 'person').sort((a, b) => a.id.localeCompare(b.id));
    const artifactRanks: Record<EntityType, number> = { vehicle: 0, phone: 1, account: 2, transaction: 3, location: 4, evidence: 5, case: 6, person: 7 };
    const artifactNodes = data.nodes.filter((node) => node.type !== 'case' && node.type !== 'person').sort((a, b) => artifactRanks[a.type] - artifactRanks[b.type] || a.id.localeCompare(b.id));
    const positionInBand = (node: GraphNode, nodes: GraphNode[], startY: number, endY: number, margin: number) => {
      const index = nodes.findIndex((item) => item.id === node.id);
      const availableWidth = Math.max(180, graphWidth - margin * 2);
      const columns = Math.max(1, Math.min(nodes.length, Math.floor(availableWidth / 120)));
      const rows = Math.max(1, Math.ceil(nodes.length / columns));
      const row = Math.floor(index / columns);
      const column = index % columns;
      const itemsInRow = Math.min(columns, nodes.length - row * columns);
      const rowWidth = Math.min(availableWidth, Math.max(0, itemsInRow - 1) * 120);
      const x = itemsInRow === 1
        ? graphWidth / 2
        : graphWidth / 2 - rowWidth / 2 + column * (rowWidth / (itemsInRow - 1));
      const y = rows === 1
        ? (startY + endY) / 2
        : startY + row * ((endY - startY) / (rows - 1));
      return { x, y };
    };
    const positionFor = (node: GraphNode) => {
      if (node.type === 'case') return positionInBand(node, caseNodes, graphHeight * .11, graphHeight * .24, graphWidth * .09);
      if (node.type === 'person') return positionInBand(node, personNodes, graphHeight * .42, graphHeight * .56, graphWidth * .09);
      return positionInBand(node, artifactNodes, graphHeight * .73, graphHeight * .88, graphWidth * .07);
    };
    const elements = [
      ...data.nodes.map((node) => ({ data: { id: node.id, displayLabel: `${node.label}\n${nodeDetail(node)}`, type: node.type, color: colors[node.type], icon: iconDataUri(node.type) }, position: positionFor(node) })),
      ...data.edges.map((edge) => ({ data: { id: edge.id, source: edge.source, target: edge.target, label: edge.relationship, crossCase: ['REFERENCES', 'RECORDED IN', 'OBSERVED AT'].includes(edge.relationship) ? 1 : 0 } })),
    ];
    const cy = cytoscape({
      container: containerRef.current, elements,
      style: [
        { selector: 'node', style: { 'background-color': 'data(color)', 'background-image': 'data(icon)', 'background-fit': 'contain', 'background-width': '50%', 'background-height': '50%', 'background-repeat': 'no-repeat', label: 'data(displayLabel)', color: '#18344A', 'font-size': 9, 'font-weight': 'bold', 'text-wrap': 'wrap', 'text-max-width': '120px', 'text-valign': 'bottom', 'text-halign': 'center', 'text-margin-y': 11, 'text-background-color': '#FFFFFF', 'text-background-opacity': .94, 'text-background-padding': '4px', 'text-border-color': '#D8E2E8', 'text-border-width': 1, 'text-border-opacity': .9, width: 46, height: 46, 'border-color': '#FFFFFF', 'border-width': 4, 'overlay-opacity': 0 } },
        { selector: 'node.hub', style: { width: 54, height: 54, 'border-width': 6, 'border-color': '#CFE5E2', 'font-size': 10 } },
        { selector: 'node:selected', style: { 'border-color': '#F2C66D', 'border-width': 7 } },
        { selector: 'edge', style: { width: 1.75, 'line-color': '#7895A6', 'target-arrow-color': '#7895A6', 'target-arrow-shape': 'triangle', 'arrow-scale': .72, 'curve-style': 'bezier', opacity: .78, label: '', 'font-size': 8, color: '#365367', 'text-background-color': '#FFFFFF', 'text-background-opacity': .96, 'text-background-padding': '3px', 'text-border-color': '#D8E2E8', 'text-border-width': 1, 'text-border-opacity': .8 } },
        { selector: 'edge[crossCase = 1]', style: { 'line-style': 'dashed', 'line-dash-pattern': [5, 5], 'line-color': '#5CA6A0', 'target-arrow-color': '#5CA6A0' } },
        { selector: 'edge:selected', style: { label: 'data(label)', 'line-color': '#C58A32', 'target-arrow-color': '#C58A32', width: 3.25, opacity: 1 } },
        { selector: '.path', style: { 'line-color': '#C58A32', 'target-arrow-color': '#C58A32', width: 3.75, opacity: 1 } },
      ],
      layout: { name: 'preset', fit: false, animate: false },
      minZoom: .4, maxZoom: 2.4,
    });
    const hub = cy.getElementById(hubNode.id);
    hub?.addClass('hub');
    selectedPath.forEach((id) => cy.getElementById(id).addClass('path'));
    cy.on('tap', 'node', (event) => { const node = data.nodes.find((item) => item.id === event.target.id()); if (node) onNodeSelect?.(node); });
    cy.on('tap', 'edge', (event) => { const edge = data.edges.find((item) => item.id === event.target.id()); if (edge) onEdgeSelect?.(edge); });
    cy.on('dbltap', 'node', (event) => { event.target.connectedEdges().connectedNodes().select(); });
    cyRef.current = cy;
    return () => cy.destroy();
  }, [compact, data, mode, onEdgeSelect, onNodeSelect, selectedPath]);

  if (!data.nodes.length) return <EmptyState />;
  return <div className={`graph-shell graph-shell--reference ${compact ? 'graph-shell--compact' : ''}`}>
    <div className="graph-toolbar"><div className="segmented"><button className={mode === 'graph' ? 'active' : ''} onClick={() => setMode('graph')}><Network size={14} />Graph</button><button className={mode === 'list' ? 'active' : ''} onClick={() => setMode('list')}><List size={14} />List</button></div>{mode === 'graph' && <div className="icon-actions"><button title="Zoom in" aria-label="Zoom in" onClick={() => cyRef.current?.zoom(cyRef.current.zoom() * 1.2)}><Plus size={16} /></button><button title="Zoom out" aria-label="Zoom out" onClick={() => cyRef.current?.zoom(cyRef.current.zoom() * .8)}><Minus size={16} /></button><button title="Fit graph" aria-label="Fit graph" onClick={() => cyRef.current?.fit(undefined, 46)}><RotateCcw size={15} /></button><button title="Center graph" aria-label="Center graph" onClick={() => cyRef.current?.center()}><Expand size={15} /></button><button title="Fullscreen graph" aria-label="Fullscreen graph" onClick={() => containerRef.current?.requestFullscreen()}><Maximize2 size={15} /></button></div>}</div>
    {mode === 'graph' ? <div ref={containerRef} className="graph-canvas" role="img" aria-label={`Investigation graph with ${data.nodes.length} entities and ${data.edges.length} relationships`} /> : <div className="graph-list">{data.nodes.map((node) => <button key={node.id} onClick={() => onNodeSelect?.(node)}><EntityBadge type={node.type} /><strong>{node.label}</strong><span>{node.id}</span></button>)}</div>}
    <div className="graph-footer-legend"><div>{Object.entries(colors).map(([type, color]) => <span key={type}><i style={{ background: color }} />{type === 'account' ? 'Bank Account' : type}</span>)}</div><div className="edge-legend"><span><i />Direct link</span><span><i className="dashed" />Cross-case link</span></div></div>
  </div>;
}
