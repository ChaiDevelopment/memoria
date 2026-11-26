import { describe, expect, it } from "vitest";
import { buildGrandLayout, LECTERNS_PER_FLOOR, planLecterns } from "@/config/grandMuseum";
import { parseAlbumRows } from "@/server/album";
import { grandSigns, yearSpan } from "./wayfinding";

const files = new Map([
  ["id-a", { id: "id-a", name: "IMG_20250922_160107.jpg" }],
  ["id-b", { id: "id-b", name: "IMG-20261031-WA0035.jpg" }],
]);

describe("Album Kata rows", () => {
  it("parses chapters and resolves photos by file name or id", () => {
    const chapters = parseAlbumRows(
      [
        ["22 September 2025", "Awal Kita", "Sore itu…", "img_20250922_160107.jpg, id-b, missing.jpg"],
        ["", "", "", ""],
        ["2026", "Tanpa foto", "Kata-kata saja"],
      ],
      files,
    );
    expect(chapters).toHaveLength(2);
    expect(chapters[0]).toEqual({ period: "22 September 2025", title: "Awal Kita", words: "Sore itu…", photoIds: ["id-a", "id-b"] });
    expect(chapters[1]!.photoIds).toEqual([]);
  });

  it("never returns photos outside the museum folder", () => {
    const [c] = parseAlbumRows([["x", "t", "w", "some-other-drive-file"]], files);
    expect(c!.photoIds).toEqual([]);
  });
});

describe("lecterns", () => {
  it("puts ten chapters per balcony, from Floor 1 up", () => {
    const l = planLecterns(LECTERNS_PER_FLOOR + 2);
    expect(l[0]!.floor).toBe(1);
    expect(l[LECTERNS_PER_FLOOR]!.floor).toBe(2);
    expect(l[LECTERNS_PER_FLOOR]!.y).toBe(12);
  });

  it("opens the balcony floors the album needs", () => {
    expect(buildGrandLayout(0, LECTERNS_PER_FLOOR + 1).topFloor).toBe(2);
  });
});

describe("wayfinding signs", () => {
  it("labels the atrium doors of Memory Halls with their years, and each balcony with its era", () => {
    const grand = buildGrandLayout(60, 9);
    const signs = grandSigns(grand, { "h0-1-1": { year: 2025 }, "h0-1-2": { year: 2026 }, "h0-2-1": { year: 2026 }, g01: { year: 2020 } }, 9);
    const door = signs.find((s) => s.id === "door-0-0");
    expect(door).toMatchObject({ title: "Memory Hall GA", subtitle: "2025 – 2026  →", z: 21 });
    expect(signs.find((s) => s.id === "door-0-1")?.subtitle).toBe("2026  →");
    expect(signs.find((s) => s.id === "era-1")?.subtitle).toBe("Album Kata");
  });

  it("formats year spans", () => {
    expect(yearSpan([])).toBeNull();
    expect(yearSpan([2021])).toBe("2021");
    expect(yearSpan([2023, 2021])).toBe("2021 – 2023");
  });
});
