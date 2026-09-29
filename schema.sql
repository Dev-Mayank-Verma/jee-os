-- Optional: tables app khud bhi bana leta hai. Neon SQL editor me manually chalana ho toh ye chalao.
create table if not exists users(
  id serial primary key,
  slug text unique not null,
  name text not null,
  pass_hash text not null,
  goal text default '',
  batch_id text default '',
  status text not null default 'active',
  created_at timestamptz default now()
);
create table if not exists app_data(
  user_id int references users(id) on delete cascade,
  kind text not null,
  json text not null,
  updated_at timestamptz default now(),
  primary key(user_id, kind)
);
create table if not exists tracked_items(
  user_id int references users(id) on delete cascade,
  batch_id text not null,
  subject text not null,
  chapter text not null,
  lec_total int default 0,
  dpp_total int default 0,
  notes int default 0,
  primary key(user_id, batch_id, subject, chapter)
);
-- Kisi user ko isolate karna ho: update users set status='pending' where slug='mayank';
