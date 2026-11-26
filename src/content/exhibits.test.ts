import { describe, expect, it } from "vitest";
import { assignExhibits, type ExhibitPhoto, type FrameSlot } from "./exhibits";

const photo = (id: string, w = 4000, h = 3000): ExhibitPhoto => ({
  id,
  title: id,
  year: 2026,
  story: "",
  width: w,
  height: h,
  thumbUrl: `/t/${id}`,
  url: `/u/${id}`,
});

const slots: FrameSlot[] = [
  { slotId: "g1", aspect: 1.5, section: "gallery" },
  { slotId: "g2", aspect: 2 / 3, section: "gallery" },
  { slotId: "t1", aspect: 1.5, section: "timeline" },
  { slotId: "t2", aspect: 1.5, section: "timeline" },
  { slotId: "t3", aspect: 1.5, section: "timeline" },
  { slotId: "m1", aspect: 1, section: "garden" },
];

describe("assignExhibits", () => {
  it("fills every frame without repeating a photo when there are enough photos", () => {
    const photos = Array.from({ length: 10 }, (_, i) => photo(`p${i}`, i === 7 ? 3000 : 4000, i === 7 ? 4000 : 3000));
    const result = assignExhibits(slots, photos);
    expect(Object.keys(result).sort()).toEqual(["g1", "g2", "m1", "t1", "t2", "t3"]);
    const ids = Object.values(result).map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("spreads the timeline from the oldest to the newest photo", () => {
    const photos = Array.from({ length: 10 }, (_, i) => photo(`p${i}`));
    const result = assignExhibits(slots, photos);
    expect([result.t1!.id, result.t2!.id, result.t3!.id]).toEqual(["p0", "p5", "p9"]);
  });

  it("puts portrait photos in portrait frames when possible", () => {
    const photos = [...Array.from({ length: 8 }, (_, i) => photo(`l${i}`)), photo("portrait", 3000, 4000)];
    const result = assignExhibits(slots, photos);
    expect(result.g2!.id).toBe("portrait");
  });

  it("fills the main gallery first when photos are scarce, leaving other frames as placeholders", () => {
    const result = assignExhibits(slots, [photo("a"), photo("b"), photo("c")]);
    expect(Object.keys(result)).toEqual(["g1", "g2", "t1"]);
  });

  it("returns nothing without photos", () => {
    expect(assignExhibits(slots, [])).toEqual({});
  });
});
