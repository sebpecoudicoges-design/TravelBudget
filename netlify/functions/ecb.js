export default async (req, context) => {
  try {
    const url = "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml";
    const r = await fetch(url, { headers: { "User-Agent": "TravelModular/1.0" }, cache: "no-store" });
    if (!r.ok) {
      return new Response(JSON.stringify({ error: "ECB fetch failed", status: r.status }), {
        status: 502,
        headers: {
          "content-type": "application/json; charset=utf-8",
          "access-control-allow-origin": "*",
        },
      });
    }
    const xml = await r.text();
    return new Response(xml, {
      status: 200,
      headers: {
        "content-type": "application/xml; charset=utf-8",
        "cache-control": "no-store",
        "access-control-allow-origin": "*",
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "access-control-allow-origin": "*",
      },
    });
  }
};
