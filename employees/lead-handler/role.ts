/**
 * Lead Handler pack — first specialised employee role.
 *
 * Do not add Lead, Quote, Appointment or other vertical domain models here.
 * Those belong to a later pack phase, not the platform kernel.
 */
export const leadHandlerRole = {
  type: "lead_handler",
  label: "Lead Handler",
  summary: "Handles prospect research, qualification and outreach preparation.",
} as const;

export type LeadHandlerRoleType = typeof leadHandlerRole.type;
