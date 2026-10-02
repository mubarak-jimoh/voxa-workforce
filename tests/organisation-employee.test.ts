import { describe, expect, it } from "vitest";
import {
  listEmployeesForOrganisation,
  provisionOrganisationEmployee,
} from "@/platform/employee/commands";
import { DEFAULT_EMPLOYEE_NAME } from "@/platform/employee/constants";
import { createTestDatabase, createTestWorkspace } from "./helpers";

describe("organisation employee provisioning", () => {
  it("creates exactly one lead_handler employee in idle status for a new organisation", async () => {
    const { db } = await createTestDatabase();
    const { employee, organisation } = await createTestWorkspace(db);

    expect(employee.organisationId).toBe(organisation.id);
    expect(employee.roleType).toBe("lead_handler");
    expect(employee.status).toBe("idle");
    expect(employee.name).toBe(DEFAULT_EMPLOYEE_NAME);

    const employees = await listEmployeesForOrganisation(db, organisation.id);
    expect(employees).toHaveLength(1);
  });

  it("does not create a second employee when provisioning is repeated", async () => {
    const { db } = await createTestDatabase();
    const { organisation, employee } = await createTestWorkspace(db);

    const again = await provisionOrganisationEmployee(db, {
      organisationId: organisation.id,
    });

    expect(again.id).toBe(employee.id);
    const employees = await listEmployeesForOrganisation(db, organisation.id);
    expect(employees).toHaveLength(1);
  });
});
