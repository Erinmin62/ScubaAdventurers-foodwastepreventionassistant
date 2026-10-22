import { openai } from "@workspace/integrations-openai-ai-server";
import { z } from "zod";
import { seed, shift, today } from "./guard-model";

const dateString = z.string().refine(value =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(Date.parse(`${value}T00:00:00Z`)) &&
  new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value,
);
const demoResponseSchema = z.object({
  mode: z.literal("synthetic_demo"),
  model: z.literal("gpt-5-mini"),
  generatedAt: z.string().datetime(),
  historyDays: z.literal(28),
  horizonStart: dateString,
  horizonEnd: dateString,
  summary: z.string().trim().min(1).max(500),
  demandForecasts: z.array(z.object({
    menuId: z.string().min(1),
    name: z.string().min(1),
    predictedPortionsByDay: z.array(z.number().int().min(0).max(1000)).length(7),
    totalPredictedPortions: z.number().int().min(0).max(7000),
    explanation: z.string().trim().min(1).max(500),
  })),
  wastePredictions: z.array(z.object({
    ingredientId: z.string().min(1),
    name: z.string().min(1),
    estimatedAtRisk: z.number().finite().min(0).max(1_000_000),
    unit: z.enum(["kg", "L", "pcs"]),
    expiryDate: dateString,
    explanation: z.string().trim().min(1).max(500),
  })),
  orderRecommendations: z.array(z.object({
    ingredientId: z.string().min(1),
    name: z.string().min(1),
    suggestedOrderQuantity: z.number().finite().min(0).max(1_000_000),
    unit: z.enum(["kg", "L", "pcs"]),
    proposedDeliveryDate: dateString,
    explanation: z.string().trim().min(1).max(500),
  })),
  disclaimer: z.string().min(1),
}).strict();
export type AiForecastDemoResponse = z.infer<typeof demoResponseSchema>;

export type SyntheticForecastContext = {
  historyDays: 28;
  historyStart: string;
  historyEnd: string;
  horizonDates: string[];
  menu: { id: string; name: string; recipe: { ingredientId: string; amount: number }[] }[];
  ingredients: { id: string; name: string; unit: string; quantity: number; expiryDate: string; deliveryQuantity: number; deliveryDate: string }[];
  dailySales: { date: string; menuId: string; portions: number }[];
  dailyPreparation: { date: string; menuId: string; prepared: number; sold: number; leftover: number }[];
};

const modelOutputSchema = z.object({
  summary: z.string().trim().min(1).max(500),
  demandForecasts: z.array(z.object({
    menuId: z.string().min(1),
    predictedPortionsByDay: z.array(z.number().int().min(0).max(1000)).length(7),
    totalPredictedPortions: z.number().int().min(0).max(7000),
    explanation: z.string().trim().min(1).max(500),
  })).min(1).max(50),
  wastePredictions: z.array(z.object({
    ingredientId: z.string().min(1),
    estimatedAtRisk: z.number().finite().min(0).max(1_000_000),
    explanation: z.string().trim().min(1).max(500),
  })).min(1).max(100),
  orderRecommendations: z.array(z.object({
    ingredientId: z.string().min(1),
    suggestedOrderQuantity: z.number().finite().min(0).max(1_000_000),
    proposedDeliveryDate: z.string().min(10).max(10),
    explanation: z.string().trim().min(1).max(500),
  })).min(1).max(100),
});

export class AiForecastDemoError extends Error {}

export function buildSyntheticForecastContext(): SyntheticForecastContext {
  const state = seed();
  const current = today();
  const historyStart = shift(current, -27);
  const horizonDates = Array.from({ length: 7 }, (_, index) => shift(current, index + 1));
  return {
    historyDays: 28,
    historyStart,
    historyEnd: current,
    horizonDates,
    menu: state.menu.map(item => ({
      id: item.id,
      name: item.name,
      recipe: item.recipe.map(row => ({ ingredientId: row.ingredientId, amount: row.amount })),
    })),
    ingredients: state.ingredients.map(item => ({
      id: item.id,
      name: item.name,
      unit: item.unit,
      quantity: item.quantity,
      expiryDate: item.expiry,
      deliveryQuantity: item.deliveryQuantity,
      deliveryDate: item.deliveryDate,
    })),
    dailySales: state.sales
      .filter(row => row.date >= historyStart && row.date <= current)
      .map(row => ({ date: row.date, menuId: row.menuId, portions: row.portions })),
    dailyPreparation: state.results
      .filter(row => row.date >= historyStart && row.date <= current)
      .map(row => ({ date: row.date, menuId: row.menuId, prepared: row.prepared, sold: row.sold, leftover: row.leftover })),
  };
}

function validDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`)) &&
    new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}

export function parseSyntheticForecastOutput(raw: string, context: SyntheticForecastContext, generatedAt = new Date().toISOString()): AiForecastDemoResponse {
  let unknownOutput: unknown;
  try {
    unknownOutput = JSON.parse(raw);
  } catch {
    throw new AiForecastDemoError("The model returned invalid JSON.");
  }
  const parsed = modelOutputSchema.safeParse(unknownOutput);
  if (!parsed.success) throw new AiForecastDemoError("The model returned an incomplete forecast.");
  const modelResult = parsed.data;

  const menuById = new Map(context.menu.map(item => [item.id, item]));
  const ingredientById = new Map(context.ingredients.map(item => [item.id, item]));
  if (modelResult.demandForecasts.length !== context.menu.length) throw new AiForecastDemoError("The model did not forecast every sample dish.");
  const seenMenu = new Set<string>();
  for (const forecast of modelResult.demandForecasts) {
    if (!menuById.has(forecast.menuId) || seenMenu.has(forecast.menuId)) throw new AiForecastDemoError("The model returned an unknown or duplicate dish.");
    if (forecast.predictedPortionsByDay.reduce((total, amount) => total + amount, 0) !== forecast.totalPredictedPortions) {
      throw new AiForecastDemoError("The model returned an inconsistent dish total.");
    }
    seenMenu.add(forecast.menuId);
  }
  if (seenMenu.size !== context.menu.length) throw new AiForecastDemoError("The model omitted a sample dish.");

  const seenWaste = new Set<string>();
  for (const risk of modelResult.wastePredictions) {
    const ingredient = ingredientById.get(risk.ingredientId);
    if (!ingredient || seenWaste.has(risk.ingredientId)) throw new AiForecastDemoError("The model returned an unknown or duplicate pantry ingredient.");
    if (risk.estimatedAtRisk > ingredient.quantity + ingredient.deliveryQuantity) throw new AiForecastDemoError("The model estimated more waste than the sample stock contains.");
    seenWaste.add(risk.ingredientId);
  }
  if (seenWaste.size !== context.ingredients.length) throw new AiForecastDemoError("The model omitted a sample pantry ingredient.");

  const seenOrders = new Set<string>();
  for (const order of modelResult.orderRecommendations) {
    if (!ingredientById.has(order.ingredientId) || seenOrders.has(order.ingredientId)) throw new AiForecastDemoError("The model returned an unknown or duplicate order ingredient.");
    if (!validDate(order.proposedDeliveryDate) || !context.horizonDates.includes(order.proposedDeliveryDate)) {
      throw new AiForecastDemoError("The model returned a delivery date outside the sample forecast week.");
    }
    seenOrders.add(order.ingredientId);
  }
  if (seenOrders.size !== context.ingredients.length) throw new AiForecastDemoError("The model omitted a sample order recommendation.");

  const response: AiForecastDemoResponse = {
    mode: "synthetic_demo",
    model: "gpt-5-mini",
    generatedAt,
    historyDays: 28,
    horizonStart: context.horizonDates[0]!,
    horizonEnd: context.horizonDates[6]!,
    summary: modelResult.summary,
    demandForecasts: modelResult.demandForecasts.map(forecast => ({
      menuId: forecast.menuId,
      name: menuById.get(forecast.menuId)!.name,
      predictedPortionsByDay: forecast.predictedPortionsByDay,
      totalPredictedPortions: forecast.totalPredictedPortions,
      explanation: forecast.explanation,
    })),
    wastePredictions: modelResult.wastePredictions.map(prediction => {
      const ingredient = ingredientById.get(prediction.ingredientId)!;
      return {
        ingredientId: ingredient.id,
        name: ingredient.name,
        estimatedAtRisk: prediction.estimatedAtRisk,
        unit: ingredient.unit as "kg" | "L" | "pcs",
        expiryDate: ingredient.expiryDate,
        explanation: prediction.explanation,
      };
    }),
    orderRecommendations: modelResult.orderRecommendations.map(recommendation => {
      const ingredient = ingredientById.get(recommendation.ingredientId)!;
      return {
        ingredientId: ingredient.id,
        name: ingredient.name,
        suggestedOrderQuantity: recommendation.suggestedOrderQuantity,
        unit: ingredient.unit as "kg" | "L" | "pcs",
        proposedDeliveryDate: recommendation.proposedDeliveryDate,
        explanation: recommendation.explanation,
      };
    }),
    disclaimer: "Synthetic demonstration only. This model is not trained on café-specific data, has not been validated against real outcomes, and must not guide real food-safety or purchasing decisions. No stock or order is changed.",
  };
  try {
    demoResponseSchema.parse(response);
  } catch {
    throw new AiForecastDemoError("The model result did not match the demo response contract.");
  }
  return response;
}

export async function completeSyntheticForecast(context: SyntheticForecastContext): Promise<string> {
  const completion = await openai.chat.completions.create({
    model: "gpt-5-mini",
    max_completion_tokens: 4096,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: [
          "You are a time-series forecasting model for an EXPERIMENTAL DEMONSTRATION only.",
          "Use only the provided synthetic history, recipe amounts, expiry dates, current stock and incoming deliveries.",
          "Forecast daily sold portions for each menu item for each of the seven listed future dates.",
          "Estimate units of each pantry ingredient likely to remain unused and at risk over the forecast horizon.",
          "Recommend a quantity for each ingredient to consider ordering and a proposed delivery date from the listed horizon dates.",
          "Never recommend using expired stock. Do not claim calibrated confidence, accuracy, guaranteed savings, or food-safety compliance.",
          "Return valid JSON only with this exact shape: {summary:string,demandForecasts:[{menuId:string,predictedPortionsByDay:number[7],totalPredictedPortions:integer,explanation:string}],wastePredictions:[{ingredientId:string,estimatedAtRisk:number,explanation:string}],orderRecommendations:[{ingredientId:string,suggestedOrderQuantity:number,proposedDeliveryDate:string,explanation:string}]}",
          "Include every supplied menu ID and every supplied ingredient ID exactly once in each relevant list. Keep numeric estimates plausible and within known sample stock. Keep each explanation short.",
        ].join(" "),
      },
      { role: "user", content: JSON.stringify(context) },
    ],
  });
  const content = completion.choices[0]?.message?.content;
  if (!content) throw new AiForecastDemoError("The model returned no forecast.");
  return content;
}
