// api/eval.js
// 最终版：支持英文 + 德语写作评分，返回统一 JSON 结构
// 在 Vercel 上运行，使用环境变量 OPENAI_API_KEY 调用 OpenAI

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
You can evaluate and correct writing in both ENGLISH and GERMAN.

TASK CONTEXT:
The student is playing an image description game.
They see a picture with this theme: "${theme}".
The image tags (objects / ideas in the scene) are: ${tags}.

The student wrote this description:

"""${text}"""

INSTRUCTIONS:

1. First, detect the language of the student's text:
   - If it is English → evaluate as an English text.
   - If it is German → evaluate as a German text.

2. Evaluate the text based on:
   - Relevance to the given theme and tags.
   - Richness of content (details, vocabulary, interesting ideas).
   - Logical structure and coherence (does it make sense, good flow?).
   - Grammar, vocabulary, and style in that language.

3. Give a total score from 0 to 1000 (integer):
   - Think of 600 as a clear pass level.
   - 800+ is very good, 900+ is excellent.

4. Identify grammar and style problems:
   - For English: tense errors, wrong prepositions, word choice, sentence structure, etc.
   - For German: verb position (Wortstellung), conjugation, cases (Nominativ/Akkusativ/Dativ/Genitiv),
     article endings, word order in main and subordinate clauses, etc.

5. Provide:
   - A short breakdown (3–6 lines) of how you judged relevance, richness, logic and grammar.
   - A more detailed explanation to help the student improve.
   - A list of grammar/style issues as short bullet-like sentences.
   - A corrected version that fixes errors but stays close to the student's style.
   - A clearly improved version (richer, more natural, high-level).
   - All of your text (breakdown, explanation, corrections) must be written
     in the SAME LANGUAGE as the student's original text (English or German).

6. RETURN FORMAT (VERY IMPORTANT):

Return ONLY a strict JSON object, no markdown, no extra explanation, like:

{
  "score": 0,
  "passed": false,
  "breakdown": "",
  "explanation": "",
  "grammarIssues": [],
  "betterVersion": ""
}

- "score": integer from 0 to 1000
- "passed": boolean, true if score >= 600
- "breakdown": short explanation (3–6 lines max)
- "explanation": a more detailed feedback block
- "grammarIssues": array of short strings, each describing one issue
- "betterVersion": corrected & improved version of the student's text

Do NOT include anything outside of the JSON.
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
          { role: "system", content: "You are a strict but friendly writing examiner for both English and German. Always answer in JSON only." },
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
    const content = openaiJson?.choices?.[0]?.message?.content;
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

    // 确保字段都有（避免前端崩）
    const response = {
      score: typeof parsed.score === "number" ? parsed.score : 0,
      passed: typeof parsed.passed === "boolean" ? parsed.passed : (parsed.score || 0) >= 600,
      breakdown: parsed.breakdown || "",
      explanation: parsed.explanation || "",
      grammarIssues: Array.isArray(parsed.grammarIssues) ? parsed.grammarIssues : [],
      betterVersion: parsed.betterVersion || ""
    };

    res.status(200).json(response);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal error", details: String(err) });
  }
}
