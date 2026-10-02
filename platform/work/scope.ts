import type { AppDb } from "../db";
import type { TenantContext } from "../tenant/context";

export type WorkScope = {
  db: AppDb;
  organisationId: string;
  employeeId: string;
};

export function scopeFromTenant(db: AppDb, tenant: TenantContext): WorkScope {
  return {
    db,
    organisationId: tenant.organisation.id,
    employeeId: tenant.employee.id,
  };
}

export function now(): Date {
  return new Date();
}

export function newId(): string {
  return crypto.randomUUID();
}
