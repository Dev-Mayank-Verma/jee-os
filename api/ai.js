const { user, wrap } = require("./_lib");

module.exports = wrap(async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  if (!user(req)) return res.status(401).json({ error: "Login karo", code: "auth" });
  const prompt = String((req.body || {}).prompt || "").slice(0, 60000);
  if (!prompt) return res.status(400).json({ error: "Prompt khali hai" });
  const model = process.env.AI_GATEWAY_MODEL || "google/gemini-2.5-flash";
  const r = await fetch("https://ai-gateway.vercel.sh/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages: [{ role: "user", content: prompt }], temperature: 0.6, response_format: { type: "json_object" } }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const quota = r.status === 429;
    return res.status(quota ? 429 : 502).json({ error: (j.error && j.error.message) || "AI Gateway error", code: quota ? "quota" : "ai_gateway" });
  }
  const text = (((j.choices || [])[0] || {}).message || {}).content || "";
  let data;
  try { data = JSON.parse(text.replace(/^```json\s*|```\s*$/g, "").trim()); }
  catch (e) { data = { reply: text || "AI ne khaali jawab diya.", actions: [] }; }
  if (!data || typeof data !== "object" || Array.isArray(data)) data = { reply: String(text), actions: [] };
  res.json({ data });
});
