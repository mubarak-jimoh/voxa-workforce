export const DEFAULT_EMPLOYEE_NAME = "Avery";

export const EMPLOYEE_ROLE_TYPES = ["lead_handler"] as const;
export type EmployeeRoleType = (typeof EMPLOYEE_ROLE_TYPES)[number];

export const EMPLOYEE_STATUSES = ["idle", "paused", "offline"] as const;
export type EmployeeStatus = (typeof EMPLOYEE_STATUSES)[number];

export const MEMBERSHIP_ROLES = ["owner", "admin", "member"] as const;
export type MembershipRole = (typeof MEMBERSHIP_ROLES)[number];

export function isEmployeeRoleType(value: string): value is EmployeeRoleType {
  return (EMPLOYEE_ROLE_TYPES as readonly string[]).includes(value);
}

export function isEmployeeStatus(value: string): value is EmployeeStatus {
  return (EMPLOYEE_STATUSES as readonly string[]).includes(value);
}

export function isMembershipRole(value: string): value is MembershipRole {
  return (MEMBERSHIP_ROLES as readonly string[]).includes(value);
}
