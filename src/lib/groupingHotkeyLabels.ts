import { HotkeyLabel } from "@/types/hotkey";

export const UNGROUPED_HOTKEY_GROUP = "Ungrouped";

/**
 * Trims a function group. Empty means ungrouped.
 */
export const resolvingHotkeyGroup = (group?: string | null) =>
  group?.trim() ?? "";

/**
 * Unique function groups in the given labels, sorted.
 */
export const listingHotkeyGroups = (labels: HotkeyLabel[]) => {
  const groups: string[] = [];
  for (const label of labels) {
    const group = resolvingHotkeyGroup(label.group);
    if (group && !groups.includes(group)) groups.push(group);
  }
  return groups.sort((left, right) => left.localeCompare(right));
};

export interface HotkeyGroupSection {
  group: string;
  labels: HotkeyLabel[];
}

/**
 * Buckets labels by function group. Named groups stay alphabetical. Ungrouped is last.
 */
export const groupingHotkeyLabels = (
  labels: HotkeyLabel[],
): HotkeyGroupSection[] => {
  const buckets = new Map<string, HotkeyLabel[]>();
  for (const label of labels) {
    const group = resolvingHotkeyGroup(label.group) || UNGROUPED_HOTKEY_GROUP;
    const bucket = buckets.get(group);
    if (bucket) {
      bucket.push(label);
    } else {
      buckets.set(group, [label]);
    }
  }

  const named = [...buckets.keys()]
    .filter((group) => group !== UNGROUPED_HOTKEY_GROUP)
    .sort((left, right) => left.localeCompare(right));
  const order = buckets.has(UNGROUPED_HOTKEY_GROUP)
    ? [...named, UNGROUPED_HOTKEY_GROUP]
    : named;

  return order.map((group) => ({
    group,
    labels: buckets.get(group) ?? [],
  }));
};
