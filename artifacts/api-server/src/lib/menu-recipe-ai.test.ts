import { test } from "node:test";
import assert from "node:assert/strict";
import { parseRecipeDraft, RecipeDraftError } from "./menu-recipe-ai";

const pantry = [
  { id: "tomato", name: "Cherry tomato", unit: "kg" },
  { id: "bread", name: "Sourdough", unit: "kg" },
];

test("AI recipe draft parsing accepts only positive, unique ingredients from this pantry", () => {
  assert.deepEqual(
    parseRecipeDraft('{"recipe":[{"ingredientId":"tomato","amount":0.1}],"explanation":"One portion."}', pantry),
    { recipe: [{ ingredientId: "tomato", amount: 0.1 }], explanation: "One portion." },
  );
  for (const invalid of [
    "not-json",
    '{"recipe":[{"ingredientId":"outside","amount":1}],"explanation":"Bad"}',
    '{"recipe":[{"ingredientId":"tomato","amount":0},{"ingredientId":"tomato","amount":1}],"explanation":"Bad"}',
    '{"recipe":[{"ingredientId":"tomato","amount":1},{"ingredientId":"tomato","amount":2}],"explanation":"Bad"}',
  ]) assert.throws(() => parseRecipeDraft(invalid, pantry), RecipeDraftError);
});
