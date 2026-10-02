import { getRoleLabel, getRoleSummary } from "@/employees/catalog";
import { suggestedPromptsForRole } from "@/employees/runtime";
import { readyDatabase } from "@/platform/db";
import { loadTenantContext } from "@/platform/tenant/load";
import { loadWorkspaceSnapshot } from "@/platform/work/queries";
import { scopeFromTenant } from "@/platform/work/scope";

export async function loadAppWorkspace() {
  const tenant = await loadTenantContext();
  const db = await readyDatabase();
  const scope = scopeFromTenant(db, tenant);
  const snapshot = await loadWorkspaceSnapshot(scope, tenant.employee.status);
  return {
    tenant,
    db,
    scope,
    snapshot,
    roleLabel: getRoleLabel(tenant.employee.roleType),
    roleSummary: getRoleSummary(tenant.employee.roleType),
    suggestions: suggestedPromptsForRole(tenant.employee.roleType),
  };
}
