const { sql, user, wrap } = require("./_lib");

const T = (p, o) => p.replace(/\{(\w+)\}/g, (m, k) => encodeURIComponent(o[k] == null ? "" : o[k]));
const list = (body) => {
  if (Array.isArray(body)) return body;
  if (Array.isArray(body && body.data)) return body.data;
  if (Array.isArray(body && body.data && body.data.data)) return body.data.data;
  if (Array.isArray(body && body.results)) return body.results;
  if (Array.isArray(body && body.items)) return body.items;
  return [];
};
const objectData = (body) => body && body.data && !Array.isArray(body.data) ? body.data : (body || {});
const pathEnv = (name, fallback) => process.env[name] || fallback;
const pwPath = {
  details: () => pathEnv("PW_BATCH_PATH", "/v3/batches/{batchId}/details"),
  schedule: () => "/v1/batches/{batchId}/todays-schedule?isNewStudyMaterialFlow=true",
  topics: () => "/v2/batches/{batchId}/subject/{subjectId}/topics?page={page}",
  contents: () => "/v2/batches/{batchId}/subject/{subjectId}/contents?tag={tag}&contentType={contentType}&page={page}",
  tests: () => "/v3/test-service/tests?testType=All&testStatus=All&attemptStatus=All&batchId={batchId}&isSubjective=false&categoryId={categoryId}&categorySectionId={categorySectionId}&isPurchased={isPurchased}",
};
const json = (body) => JSON.stringify(body || {});
const searchPath = () => process.env.PW_SEARCH_PATH || "https://pwthor.live/api/searchBatch?name={q}&page={page}";

async function get(path) {
  const base = (process.env.PW_API_BASE || "https://proxy.streamvideo.co.in/fetch/api.penpencil.co").replace(/\/$/, "");
  const url = /^https?:\/\//i.test(path) ? path : base + (path.startsWith("/") ? path : "/" + path);
  let h = { accept: "application/json", "client-id": "5eb393ee95fab7468a79d189", "client-type": "WEB", "client-version": "2.2.7", origin: "https://www.pw.live", referer: "https://www.pw.live/" };
  try { h = Object.assign(h, JSON.parse(process.env.PW_API_HEADERS || "{}")); } catch (e) {
    const err = new Error("PW_API_HEADERS valid JSON nahi hai"); err.status = 503; throw err;
  }
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 15000);
  try {
    const r = await fetch(url, { headers: h, signal: ac.signal });
    if (!r.ok) {
      const upstream = await r.text().catch(() => "");
      let detail = "";
      try { detail = JSON.parse(upstream).message || JSON.parse(upstream).error || ""; } catch (e) {}
      const err = new Error("PW API error " + r.status + (detail ? ": " + detail : ""));
      err.status = r.status === 401 || r.status === 403 ? r.status : 502;
      throw err;
    }
    const body = await r.json();
    if (!body || typeof body !== "object") { const e = new Error("PW API ne JSON object nahi bheja"); e.status = 502; throw e; }
    return body;
  } catch (e) {
    if (!e.status) { e.status = 502; e.message = "PW API se connect nahi hua: " + e.message; }
    throw e;
  } finally { clearTimeout(t); }
}

module.exports = wrap(async (req, res) => {
  const u = user(req);
  if (!u) return res.status(401).json({ error: "Login karo", code: "auth" });
  const op = req.query.op;
  try {
    if (op === "search") {
      const q = String(req.query.q || "").trim().slice(0, 80);
      const page = parseInt(req.query.page) || 1;
      if (!q) return res.status(400).json({ error: "Keyword daalo" });
      const j = await get(T(process.env.PW_SEARCH_PATH || "/api/AllBatches?page={page}&search={q}", { q, page }));
      let data = list(j).map((b) => ({
        batchId: b.batchId || b._id, batchName: b.batchName || b.name, batchImage: b.batchImage || "",
        startDate: b.startDate || "", endDate: b.endDate || "", batchPrice: b.batchPrice, byName: b.byName || "",
      })).filter((b) => b.batchId && b.batchName);
      if (process.env.PW_SEARCH_FILTER === "1") data = data.filter((b) => b.batchName.toLowerCase().includes(q.toLowerCase()));
      return res.json({ data: data.slice(0, 30) });
    }
    if (["schedule", "topics", "contents", "tests"].includes(op)) {
      const batchId = String(req.query.batchId || "").trim();
      if (!/^[A-Za-z0-9_-]{3,100}$/.test(batchId)) return res.status(400).json({ error: "Batch ID galat hai" });
      const args = { batchId, subjectId: String(req.query.subjectId || ""), tag: String(req.query.tag || ""), contentType: String(req.query.contentType || "notes"), page: parseInt(req.query.page) || 1, categoryId: String(req.query.categoryId || ""), categorySectionId: String(req.query.categorySectionId || "Other_Tests"), isPurchased: String(req.query.isPurchased || "true") };
      const route = op === "schedule" ? pwPath.schedule() : op === "topics" ? pwPath.topics() : op === "contents" ? pwPath.contents() : pwPath.tests();
      if ((op === "topics" || op === "contents") && !args.subjectId) return res.status(400).json({ error: "Subject ID zaroori hai" });
      return res.json({ data: await get(T(route, args)) });
    }
    if (op === "build") {
      const batchId = String(req.query.batchId || "").trim();
      if (!/^[A-Za-z0-9_-]{3,100}$/.test(batchId)) return res.status(400).json({ error: "Batch ID galat hai" });
      const bi = await get(T(pwPath.details(), { batchId }));
      const d = objectData(bi);
      const subs = list(d.subjects || d).filter((s) => !s.isResources && s.slug);
      const groups = {};
      await Promise.all(subs.map(async (s) => {
        try {
          const subjectPath = process.env.PW_SUBJECT_PATH && !process.env.PW_SUBJECT_PATH.includes("SubjectInfo") ? process.env.PW_SUBJECT_PATH : pwPath.topics();
          const sj = await get(T(subjectPath, { batchId, subjectId: s.slug, page: 1 }));
          const ch = {};
          list(sj).forEach((t) => {
            const v = +t.videos || 0, x = +t.exercises || 0;
            if (!v && !x) return;
            ch[String(t.name).trim()] = { lt: v, dt: x, notes: +t.notes || 0 };
          });
          if (Object.keys(ch).length) {
            let g = String(s.subject || s.slug).trim();
            if (groups[g]) g += " (" + String(s.slug).slice(-4) + ")";
            groups[g] = ch;
          }
        } catch (e) { console.error("subject fail", s.slug, e.message); }
      }));
      try {
        const S = [], C = [], L = [], D = [], N = [];
        Object.keys(groups).forEach((g) => Object.keys(groups[g]).forEach((c) => {
          const t = groups[g][c]; S.push(g); C.push(c); L.push(t.lt); D.push(t.dt); N.push(t.notes);
        }));
        if (S.length) {
          await sql`insert into tracked_items(user_id,batch_id,subject,chapter,lec_total,dpp_total,notes) select ${u.id}::int, ${batchId}::text, x.s, x.c, x.l, x.d, x.n from unnest(${S}::text[], ${C}::text[], ${L}::int[], ${D}::int[], ${N}::int[]) as x(s,c,l,d,n) on conflict (user_id,batch_id,subject,chapter) do update set lec_total=excluded.lec_total, dpp_total=excluded.dpp_total, notes=excluded.notes`;
        }
        await sql`update users set batch_id=${batchId} where id=${u.id}`;
      } catch (e) { console.error("tracked_items save fail", e.message); }
      return res.json({ name: d.batchName || d.name || "", groups });
    }
    return res.status(400).json({ error: "op galat" });
  } catch (e) {
    return res.status(e.status || 500).json({ error: e.message });
  }
});
