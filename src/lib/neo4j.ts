import neo4j from 'neo4j-driver';

const uri = process.env.NEO4J_URI!;
const user = process.env.NEO4J_USERNAME!;
const password = process.env.NEO4J_PASSWORD!;

// Initialize a Neo4j Driver instance
export const driver = neo4j.driver(uri, neo4j.auth.basic(user, password));

// Helper function to run queries
export async function runQuery(query: string, params: any = {}) {
  const session = driver.session();
  try {
    const result = await session.run(query, params);
    return result;
  } finally {
    await session.close();
  }
}
