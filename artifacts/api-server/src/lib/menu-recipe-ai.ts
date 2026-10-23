import { openai } from "@workspace/integrations-openai-ai-server";
import { z } from "zod";

export type PantryOption = { id: string; name: string; unit: string };
export type RecipeDraft = { recipe: { ingredientId: string; amount: number }[]; explanation: string };

const responseSchema = z.object({
  recipe: z.array(z.object({
    ingredientId: z.string().min(1),
    amount: z.number().finite().positive().max(1_000_000),
  })).min(1).max(50),
  explanation: z.string().trim().min(1).max(500),
});

export class RecipeDraftError extends Error {}

export function parseRecipeDraft(raw: string, pantry: PantryOption[]): RecipeDraft {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new RecipeDraftError("The recipe service returned invalid data.");
  }
  const result = responseSchema.safeParse(parsed);
  if (!result.success) throw new RecipeDraftError("The recipe service returned an incomplete recipe.");
  const available = new Set(pantry.map(i => i.id));
  const seen = new Set<string>();
  for (const row of result.data.recipe) {
    if (!available.has(row.ingredientId)) throw new RecipeDraftError("The recipe service suggested an ingredient outside this pantry.");
    if (seen.has(row.ingredientId)) throw new RecipeDraftError("The recipe service returned a duplicate ingredient.");
    seen.add(row.ingredientId);
  }
  return result.data;
}

export async function generateRecipeDraft(name: string, description: string, pantry: PantryOption[]): Promise<RecipeDraft> {
  if (!pantry.length) throw new RecipeDraftError("Add pantry ingredients before drafting a recipe.");
  const completion = await openai.chat.completions.create({
    model: "gpt-5-mini",
    max_completion_tokens: 8192,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: "Draft one practical recipe portion for a small food-and-beverage business. Only use ingredient IDs from the supplied pantry list; never invent ingredients. Amounts must be positive quantities in the ingredient's existing pantry unit. Return JSON only, matching {\"recipe\":[{\"ingredientId\":\"...\",\"amount\":0.1}],\"explanation\":\"...\"}. Do not make allergen, food-safety, or nutrition guarantees. The owner will verify the draft.",
      },
      {
        role: "user",
        content: JSON.stringify({ dishName: name, description, pantry }),
      },
    ],
  });
  const content = completion.choices[0]?.message?.content;
  if (!content) throw new RecipeDraftError("The recipe service returned no draft.");
  return parseRecipeDraft(content, pantry);
}
