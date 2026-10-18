import {
  eligibleMeals,
  emptyFilters,
  type DiscoveryFilters,
  type Meal,
} from "./domain.ts";

// A deterministic interaction model for the prototype, not a language-model API.
export type MealPreferences = Pick<
  DiscoveryFilters,
  "area" | "budget" | "size" | "language" | "mood" | "dietary"
>;
export type AssistantQuery = Partial<DiscoveryFilters>;
export const blankPreferences: MealPreferences = {
  area: "",
  budget: "",
  size: "",
  language: "",
  mood: "",
  dietary: "",
};
export type AssistantReply = {
  text: string;
  meals?: Meal[];
  query?: AssistantQuery;
  draft?: {
    kind: "application" | "message" | "create";
    text: string;
    mealId?: string;
  };
  preferences?: MealPreferences;
};
export type AssistantContext = {
  meals: Meal[];
  current?: Meal;
  filters: DiscoveryFilters;
  query: AssistantQuery;
  preferences: MealPreferences;
  today: string;
};

export function parseMealRequest(text: string, today: string): AssistantQuery {
  const q: AssistantQuery = {};
  for (const area of ["Soho", "Fitzrovia", "Covent Garden", "St James’s"])
    if (
      text.toLowerCase().includes(area.toLowerCase().replace("’", "'")) ||
      text.toLowerCase().includes(area.toLowerCase())
    )
      q.area = area;
  const budget =
    text.match(/(?:£\s*|预算\s*|budget\s*(?:of\s*)?)(\d+(?:\.\d{1,2})?)/i) ||
    text.match(/(\d+(?:\.\d{1,2})?)\s*(?:pounds|英镑)/i);
  if (budget) q.budget = budget[1];
  const size =
    text.match(/(?:table\s*(?:for|of)\s*|for\s+)([2-6])\b/i) ||
    text.match(/([2-6])\s*(?:people|persons|人)/i);
  if (size) q.size = size[1];
  if (/four people|table for four|四人/i.test(text)) q.size = "4";
  if (/two people|table for two|两人/i.test(text)) q.size = "2";
  if (/relaxed|easy conversation|轻松/i.test(text))
    q.mood = "Easy conversation";
  if (/vegetarian|素食/i.test(text)) q.dietary = "Vegetarian options";
  if (/\bvegan\b|纯素/i.test(text)) q.dietary = "Vegan";
  for (const [language, pattern] of [
    ["English", /\benglish\b|英语/i],
    ["Mandarin", /\bmandarin\b|中文|普通话/i],
    ["Spanish", /\bspanish speaking\b|西班牙语/i],
    ["French", /\bfrench speaking\b|法语/i],
  ] as const)
    if (pattern.test(text)) q.language = language;
  for (const [cuisine, pattern] of [
    ["Japanese", /\bjapanese\b|\bramen\b|日料|拉面/i],
    ["Spanish", /\btapas\b|spanish food|西班牙菜/i],
    ["European", /european food|欧餐/i],
    ["Chinese", /\bsichuan\b|chinese food|川菜|中餐/i],
  ] as const)
    if (pattern.test(text)) q.cuisine = cuisine;
  if (/\blunch\b|午餐|中午/i.test(text)) q.time = "lunch";
  if (/\bdinner\b|\bevening\b|晚餐|晚上/i.test(text)) q.time = "dinner";
  const date = text.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  if (
    date &&
    !Number.isNaN(Date.parse(date[1])) &&
    new Date(date[1]).toISOString().slice(0, 10) === date[1]
  )
    q.date = date[1];
  const day = new Date(today + "T12:00:00Z");
  if (/\btoday\b|今天/i.test(text)) q.date = today;
  if (/\btomorrow\b|明天/i.test(text)) {
    day.setUTCDate(day.getUTCDate() + 1);
    q.date = day.toISOString().slice(0, 10);
  }
  const weekdays = [
    /sunday|周日|星期日/i,
    /monday|周一|星期一/i,
    /tuesday|周二|星期二/i,
    /wednesday|周三|星期三/i,
    /thursday|周四|星期四/i,
    /friday|周五|星期五/i,
    /saturday|周六|星期六/i,
  ];
  const weekday = weekdays.findIndex((pattern) => pattern.test(text));
  if (!date && weekday >= 0) {
    const next = new Date(today + "T12:00:00Z");
    const offset = (weekday - next.getUTCDay() + 7) % 7;
    next.setUTCDate(
      next.getUTCDate() + (offset || (/next|下周/i.test(text) ? 7 : 0)),
    );
    q.date = next.toISOString().slice(0, 10);
  }
  return q;
}

export function preferenceSummary(p: AssistantQuery): string {
  return [
    p.area,
    p.date,
    p.budget && `up to £${p.budget}`,
    p.size && `table for ${p.size}`,
    p.language,
    p.mood,
    p.dietary,
    p.cuisine,
    p.time,
    p.search,
  ]
    .filter(Boolean)
    .join(" · ");
}

export function assistantReply(
  text: string,
  c: AssistantContext,
): AssistantReply {
  const parsed = parseMealRequest(text, c.today);
  const meal = c.current;
  if (/remember|save.*prefer|记住|保存偏好/i.test(text)) {
    const preferences = { ...c.preferences };
    for (const key of Object.keys(preferences) as (keyof MealPreferences)[])
      if (parsed[key]) preferences[key] = parsed[key]!;
    return preferenceSummary(preferences)
      ? {
          text: "Save these preferences? You can edit or delete them in My preferences. Dates stay in this search only.",
          preferences,
        }
      : {
          text: "Tell me an area, budget, table size, language or dining preference to remember. For example: remember Soho and a budget of £35.",
        };
  }
  if (
    /publish|send (it|now)|pay (now|for)|submit|发布|直接发送|付款/i.test(text)
  )
    return {
      text: "I can prepare a draft. You review and submit applications, publish meals, send messages and confirm payments yourself in the relevant screen.",
    };
  if (/apply|application|introduction|申请|自我介绍/i.test(text)) {
    if (meal?.owned)
      return {
        text: "You host this meal. Open Manage applications to review your guests; you don’t need to apply to your own table.",
      };
    if (!meal)
      return {
        text: "Open a meal first so I can prepare an introduction for that table.",
      };
    return {
      text: `Here’s a starting point for ${meal.title}. Edit it to sound like you; nothing has been sent.`,
      draft: {
        kind: "application",
        mealId: meal.id,
        text: `Hi! I’d love to join your meal at ${meal.venue}. I’m looking forward to good food and getting to know everyone. Is there anything I should know before joining?`,
      },
    };
  }
  if (/message|coordinate|协调|消息/i.test(text)) {
    if (!meal)
      return {
        text: "Open the meal you want to coordinate. I can draft a message without reading your conversations.",
      };
    return {
      text: "A coordination draft based on the meal details. I haven’t read the group’s messages. Review it in the chat before sending.",
      draft: {
        kind: "message",
        mealId: meal.id,
        text: `Hi everyone! Shall we meet at ${meal.venue} at ${meal.time} on ${meal.date}? Please let the host know if your plans change.`,
      },
    };
  }
  if (/create|host|organis|organiz|组局|发起/i.test(text))
    return {
      text: "Let’s start a meal draft. Your request will be carried into the description. Choose the restaurant, available time and costs in Create meal, then review before publishing.",
      query: { ...c.query, ...parsed },
      draft: { kind: "create", text: text.slice(0, 1000) },
    };
  if (
    /cost|deposit|payment|booking|approved|status|费用|订金|付款|预约|状态/i.test(
      text,
    )
  ) {
    if (!meal)
      return {
        text: "Open a meal to see its costs and booking details. Host approval, payment and restaurant confirmation are separate steps.",
      };
    return {
      text: `${meal.title}: estimated spend £${meal.min}–${meal.max} per person. ${meal.costMode === "OFFLINE" ? "Pay at the restaurant; no payment is due on approval." : `£${meal.deposit} is due after host approval (${meal.costMode === "DEPOSIT" ? "deposit" : "fixed menu"}).`} Restaurant booking: ${meal.booking.toLowerCase()}. Payment confirms your seat, not the restaurant booking. Open the meal for your latest application, payment and cancellation terms.`,
      meals: [meal],
    };
  }
  const explicitDate = text.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  if (explicitDate && !parsed.date)
    return {
      text: "That date isn’t valid. Use YYYY-MM-DD, for example 2026-10-23.",
    };
  const areaRequest = text.match(
    /\bin\s+([a-z][a-z’' ]*?)(?=,|\.|\s+(?:for|under|with|on|at|this|next|today|tomorrow|friday|saturday|sunday|monday|tuesday|wednesday|thursday)\b|$)/i,
  );
  if (areaRequest && !parsed.area && !/^london$/i.test(areaRequest[1].trim()))
    return {
      text: "I can currently search Soho, Fitzrovia, Covent Garden and St James’s. Choose one of these areas, or say “any area” to compare available tables.",
    };
  const activeFilters = Object.fromEntries(
    Object.entries(c.filters).filter(([, value]) => value !== ""),
  );
  const query: AssistantQuery = {
    ...c.preferences,
    ...activeFilters,
    ...c.query,
    ...parsed,
  };
  if (/any area|anywhere|不限区域/i.test(text)) query.area = "";
  if (/any date|any day|不限日期/i.test(text)) query.date = "";
  if (/any budget|不限预算/i.test(text)) query.budget = "";
  if (/any size|不限人数/i.test(text)) query.size = "";
  if (/clear search|start over|清空条件/i.test(text))
    Object.assign(query, emptyFilters);
  const recognized =
    Object.keys(parsed).length > 0 ||
    /find|meal|table|compare|cheaper|any |clear search|start over|找|饭局|比较|不限|清空条件/i.test(
      text,
    );
  if (!recognized)
    return {
      text: "I can help find or compare meals, draft a meal, prepare an application, explain costs or draft a group message. Try “Friday in Soho, budget £35” or open a meal and ask about its deposit.",
    };
  if (/cheaper|便宜/i.test(text) && !parsed.budget)
    query.budget = String(Math.max(0, Number(query.budget || 35) - 5));
  const results = eligibleMeals(c.meals, { ...emptyFilters, ...query }).filter(
    (m) =>
      m.confirmed < m.capacity &&
      m.date >= c.today &&
      m.booking !== "CANCELLED" &&
      !m.owned,
  );
  const criteria = preferenceSummary(query);
  return {
    query,
    text: results.length
      ? `${/compare|比较/i.test(text) ? "Compare these options" : `I found ${results.length} ${results.length === 1 ? "table" : "tables"}`}${criteria ? ` for ${criteria}` : " with places available"}. Budget uses the top of each meal’s estimated range. Open a meal to review the people, costs and terms.`
      : `No available tables match${criteria ? ` ${criteria}` : " these conditions"}. I haven’t changed your requirements. Try “any area”, “any date”, “any budget” or “clear search”, or ask me to draft a meal.`,
    meals: results,
  };
}
