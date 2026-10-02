import Link from "next/link";
import { decideApprovalAction } from "@/app/(app)/employee/actions";
import type { Approval } from "@/platform/db/schema";
import { formatWhen } from "./format";

export function ApprovalList({ items }: { items: Approval[] }) {
  if (items.length === 0) {
    return (
      <p className="max-w-lg text-base leading-relaxed text-ink-soft">
        Nothing needs your approval. External actions such as sending email will
        appear here before they happen.
      </p>
    );
  }

  return (
    <ol className="divide-y divide-line border-y border-line">
      {items.map((item) => (
        <li key={item.id} className="py-8">
          <p className="text-xs text-ink-soft">{formatWhen(item.createdAt)}</p>
          <h2 className="mt-3 font-serif text-3xl text-ink">{item.title}</h2>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-ink-soft">
            {item.summary}
          </p>
          <ApprovalPayload payload={item.payload} />
          {item.status === "pending" ? (
            <div className="mt-6 flex flex-wrap items-center gap-5 text-sm">
              <Link
                href={`/employee/tasks/${item.taskId}`}
                className="text-ink-soft transition-colors hover:text-ink"
              >
                Review
              </Link>
              <ApprovalActions approvalId={item.id} />
            </div>
          ) : (
            <p className="mt-4 text-sm text-ink-soft">
              {item.status === "approved" ? "Approved" : "Rejected"}
            </p>
          )}
        </li>
      ))}
    </ol>
  );
}

export function ApprovalActions({ approvalId }: { approvalId: string }) {
  return (
    <div className="flex items-center gap-3">
      <form action={decideApprovalAction}>
        <input type="hidden" name="approvalId" value={approvalId} />
        <input type="hidden" name="decision" value="rejected" />
        <button
          type="submit"
          className="px-3 py-1.5 text-sm text-ink-soft transition-colors hover:text-ink"
        >
          Reject
        </button>
      </form>
      <form action={decideApprovalAction}>
        <input type="hidden" name="approvalId" value={approvalId} />
        <input type="hidden" name="decision" value="approved" />
        <button
          type="submit"
          className="bg-accent px-3 py-1.5 text-sm text-on-accent transition-colors hover:bg-accent-hover"
        >
          Approve
        </button>
      </form>
    </div>
  );
}

export function ApprovalPayload({
  payload,
}: {
  payload: Record<string, unknown> | null;
}) {
  if (!payload || Object.keys(payload).length === 0) {
    return null;
  }
  if (payload.connected === false) {
    return (
      <p className="mt-4 max-w-xl text-sm leading-relaxed text-ink-soft">
        Email isn&apos;t connected. Approving records your decision; nothing will
        be sent.
      </p>
    );
  }
  return (
    <dl className="mt-4 grid max-w-xl gap-1 text-sm">
      {Object.entries(payload).map(([key, value]) => (
        <div key={key} className="grid grid-cols-[8rem_minmax(0,1fr)] gap-3">
          <dt className="text-ink-soft">{labelKey(key)}</dt>
          <dd className="text-ink">{formatPayloadValue(value)}</dd>
        </div>
      ))}
    </dl>
  );
}

function labelKey(key: string): string {
  if (key === "connected") {
    return "Email connected";
  }
  if (key === "wouldSend") {
    return "Would send now";
  }
  return key.replace(/([A-Z])/g, " $1").replace(/^./, (char) => char.toUpperCase());
}

function formatPayloadValue(value: unknown): string {
  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }
  if (value === null || value === undefined) {
    return "—";
  }
  return String(value);
}
