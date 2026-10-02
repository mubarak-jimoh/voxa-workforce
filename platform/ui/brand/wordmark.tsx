import Link from "next/link";

export function Wordmark({
  href = "/employee",
  size = "md",
}: {
  href?: string;
  size?: "sm" | "md" | "lg";
}) {
  const type =
    size === "lg"
      ? "font-serif text-5xl leading-none tracking-tight"
      : size === "sm"
        ? "font-serif text-xl leading-none tracking-tight"
        : "font-serif text-[1.65rem] leading-none tracking-tight";

  return (
    <Link href={href} className={`${type} text-ink`}>
      Voxa
    </Link>
  );
}

export function WordmarkText({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const type =
    size === "lg"
      ? "font-serif text-5xl leading-none tracking-tight"
      : size === "sm"
        ? "font-serif text-xl leading-none tracking-tight"
        : "font-serif text-[1.65rem] leading-none tracking-tight";
  return <p className={`${type} text-ink`}>Voxa</p>;
}
