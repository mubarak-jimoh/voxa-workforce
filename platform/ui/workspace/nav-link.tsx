"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCloseNav } from "./mobile-nav";

type Item = { href: string; label: string; match: string };

export function isNavActive(pathname: string, item: Pick<Item, "href" | "match">): boolean {
  if (item.match === "tasks") {
    return pathname === "/employee/tasks" || pathname.startsWith("/employee/tasks/");
  }
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function NavLink({
  href,
  label,
  match,
  active,
}: {
  href: string;
  label: string;
  match?: string;
  active?: boolean;
}) {
  const pathname = usePathname() ?? "";
  const close = useCloseNav();
  const current =
    active ??
    (match ? isNavActive(pathname, { href, match }) : pathname === href);

  return (
    <Link
      href={href}
      aria-current={current ? "page" : undefined}
      onClick={close}
      className={`-ml-2 block border-l-2 py-1.5 pl-2 transition-colors ${
        current
          ? "border-accent text-ink"
          : "border-transparent text-ink-soft hover:text-ink"
      }`}
    >
      {label}
    </Link>
  );
}

export function IdentityLink({ children }: { children: React.ReactNode }) {
  const close = useCloseNav();
  return (
    <Link href="/employee" onClick={close} className="block">
      {children}
    </Link>
  );
}
