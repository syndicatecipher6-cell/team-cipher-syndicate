import { NextResponse } from 'next/server';
import { runQuery } from '@/lib/neo4j';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // 1. Fetch Nodes
    const nodesResult = await runQuery(`MATCH (n) RETURN n.id AS id, n.name AS name, labels(n)[0] AS type, n.risk AS risk, n.val AS val`);
    const nodes = nodesResult.records.map((record: any) => ({
      id: record.get('id'),
      name: record.get('name'),
      type: record.get('type').toLowerCase(),
      risk: record.get('risk'),
      val: record.get('val')?.toNumber() || 10
    }));

    // 2. Fetch Relationships (Links)
    const linksResult = await runQuery(`MATCH (a)-[r]->(b) RETURN a.id AS source, b.id AS target, type(r) AS type, r.weight AS weight`);
    const links = linksResult.records.map((record: any) => ({
      source: record.get('source'),
      target: record.get('target'),
      type: record.get('type').toLowerCase(),
      weight: record.get('weight')?.toNumber() || 1
    }));

    return NextResponse.json({ nodes, links });
  } catch (error) {
    console.error('Neo4j fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch graph data' }, { status: 500 });
  }
}
