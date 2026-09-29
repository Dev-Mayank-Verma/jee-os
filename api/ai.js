const { user, wrap } = require("./_lib");

module.exports = wrap(async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  if (!user(req)) return res.status(401).json({ error: "Login karo", code: "auth" });
  const key = process.env.GEMINI_API_KEY;
  if (!key) return res.status(503).json({ error: "GEMINI_API_KEY set nahi hai" });
  const prompt = String((req.body || {}).prompt || "").slice(0, 60000);
  if (!prompt) return res.status(400).json({ error: "Prompt khali hai" });
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";

  const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + encodeURIComponent(model) + ":generateContent", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json", temperature: 0.6 },
    }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const quota = r.status === 429;
    return res.status(quota ? 429 : 502).json({ error: (j.error && j.error.message) || "Gemini error", code: quota ? "quota" : "gemini" });
  }
  const parts = (((j.candidates || [])[0] || {}).content || {}).parts || [];
  const text = parts.map((p) => p.text || "").join("");
  let data;
  try { data = JSON.parse(text.replace(/^```json\s*|```\s*$/g, "").trim()); }
  catch (e) { data = { reply: text || "AI ne khaali jawab diya.", actions: [] }; }
  if (!data || typeof data !== "object" || Array.isArray(data)) data = { reply: String(text), actions: [] };
  res.json({ data });
});
