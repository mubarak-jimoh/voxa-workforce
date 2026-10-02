const DIRECTORY_HOSTS = [
  "yell.com",
  "yelp.com",
  "thomsonlocal.com",
  "cylex-uk.co.uk",
  "hotfrog.co.uk",
  "freeindex.co.uk",
  "192.com",
  "checkatrade.com",
  "bark.com",
  "trustatrader.com",
  "ratedpeople.com",
  "facebook.com",
  "instagram.com",
  "google.com",
  "maps.google.com",
  "linkedin.com",
  "wikipedia.org",
  "directoriesuk.co.uk",
];

const SOUTH_LONDON = [
  "south london",
  "croydon",
  "brixton",
  "clapham",
  "peckham",
  "dulwich",
  "streatham",
  "battersea",
  "wandsworth",
  "lambeth",
  "lewisham",
  "greenwich",
  "southwark",
  "bermondsey",
  "camberwell",
  "tooting",
  "balham",
  "norbury",
  "sutton",
  "wimbledon",
  "putney",
  "norwood",
  "crystal palace",
];

export function hostnameOf(url: string): string | null {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host.startsWith("www.") ? host.slice(4) : host;
  } catch {
    return null;
  }
}

export function isPublicHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") {
      return false;
    }
    const host = parsed.hostname.toLowerCase();
    if (
      host === "localhost" ||
      host.endsWith(".local") ||
      host === "0.0.0.0" ||
      host.startsWith("127.") ||
      host.startsWith("10.") ||
      host.startsWith("192.168.") ||
      host.startsWith("169.254.")
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function isDirectoryHost(url: string): boolean {
  const host = hostnameOf(url);
  if (!host) {
    return true;
  }
  return DIRECTORY_HOSTS.some((item) => host === item || host.endsWith(`.${item}`));
}

export function companyNameFromTitle(title: string): string {
  return title
    .split(/[|–—\-•]/)[0]
    ?.replace(/\s+/g, " ")
    .trim()
    .slice(0, 120) || title.slice(0, 120);
}

export function websiteOrigin(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

export function parseBrief(instruction: string): {
  query: string;
  location: string | null;
  limit: number;
  terms: string[];
} {
  const text = instruction.replace(/\s+/g, " ").trim();
  const count = text.match(/\b(\d{1,2})\b/);
  const limit = count ? Math.min(15, Math.max(1, Number.parseInt(count[1] ?? "10", 10))) : 10;
  let location: string | null = null;
  const south = text.match(/\bsouth london\b/i);
  const city = text.match(/\bin ([A-Z][A-Za-z]+(?: [A-Z][A-Za-z]+)?)\b/);
  if (south) {
    location = "South London";
  } else if (city?.[1] && !/the|our|this/i.test(city[1])) {
    location = city[1];
  }
  const terms = ["commercial", "cleaning", "office", "cleaner", "facilities"].filter((term) =>
    new RegExp(`\\b${term}`, "i").test(text),
  );
  return { query: text.slice(0, 400), location, limit, terms };
}

export function locationMatches(text: string, location: string | null): "yes" | "maybe" | "no" {
  if (!location) {
    return "maybe";
  }
  const hay = text.toLowerCase();
  const needle = location.toLowerCase();
  if (hay.includes(needle)) {
    return "yes";
  }
  if (needle === "south london" && SOUTH_LONDON.some((item) => hay.includes(item))) {
    return "yes";
  }
  if (needle.includes("london") && hay.includes("london")) {
    return "maybe";
  }
  if (/\b(manchester|leeds|bristol|birmingham|glasgow|edinburgh|liverpool)\b/i.test(hay) && needle.includes("london")) {
    return "no";
  }
  return "maybe";
}

export function relevanceMatches(text: string, terms: string[]): boolean {
  const hay = text.toLowerCase();
  if (/\b(plant hire|machinery hire|excavators?|dumpers?|not a cleaning)\b/i.test(hay)) {
    return false;
  }
  if (terms.includes("cleaning") || terms.includes("cleaner")) {
    return /\b(commercial cleaning|office cleaning|cleaning compan|contracted.{0,24}clean|we clean|facilities.{0,16}clean)\b/i.test(
      hay,
    );
  }
  if (terms.length === 0) {
    return true;
  }
  return terms.some((term) => hay.includes(term));
}

export function wrapUntrusted(text: string): string {
  return `<untrusted_web_content>\n${text}\n</untrusted_web_content>`;
}

export function formulateQueries(input: {
  query: string;
  location: string | null;
  terms: string[];
}): string[] {
  const location = input.location ?? "";
  const subject = input.terms.includes("cleaning")
    ? "commercial cleaning companies"
    : input.query.slice(0, 80);
  const queries = [
    [subject, location].filter(Boolean).join(" "),
    [subject, location, "official site"].filter(Boolean).join(" "),
  ];
  if (location?.toLowerCase() === "south london") {
    queries.push("commercial office cleaning Croydon Battersea Brixton");
  }
  return [...new Set(queries.map((item) => item.trim()).filter(Boolean))].slice(0, 3);
}
