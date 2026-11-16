import { Hono } from "hono";
import { QUESTIONS } from "../../src/data/questions";
import { AiRefusal, explainPrompt } from "../ai";
import { dbOf, depsOf, rateLimit, readBody, requireFeature, schoolBySlug, type HonoEnv } from "../context";
import { Fail } from "../lib";
import { aiExplainSchema } from "../schemas";

export const aiRoutes = new Hono<HonoEnv>();

aiRoutes.post("/ai/explain", async (c) => {
  rateLimit(c, "ai");
  const body = await readBody(c, aiExplainSchema, 4_000);
  if (body.schoolSlug) {
    const school = await schoolBySlug(dbOf(c), body.schoolSlug);
    if (!school) throw new Fail("not_found", "school");
    requireFeature(school, "ai");
  }
  const ai = depsOf(c).ai;
  if (!ai) throw new Fail("ai_unavailable");
  const question = QUESTIONS.find((item) => item.id === body.questionId);
  if (!question) throw new Fail("not_found", "question");
  try {
    const text = await ai(
      explainPrompt(question, { selected: body.selected ?? null, style: body.style, lang: body.lang })
    );
    return c.json({ text });
  } catch (error) {
    if (error instanceof AiRefusal) throw new Fail("ai_unavailable", "refused");
    console.error("[ai] explain failed", error);
    throw new Fail("ai_unavailable", "upstream");
  }
});
