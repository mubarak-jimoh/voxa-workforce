import { AveryHome } from "@/platform/ui/workspace/avery-home";
import { loadAppWorkspace } from "../load-workspace";

export const metadata = {
  title: "Avery",
};

export default async function EmployeePage() {
  const { tenant, snapshot, roleLabel, suggestions } = await loadAppWorkspace();

  return (
    <AveryHome
      tenant={tenant}
      roleLabel={roleLabel}
      snapshot={snapshot}
      suggestions={suggestions}
    />
  );
}
