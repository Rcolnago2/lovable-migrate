export function sortTablesByFKDependency(
  tables: string[],
  fkMap: Record<string, string[]>
): string[] {
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const result: string[] = [];

  function visit(table: string) {
    if (visited.has(table)) return;
    if (visiting.has(table)) return;
    visiting.add(table);
    for (const dep of fkMap[table] || []) {
      if (tables.includes(dep)) visit(dep);
    }
    visiting.delete(table);
    visited.add(table);
    result.push(table);
  }

  for (const table of tables) visit(table);
  return result;
}

export async function getFKDependencies(
  pgClient: { query: (sql: string) => Promise<{ rows: Array<{ child: string; parent: string }> }> }
): Promise<Record<string, string[]>> {
  try {
    const { rows } = await pgClient.query(`
      SELECT tc.table_name AS child, ccu.table_name AS parent
      FROM information_schema.table_constraints tc
      JOIN information_schema.constraint_column_usage ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.constraint_schema = tc.constraint_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = 'public'
        AND ccu.table_schema = 'public'
        AND tc.table_name <> ccu.table_name
    `);
    const fkMap: Record<string, string[]> = {};
    for (const row of rows) {
      if (!fkMap[row.child]) fkMap[row.child] = [];
      if (!fkMap[row.child].includes(row.parent)) fkMap[row.child].push(row.parent);
    }
    return fkMap;
  } catch {
    return {};
  }
}
