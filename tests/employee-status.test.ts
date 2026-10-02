import { describe, expect, it } from "vitest";
import {
  setEmployeeStatus,
  toggleEmployeePaused,
} from "@/platform/employee/commands";
import { ForbiddenError, InvalidTransitionError } from "@/platform/errors";
import { createTestDatabase, createTestWorkspace } from "./helpers";

describe("employee pause and resume", () => {
  it("persists idle to paused and back to idle", async () => {
    const { db } = await createTestDatabase();
    const { organisation, employee } = await createTestWorkspace(db);

    const paused = await setEmployeeStatus({
      db,
      organisationId: organisation.id,
      employeeId: employee.id,
      actorRole: "owner",
      nextStatus: "paused",
    });
    expect(paused.status).toBe("paused");

    const resumed = await toggleEmployeePaused({
      db,
      organisationId: organisation.id,
      employeeId: employee.id,
      actorRole: "admin",
    });
    expect(resumed.status).toBe("idle");
  });

  it("rejects illegal status transitions", async () => {
    const { db } = await createTestDatabase();
    const { organisation, employee } = await createTestWorkspace(db);

    await expect(
      setEmployeeStatus({
        db,
        organisationId: organisation.id,
        employeeId: employee.id,
        actorRole: "owner",
        nextStatus: "offline",
      }),
    ).rejects.toBeInstanceOf(InvalidTransitionError);
  });

  it("forbids members from pausing", async () => {
    const { db } = await createTestDatabase();
    const { organisation, employee } = await createTestWorkspace(db);

    await expect(
      toggleEmployeePaused({
        db,
        organisationId: organisation.id,
        employeeId: employee.id,
        actorRole: "member",
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});
