import Link from "next/link";
import type { TenantContext } from "@/platform/tenant/context";
import { signOutAction } from "@/platform/auth/actions";

export function AppHeader({
  tenant,
  current,
}: {
  tenant: TenantContext;
  current: "employee" | "settings";
}) {
  return (
    <header className="flex items-baseline justify-between gap-6 border-b border-line px-0 py-5">
      <Link href="/employee" className="font-serif text-xl tracking-tight text-ink">
        Voxa
      </Link>
      <nav className="flex items-center gap-6 text-sm">
        <Link
          href="/employee"
          className={current === "employee" ? "text-ink" : "text-ink-soft hover:text-ink"}
        >
          {tenant.employee.name}
        </Link>
        <Link
          href="/settings"
          className={current === "settings" ? "text-ink" : "text-ink-soft hover:text-ink"}
        >
          Settings
        </Link>
        <form action={signOutAction}>
          <button type="submit" className="text-ink-soft hover:text-ink">
            Sign out
          </button>
        </form>
      </nav>
    </header>
  );
}
