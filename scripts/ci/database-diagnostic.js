// Fixed labels only. Never return service output, SQL, identifiers or credentials.
export function databaseDiagnostic(result) {
  const text = `${result?.stderr ?? ""}\n${result?.stdout ?? ""}`;
  if (/must be superuser|only superusers can/i.test(text))
    return "database-superuser-required";
  if (/permission denied to create role/i.test(text))
    return "database-role-create";
  if (/infinite recursion detected in policy/i.test(text))
    return "database-policy-recursion";
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
