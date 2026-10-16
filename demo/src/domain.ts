export type JoinState =
  | "NONE"
  | "PENDING"
  | "DECLINED"
  | "WITHDRAWN"
  | "APPROVED_PAYMENT_PENDING"
  | "CONFIRMED"
  | "CANCELLED";
export type PaymentState = "UNPAID" | "PROCESSING" | "PAID" | "FAILED";
export type BookingState = "PENDING" | "CONFIRMED" | "FAILED" | "CANCELLED";
export type Member = {
  id: string;
  name: string;
  image: string;
  background: string;
  bio: string;
  interests: string[];
  language: string;
  life: string;
};
export type Meal = {
  id: string;
  title: string;
  venue: string;
  area: string;
  date: string;
  time: string;
  capacity: number;
  confirmed: number;
  min: number;
  max: number;
  deposit: number;
  language: string;
  mood: string;
  description: string;
  host: string;
  members: string[];
  x: number;
  y: number;
  booking: BookingState;
  costMode: "DEPOSIT" | "FIXED_MENU" | "OFFLINE";
  owned?: boolean;
  cuisine?: string;
  dietary?: string[];
};
export const members: Record<string, Member> = {
  maya: {
    id: "maya",
    name: "Maya",
    image: "maya",
    background: "Product designer · London for 2 years",
    bio: "Finding my way around London, one little restaurant at a time. I love conversations that wander, independent bookshops and sharing the last dessert.",
    interests: ["Food discoveries", "Design", "Books"],
    language: "English · Hindi",
    life: "Making London home",
  },
  leo: {
    id: "leo",
    name: "Leo",
    image: "leo",
    background: "Architect · Based in East London",
    bio: "Usually sketching buildings or looking for somewhere good to eat. Always happy to meet people outside my usual circle.",
    interests: ["Architecture", "Jazz", "Cooking"],
    language: "English · French",
    life: "Living and working in London",
  },
  emma: {
    id: "emma",
    name: "Emma",
    image: "emma",
    background: "Researcher · New to London",
    bio: "Recently moved here and making room for new friends. I enjoy films, long walks and a very unhurried dinner.",
    interests: ["Cinema", "Walking", "Travel"],
    language: "English · Spanish",
    life: "New to London",
  },
  alex: {
    id: "alex",
    name: "Alex",
    image: "leo",
    background: "Creative strategist · New to London",
    bio: "I moved to London recently and would love to meet people beyond my work bubble. Good food and easy conversation are my kind of evening.",
    interests: ["Food", "Photography", "Travel"],
    language: "English",
    life: "New to London",
  },
};
export const initialMeals: Meal[] = [
  {
    id: "supper",
    title: "An easy Friday supper",
    venue: "The Little Table",
    area: "Soho",
    date: "2026-10-23",
    time: "19:00",
    capacity: 4,
    confirmed: 3,
    min: 25,
    max: 35,
    deposit: 10,
    language: "English",
    mood: "Easy conversation",
    description:
      "A relaxed Friday dinner with a few new faces. No agenda, no pitches — just sharing plates and stories about life in London. Come as you are; you don’t need to know anyone.",
    host: "maya",
    members: ["maya", "leo", "emma"],
    x: 48,
    y: 44,
    booking: "PENDING",
    costMode: "DEPOSIT",
  },
  {
    id: "ramen",
    title: "Ramen & new faces",
    venue: "Noodle House",
    area: "Fitzrovia",
    date: "2026-10-23",
    time: "18:30",
    capacity: 5,
    confirmed: 3,
    min: 20,
    max: 30,
    deposit: 0,
    language: "English",
    mood: "Food discoveries",
    description:
      "A cosy bowl of ramen and a catch-up with people you haven’t met yet. Everyone is welcome, especially if this is your first meal.",
    host: "leo",
    members: ["leo", "emma", "maya"],
    x: 31,
    y: 24,
    booking: "CONFIRMED",
    costMode: "OFFLINE",
  },
  {
    id: "tapas",
    title: "Small plates, big stories",
    venue: "Casa Evening",
    area: "Covent Garden",
    date: "2026-10-24",
    time: "19:30",
    capacity: 6,
    confirmed: 4,
    min: 35,
    max: 35,
    deposit: 35,
    language: "English",
    mood: "Travel & culture",
    description:
      "A fixed sharing menu and stories from everywhere. Bring your curiosity and your appetite. Vegetarian options are available.",
    host: "emma",
    members: ["emma", "maya", "leo"],
    x: 79,
    y: 47,
    booking: "PENDING",
    costMode: "FIXED_MENU",
  },
  {
    id: "duo",
    title: "Lunch with someone new",
    venue: "The Garden Kitchen",
    area: "St James’s",
    date: "2026-10-24",
    time: "12:30",
    capacity: 2,
    confirmed: 1,
    min: 20,
    max: 30,
    deposit: 0,
    language: "English",
    mood: "Easy conversation",
    description:
      "A friendly lunch for two. A little space to get to know someone new over a good meal. This is a friendship-first table.",
    host: "maya",
    members: ["maya"],
    x: 60,
    y: 79,
    booking: "CONFIRMED",
    costMode: "OFFLINE",
  },
];
initialMeals.push({
  ...initialMeals[0],
  id: "soho-saturday",
  title: "A Saturday table in Soho",
  date: "2026-10-24",
  time: "18:30",
  capacity: 5,
  confirmed: 2,
  members: ["maya", "emma"],
  deposit: 0,
  costMode: "OFFLINE",
  booking: "CONFIRMED",
  description:
    "A relaxed Saturday supper with new London friends. Share a few plates and trade your favourite neighbourhood discoveries.",
});
const cuisines: Record<string, string> = {
  supper: "European",
  ramen: "Japanese",
  tapas: "Spanish",
  duo: "European",
  "soho-saturday": "European",
};
initialMeals.forEach((meal) => {
  meal.cuisine = cuisines[meal.id];
  meal.dietary = meal.id === "ramen" ? [] : ["Vegetarian options"];
});

export type DiscoveryFilters = {
  date: string;
  budget: string;
  size: string;
  search: string;
  area: string;
  language: string;
  mood: string;
  time: string;
  cuisine: string;
  dietary: string;
};
export const emptyFilters: DiscoveryFilters = {
  date: "",
  budget: "",
  size: "",
  search: "",
  area: "",
  language: "",
  mood: "",
  time: "",
  cuisine: "",
  dietary: "",
};
export function groupMealsByArea(meals: Meal[]) {
  const groups = new Map<
    string,
    { area: string; meals: Meal[]; x: number; y: number }
  >();
  for (const meal of meals) {
    const group = groups.get(meal.area);
    if (group) group.meals.push(meal);
    else
      groups.set(meal.area, {
        area: meal.area,
        meals: [meal],
        x: meal.x,
        y: meal.y,
      });
  }
  return [...groups.values()];
}
export function googleMapsAreaUrl(area: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${area}, London`)}`;
}
export function monthDates(month: string) {
  const [year, m] = month.split("-").map(Number);
  const count = new Date(Date.UTC(year, m, 0)).getUTCDate();
  const offset = (new Date(Date.UTC(year, m - 1, 1)).getUTCDay() + 6) % 7;
  return {
    offset,
    dates: Array.from(
      { length: count },
      (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`,
    ),
  };
}

export function eligibleMeals(
  meals: Meal[],
  filters: {
    date: string;
    budget: string;
    size: string;
    search?: string;
  } & Partial<DiscoveryFilters>,
) {
  return meals.filter(
    (m) =>
      (!filters.date || m.date === filters.date) &&
      (!filters.budget || m.max <= Number(filters.budget)) &&
      (!filters.size ||
        (filters.size === "small"
          ? m.capacity >= 3
          : filters.size === "duo"
            ? m.capacity === 2
            : m.capacity === Number(filters.size))) &&
      (!filters.search ||
        `${m.title} ${m.venue} ${m.area}`
          .toLowerCase()
          .includes(filters.search.trim().toLowerCase())) &&
      (!filters.area || m.area === filters.area) &&
      (!filters.language ||
        m.language.split(" & ").includes(filters.language)) &&
      (!filters.mood || m.mood === filters.mood) &&
      (!filters.time ||
        (filters.time === "lunch"
          ? Number(m.time.slice(0, 2)) < 16
          : Number(m.time.slice(0, 2)) >= 16)) &&
      (!filters.cuisine || m.cuisine === filters.cuisine) &&
      (!filters.dietary || m.dietary?.includes(filters.dietary)),
  );
}

export function applyToMeal(
  meal: Meal,
  current: JoinState,
  message: string,
  profileComplete = true,
): JoinState {
  if (current !== "NONE" && current !== "WITHDRAWN")
    throw new Error("You already have an application for this meal.");
  if (meal.owned) throw new Error("You are hosting this meal.");
  if (meal.confirmed >= meal.capacity)
    throw new Error("This table is full. Try another meal.");
  if (!profileComplete)
    throw new Error("Complete your profile before applying.");
  if (message.trim().length < 20 || message.trim().length > 300)
    throw new Error("Write a short introduction of 20–300 characters.");
  return "PENDING";
}
export function approveApplication(meal: Meal, state: JoinState): JoinState {
  if (state !== "PENDING")
    throw new Error("Only a pending application can be approved.");
  if (meal.confirmed >= meal.capacity) throw new Error("No seats available.");
  return meal.deposit > 0 ? "APPROVED_PAYMENT_PENDING" : "CONFIRMED";
}
export function completePayment(
  state: JoinState,
  paid: PaymentState,
  success: boolean,
): { join: JoinState; payment: PaymentState } {
  if (paid === "PAID" && state === "CONFIRMED")
    return { join: state, payment: paid };
  if (state !== "APPROVED_PAYMENT_PENDING")
    throw new Error("A valid approval is needed before payment.");
  return success
    ? { join: "CONFIRMED", payment: "PAID" }
    : { join: state, payment: "FAILED" };
}
export function refundAmount(
  amount: number,
  beforeDeadline: boolean,
  cancelledByPlatform = false,
) {
  return beforeDeadline || cancelledByPlatform ? amount : 0;
}
export function groupReady(capacity: number, confirmed: number) {
  return confirmed >= (capacity === 2 ? 2 : 3);
}
export function validateMeal(
  title: string,
  description: string,
  capacity: number,
  min: number,
  max: number,
) {
  if (title.trim().length < 5 || title.length > 80)
    return "Give your meal a title of 5–80 characters.";
  if (description.trim().length < 20 || description.length > 1000)
    return "Tell guests about your meal in 20–1,000 characters.";
  if (!Number.isInteger(capacity) || capacity < 2 || capacity > 6)
    return "Choose a table for 2–6 people, including you.";
  if (!Number.isFinite(min) || !Number.isFinite(max) || min < 0 || max < min)
    return "Enter a valid budget, with the maximum at least the minimum.";
  return "";
}
export const longDate = (date: string) =>
  new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "Europe/London",
  }).format(new Date(date + "T12:00:00Z"));
