export default function AppLoading() {
  return (
    <div className="animate-pulse space-y-8" aria-hidden="true">
      <div className="h-10 w-36 bg-line" />
      <div className="h-24 bg-line/70" />
      <div className="space-y-3">
        <div className="h-4 w-3/4 bg-line" />
        <div className="h-4 w-1/2 bg-line" />
      </div>
    </div>
  );
}
