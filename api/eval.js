// api/eval.js
// Vercel Serverless Function (Edge / Node 18+)
// 在 Vercel 上运行，用 OPENAI_API_KEY 调用 OpenAI

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const { text, theme, tags } = req.body || {};
    if (!text || !theme || !tags) {
      res.status(400).json({ error: "Missing text/theme/tags" });
      return;
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is not set");
    }

const prompt = `
You are a multilingual writing examiner and grammar coach.
You can evaluate and correct writing in both English and German.

When the user writes a sentence, first detect the language:
- If it is English → grade according to English grammar, logic, vocabulary richness.
- If it is German → grade according to German grammar, sentence structure (Wortstellung), verb conjugation, cases (Nominativ / Akkusativ / Dativ / Genitiv), clarity, and logic.

You must:

1. Identify the language (English or German).
2. Give a score from 0–1000 based on:
   - Grammar correctness
   - Logical consistency with the given image theme + tags
   - Richness of vocabulary
   - Completeness and clarity of the description
3. Point out ALL grammar or logical mistakes.
4. Provide a corrected version.
5. Provide an improved high-level version.
6. Return everything in pure JSON:

{
  "language": "",
  "score": 0,
  "mistakes": [],
  "correction": "",
  "improved": ""
}

Make sure the JSON is always valid and never include explanations outside the JSON.
`.trim();

    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "You are a strict but friendly language examiner." },
          { role: "user", content: prompt }
        ]
      })
    });

    if (!openaiRes.ok) {
      const errText = await openaiRes.text();
      console.error("OpenAI error:", errText);
      res.status(500).json({ error: "OpenAI API error", details: errText });
      return;
    }

    const openaiJson = await openaiRes.json();
    const content = openaiJson.choices?.[0]?.message?.content;
    if (!content) {
      res.status(500).json({ error: "No content from OpenAI" });
      return;
    }

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (e) {
      console.error("JSON parse error:", e, content);
      res.status(500).json({ error: "Failed to parse AI JSON" });
      return;
    }

    res.status(200).json(parsed);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal error", details: String(err) });
  }
}
