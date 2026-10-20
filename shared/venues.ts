/** Verified restaurant identities; fixture meal budgets are user estimates, never menu quotes or availability. */
export const londonVenues = [
  {
    id: "dishoom-carnaby",
    name: "Dishoom Carnaby",
    address: "22 Kingly Street, London W1B 5QP",
    area: "Soho",
    cuisine: "Indian",
    x: 36,
    y: 30,
    mapUrl: "https://maps.app.goo.gl/zmnJNt9WrwAhppMt9",
    source: "https://www.dishoom.com/carnaby/",
  },
  {
    id: "flat-iron-soho",
    name: "Flat Iron Soho",
    address: "17 Beak Street, London W1F 9RW",
    area: "Soho",
    cuisine: "Steak",
    x: 44,
    y: 42,
    mapUrl: "https://maps.app.goo.gl/QKogMhUDhSXw8DGH8",
    source: "https://flatironsteak.co.uk/restaurant/soho/",
  },
  {
    id: "barbary-neals-yard",
    name: "The Barbary Neal’s Yard",
    address: "16 Neal’s Yard, London WC2H 9DP",
    area: "Covent Garden",
    cuisine: "North African",
    x: 77,
    y: 44,
    mapUrl:
      "https://www.google.com/maps/search/?api=1&query=The+Barbary+16+Neal%27s+Yard+London+WC2H+9DP",
    source: "https://www.thebarbary.co.uk/neals-yard",
  },
] as const;
export type LondonVenue = (typeof londonVenues)[number];
export const findVenue = (id: string) => londonVenues.find((v) => v.id === id);
