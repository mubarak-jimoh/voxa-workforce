import { leadHandlerRole } from "./lead-handler/role";

const packs = [leadHandlerRole] as const;

export type RegisteredRoleType = (typeof packs)[number]["type"];

export function getRoleLabel(roleType: string): string {
  const pack = packs.find((entry) => entry.type === roleType);
  return pack?.label ?? roleType;
}

export function getRoleSummary(roleType: string): string | undefined {
  return packs.find((entry) => entry.type === roleType)?.summary;
}
