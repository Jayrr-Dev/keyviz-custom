import { HotkeyLabel } from "@/stores/key_style";
import { CSSProperties, ReactNode } from "react";

interface RenderingHotkeyCardProps {
  label: HotkeyLabel | null;
  nameStyle: CSSProperties;
  descriptionStyle: CSSProperties;
  groupStyle: CSSProperties;
  showDescription: boolean;
  children: ReactNode;
}

/**
 * Key group with the shortcut name on top and an optional description under the keys.
 */
export const RenderingHotkeyCard = ({
  label,
  nameStyle,
  descriptionStyle,
  groupStyle,
  showDescription,
  children,
}: RenderingHotkeyCardProps) => {
  if (!label) {
    return (
      <div style={groupStyle} className="overflow-hidden">
        {children}
      </div>
    );
  }

  const description =
    showDescription && label.description.trim() ? label.description : null;

  return (
    <div
      style={groupStyle}
      className="overflow-hidden flex flex-col items-start"
    >
      <div style={nameStyle}>{label.name}</div>
      <div className="flex items-center">{children}</div>
      {description ? <div style={descriptionStyle}>{description}</div> : null}
    </div>
  );
};
