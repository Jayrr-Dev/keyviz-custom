import { ForegroundApp } from "@/lib/matchingForegroundProgram";
import { normalizingHotkeySets } from "@/lib/parsingHotkeyCsv";
import { pickingHotkeyLabel } from "@/lib/pickingHotkeyLabel";
import { easeInQuint, easeOutQuint } from "@/lib/utils";
import { useKeyEvent } from "@/stores/key_event";
import { pickingKeysFollowCursor, useKeyStyle } from "@/stores/key_style";
import { alignmentForColumn, alignmentForRow } from "@/types/style";
import { platform } from "@tauri-apps/plugin-os";
import { AnimatePresence, motion, Variants } from "motion/react";
import { CSSProperties, useEffect, useMemo, useRef } from "react";
import { Keycap } from "./keycaps";
import { RenderingHotkeyCard } from "./renderingHotkeyCard";

const fadeVariants: Variants = {
  visible: { opacity: 1 },
  hidden: { opacity: 0 },
};

const isMacos = platform() === "macos";
/** Title size relative to the keycap text size. */
const HOTKEY_NAME_SIZE_RATIO = 0.72;
/** Description size relative to the keycap text size. */
const HOTKEY_DESCRIPTION_SIZE_RATIO = 0.6;
const HOTKEY_DESCRIPTION_WEIGHT = 400;
const HOTKEY_DESCRIPTION_OPACITY = 0.62;

interface KeyOverlayProps {
  /** Monitor box used when Placement is On screen. */
  screenStyle: CSSProperties;
  /** Focused app, used to pick a program-bound hotkey set. */
  foregroundApp: ForegroundApp | null;
}

/**
 * Keycap bar. Pins to the selected display, or sits next to the cursor.
 */
export const KeyOverlay = ({ screenStyle, foregroundApp }: KeyOverlayProps) => {
  const pressedKeys = useKeyEvent((state) => state.pressedKeys);
  const groups = useKeyEvent((state) => state.groups);
  const showHistory = useKeyEvent((state) => state.showEventHistory);

  const appearance = useKeyStyle((state) => state.appearance);
  const text = useKeyStyle((state) => state.text);
  const border = useKeyStyle((state) => state.border);
  const background = useKeyStyle((state) => state.background);
  const indicatorOffsetX = useKeyStyle((state) => state.mouse.indicatorOffsetX);
  const indicatorOffsetY = useKeyStyle((state) => state.mouse.indicatorOffsetY);
  const storedLabels = useKeyStyle((state) => state.hotkeyLabels);
  const hotkeyLabels = {
    enabled: storedLabels?.enabled ?? false,
    defaultEnabled: storedLabels?.defaultEnabled ?? true,
    showDescription: storedLabels?.showDescription ?? false,
    activeSet: storedLabels?.activeSet ?? null,
    sets: normalizingHotkeySets(storedLabels?.sets),
    labels: storedLabels?.labels ?? [],
  };
  const followCursor = pickingKeysFollowCursor(appearance);

  const positionRef = useRef<HTMLDivElement>(null);

  const alignment =
    appearance.flexDirection === "row"
      ? alignmentForRow[appearance.alignment]
      : alignmentForColumn[appearance.alignment];

  const containerStyle = followCursor
    ? {
        flexDirection: "row" as const,
        alignItems: "center",
        justifyContent: "flex-start",
        gap: text.size * 0.5,
        marginLeft: indicatorOffsetX,
        marginTop: indicatorOffsetY,
      }
    : {
        flexDirection: appearance.flexDirection,
        paddingBlock: appearance.marginY,
        paddingInline: appearance.marginX,
        alignItems: alignment.alignItems,
        justifyContent: alignment.justifyContent,
        gap: text.size * 0.5,
      };

  const keyRowGap =
    appearance.style === "minimal" ? text.size * 0.15 : text.size * 0.3;
  const cardPadX = text.size * 0.4;
  const cardPadY =
    appearance.style === "minimal" ? text.size * 0.25 : text.size * 0.4;

  const buildingGroupStyle = (labeled: boolean) => ({
    display: "flex",
    flexDirection: labeled ? ("column" as const) : ("row" as const),
    alignItems: labeled ? "flex-start" : undefined,
    columnGap: labeled ? undefined : keyRowGap,
    rowGap: labeled ? text.size * 0.12 : undefined,
    ...((background.enabled || labeled) && {
      paddingInline: cardPadX,
      paddingBlock: cardPadY,
      background: background.enabled ? background.color : "#f4f4f5",
      borderRadius: border.radius * (text.size * 1.75),
    }),
  });

  const nameStyle = {
    fontSize: text.size * HOTKEY_NAME_SIZE_RATIO,
    fontWeight: 600,
    lineHeight: 1.2,
    color: text.color,
  };

  const descriptionStyle = {
    fontSize: text.size * HOTKEY_DESCRIPTION_SIZE_RATIO,
    fontWeight: HOTKEY_DESCRIPTION_WEIGHT,
    lineHeight: 1.25,
    color: text.color,
    opacity: HOTKEY_DESCRIPTION_OPACITY,
  };

  const keyRowStyle = {
    display: "flex",
    columnGap: keyRowGap,
  };

  const variants = useMemo<Variants>(() => {
    switch (appearance.animation) {
      case "none":
        return {
          visible: {},
          hidden: {},
        };
      case "fade":
        return fadeVariants;
      case "zoom":
        return {
          visible: { scale: 1, opacity: 1 },
          hidden: { scale: 0, opacity: 0 },
        };
      case "float":
        return {
          visible: { opacity: 1, y: 0 },
          hidden: { opacity: 0, y: text.size },
        };
      case "slide":
        return {
          visible: { opacity: 1, x: 0 },
          hidden: { opacity: 0, x: text.size },
        };
    }
  }, [appearance.animation, text.size]);

  useEffect(() => {
    if (!followCursor) return;

    const applyingMousePosition = (x: number, y: number) => {
      const el = positionRef.current;
      if (!el) return;
      const dpr = isMacos ? 1 : window.devicePixelRatio || 1;
      el.style.transform = `translate3d(${x / dpr}px, ${y / dpr}px, 0)`;
    };

    const mouse = useKeyEvent.getState().mouse;
    applyingMousePosition(mouse.x, mouse.y);

    return useKeyEvent.subscribe((state) => {
      applyingMousePosition(state.mouse.x, state.mouse.y);
    });
  }, [followCursor]);

  const resolvingGroupLabel = (rawKeyNames: string[]) =>
    hotkeyLabels.enabled
      ? pickingHotkeyLabel(
          rawKeyNames,
          hotkeyLabels.labels,
          hotkeyLabels.sets,
          foregroundApp,
          hotkeyLabels.defaultEnabled,
        )
      : null;

  const bar =
    appearance.animation === "none" ? (
      <div
        className={followCursor ? "flex w-max" : "w-full h-full flex"}
        style={containerStyle}
      >
        {groups.map((group, groupIndex) => {
          const label = resolvingGroupLabel(group.keys.map((key) => key.name));
          return (
            <RenderingHotkeyCard
              key={group.createdAt}
              label={label}
              nameStyle={nameStyle}
              descriptionStyle={descriptionStyle}
              groupStyle={buildingGroupStyle(Boolean(label))}
              showDescription={hotkeyLabels.showDescription}
            >
              <div style={keyRowStyle}>
                {group.keys.map((event, keyIndex) => (
                  <Keycap
                    key={event.name}
                    event={event}
                    lastest={group.keys.length - 1 === keyIndex}
                    isPressed={
                      groups.length - 1 === groupIndex && event.in(pressedKeys)
                    }
                  />
                ))}
              </div>
            </RenderingHotkeyCard>
          );
        })}
      </div>
    ) : (
      <div
        className={followCursor ? "flex w-max" : "w-full h-full flex"}
        style={containerStyle}
      >
        <AnimatePresence>
          {groups.map((group, groupIndex) => {
            const label = resolvingGroupLabel(
              group.keys.map((key) => key.name),
            );
            return (
              <motion.div
                key={group.createdAt}
                layout={showHistory ? "position" : false}
                variants={fadeVariants}
                initial="hidden"
                animate="visible"
                exit="hidden"
                transition={{
                  ease: [easeOutQuint, easeInQuint],
                  duration: showHistory ? appearance.animationDuration : 0,
                }}
              >
                <RenderingHotkeyCard
                  label={label}
                  nameStyle={nameStyle}
                  descriptionStyle={descriptionStyle}
                  groupStyle={buildingGroupStyle(Boolean(label))}
                  showDescription={hotkeyLabels.showDescription}
                >
                  <div style={keyRowStyle}>
                    <AnimatePresence>
                      {group.keys.map((event, keyIndex) => (
                        <motion.div
                          key={event.name}
                          layout="position"
                          variants={variants}
                          initial="hidden"
                          animate="visible"
                          exit="hidden"
                          transition={{
                            ease: [easeOutQuint, easeInQuint],
                            duration: appearance.animationDuration,
                            layout: {
                              duration: appearance.animationDuration / 3,
                              ease: easeOutQuint,
                            },
                          }}
                        >
                          <Keycap
                            event={event}
                            lastest={group.keys.length - 1 === keyIndex}
                            isPressed={
                              groups.length - 1 === groupIndex &&
                              event.in(pressedKeys)
                            }
                          />
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                </RenderingHotkeyCard>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    );

  if (followCursor) {
    return (
      <div
        ref={positionRef}
        className="absolute top-0 left-0 will-change-transform pointer-events-none"
      >
        {bar}
      </div>
    );
  }

  return (
    <div className="absolute pointer-events-none" style={screenStyle}>
      {bar}
    </div>
  );
};
