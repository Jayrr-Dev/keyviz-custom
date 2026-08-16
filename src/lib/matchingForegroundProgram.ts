export interface ForegroundApp {
  processName: string;
  windowTitle: string;
}

const KEYVIZ_PROCESS = "keyviz";

const PROGRAM_ALIASES: Record<string, string[]> = {
  powerpoint: ["powerpnt", "powerpoint"],
  powerpnt: ["powerpnt", "powerpoint"],
  word: ["winword", "word"],
  winword: ["winword", "word"],
  excel: ["excel"],
  outlook: ["outlook"],
  onenote: ["onenote", "onenotem"],
  cursor: ["cursor"],
  chrome: ["chrome"],
  iexplore: ["iexplore", "internet explorer"],
  explorer: ["explorer"],
  keyviz: ["keyviz"],
};

/**
 * Strips path and .exe for loose matching.
 */
export const normalizingProgramName = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/\\/g, "/")
    .split("/")
    .pop()
    ?.replace(/\.exe$/i, "") ?? "";

/**
 * True when this process is the Keyviz overlay or settings window.
 */
export const checkingKeyvizProcess = (processName: string) =>
  normalizingProgramName(processName).includes(KEYVIZ_PROCESS);

/**
 * True when a set's program binding matches the focused app.
 */
export const matchingForegroundProgram = (
  program: string,
  app: ForegroundApp | null,
) => {
  if (!app) return false;
  const query = normalizingProgramName(program);
  if (!query) return false;

  const processName = normalizingProgramName(app.processName);
  const windowTitle = app.windowTitle.toLowerCase();
  const aliases = PROGRAM_ALIASES[query] ?? [query];

  return aliases.some(
    (alias) =>
      processName.includes(alias) ||
      alias.includes(processName) ||
      windowTitle.includes(alias),
  );
};
