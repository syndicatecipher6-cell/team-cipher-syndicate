import neo4j from "neo4j-driver";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  const { NEO4J_URI, NEO4J_USERNAME, NEO4J_PASSWORD } = process.env;

  if (!NEO4J_URI || !NEO4J_USERNAME || !NEO4J_PASSWORD) {
    return res.status(500).json({
      connected: false,
      message: "Missing Neo4j environment variables."
    });
  }

  let driver;

  try {
    driver = neo4j.driver(
      NEO4J_URI,
      neo4j.auth.basic(NEO4J_USERNAME, NEO4J_PASSWORD),
      { connectionTimeout: 10000 }
    );

    await driver.verifyConnectivity();

    return res.status(200).json({
      connected: true,
      message: "Vercel connected to Neo4j!"
    });
  } catch {
    return res.status(500).json({
      connected: false,
      message: "Connection failed. Check your Neo4j credentials and instance status."
    });
  } finally {
    if (driver) await driver.close();
  }
}
