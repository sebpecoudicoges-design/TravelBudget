export default async (req, context) => {
  try {
    const url = "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml";
    const r = await fetch(url, { headers: { "User-Agent": "TravelModular/1.0" } });
    if (!r.ok) {
      return new Response(JSON.stringify({ error: "ECB fetch failed", status: r.status }), {
        status: 502,
        headers: {
          "content-type": "application/json",
          "access-control-allow-origin": "*",
          "cache-control": "no-store",
        },
      });
    }
    const xml = await r.text();
    return new Response(xml, {
      status: 200,
      headers: {
        "content-type": "application/xml; charset=utf-8",
        "access-control-allow-origin": "*",
        "cache-control": "no-store",
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500,
      headers: {
        "content-type": "application/json",
        "access-control-allow-origin": "*",
        "cache-control": "no-store",
      },
    });
  }
};
