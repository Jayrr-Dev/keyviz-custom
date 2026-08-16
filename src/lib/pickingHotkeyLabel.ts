import { applyingHotkeyVariables } from "@/lib/applyingHotkeyVariables";
import {
  ForegroundApp,
  matchingForegroundProgram,
} from "@/lib/matchingForegroundProgram";
import {
  resolvingHotkeyComboMatch,
  scoringHotkeyCombo,
} from "@/lib/matchingHotkeyCombo";
import { DEFAULT_HOTKEY_SET, resolvingHotkeySet } from "@/lib/parsingHotkeyCsv";
import { HotkeyLabel, HotkeySet } from "@/types/hotkey";

/**
 * Set names that should match right now: program hits first, else Default.
 */
export const listingLiveHotkeySets = (
  sets: HotkeySet[],
  app: ForegroundApp | null,
  defaultEnabled = true,
) => {
  const programSets = sets
    .filter((set) => {
      if (!set.enabled) return false;
      if (set.programs.length === 0) return true;
      return set.programs.some((program) =>
        matchingForegroundProgram(program, app),
      );
    })
    .map((set) => set.name);

  if (programSets.length > 0) {
    return defaultEnabled ? [...programSets, DEFAULT_HOTKEY_SET] : programSets;
  }
  return defaultEnabled ? [DEFAULT_HOTKEY_SET] : [];
};

/**
 * Finds the labeled shortcut for the current keys in live sets.
 * Program-specific rows win over Default when both match.
 */
export const pickingHotkeyLabel = (
  rawKeyNames: string[],
  labels: HotkeyLabel[],
  sets: HotkeySet[],
  app: ForegroundApp | null,
  defaultEnabled = true,
): HotkeyLabel | null => {
  if (rawKeyNames.length === 0) return null;

  const liveSets = listingLiveHotkeySets(sets, app, defaultEnabled);
  const matches = labels.flatMap((label) => {
    const setName = resolvingHotkeySet(label.set);
    if (!liveSets.includes(setName)) return [];
    const match = resolvingHotkeyComboMatch(rawKeyNames, label.combo);
    if (!match.matched) return [];
    return [{ label, variables: match.variables }];
  });
  if (matches.length === 0) return null;

  const picked = [...matches].sort((left, right) => {
    const leftSpecific =
      resolvingHotkeySet(left.label.set) !== DEFAULT_HOTKEY_SET ? 1 : 0;
    const rightSpecific =
      resolvingHotkeySet(right.label.set) !== DEFAULT_HOTKEY_SET ? 1 : 0;
    if (rightSpecific !== leftSpecific) return rightSpecific - leftSpecific;
    return (
      scoringHotkeyCombo(right.label.combo) -
      scoringHotkeyCombo(left.label.combo)
    );
  })[0];

  return {
    ...picked.label,
    name: applyingHotkeyVariables(picked.label.name, picked.variables),
    description: applyingHotkeyVariables(
      picked.label.description,
      picked.variables,
    ),
  };
};
