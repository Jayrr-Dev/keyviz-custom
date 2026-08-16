export interface HotkeyLabel {
  id: string;
  set: string;
  name: string;
  combo: string;
  description: string;
  /** Function group, e.g. AI or Editing. Empty is ungrouped. */
  group: string;
}

export interface HotkeySet {
  name: string;
  enabled: boolean;
  /** Process names or app titles, e.g. POWERPNT.EXE */
  programs: string[];
}

export interface HotkeyLabelSettings {
  enabled: boolean;
  /** When false, classic Default shortcuts are not shown. */
  defaultEnabled: boolean;
  /** When true, the shortcut description is shown under the keys. */
  showDescription: boolean;
  /** Which set the settings editor is adding to. `null` is Default. */
  activeSet: string | null;
  sets: HotkeySet[];
  labels: HotkeyLabel[];
}
