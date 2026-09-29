const { sql, user, wrap } = require("./_lib");

module.exports = wrap(async (req, res) => {
  const u = user(req);
  if (!u) return res.status(401).json({ error: "Login karo", code: "auth" });
  const kind = req.query.kind === "chats" ? "chats" : "state";
  if (req.method === "GET") {
    const r = await sql`select json from app_data where user_id=${u.id} and kind=${kind}`;
    return res.json({ json: r.length ? r[0].json : null });
  }
  if (req.method === "PUT") {
    const j = req.body && req.body.json;
    if (typeof j !== "string" || j.length > 1500000) return res.status(400).json({ error: "Data galat ya bahut bada" });
    await sql`insert into app_data(user_id,kind,json,updated_at) values(${u.id},${kind},${j},now()) on conflict (user_id,kind) do update set json=excluded.json, updated_at=now()`;
    return res.json({ ok: true });
  }
  res.status(405).json({ error: "GET ya PUT" });
});
