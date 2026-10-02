export function PageIntro({
  title,
  body,
}: {
  title: string;
  body?: string;
}) {
  return (
    <header className="mb-10">
      <h1 className="font-serif text-4xl leading-tight tracking-tight text-ink">{title}</h1>
      {body ? (
        <p className="mt-3 max-w-xl text-base leading-relaxed text-ink-soft">{body}</p>
      ) : null}
    </header>
  );
}
