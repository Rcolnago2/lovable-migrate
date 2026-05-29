export function sortTablesByFKDependency(tables, fkMap) {
  const visited = new Set();
  const visiting = new Set();
  const result = [];

  function visit(table) {
    if (visited.has(table)) return;
    if (visiting.has(table)) return; // cycle — skip
    visiting.add(table);
    const deps = fkMap[table] || [];
    for (const dep of deps) {
      if (tables.includes(dep)) visit(dep);
    }
    visiting.delete(table);
    visited.add(table);
    result.push(table);
  }

  for (const table of tables) visit(table);
  return result;
}

export async function getFKDependencies(pgClient) {
  try {
    const query = `
      SELECT
        tc.table_name AS child,
        ccu.table_name AS parent
      FROM information_schema.table_constraints tc
      JOIN information_schema.constraint_column_usage ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.constraint_schema = tc.constraint_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = 'public'
        AND ccu.table_schema = 'public'
        AND tc.table_name <> ccu.table_name
    `;
    const { rows } = await pgClient.query(query);
    const fkMap = {};
    for (const row of rows) {
      if (!fkMap[row.child]) fkMap[row.child] = [];
      if (!fkMap[row.child].includes(row.parent)) fkMap[row.child].push(row.parent);
    }
    return fkMap;
  } catch {
    return {};
  }
}
