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
You are an English writing examiner and grammar coach.

The student is playing an image description game.
They see a picture with this theme: "${theme}".
The image tags (objects / ideas in the scene) are: ${tags}.

The student wrote this description:

"""${text}"""

Please:
1. Evaluate relevance to the theme and tags.
2. Evaluate richness of content (details, vocabulary).
3. Evaluate logical structure and coherence.
4. Evaluate grammar, vocabulary and style.
5. Give a total score from 0 to 1000 (integer).
   - Think of 600 as a clear pass, 800+ as very good, 900+ as excellent.

Return your result as a strict JSON object with the following fields:

{
  "score": number,                   // integer 0–1000
  "passed": boolean,                 // true if score >= 600
  "breakdown": string,               // short explanation of 3–6 lines
  "explanation": string,             // more detailed explanation for the student
  "grammarIssues": string[],         // list each grammar or style problem in a short sentence
  "betterVersion": string            // your improved version of the student's description
}

Do NOT include anything outside of the JSON. Do NOT use markdown.
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
