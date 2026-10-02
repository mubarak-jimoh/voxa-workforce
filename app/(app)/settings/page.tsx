import { headers } from "next/headers";
import { listOrganisationMembers } from "@/platform/organisation/commands";
import { readyDatabase } from "@/platform/db";
import { loadTenantContext } from "@/platform/tenant/load";
import { SettingsPanel } from "@/platform/ui/settings-panel";

export const metadata = {
  title: "Settings",
};

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string }>;
}) {
  const tenant = await loadTenantContext();
  const db = await readyDatabase();
  const members = await listOrganisationMembers(db, tenant.organisation.id);
  const params = await searchParams;
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host") ?? "localhost:3000";
  const protocol = headerList.get("x-forwarded-proto") ?? "http";

  return (
    <SettingsPanel
      tenant={tenant}
      members={members}
      inviteId={params.invite}
      origin={`${protocol}://${host}`}
    />
  );
}
