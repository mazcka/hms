type NominatimHit = {
  display_name?: string;
};

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (query.length < 2) return Response.json([]);

  const hits = await search(query, true);
  const rows = hits.length ? hits : await search(query, false);
  const labels = [...new Set(rows.map((row) => row.display_name?.trim()).filter((label): label is string => Boolean(label)))];
  return Response.json(labels.slice(0, 6));
}

async function search(query: string, israelOnly: boolean) {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", query);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "6");
  url.searchParams.set("accept-language", "he");
  if (israelOnly) url.searchParams.set("countrycodes", "il");

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "hms-household/1.0",
    },
    next: { revalidate: 60 },
  });
  if (!response.ok) return [];
  const body = (await response.json()) as NominatimHit[];
  return Array.isArray(body) ? body : [];
}
