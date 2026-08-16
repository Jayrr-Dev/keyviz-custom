/**
 * Fills {char}, {letter}, {digit}, {number}, and {key} from a combo match.
 */
export const applyingHotkeyVariables = (
  text: string,
  variables: Record<string, string>,
) =>
  text.replace(
    /\{(char|letter|digit|number|key)\}/gi,
    (_match, name: string) => {
      return variables[name.toLowerCase()] ?? "";
    },
  );
