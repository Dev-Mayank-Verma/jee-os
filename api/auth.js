const bcrypt = require("bcryptjs");
const { sql, jwt, wrap } = require("./_lib");

const slug = (n) => String(n).toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 20) || "user";

module.exports = wrap(async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const b = req.body || {};
  const action = String(req.query.action || b.action || "");
  const name = String(b.name || "").trim().slice(0, 40);
  const pw = String(b.password || "");
  if (!name || !pw) return res.status(400).json({ error: "Naam aur password dono daalo" });
  if (pw.length < 4) return res.status(400).json({ error: "Password kam se kam 4 character ka rakho" });
  const sl = slug(name);

  const out = (r) => {
    const token = jwt.sign({ id: r.id, slug: r.slug, name: r.name }, process.env.JWT_SECRET, { expiresIn: "90d" });
    return res.json({ token, user: { slug: r.slug, name: r.name, status: r.status, batch_id: r.batch_id || "" } });
  };

  if (action === "register") {
    const ex = await sql`select id from users where slug=${sl}`;
    if (ex.length) return res.status(409).json({ error: "Ye naam le liya gaya hai" });
    const h = await bcrypt.hash(pw, 10);
    const goal = String(b.goal || "").slice(0, 200);
    const batch = /^[a-f0-9]{8,40}$/i.test(String(b.batch_id || "")) ? String(b.batch_id) : "";
    const r = await sql`insert into users(slug,name,pass_hash,goal,batch_id) values(${sl},${name},${h},${goal},${batch}) returning id,slug,name,status,batch_id`;
    return out(r[0]);
  }
  if (action === "login") {
    const r = await sql`select id,slug,name,pass_hash,status,batch_id from users where slug=${sl}`;
    if (!r.length || !(await bcrypt.compare(pw, r[0].pass_hash))) return res.status(401).json({ error: "Naam ya password galat" });
    if (r[0].status !== "active") return res.status(403).json({ error: "Account abhi " + r[0].status + " hai" });
    return out(r[0]);
  }
  res.status(400).json({ error: "action galat" });
});
