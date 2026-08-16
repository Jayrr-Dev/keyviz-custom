import { RawKey } from "@/types/event";

const COMBO_SPLIT = /[\s]*[+\-][\s]*|[\s]+/;

/** Maps typed / CSV tokens to one canonical name. */
const TOKEN_ALIASES: Record<string, string> = {
  ctrl: "ctrl",
  control: "ctrl",
  ctl: "ctrl",
  controlleft: "ctrl",
  controlright: "ctrl",
  shift: "shift",
  shiftleft: "shift",
  shiftright: "shift",
  alt: "alt",
  option: "alt",
  opt: "alt",
  win: "meta",
  windows: "meta",
  meta: "meta",
  cmd: "meta",
  command: "meta",
  super: "meta",
  metaleft: "meta",
  metaright: "meta",
  enter: "enter",
  return: "enter",
  kpreturn: "enter",
  space: "space",
  spacebar: "space",
  tab: "tab",
  esc: "esc",
  escape: "esc",
  backspace: "backspace",
  delete: "delete",
  del: "delete",
  insert: "insert",
  ins: "insert",
  home: "home",
  end: "end",
  pageup: "pageup",
  pgup: "pageup",
  pagedown: "pagedown",
  pgdn: "pagedown",
  up: "up",
  uparrow: "up",
  down: "down",
  downarrow: "down",
  left: "left",
  leftarrow: "left",
  right: "right",
  rightarrow: "right",
  backquote: "backquote",
  backtick: "backquote",
  grave: "backquote",
  comma: "comma",
  slash: "slash",
  equal: "equal",
  period: "period",
  dot: "period",
  backslash: "backslash",
  minus: "minus",
};

const SYMBOL_ALIASES: Record<string, string> = {
  "`": "backquote",
  ",": "comma",
  "/": "slash",
  "=": "equal",
  ".": "period",
  "\\": "backslash",
};

/** Canonical token to a RawKey used for settings previews. */
const CANONICAL_TO_RAW: Record<string, string> = {
  ctrl: RawKey.ControlLeft,
  shift: RawKey.ShiftLeft,
  alt: RawKey.Alt,
  meta: RawKey.MetaLeft,
  enter: RawKey.Return,
  space: RawKey.Space,
  tab: RawKey.Tab,
  esc: RawKey.Escape,
  backspace: RawKey.Backspace,
  delete: RawKey.Delete,
  insert: RawKey.Insert,
  home: RawKey.Home,
  end: RawKey.End,
  pageup: RawKey.PageUp,
  pagedown: RawKey.PageDown,
  up: RawKey.UpArrow,
  down: RawKey.DownArrow,
  left: RawKey.LeftArrow,
  right: RawKey.RightArrow,
  backquote: RawKey.BackQuote,
  comma: RawKey.Comma,
  slash: RawKey.Slash,
  equal: RawKey.Equal,
  period: RawKey.Dot,
  backslash: RawKey.BackSlash,
  minus: RawKey.Minus,
};

const MODIFIER_TOKENS = new Set(["ctrl", "shift", "alt", "meta"]);

const PATTERN_TOKENS = new Set(["char", "digit", "key"]);

const PATTERN_ALIASES: Record<string, string> = {
  char: "char",
  letter: "char",
  digit: "digit",
  number: "digit",
  key: "key",
};

/** Preview text for variable tokens in settings cards. */
export const PATTERN_TOKEN_LABELS: Record<string, string> = {
  char: "A-Z",
  digit: "0-9",
  key: "Key",
};

/**
 * Rewrites Shift + X (char) into Shift+(char).
 */
export const rewritingComboVariables = (combo: string) =>
  combo.replace(
    /\b[a-zA-Z]\s*\(\s*(char|letter|digit|number|key)\s*\)/gi,
    "($1)",
  );

/**
 * Strips punctuation and case from a combo token.
 */
export const normalizingComboToken = (token: string) => {
  const trimmed = token.trim().toLowerCase();
  if (SYMBOL_ALIASES[trimmed]) return SYMBOL_ALIASES[trimmed];
  return trimmed.replace(/[^a-z0-9]/g, "");
};

/**
 * Turns a CSV combo string into canonical tokens.
 */
export const parsingComboTokens = (combo: string) =>
  rewritingComboVariables(combo)
    .split(COMBO_SPLIT)
    .map(normalizingComboToken)
    .filter(Boolean)
    .map((token) => {
      if (PATTERN_ALIASES[token]) return PATTERN_ALIASES[token];
      if (TOKEN_ALIASES[token]) return TOKEN_ALIASES[token];
      if (/^f([1-9]|1[0-2])$/.test(token)) return token;
      if (/^[a-z]$/.test(token)) return token;
      if (/^[0-9]$/.test(token)) return token;
      if (token.startsWith("key") && token.length === 4) return token.slice(3);
      if (token.startsWith("num") && token.length === 4) return token.slice(3);
      return token;
    });

/**
 * True when the token is a modifier.
 */
export const checkingModifierToken = (token: string) =>
  MODIFIER_TOKENS.has(token);

/**
 * True when the token is (char), (digit), or (key).
 */
export const checkingPatternToken = (token: string) =>
  PATTERN_TOKENS.has(token);

/**
 * Maps a live RawKey name to the same canonical token as CSV combos.
 */
export const canonicalizingRawKey = (rawKey: string) => {
  const normalized = normalizingComboToken(rawKey);
  if (TOKEN_ALIASES[normalized]) return TOKEN_ALIASES[normalized];
  if (normalized.startsWith("key") && normalized.length === 4) {
    return normalized.slice(3);
  }
  if (normalized.startsWith("num") && normalized.length === 4) {
    return normalized.slice(3);
  }
  if (/^f([1-9]|1[0-2])$/.test(normalized)) return normalized;
  return normalized;
};

export interface HotkeyComboMatch {
  matched: boolean;
  variables: Record<string, string>;
}

const EMPTY_COMBO_MATCH: HotkeyComboMatch = {
  matched: false,
  variables: {},
};

const matchingTokenCounts = (left: string[], right: string[]) => {
  if (left.length !== right.length) return false;
  const needed = new Map<string, number>();
  for (const token of right) {
    needed.set(token, (needed.get(token) ?? 0) + 1);
  }
  for (const token of left) {
    const count = needed.get(token);
    if (!count) return false;
    needed.set(token, count - 1);
  }
  return true;
};

const matchingPatternValue = (pattern: string, token: string) => {
  if (pattern === "char") return /^[a-z]$/.test(token);
  if (pattern === "digit") return /^[0-9]$/.test(token);
  if (pattern === "key") return !MODIFIER_TOKENS.has(token);
  return false;
};

const buildingComboVariables = (pattern: string, captured: string) => {
  if (pattern === "char") {
    const letter = captured.toUpperCase();
    return { char: letter, letter };
  }
  if (pattern === "digit") {
    return { digit: captured, number: captured };
  }
  return { key: captured.toUpperCase() };
};

/**
 * Matches pressed keys to a combo, including (char), (digit), and (key).
 */
export const resolvingHotkeyComboMatch = (
  pressedRawKeys: string[],
  combo: string,
): HotkeyComboMatch => {
  const pressed = [...new Set(pressedRawKeys.map(canonicalizingRawKey))];
  const expected = parsingComboTokens(combo);
  if (expected.length === 0) return EMPTY_COMBO_MATCH;

  const patterns = expected.filter(checkingPatternToken);
  if (patterns.length > 1) return EMPTY_COMBO_MATCH;

  const expectedMods = expected.filter(checkingModifierToken);
  const expectedExact = expected.filter(
    (token) => !checkingModifierToken(token) && !checkingPatternToken(token),
  );
  const pressedMods = pressed.filter(checkingModifierToken);
  const pressedRest = pressed.filter((token) => !checkingModifierToken(token));

  if (!matchingTokenCounts(pressedMods, expectedMods)) {
    return EMPTY_COMBO_MATCH;
  }

  if (patterns.length === 0) {
    return matchingTokenCounts(pressedRest, expectedExact)
      ? { matched: true, variables: {} }
      : EMPTY_COMBO_MATCH;
  }

  if (pressedRest.length !== expectedExact.length + 1) {
    return EMPTY_COMBO_MATCH;
  }

  const remaining = [...pressedRest];
  for (const exact of expectedExact) {
    const index = remaining.indexOf(exact);
    if (index < 0) return EMPTY_COMBO_MATCH;
    remaining.splice(index, 1);
  }
  if (remaining.length !== 1) return EMPTY_COMBO_MATCH;

  const captured = remaining[0];
  const pattern = patterns[0];
  if (!matchingPatternValue(pattern, captured)) return EMPTY_COMBO_MATCH;

  return {
    matched: true,
    variables: buildingComboVariables(pattern, captured),
  };
};

/**
 * True when the pressed keys match the combo (order does not matter).
 */
export const matchingHotkeyCombo = (pressedRawKeys: string[], combo: string) =>
  resolvingHotkeyComboMatch(pressedRawKeys, combo).matched;

/**
 * Higher is a better match. Exact combos beat (char), which beats (digit) and (key).
 */
export const scoringHotkeyCombo = (combo: string) => {
  const tokens = parsingComboTokens(combo);
  const patterns = tokens.filter(checkingPatternToken);
  const patternScore = patterns.includes("key")
    ? 1
    : patterns.includes("digit")
      ? 2
      : patterns.includes("char")
        ? 3
        : 10;
  return patternScore * 100 + tokens.length;
};

/**
 * Display label for a combo token on settings cards.
 */
export const formattingComboToken = (token: string) => {
  if (PATTERN_TOKEN_LABELS[token]) return PATTERN_TOKEN_LABELS[token];
  if (token === "ctrl") return "Ctrl";
  if (token === "meta") return "Win";
  if (token === "shift") return "Shift";
  if (token === "alt") return "Alt";
  return token.toUpperCase();
};

/**
 * RawKey names for a combo, used to preview keycaps in settings.
 */
export const resolvingComboToRawKeys = (combo: string) =>
  parsingComboTokens(combo).map((token) => {
    if (token === "char") return RawKey.KeyA;
    if (token === "digit") return RawKey.Num0;
    if (token === "key") return RawKey.KeyX;
    if (CANONICAL_TO_RAW[token]) return CANONICAL_TO_RAW[token];
    if (/^f([1-9]|1[0-2])$/.test(token)) return token.toUpperCase();
    if (/^[a-z]$/.test(token)) return `Key${token.toUpperCase()}`;
    if (/^[0-9]$/.test(token)) return `Num${token}`;
    return token;
  });
