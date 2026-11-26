import type { Memory, PhotoPlacement, SceneKind } from "@/types/memory";

/**
 * PLACEHOLDER CONTENT. These memories are fictional and their photographs are
 * painted procedurally at runtime (see lib/textures/photoPainter.ts). Phase 2
 * replaces this module with user-owned data.
 */

const L = 3 / 2; // landscape
const P = 2 / 3; // portrait
const S = 1; // square

function m(id: string, title: string, year: number, scene: SceneKind, aspect: number, caption: string, seed: number): Memory {
  return { id, title, year, scene, aspect, caption, seed };
}

export const MEMORIES: Memory[] = [
  // Main Memory Gallery
  m("g01", "Lake at First Light", 2019, "lake", L, "We woke before everyone else just to watch the mist lift off the water.", 11),
  m("g02", "The Long Road North", 2017, "mountains", L, "Six hours of switchbacks, one playlist on repeat, no regrets.", 12),
  m("g03", "Saturday Market Lanterns", 2021, "lanterns", L, "The night market smelled of grilled corn and rain.", 13),
  m("g04", "Where the Pines Whisper", 2016, "forest", L, "A trail with no name and a silence worth keeping.", 14),
  m("g05", "Last Swim of Summer", 2022, "sunset-sea", L, "The water was cold, the sky was gold, and nobody wanted to leave.", 15),
  m("g06", "City After Rain", 2018, "night-city", L, "Every window lit like a tiny story.", 16),
  m("g07", "Wildflower Hill", 2020, "meadow", L, "We lay in the grass and named the clouds.", 17),
  m("g08", "Snow Day Cabin", 2015, "snow", L, "Hot cocoa, a crackling stove, and nowhere to be.", 18),
  m("g09", "Dunes at Golden Hour", 2023, "desert", L, "The sand kept the warmth of the day long after sunset.", 19),
  m("g10", "Harbor Goodbyes", 2014, "sunset-sea", L, "The ferry horn still sounds like a promise to come back.", 20),
  m("g11", "October Walk", 2021, "autumn", L, "Leaves crunched underfoot all the way home.", 21),
  m("g12", "Island Weekend", 2019, "beach", L, "Two days, one umbrella, and the clearest water we had ever seen.", 22),
  m("g13", "Mountain Hut Breakfast", 2022, "mountains", P, "Porridge tastes better at 2,000 meters.", 23),
  m("g14", "Fireflies", 2018, "lanterns", P, "The garden glowed like it was keeping a secret.", 24),
  m("g15", "Quiet Fjord", 2024, "lake", L, "Not a single ripple for an hour.", 25),
  m("g16", "Rooftop New Year", 2020, "night-city", L, "Counting down with strangers who felt like friends.", 26),
  m("g17", "Orchard Path", 2017, "autumn", P, "Apples in every pocket.", 27),
  m("g18", "Morning Fog", 2016, "forest", P, "The forest breathed out and the world went soft.", 28),
  m("g19", "Tide Pools", 2023, "beach", L, "Tiny worlds in every puddle of the reef.", 29),

  // Timeline Hall (chronological)
  m("t01", "The First Camera", 2009, "meadow", L, "The first roll of film — half of it blurry, all of it precious.", 31),
  m("t02", "Moving Day", 2011, "autumn", L, "Boxes everywhere, and a new street to learn by heart.", 32),
  m("t03", "Graduation Summer", 2012, "sunset-sea", L, "Caps in the air, then straight to the coast.", 33),
  m("t04", "First Apartment View", 2014, "night-city", L, "A tiny balcony with the whole city in it.", 34),
  m("t05", "Road Trip West", 2015, "desert", L, "Gas station snacks and endless horizons.", 35),
  m("t06", "The Big Snow", 2017, "snow", L, "The whole town closed and everyone went sledding.", 36),
  m("t07", "Hiking the Ridge", 2018, "mountains", L, "We reached the top just as the clouds broke open.", 37),
  m("t08", "Backyard Summers", 2020, "meadow", L, "When the world got smaller, the garden got bigger.", 38),
  m("t09", "Lantern Festival", 2022, "lanterns", L, "Thousands of wishes floating over the river.", 39),
  m("t10", "Back to the Sea", 2024, "beach", L, "Same beach, ten years later, same laughter.", 40),
  m("t11", "Today, Still Wandering", 2025, "lake", L, "The story keeps going. There is room on these walls.", 41),

  // Memory Garden
  m("m01", "Picnic Under the Oak", 2021, "meadow", S, "Strawberries, a checkered blanket and an afternoon that refused to end.", 51),
  m("m02", "Rose Season", 2019, "forest", S, "The garden smelled like summer for weeks.", 52),
  m("m03", "Rainy Greenhouse", 2023, "lake", S, "Raindrops drumming on the glass roof.", 53),
  m("m04", "Evening by the Fountain", 2020, "sunset-sea", S, "Coins, wishes and the sound of falling water.", 54),
];

export const MEMORY_BY_ID: ReadonlyMap<string, Memory> = new Map(MEMORIES.map((mem) => [mem.id, mem]));

// ── Placements ─────────────────────────────────────────────────────────────
// Wall faces sit 0.2 m from the wall centerline; photos float 3 cm proud of it.
const WALL_OFFSET = 0.23;
const PARTITION_OFFSET = 0.18;

function wall(memoryId: string, x: number, y: number, z: number, facing: PhotoPlacement["facing"], height: number, frame: PhotoPlacement["frame"]): PhotoPlacement {
  return { memoryId, x, y, z, facing, height, frame, mount: "wall" };
}

const galleryPlacements: PhotoPlacement[] = [
  // East wall — the long photo wall.
  ...[-21, -16.5, -12, -7.5, -3].map((z, i) =>
    wall(`g0${i + 1}`, 12 - WALL_OFFSET, 2.3, z, "-x", 1.25, i % 2 === 0 ? "oak" : "black"),
  ),
  // West wall, between windows and the garden door.
  wall("g06", -12 + WALL_OFFSET, 2.3, -15.75, "+x", 1.2, "black"),
  wall("g07", -12 + WALL_OFFSET, 2.3, -8.25, "+x", 1.2, "oak"),
  // North wall, flanking the big window.
  wall("g13", -8, 2.45, -24 + WALL_OFFSET, "+z", 1.6, "gold"),
  wall("g17", 8, 2.45, -24 + WALL_OFFSET, "+z", 1.6, "gold"),
  // South wall, flanking the entrance from the lobby.
  wall("g08", -7.5, 2.3, -WALL_OFFSET, "-z", 1.3, "white"),
  wall("g09", 7.5, 2.3, -WALL_OFFSET, "-z", 1.3, "white"),
  // Partitions (both faces).
  wall("g10", -6 - PARTITION_OFFSET, 1.75, -10.5, "-x", 1.0, "oak"),
  wall("g11", -6 - PARTITION_OFFSET, 1.75, -15.5, "-x", 1.0, "oak"),
  wall("g12", -6 + PARTITION_OFFSET, 1.75, -10.5, "+x", 1.0, "black"),
  wall("g14", -6 + PARTITION_OFFSET, 1.75, -15.5, "+x", 1.15, "black"),
  wall("g15", 6 - PARTITION_OFFSET, 1.75, -10.5, "-x", 1.0, "black"),
  wall("g16", 6 - PARTITION_OFFSET, 1.75, -15.5, "-x", 1.0, "black"),
  wall("g18", 6 + PARTITION_OFFSET, 1.75, -10.5, "+x", 1.15, "oak"),
  wall("g19", 6 + PARTITION_OFFSET, 1.75, -15.5, "+x", 1.0, "oak"),
];

// Timeline: slots sorted west→east are filled chronologically.
const timelineSlots: { x: number; side: "north" | "south" }[] = [
  { x: 11.6, side: "south" },
  { x: 12.5, side: "north" },
  { x: 16.5, side: "north" },
  { x: 19.5, side: "south" },
  { x: 20.5, side: "north" },
  { x: 24.5, side: "north" },
  { x: 27.5, side: "south" },
  { x: 28.5, side: "north" },
  { x: 32.5, side: "north" },
  { x: 36.5, side: "north" },
  { x: 36.6, side: "south" },
];

const timelineMemories = MEMORIES.filter((mem) => mem.id.startsWith("t")).sort((a, b) => a.year - b.year);

const timelinePlacements: PhotoPlacement[] = timelineSlots.map((slot, i) => {
  const mem = timelineMemories[i];
  if (!mem) throw new Error(`Timeline slot ${i} has no memory`);
  return slot.side === "north"
    ? wall(mem.id, slot.x, 2.05, 3 + WALL_OFFSET, "+z", 1.0, "oak")
    : wall(mem.id, slot.x, 2.05, 11 - WALL_OFFSET, "-z", 1.0, "oak");
});

const gardenPlacements: PhotoPlacement[] = [
  { memoryId: "m01", x: -15.5, y: 1.45, z: 9.7, facing: "-z", height: 0.8, frame: "oak", mount: "easel" },
  { memoryId: "m02", x: -17.6, y: 1.45, z: 4.3, facing: "+z", height: 0.8, frame: "oak", mount: "easel" },
  { memoryId: "m03", x: -29.4, y: 1.45, z: -11.8, facing: "+z", height: 0.8, frame: "oak", mount: "easel" },
  { memoryId: "m04", x: -26, y: 1.45, z: 3.5, facing: "-z", height: 0.8, frame: "oak", mount: "easel" },
];

export const PHOTO_PLACEMENTS: PhotoPlacement[] = [...galleryPlacements, ...timelinePlacements, ...gardenPlacements];
