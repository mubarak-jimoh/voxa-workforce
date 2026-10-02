import type { MembershipRole } from "../employee/constants";

export function canPauseEmployee(role: MembershipRole): boolean {
  return role === "owner" || role === "admin";
}

export function canInviteMembers(role: MembershipRole): boolean {
  return role === "owner" || role === "admin";
}

export function canUpdateOrganisation(role: MembershipRole): boolean {
  return role === "owner";
}

export function canViewEmployee(role: MembershipRole): boolean {
  return role === "owner" || role === "admin" || role === "member";
}

export function canCommandEmployee(role: MembershipRole): boolean {
  return canViewEmployee(role);
}

export function canDecideApproval(role: MembershipRole): boolean {
  return role === "owner" || role === "admin";
}
