import { HotkeyLabel, HotkeySet } from "@/types/hotkey";

export const DEFAULT_HOTKEY_SET = "default";

/**
 * Empty / None / default all map to the Default set.
 */
export const resolvingHotkeySet = (set: string | null | undefined) => {
  const trimmed = set?.trim() ?? "";
  if (
    !trimmed ||
    trimmed.toLowerCase() === DEFAULT_HOTKEY_SET ||
    trimmed.toLowerCase() === "none"
  ) {
    return DEFAULT_HOTKEY_SET;
  }
  return trimmed;
};

const HEADER_ALIASES: Record<
  string,
  "set" | "name" | "combo" | "description" | "group"
> = {
  hotkey_set: "set",
  hotkeyset: "set",
  set: "set",
  hotkey_name: "name",
  hotkeyname: "name",
  name: "name",
  hotkey_combo: "combo",
  hotkeycombo: "combo",
  combo: "combo",
  shortcut: "combo",
  description: "description",
  desc: "description",
  hotkey_group: "group",
  hotkeygroup: "group",
  group: "group",
  function: "group",
  function_group: "group",
};

/**
 * Normalizes a CSV header to a known column.
 */
const normalizingCsvHeader = (header: string) =>
  HEADER_ALIASES[
    header
      .trim()
      .toLowerCase()
      .replace(/[\s-]+/g, "_")
  ] ?? null;

/**
 * Splits one CSV line, honoring quoted commas.
 */
const splittingCsvLine = (line: string) => {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === "," && !inQuotes) {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  cells.push(current.trim());
  return cells;
};

/**
 * Builds labeled hotkeys from a CSV with hotkey_set, hotkey_name, Hotkey combo, description.
 */
export const parsingHotkeyCsv = (csvText: string): HotkeyLabel[] => {
  const lines = csvText
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];

  const headers = splittingCsvLine(lines[0]).map(normalizingCsvHeader);
  const setIndex = headers.indexOf("set");
  const nameIndex = headers.indexOf("name");
  const comboIndex = headers.indexOf("combo");
  const descriptionIndex = headers.indexOf("description");
  const groupIndex = headers.indexOf("group");

  if (nameIndex < 0 || comboIndex < 0) return [];

  return lines.slice(1).flatMap((line, rowIndex) => {
    const cells = splittingCsvLine(line);
    const set = resolvingHotkeySet(setIndex >= 0 ? cells[setIndex] : "");
    const name = cells[nameIndex] ?? "";
    const combo = cells[comboIndex] ?? "";
    if (!name || !combo) return [];
    return [
      {
        id: `${set}-${combo}-${rowIndex}`,
        set,
        name,
        combo,
        description:
          descriptionIndex >= 0 ? (cells[descriptionIndex] ?? "") : "",
        group: groupIndex >= 0 ? (cells[groupIndex] ?? "").trim() : "",
      },
    ];
  });
};

/**
 * Fills missing group/description on older saved labels.
 */
export const normalizingHotkeyLabel = (label: HotkeyLabel): HotkeyLabel => ({
  ...label,
  set: resolvingHotkeySet(label.set),
  description: label.description ?? "",
  group: label.group?.trim() ?? "",
});

/**
 * Turns old string[] sets and new objects into HotkeySet rows.
 */
export const normalizingHotkeySets = (sets: unknown): HotkeySet[] => {
  if (!Array.isArray(sets)) return [];
  const next: HotkeySet[] = [];
  for (const item of sets) {
    if (typeof item === "string") {
      const name = resolvingHotkeySet(item);
      if (name === DEFAULT_HOTKEY_SET) continue;
      if (!next.some((row) => row.name === name)) {
        next.push({ name, enabled: true, programs: [] });
      }
      continue;
    }
    if (!item || typeof item !== "object" || !("name" in item)) continue;
    const row = item as Partial<HotkeySet>;
    const name = resolvingHotkeySet(row.name);
    if (
      name === DEFAULT_HOTKEY_SET ||
      next.some((existing) => existing.name === name)
    ) {
      continue;
    }
    next.push({
      name,
      enabled: row.enabled ?? true,
      programs: Array.isArray(row.programs) ? row.programs : [],
    });
  }
  return next;
};

/**
 * Named sets only. Default is not in this list.
 */
export const listingNamedHotkeySets = (
  labels: HotkeyLabel[],
  savedSets: Array<string | HotkeySet> = [],
) => {
  const names = savedSets.map((item) =>
    typeof item === "string" ? item : item.name,
  );
  const sets: string[] = [];
  for (const name of [...names, ...labels.map((label) => label.set)]) {
    const resolved = resolvingHotkeySet(name);
    if (resolved === DEFAULT_HOTKEY_SET) continue;
    if (!sets.includes(resolved)) sets.push(resolved);
  }
  return sets;
};

/**
 * Unique set names in the order they first appear.
 */
export const listingHotkeySets = (labels: HotkeyLabel[]) =>
  listingNamedHotkeySets(labels);
