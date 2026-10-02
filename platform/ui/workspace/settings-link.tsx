"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function SettingsLink() {
  const pathname = usePathname();
  const active = pathname === "/settings" || pathname.startsWith("/settings/");
  return (
    <Link
      href="/settings"
      aria-current={active ? "page" : undefined}
      className={active ? "text-ink" : "text-ink-soft hover:text-ink"}
    >
      Settings
    </Link>
  );
}
