// Fixed labels only. Never return service output, SQL, identifiers or credentials.
export function databaseDiagnostic(result) {
  const text = `${result?.stderr ?? ""}\n${result?.stdout ?? ""}`;
  if (/must be superuser|only superusers can/i.test(text))
    return "database-superuser-required";
  if (/permission denied to create role/i.test(text))
    return "database-role-create";
  if (/infinite recursion detected in policy/i.test(text))
    return "database-policy-recursion";
  if (/function .* does not exist/i.test(text))
    return "database-missing-function";
  if (/must be (?:able to SET ROLE|member of role)/i.test(text))
    return "database-role-switch";
  if (/must be owner of/i.test(text)) return "database-ownership";
  if (
    /SQLSTATE[\s:=(]+42501\b|permission denied for (?:schema|table|relation)/i.test(
      text,
    )
  )
    return "database-permission";
  if (/SQLSTATE[\s:=(]+42601\b/i.test(text)) return "database-syntax";
  if (/SQLSTATE[\s:=(]+42710\b/i.test(text)) return "database-duplicate-object";
  if (/SQLSTATE[\s:=(]+42P01\b/i.test(text)) return "database-missing-relation";
  return "unclassified";
}

export function rlsFailureSummary(result) {
  const text = `${result?.stderr ?? ""}\n${result?.stdout ?? ""}`;
  const allowedFiles = new Set([
    "00_catalog.test.sql",
    "10_a4_matrix.test.sql",
    "20_boundaries.test.sql",
    "30_t3_caller_admin_status.test.sql",
    "40_catalogue_privacy.test.sql",
    "41_catalogue_matrix.test.sql",
    "42_catalogue_review.test.sql",
    "43_search.test.sql",
  ]);
  return {
    files: [
      ...new Set(
        [...text.matchAll(/\bFAIL\s+([0-9]{2}_[a-z0-9_]+\.test\.sql)\b/g)].map(
          (m) => m[1],
        ),
      ),
    ]
      .filter((name) => allowedFiles.has(name))
      .slice(0, 16),
    assertions: [
      ...new Set(
        [...text.matchAll(/\bnot ok\s+([0-9]{1,5})\b/g)].map((m) =>
          Number(m[1]),
        ),
      ),
    ].slice(0, 64),
    diagnostic: databaseDiagnostic(result),
  };
}
