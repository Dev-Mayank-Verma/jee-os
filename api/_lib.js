const { neon } = require("@neondatabase/serverless");
const jwt = require("jsonwebtoken");

const sql = neon(process.env.DATABASE_URL || "postgresql://missing");
let ready = null;

function ensure() {
  if (!ready) {
    ready = (async () => {
      await sql`create table if not exists users(id serial primary key, slug text unique not null, name text not null, pass_hash text not null, goal text default '', batch_id text default '', status text not null default 'active', created_at timestamptz default now())`;
      await sql`alter table users add column if not exists batch_id text default ''`;
      await sql`alter table users add column if not exists status text not null default 'active'`;
      await sql`alter table users add column if not exists goal text default ''`;
      await sql`create table if not exists app_data(user_id int references users(id) on delete cascade, kind text not null, json text not null, updated_at timestamptz default now(), primary key(user_id, kind))`;
      await sql`create table if not exists tracked_items(user_id int references users(id) on delete cascade, batch_id text not null, subject text not null, chapter text not null, lec_total int default 0, dpp_total int default 0, notes int default 0, primary key(user_id, batch_id, subject, chapter))`;
      await sql`create table if not exists tracked_resources(user_id int references users(id) on delete cascade, batch_id text not null, resource_type text not null, resource_id text not null, payload jsonb not null default '{}'::jsonb, updated_at timestamptz default now(), primary key(user_id, batch_id, resource_type, resource_id))`;
    })().catch((e) => { ready = null; throw e; });
  }
  return ready;
}

function user(req) {
  const h = req.headers.authorization || "";
  const t = h.startsWith("Bearer ") ? h.slice(7) : "";
  try { return jwt.verify(t, process.env.JWT_SECRET); } catch (e) { return null; }
}

function wrap(fn) {
  return async (req, res) => {
    try {
      if (!process.env.DATABASE_URL) return res.status(500).json({ error: "DATABASE_URL set nahi hai" });
      if (!process.env.JWT_SECRET) return res.status(500).json({ error: "JWT_SECRET set nahi hai" });
      await ensure();
      await fn(req, res);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Server error: " + (e.message || "unknown") });
    }
  };
}

module.exports = { sql, jwt, user, wrap };
