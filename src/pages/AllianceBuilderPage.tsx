import {
  Fragment,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  createDataRange,
  type DataRange,
  getColor,
  updateDataRange,
} from "../ui/TeamsDisplay";
import { eventsLabel } from "../util/eventsLabel";
import { FrcTeam } from "../util/FrcTeam";

const PICK_COLUMNS = ["Captain", "1st Pick", "2nd Pick", "3rd Pick"];
const ALLIANCE_COUNT = 8;
const ALLIANCE_IDS = Array.from(
  { length: ALLIANCE_COUNT },
  (_, i) => `alliance-${i + 1}`,
);
const SLOT_COUNT = ALLIANCE_COUNT * PICK_COLUMNS.length;
const MOVE_MS = 450;
// extra time per pixel traveled, capped so long moves don't drag
const MS_PER_PX = 0.8;
const MAX_MOVE_MS = 800;
// fraction of the remaining distance the drag overlay covers each frame
const EASE = 0.3;

type Box = { left: number; top: number; width: number; height: number };

type Board = {
  // row-major: slots[alliance * PICK_COLUMNS.length + pick]
  slots: (string | null)[];
  // pool order; teams missing from it are appended in teams order
  order: string[];
};

type Drag = {
  team: string;
  // painted overlay anchor and size, eased toward the targets each frame
  x: number;
  y: number;
  w: number;
  h: number;
  tx: number;
  ty: number;
  tw: number;
  th: number;
  // grab point as a fraction of the chip's size, and the chip's normal size
  fx: number;
  fy: number;
  baseW: number;
  baseH: number;
  // "yes" (green) over a slot, "no" (gray) over the pool
  tone: "yes" | "no";
};

type AllianceBuilderPageProps = {
  eventChoices: string[];
  aggregateEvents: string[];
  displayEvents: string[];
  teams: FrcTeam[];
};

function emptyBoard(): Board {
  return {
    slots: Array(SLOT_COUNT).fill(null),
    order: [],
  };
}

function fullOrder(order: string[], names: string[]) {
  return [
    ...order.filter((name) => names.includes(name)),
    ...names.filter((name) => !order.includes(name)),
  ];
}

// values that display as 0.00 are white and kept out of the gradient range
const isZero = (value: number) => Math.abs(value) < 0.005;

// a single non-zero value has no spread to scale against, so it reads as the best (green)
function statColor(value: number, range: DataRange) {
  if (isZero(value)) {
    return "white";
  }
  if (range.min === range.max) {
    return "rgb(0, 255, 0)";
  }
  return getColor(value, range);
}

function relativeTo(box: Box, origin: DOMRect): Box {
  return {
    left: box.left - origin.left,
    top: box.top - origin.top,
    width: box.width,
    height: box.height,
  };
}

export function AllianceBuilderPage({
  eventChoices,
  aggregateEvents,
  displayEvents,
  teams: allTeams,
}: AllianceBuilderPageProps) {
  const headerMessage = useMemo(
    () => eventsLabel(eventChoices, aggregateEvents, displayEvents),
    [eventChoices, aggregateEvents, displayEvents],
  );

  // only teams with matches in the displayed events, with stats limited to those matches
  const teams = useMemo(() => {
    return allTeams.flatMap((team) => {
      const matches = team
        .getMatches()
        .filter((match) => displayEvents.includes(match.getEvent()));
      if (matches.length === 0) {
        return [];
      }
      const filteredTeam = new FrcTeam(team.getTeamName());
      matches.forEach((match) => {
        filteredTeam.addMatch(match);
      });
      return [filteredTeam];
    });
  }, [allTeams, displayEvents]);

  const [board, setBoard] = useState<Board>(emptyBoard);
  const [dragTeam, setDragTeam] = useState<string | null>(null);
  const [dragTone, setDragTone] = useState<"yes" | "no">("yes");
  const [overPool, setOverPool] = useState(false);
  // the slot a dragged team is hovering, so stats can preview a replacement before release
  const [hoverSlot, setHoverSlot] = useState<{
    team: string;
    index: number;
  } | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLButtonElement>(null);
  const dragRef = useRef<Drag | null>(null);
  const stopDrag = useRef<(() => void) | null>(null);
  // the touch that grabbed the chip; other fingers keep their normal scrolling
  const dragTouch = useRef<number | null>(null);
  // chip boxes from the last commit, relative to the card
  const boxes = useRef(new Map<string, Box>());
  // the viewport box a just-dropped chip is released from
  const landing = useRef<{ team: string; box: Box; pulse: boolean } | null>(
    null,
  );
  // how the next commit moves chips: reset and auto fill fade every chip, reorder flies them
  const motionMode = useRef<"fly" | "fade">("fly");

  const names = useMemo(() => teams.map((team) => team.getTeamName()), [teams]);
  const teamsByName = useMemo(
    () => new Map(teams.map((team) => [team.getTeamName(), team])),
    [teams],
  );
  // same ordering as TeamsDisplay: highest average points first
  const rankByName = useMemo(
    () =>
      new Map(
        [...teams]
          .sort((a, b) => b.getAvgPoints() - a.getAvgPoints())
          .map((team, index) => [team.getTeamName(), index + 1]),
      ),
    [teams],
  );
  const label = (name: string) =>
    `${name.substring(3)} (#${rankByName.get(name)})`;
  const pool = fullOrder(board.order, names).filter(
    (name) => !board.slots.includes(name),
  );

  useEffect(() => () => stopDrag.current?.(), []);

  // eases the overlay toward the pointer and target size without re-rendering
  useLayoutEffect(() => {
    const overlay = overlayRef.current;
    const drag = dragRef.current;
    if (!dragTeam || !overlay || !drag) {
      return;
    }
    let frame = 0;
    const tick = () => {
      drag.x += (drag.tx - drag.x) * EASE;
      drag.y += (drag.ty - drag.y) * EASE;
      drag.w += (drag.tw - drag.w) * EASE;
      drag.h += (drag.th - drag.h) * EASE;
      overlay.style.width = `${drag.w}px`;
      overlay.style.height = `${drag.h}px`;
      overlay.style.transform = `translate(${drag.x - drag.fx * drag.w}px, ${drag.y - drag.fy * drag.h}px)`;
      frame = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(frame);
  }, [dragTeam]);

  // after every commit, slides each chip from its previous box (or from where a dropped chip was released) to its new box
  useLayoutEffect(() => {
    const card = cardRef.current;
    if (!card) {
      return;
    }
    const origin = card.getBoundingClientRect();
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const landed = landing.current;
    landing.current = null;
    // the fade mode applies only to the commit that requested it
    const fadeAll = motionMode.current === "fade";
    motionMode.current = "fly";
    const next = new Map<string, Box>();

    card.querySelectorAll<HTMLElement>("[data-team]").forEach((element) => {
      const team = element.dataset.team ?? "";
      const painted = relativeTo(element.getBoundingClientRect(), origin);
      const animations = element.getAnimations();
      for (const animation of animations) {
        animation.cancel();
      }
      const now = relativeTo(element.getBoundingClientRect(), origin);
      next.set(team, now);

      const from =
        landed?.team === team
          ? relativeTo(landed.box, origin)
          : animations.length > 0
            ? painted
            : boxes.current.get(team);
      if (!from || reduceMotion) {
        return;
      }

      const dx = from.left + from.width / 2 - (now.left + now.width / 2);
      const dy = from.top + from.height / 2 - (now.top + now.height / 2);
      const sx = from.width / Math.max(now.width, 1);
      const sy = from.height / Math.max(now.height, 1);
      const pulse = landed?.team === team && landed.pulse;
      const still =
        Math.abs(dx) + Math.abs(dy) < 0.5 &&
        Math.abs(sx - 1) + Math.abs(sy - 1) < 0.01;
      if (still && !pulse) {
        return;
      }
      // a chip that wrapped to another row would sweep diagonally across the card, so fade it in instead
      const wrapped =
        Math.abs(from.top - now.top) > 1 ||
        Math.abs(from.left - now.left) > now.width * 1.5;
      if (landed?.team !== team && (fadeAll || wrapped)) {
        element.animate([{ opacity: 0 }, { opacity: 1 }], {
          duration: MOVE_MS,
        });
        return;
      }
      const start = `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`;
      // a drop onto an alliance box shrinks the chip, overshoots, then settles at its normal size
      const keyframes: Keyframe[] = pulse
        ? [
            { transform: start, offset: 0 },
            { transform: "scale(0.9)", offset: 0.5 },
            { transform: "scale(1.03)", offset: 0.75 },
            { transform: "none", offset: 1 },
          ]
        : [{ transform: start }, { transform: "none" }];
      // a chip caught mid-slide only covers the distance left, so repeated drops don't stretch its motion
      const distance = Math.hypot(dx, dy);
      const interrupted = animations.length > 0 && !landed;
      const duration = interrupted
        ? Math.min(MOVE_MS, Math.max(120, distance * MS_PER_PX))
        : Math.min(MAX_MOVE_MS, MOVE_MS + distance * MS_PER_PX);
      const motion = element.animate(keyframes, {
        duration,
        easing: "cubic-bezier(0.2, 0, 0, 1)",
      });
      // the dropped chip paints above the pool chips it passes over while it lands
      if (landed?.team === team) {
        const clear = () => {
          element.style.zIndex = "";
          card.style.overflow = "";
        };
        element.style.zIndex = "2";
        // the card's overflow clip hides a chip still flying in from outside it
        card.style.overflow = "visible";
        motion.onfinish = clear;
        motion.oncancel = clear;
      }
    });

    boxes.current = next;
  });

  function moveToSlot(team: string, target: number, commit: boolean) {
    setBoard((prev) => {
      const from = prev.slots.indexOf(team);
      if (from === target) {
        return prev;
      }
      // hovering over a filled slot does nothing; the replacement happens on release
      if (prev.slots[target] && !commit) {
        return prev;
      }
      const slots = [...prev.slots];
      if (from !== -1) {
        slots[from] = null;
      }
      // an occupied slot's team is replaced, so it returns to the pool
      slots[target] = team;
      return { ...prev, slots };
    });
  }

  // index in the pool where a drop at (x, y) lands, found from the pool chips' current positions
  function poolIndexAt(x: number, y: number, team: string) {
    const chips = cardRef.current?.querySelectorAll<HTMLElement>(
      '[data-slot="pool"] [data-team]',
    );
    let index = 0;
    for (const chip of chips ?? []) {
      if (chip.dataset.team === team) {
        continue;
      }
      const rect = chip.getBoundingClientRect();
      const before =
        y > rect.bottom || (y >= rect.top && x > rect.left + rect.width / 2);
      if (!before) {
        break;
      }
      index++;
    }
    return index;
  }

  function moveToPool(team: string, index: number) {
    setBoard((prev) => {
      const ordered = fullOrder(prev.order, names);
      const slots = prev.slots.map((slot) => (slot === team ? null : slot));
      const pool = ordered.filter(
        (name) => name !== team && !slots.includes(name),
      );
      const slotted = ordered.filter((name) => slots.includes(name));
      return {
        slots,
        order: [
          ...pool.slice(0, index),
          team,
          ...pool.slice(index),
          ...slotted,
        ],
      };
    });
  }

  // fills empty boxes in draft order: captains take seeds 1-8, then each pick round snakes (8-1 on the second pick)
  function autoFill() {
    motionMode.current = "fade";
    setBoard((prev) => {
      const slots = [...prev.slots];
      const available = [...names]
        .sort((a, b) => (rankByName.get(a) ?? 0) - (rankByName.get(b) ?? 0))
        .filter((name) => !slots.includes(name));
      const forward = Array.from({ length: ALLIANCE_COUNT }, (_, i) => i);
      let next = 0;
      for (let column = 0; column < PICK_COLUMNS.length; column++) {
        const reversed = column !== 0 && column % 2 === 0;
        for (const alliance of reversed ? [...forward].reverse() : forward) {
          const index = alliance * PICK_COLUMNS.length + column;
          if (slots[index] || next >= available.length) {
            continue;
          }
          slots[index] = available[next++];
        }
      }
      return { ...prev, slots };
    });
  }

  function startDrag(
    event: ReactPointerEvent<HTMLButtonElement>,
    team: string,
  ) {
    if (event.button !== 0) {
      return;
    }
    // capture on the card: a chip moved between the pool and a slot is remounted, which can drop touch events aimed at it
    cardRef.current?.setPointerCapture(event.pointerId);
    const fromSlot = board.slots.includes(team);
    const rect = event.currentTarget.getBoundingClientRect();
    dragRef.current = {
      team,
      x: event.clientX,
      y: event.clientY,
      w: rect.width,
      h: rect.height,
      tx: event.clientX,
      ty: event.clientY,
      tw: rect.width,
      th: rect.height,
      fx: (event.clientX - rect.left) / rect.width,
      fy: (event.clientY - rect.top) / rect.height,
      baseW: rect.width,
      baseH: rect.height,
      tone: board.slots.includes(team) ? "yes" : "no",
    };
    setDragTeam(team);
    setDragTone(dragRef.current.tone);

    // the board before the drag, restored if the chip is released outside any box
    const startBoard = board;
    let hoverKey: string | undefined;
    const onMove = (move: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) {
        return;
      }
      // the overlay ignores pointer events, so this finds the slot under the cursor
      const slot = document
        .elementFromPoint(move.clientX, move.clientY)
        ?.closest<HTMLElement>("[data-slot]");
      const key = slot?.dataset.slot;
      hoverKey = key;
      drag.tx = move.clientX;
      drag.ty = move.clientY;
      if (key !== undefined) {
        // over the pool, use a pool chip's size: a chip grabbed from a slot is wider than a pool chip
        const sample =
          key === "pool"
            ? slot?.querySelector<HTMLElement>("[data-team]")
            : slot;
        const size = sample?.getBoundingClientRect();
        drag.tw = size ? size.width : drag.baseW;
        drag.th = size ? size.height : drag.baseH;
        const tone = key === "pool" ? "no" : "yes";
        if (tone !== drag.tone) {
          drag.tone = tone;
          setDragTone(tone);
        }
      }
      setOverPool(key === "pool");
      const hovered =
        key !== undefined && key !== "pool"
          ? { team, index: Number(key) }
          : null;
      setHoverSlot((prev) =>
        prev?.team === hovered?.team && prev?.index === hovered?.index
          ? prev
          : hovered,
      );
      // a pool chip only lands in a slot on release, so the pool keeps its gap while dragging
      if (fromSlot && key !== undefined && key !== "pool") {
        moveToSlot(team, Number(key), false);
      }
    };

    const onTouchMove = (move: TouchEvent) => {
      for (const touch of Array.from(move.changedTouches)) {
        if (touch.identifier === dragTouch.current) {
          move.preventDefault();
          return;
        }
      }
    };

    const stop = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      window.removeEventListener("touchmove", onTouchMove);
      dragTouch.current = null;
      stopDrag.current = null;
    };

    const onUp = (up: PointerEvent) => {
      stop();
      if (hoverKey === "pool") {
        moveToPool(team, poolIndexAt(up.clientX, up.clientY, team));
      } else if (hoverKey !== undefined) {
        moveToSlot(team, Number(hoverKey), true);
      } else {
        setBoard(startBoard);
      }
      setOverPool(false);
      setHoverSlot(null);
      const drag = dragRef.current;
      if (drag) {
        landing.current = {
          team,
          pulse: hoverKey !== undefined && hoverKey !== "pool",
          box: {
            left: drag.tx - drag.fx * drag.tw,
            top: drag.ty - drag.fy * drag.th,
            width: drag.tw,
            height: drag.th,
          },
        };
      }
      dragRef.current = null;
      setDragTeam(null);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    stopDrag.current = stop;
  }

  function allianceStats(alliance: number, slots: (string | null)[]) {
    const start = alliance * PICK_COLUMNS.length;
    const alliancePicks = slots.slice(start, start + PICK_COLUMNS.length);
    // the 3rd pick only counts once the alliance has all four teams
    const counted = alliancePicks.every(Boolean)
      ? alliancePicks
      : alliancePicks.slice(0, 3);
    const members = counted.flatMap((name) => {
      const team = name ? teamsByName.get(name) : undefined;
      return team ? [team] : [];
    });
    const sum = (get: (team: FrcTeam) => number) =>
      members.reduce((total, team) => total + get(team), 0);
    return {
      total: sum((team) => team.getAvgPoints()),
      auto: sum((team) => team.getAvgAutoPoints()),
      teleop: sum((team) => team.getAvgTeleopPoints()),
      climb: sum((team) => team.getAvgClimbPoints()),
    };
  }

  // colors each stat relative to the other alliances, like TeamsDisplay does for teams
  const statSlots = [...board.slots];
  if (hoverSlot) {
    const from = statSlots.indexOf(hoverSlot.team);
    if (from !== -1) {
      statSlots[from] = null;
    }
    statSlots[hoverSlot.index] = hoverSlot.team;
  }
  const allStats = ALLIANCE_IDS.map((_, alliance) =>
    allianceStats(alliance, statSlots),
  );
  const statRanges = {
    total: createDataRange(),
    auto: createDataRange(),
    teleop: createDataRange(),
    climb: createDataRange(),
  };
  allStats.forEach((stats) => {
    if (!isZero(stats.total)) {
      updateDataRange(statRanges.total, stats.total);
    }
    if (!isZero(stats.auto)) {
      updateDataRange(statRanges.auto, stats.auto);
    }
    if (!isZero(stats.teleop)) {
      updateDataRange(statRanges.teleop, stats.teleop);
    }
    if (!isZero(stats.climb)) {
      updateDataRange(statRanges.climb, stats.climb);
    }
  });

  // the grabbed chip stays in layout (hidden) so the grid doesn't jump
  const chip = (team: string, tone: "yes" | "no") => (
    <button
      key={team}
      type="button"
      data-team={team}
      className={`button event-button ${tone} alliance-chip`}
      style={{ visibility: dragTeam === team ? "hidden" : "visible" }}
      onPointerDown={(event) => startDrag(event, team)}
      onTouchStart={(event) => {
        dragTouch.current = event.changedTouches[0]?.identifier ?? null;
      }}
    >
      <h4>{label(team)}</h4>
    </button>
  );

  if (displayEvents.length === 0) {
    return (
      <div className="card">
        <h1>Alliance Builder</h1>
        <span className="text-container">{headerMessage}</span>
      </div>
    );
  }

  return (
    <div
      ref={cardRef}
      className={`wide-card alliance-builder${dragTeam ? " dragging" : ""}`}
    >
      <div className="alliance-title-row">
        <h1>Alliance Builder</h1>
        <div className="alliance-title-actions">
          <button type="button" onClick={autoFill} disabled={pool.length === 0}>
            Auto Fill
          </button>
          <button
            type="button"
            disabled={pool.length <= 1}
            onClick={() => {
              motionMode.current = "fly";
              setBoard((prev) => ({
                ...prev,
                order: [...names].sort(
                  (a, b) => (rankByName.get(a) ?? 0) - (rankByName.get(b) ?? 0),
                ),
              }));
            }}
          >
            Reorder
          </button>
          <button
            type="button"
            disabled={board.slots.every((slot) => slot === null)}
            onClick={() => {
              motionMode.current = "fade";
              setBoard(emptyBoard());
            }}
          >
            Reset
          </button>
        </div>
      </div>
      <span className="text-container">{headerMessage}</span>

      <div className="alliance-grid">
        {["", ...PICK_COLUMNS, "Stats"].map((label) => (
          <div key={label} className="alliance-header">
            {label}
          </div>
        ))}

        {ALLIANCE_IDS.map((allianceId, alliance) => {
          const stats = allStats[alliance];
          return (
            <Fragment key={allianceId}>
              <div className="alliance-rank">#{alliance + 1}</div>
              {PICK_COLUMNS.map((pick, column) => {
                const index = alliance * PICK_COLUMNS.length + column;
                const team = board.slots[index];
                return (
                  <fieldset
                    key={`${allianceId}-${pick}`}
                    data-slot={index}
                    className={`alliance-slot${hoverSlot?.index === index ? " drop-target" : ""}`}
                  >
                    {team && chip(team, "yes")}
                  </fieldset>
                );
              })}
              <div className="alliance-stats">
                <span
                  className="alliance-stat-total"
                  style={{ color: statColor(stats.total, statRanges.total) }}
                >
                  {stats.total.toFixed(2)}
                </span>
                <span className="alliance-stat-label">Total</span>
                <div className="alliance-stat-breakdown">
                  <span
                    style={{ color: statColor(stats.auto, statRanges.auto) }}
                  >
                    Auto {stats.auto.toFixed(2)}
                  </span>
                  <span
                    style={{
                      color: statColor(stats.teleop, statRanges.teleop),
                    }}
                  >
                    Teleop {stats.teleop.toFixed(2)}
                  </span>
                  <span
                    style={{ color: statColor(stats.climb, statRanges.climb) }}
                  >
                    Climb {stats.climb.toFixed(2)}
                  </span>
                </div>
              </div>
            </Fragment>
          );
        })}
      </div>

      <h3>Teams</h3>
      <fieldset
        className={`grid-container${overPool ? " pool-drop" : ""}${pool.length === 0 ? " pool-empty" : ""}`}
        data-slot="pool"
      >
        {pool.map((team) => chip(team, "no"))}
      </fieldset>

      {dragTeam && (
        <button
          ref={overlayRef}
          type="button"
          tabIndex={-1}
          aria-hidden="true"
          className={`button event-button ${dragTone} alliance-drag-overlay`}
        >
          <h4>{label(dragTeam)}</h4>
        </button>
      )}
    </div>
  );
}
