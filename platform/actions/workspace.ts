"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { readyDatabase } from "../db";
import { AppError } from "../errors";
import { toggleEmployeePaused } from "../employee/commands";
import { renameOrganisation } from "../organisation/commands";
import { acceptInvitation, createInvitation } from "../organisation/invitations";
import { requireSession } from "../auth/session";
import { ensureMigrated, loadTenantContext, setActiveOrganisation } from "../tenant/load";

export type FormState = { error?: string; success?: string } | null;

export async function toggleEmployeeStatusAction(
  prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  void prevState;
  void formData;
  try {
    const tenant = await loadTenantContext();
    const db = await readyDatabase();
    await toggleEmployeePaused({
      db,
      organisationId: tenant.organisation.id,
      employeeId: tenant.employee.id,
      actorRole: tenant.membershipRole,
    });
    revalidatePath("/employee");
    revalidatePath("/employee", "layout");
    revalidatePath("/settings");
    return null;
  } catch (error) {
    if (error instanceof AppError) {
      return { error: error.message };
    }
    return { error: "Could not update employee status." };
  }
}

export async function renameOrganisationAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const name = String(formData.get("name") ?? "").trim();
  try {
    const tenant = await loadTenantContext();
    const db = await readyDatabase();
    await renameOrganisation({
      db,
      organisationId: tenant.organisation.id,
      name,
      actorRole: tenant.membershipRole,
    });
    revalidatePath("/settings");
    revalidatePath("/employee");
    return { success: "Organisation name updated." };
  } catch (error) {
    if (error instanceof AppError) {
      return { error: error.message };
    }
    return { error: "Could not update the organisation name." };
  }
}

export async function inviteMemberAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const email = String(formData.get("email") ?? "").trim();
  const role = String(formData.get("role") ?? "member");

  try {
    const tenant = await loadTenantContext();
    const db = await readyDatabase();
    const invite = await createInvitation({
      db,
      organisationId: tenant.organisation.id,
      email,
      role,
      inviterId: tenant.userId,
      actorRole: tenant.membershipRole,
    });
    revalidatePath("/settings");
    redirect(`/settings?invite=${invite.id}`);
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "digest" in error &&
      typeof error.digest === "string" &&
      error.digest.startsWith("NEXT_REDIRECT")
    ) {
      throw error;
    }
    if (error instanceof AppError) {
      return { error: error.message };
    }
    return { error: "Could not create the invitation." };
  }
}

export async function acceptInvitationAction(formData: FormData) {
  const invitationId = String(formData.get("invitationId") ?? "");
  await ensureMigrated();
  const session = await requireSession();
  const db = await readyDatabase();
  const accepted = await acceptInvitation({
    db,
    invitationId,
    userId: session.user.id,
    userEmail: session.user.email,
  });
  await setActiveOrganisation(accepted.organisationId);
  redirect("/employee");
}
