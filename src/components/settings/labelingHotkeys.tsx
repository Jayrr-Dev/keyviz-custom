import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemTitle,
} from "@/components/ui/item";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  groupingHotkeyLabels,
  listingHotkeyGroups,
  resolvingHotkeyGroup,
} from "@/lib/groupingHotkeyLabels";
import {
  checkingKeyvizProcess,
  ForegroundApp,
} from "@/lib/matchingForegroundProgram";
import {
  formattingComboToken,
  parsingComboTokens,
} from "@/lib/matchingHotkeyCombo";
import {
  DEFAULT_HOTKEY_SET,
  listingNamedHotkeySets,
  normalizingHotkeySets,
  parsingHotkeyCsv,
  resolvingHotkeySet,
} from "@/lib/parsingHotkeyCsv";
import { listingLiveHotkeySets } from "@/lib/pickingHotkeyLabel";
import { HotkeySet, useKeyStyle } from "@/stores/key_style";
import { KeyboardIcon, Upload01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { readTextFile } from "@tauri-apps/plugin-fs";
import { XIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

const FOREGROUND_POLL_MS = 800;

const DEFAULT_SET_VALUE = "__default__";
const ALL_GROUPS_VALUE = "__all__";

/**
 * Settings for named shortcut sets shown above the key bar.
 */
export const LabelingHotkeys = () => {
  const stored = useKeyStyle((state) => state.hotkeyLabels);
  const hotkeyLabels = {
    enabled: stored?.enabled ?? true,
    defaultEnabled: stored?.defaultEnabled ?? true,
    showDescription: stored?.showDescription ?? false,
    activeSet: stored?.activeSet ?? null,
    sets: normalizingHotkeySets(stored?.sets),
    labels: stored?.labels ?? [],
  };
  const setHotkeyLabels = useKeyStyle((state) => state.setHotkeyLabels);

  const [draftSetName, setDraftSetName] = useState("");
  const [draftName, setDraftName] = useState("");
  const [draftCombo, setDraftCombo] = useState("");
  const [draftDescription, setDraftDescription] = useState("");
  const [draftGroup, setDraftGroup] = useState("");
  const [filterGroup, setFilterGroup] = useState(ALL_GROUPS_VALUE);
  const [foregroundApp, setForegroundApp] = useState<ForegroundApp | null>(
    null,
  );
  const [lastForeignApp, setLastForeignApp] = useState<ForegroundApp | null>(
    null,
  );
  const lastAppRef = useRef<ForegroundApp | null>(null);

  const namedSetNames = listingNamedHotkeySets(
    hotkeyLabels.labels,
    hotkeyLabels.sets,
  );
  const namedSets: HotkeySet[] = namedSetNames.map(
    (name) =>
      hotkeyLabels.sets.find((set) => set.name === name) ?? {
        name,
        enabled: true,
        programs: [],
      },
  );
  const activeSet = resolvingHotkeySet(hotkeyLabels.activeSet);
  const isDefaultSet = activeSet === DEFAULT_HOTKEY_SET;
  const setLabels = hotkeyLabels.labels.filter(
    (label) => resolvingHotkeySet(label.set) === activeSet,
  );
  const availableGroups = listingHotkeyGroups(setLabels);
  const visibleLabels =
    filterGroup === ALL_GROUPS_VALUE
      ? setLabels
      : setLabels.filter(
          (label) => resolvingHotkeyGroup(label.group) === filterGroup,
        );
  const groupedLabels = groupingHotkeyLabels(visibleLabels);
  const liveSets = listingLiveHotkeySets(
    namedSets,
    lastForeignApp,
    hotkeyLabels.defaultEnabled,
  );

  useEffect(() => {
    const pollingForeground = () => {
      invoke<ForegroundApp>("reading_foreground_app")
        .then((app) => {
          setForegroundApp(app);
          if (app.processName && !checkingKeyvizProcess(app.processName)) {
            lastAppRef.current = app;
            setLastForeignApp(app);
          }
        })
        .catch(() => undefined);
    };
    pollingForeground();
    const id = setInterval(pollingForeground, FOREGROUND_POLL_MS);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    setFilterGroup(ALL_GROUPS_VALUE);
  }, [activeSet]);

  const savingSets = (sets: HotkeySet[]) => {
    setHotkeyLabels({ sets: normalizingHotkeySets(sets) });
  };

  const creatingSet = () => {
    const setName = draftSetName.trim();
    if (!setName) {
      toast.warning("Enter a set name");
      return;
    }
    if (resolvingHotkeySet(setName) === DEFAULT_HOTKEY_SET) {
      setHotkeyLabels({ activeSet: null });
      setDraftSetName("");
      return;
    }
    const exists = namedSets.some((set) => set.name === setName);
    const sets = exists
      ? namedSets
      : [...namedSets, { name: setName, enabled: true, programs: [] }];
    setHotkeyLabels({ sets, activeSet: setName });
    setDraftSetName("");
  };

  const bindingProgram = (setName: string, program: string) => {
    savingSets(
      namedSets.map((set) =>
        set.name === setName
          ? { ...set, programs: program.trim() ? [program.trim()] : [] }
          : set,
      ),
    );
  };

  const togglingSet = (setName: string, enabled: boolean) => {
    savingSets(
      namedSets.map((set) =>
        set.name === setName ? { ...set, enabled } : set,
      ),
    );
  };

  const detectingProgram = (setName: string) => {
    const app = lastAppRef.current ?? foregroundApp;
    if (!app?.processName || checkingKeyvizProcess(app.processName)) {
      toast.warning("Focus PowerPoint or another app, then click Detect");
      return;
    }
    bindingProgram(setName, app.processName);
  };

  const importingCsv = async () => {
    try {
      const filePath = await open({
        multiple: false,
        filters: [{ name: "CSV Files", extensions: ["csv"] }],
      });
      if (!filePath || typeof filePath !== "string") return;

      const content = await readTextFile(filePath);
      const parsed = parsingHotkeyCsv(content);
      if (parsed.length === 0) {
        toast.warning("No hotkeys found", {
          description:
            "Need columns hotkey_set, hotkey_name, and Hotkey combo. hotkey_group is optional.",
        });
        return;
      }
      const next = [...hotkeyLabels.labels];
      for (const label of parsed) {
        const set = resolvingHotkeySet(label.set);
        const existing = next.findIndex(
          (row) =>
            resolvingHotkeySet(row.set) === set &&
            row.combo.toLowerCase() === label.combo.toLowerCase(),
        );
        if (existing >= 0) {
          next[existing] = {
            ...next[existing],
            ...label,
            set,
            id: next[existing].id,
          };
        } else {
          next.push({ ...label, set });
        }
      }
      const importedNamed = listingNamedHotkeySets(parsed);
      const sets = normalizingHotkeySets([
        ...namedSets,
        ...importedNamed.map((name) => ({
          name,
          enabled: true,
          programs: [],
        })),
      ]);
      setHotkeyLabels({
        labels: next,
        sets,
        activeSet: importedNamed[0] ?? hotkeyLabels.activeSet,
      });
      toast.success(`Imported ${parsed.length} hotkeys`);
    } catch (error) {
      toast.error("Could not import CSV", {
        description: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const addingLabel = () => {
    const name = draftName.trim();
    const combo = draftCombo.trim();
    if (!name || !combo) {
      toast.warning("Name and combo are required");
      return;
    }
    const set = activeSet;
    const next = [...hotkeyLabels.labels];
    const existing = next.findIndex(
      (row) =>
        resolvingHotkeySet(row.set) === set &&
        row.combo.toLowerCase() === combo.toLowerCase(),
    );
    const label = {
      id: existing >= 0 ? next[existing].id : `${set}-${combo}-${Date.now()}`,
      set,
      name,
      combo,
      description: draftDescription.trim(),
      group: draftGroup.trim(),
    };
    if (existing >= 0) {
      next[existing] = label;
    } else {
      next.push(label);
    }
    setHotkeyLabels({ labels: next });
    setDraftName("");
    setDraftCombo("");
    setDraftDescription("");
    setDraftGroup("");
  };

  const removingLabel = (id: string) => {
    setHotkeyLabels({
      labels: hotkeyLabels.labels.filter((label) => label.id !== id),
    });
  };

  return (
    <div className="flex flex-col gap-y-4 p-6">
      <h1 className="text-xl font-semibold">Hotkey Labels</h1>

      <Item variant="muted">
        <ItemContent>
          <ItemTitle>
            <HugeiconsIcon icon={KeyboardIcon} size="1em" /> Show names
          </ItemTitle>
          <ItemDescription>
            Names show when a combo matches an enabled set for the app in front,
            or Default
          </ItemDescription>
        </ItemContent>
        <ItemActions>
          <Switch
            checked={hotkeyLabels.enabled}
            onCheckedChange={(enabled) => setHotkeyLabels({ enabled })}
          />
        </ItemActions>
      </Item>

      <Item variant="muted">
        <ItemContent>
          <ItemTitle>
            <HugeiconsIcon icon={KeyboardIcon} size="1em" /> Show description
          </ItemTitle>
          <ItemDescription>
            Adds a short line under the keys, like Focus the address bar
          </ItemDescription>
        </ItemContent>
        <ItemActions>
          <Switch
            checked={hotkeyLabels.showDescription}
            onCheckedChange={(showDescription) =>
              setHotkeyLabels({ showDescription })
            }
          />
        </ItemActions>
      </Item>

      <Item variant="muted">
        <ItemContent>
          <ItemTitle>
            <HugeiconsIcon icon={KeyboardIcon} size="1em" /> Edit set
          </ItemTitle>
          <ItemDescription>
            Which set new hotkeys go into. Runtime picks by program.
          </ItemDescription>
        </ItemContent>
        <ItemActions>
          <Select
            value={isDefaultSet ? DEFAULT_SET_VALUE : activeSet}
            onValueChange={(value) =>
              setHotkeyLabels({
                activeSet: value === DEFAULT_SET_VALUE ? null : value,
              })
            }
          >
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Default" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value={DEFAULT_SET_VALUE}>Default</SelectItem>
                {namedSets.map((set) => (
                  <SelectItem key={set.name} value={set.name}>
                    {set.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </ItemActions>
      </Item>

      <Item variant="muted">
        <ItemContent>
          <ItemTitle>
            <HugeiconsIcon icon={KeyboardIcon} size="1em" /> Create hotkey set
          </ItemTitle>
          <ItemDescription>
            Adds a set you can turn on and bind to an app, like PowerPoint
            Hotkey
          </ItemDescription>
        </ItemContent>
        <ItemActions>
          <Input
            className="w-40"
            placeholder="PowerPoint Hotkey"
            value={draftSetName}
            onChange={(event) => setDraftSetName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") creatingSet();
            }}
          />
          <Button variant="outline" onClick={creatingSet}>
            Create
          </Button>
        </ItemActions>
      </Item>

      <h2 className="text-sm text-muted-foreground font-medium">Active sets</h2>
      <p className="text-xs text-muted-foreground">
        Turn on more than one. Bind a process like POWERPNT.EXE. Live:{" "}
        {lastForeignApp?.processName || foregroundApp?.processName || "none"}
        {liveSets.length > 0
          ? ` · using ${liveSets
              .map((name) => (name === DEFAULT_HOTKEY_SET ? "Default" : name))
              .join(", ")}`
          : " · no set active"}
      </p>
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 rounded-xl border border-white/15 bg-neutral-800 px-3 py-2">
          <span className="min-w-28 shrink-0 text-sm text-neutral-200">
            Default
          </span>
          <Switch
            checked={hotkeyLabels.defaultEnabled}
            onCheckedChange={(defaultEnabled) =>
              setHotkeyLabels({ defaultEnabled })
            }
          />
          <span className="flex-1 text-xs text-neutral-400">
            Copy, paste, undo, and other classics. All apps.
          </span>
        </div>
        {namedSets.map((set) => (
          <div
            key={set.name}
            className="flex items-center gap-2 rounded-xl border border-white/15 bg-neutral-800 px-3 py-2"
          >
            <span className="min-w-28 shrink-0 text-sm text-neutral-200">
              {set.name}
            </span>
            <Switch
              checked={set.enabled}
              onCheckedChange={(enabled) => togglingSet(set.name, enabled)}
            />
            <Input
              className="flex-1"
              placeholder="POWERPNT.EXE"
              value={set.programs[0] ?? ""}
              onChange={(event) => bindingProgram(set.name, event.target.value)}
            />
            <Button
              variant="outline"
              className="shrink-0"
              onClick={() => detectingProgram(set.name)}
            >
              Detect
            </Button>
          </div>
        ))}
      </div>

      <Item variant="muted">
        <ItemContent>
          <ItemTitle>
            <HugeiconsIcon icon={Upload01Icon} size="1em" /> Import CSV
          </ItemTitle>
          <ItemDescription>
            Columns: hotkey_set, hotkey_name, Hotkey combo, description,
            hotkey_group. Empty set goes to Default
          </ItemDescription>
        </ItemContent>
        <ItemActions>
          <Button variant="outline" onClick={importingCsv}>
            Import
          </Button>
        </ItemActions>
      </Item>

      <h2 className="text-sm text-muted-foreground font-medium">
        Add a hotkey
      </h2>
      <div className="flex items-center gap-2">
        <Input
          className="flex-1"
          placeholder="Name (Start slideshow)"
          value={draftName}
          onChange={(event) => setDraftName(event.target.value)}
        />
        <Input
          className="flex-1"
          placeholder="Combo (F5)"
          value={draftCombo}
          onChange={(event) => setDraftCombo(event.target.value)}
        />
        <Input
          className="flex-1"
          placeholder="Description (optional)"
          value={draftDescription}
          onChange={(event) => setDraftDescription(event.target.value)}
        />
        <Input
          className="w-36"
          list="hotkey-function-groups"
          placeholder="Group (AI)"
          value={draftGroup}
          onChange={(event) => setDraftGroup(event.target.value)}
        />
        <datalist id="hotkey-function-groups">
          {availableGroups.map((group) => (
            <option key={group} value={group} />
          ))}
        </datalist>
        <Button className="shrink-0" onClick={addingLabel}>
          Add
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Saves to {isDefaultSet ? "Default" : activeSet}. Use Shift+(char) for
        any letter. Put {"{char}"} in the name or description to show it.
      </p>

      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm text-muted-foreground font-medium">
          {isDefaultSet ? "Default" : activeSet}
        </h2>
        {availableGroups.length > 0 ? (
          <Select value={filterGroup} onValueChange={setFilterGroup}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All groups" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value={ALL_GROUPS_VALUE}>All groups</SelectItem>
                {availableGroups.map((group) => (
                  <SelectItem key={group} value={group}>
                    {group}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        ) : null}
      </div>
      {visibleLabels.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Import a CSV or add a hotkey to see cards here.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {groupedLabels.map((section) => (
            <div key={section.group} className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold text-neutral-200">
                {section.group}
              </h3>
              <div className="flex flex-wrap gap-3">
                {section.labels.map((label) => (
                  <div
                    key={label.id}
                    className="relative min-w-36 rounded-2xl bg-neutral-100 px-4 py-3 text-neutral-900 shadow-sm"
                  >
                    {label.group ? (
                      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                        {label.group}
                      </p>
                    ) : null}
                    <p className="mb-2 pr-6 text-base font-semibold leading-tight">
                      {label.name}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {parsingComboTokens(label.combo).map((token) => (
                        <span
                          key={`${label.id}-${token}`}
                          className="flex h-8 min-w-8 items-center justify-center rounded-md bg-neutral-700 px-2 text-xs font-medium text-neutral-100"
                        >
                          {formattingComboToken(token)}
                        </span>
                      ))}
                    </div>
                    {label.description ? (
                      <p className="mt-2 text-xs text-neutral-500">
                        {label.description}
                      </p>
                    ) : null}
                    <button
                      type="button"
                      className="absolute top-2 right-2 text-neutral-400 hover:text-neutral-800"
                      aria-label={`Remove ${label.name}`}
                      onClick={() => removingLabel(label.id)}
                    >
                      <XIcon className="size-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
