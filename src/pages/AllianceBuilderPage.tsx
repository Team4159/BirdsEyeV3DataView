import {
  type Dispatch,
  Fragment,
  memo,
  type PointerEvent as ReactPointerEvent,
  type SetStateAction,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { FetchingDataText } from "../ui/FetchingDataText";
import {
  createDataRange,
  type DataRange,
  extendDataRange,
} from "../util/DataRange";
import { eventsLabel } from "../util/eventsLabel";
import type { FrcTeam } from "../util/FrcTeam";
import { getStatColor } from "../util/getStatColor";
import { pagePropsEqual } from "../util/pagePropsEqual";
import { getDisplayTeamData } from "../util/teamData";

const PICK_COLUMNS = ["Captain", "1st Pick", "2nd Pick", "3rd Pick"];
const ALLIANCE_COUNT = 8;
const ALLIANCE_IDS = Array.from(
  { length: ALLIANCE_COUNT },
  (_, i) => `alliance-${i + 1}`,
);
const SLOT_COUNT = ALLIANCE_COUNT * PICK_COLUMNS.length;
const STAT_KEYS = ["total", "auto", "teleop", "climb"] as const;
const MOVE_MS = 450;
// extra time per pixel traveled, capped so long moves don't drag
const MS_PER_PX = 0.8;
const MAX_MOVE_MS = 800;
// fraction of the remaining distance the drag overlay covers each frame
const EASE = 0.3;
// how long the shadow takes to come back when a chip is grabbed again while its shadow is still fading
const SHADOW_RAMP_MS = 160;

type Box = { left: number; top: number; width: number; height: number };

// where a chip was painted (transforms included) just before a state change, and whether one of our slides was running
type ChipSnapshot = { box: Box; moving: boolean };

// a dropped chip: the overlay's painted box in viewport coordinates, from which the overlay flies to the chip's new box
type Landing = { team: string; from: Box; pulse: boolean };
type LandingFlight = { cancel: () => void; finished: Promise<void> };

type TeamAverages = {
  total: number;
  auto: number;
  teleop: number;
  climb: number;
};

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

type DragStartEvent = Pick<
  ReactPointerEvent<HTMLButtonElement>,
  | "button"
  | "isPrimary"
  | "pointerId"
  | "pointerType"
  | "clientX"
  | "clientY"
  | "currentTarget"
>;

function emptyBoard(): Board {
  return {
    slots: Array(SLOT_COUNT).fill(null),
    order: [],
  };
}

function fullOrder(order: string[], names: string[]) {
  const availableNames = new Set(names);
  const orderedNames = new Set(order);
  return order
    .filter((name) => availableNames.has(name))
    .concat(names.filter((name) => !orderedNames.has(name)));
}

// values that display as 0.00 are white and kept out of the gradient range
const isZero = (value: number) => Math.abs(value) < 0.005;

// a single non-zero value has no spread to scale against, so it reads as the best (green)
function statColor(value: number, range: DataRange) {
  if (isZero(value)) return "white";
  return range.min === range.max
    ? "rgb(0, 255, 0)"
    : getStatColor(value, range, false);
}

// slots are neighbors when they touch, including diagonally, like adjacent cells in minesweeper
function isNeighborSlot(a: number, b: number) {
  const columns = PICK_COLUMNS.length;
  return Math.abs(Math.floor(a / columns) - Math.floor(b / columns)) <= 1 &&
    Math.abs((a % columns) - (b % columns)) <= 1;
}

function relativeTo(box: Box, origin: DOMRect): Box {
  return {
    left: box.left - origin.left,
    top: box.top - origin.top,
    width: box.width,
    height: box.height,
  };
}

function landingEasing(progress: number) {
  // Match the historical cubic-bezier(0.2, 0, 0, 1) landing animation.
  let start = 0;
  let end = 1;
  let parameter = progress;
  for (let i = 0; i < 12; i++) {
    const inverse = 1 - parameter;
    const x =
      3 * inverse ** 2 * parameter * 0.2 + parameter ** 3;
    if (x < progress) start = parameter;
    else end = parameter;
    parameter = (start + end) / 2;
  }
  return 3 * (1 - parameter) * parameter ** 2 + parameter ** 3;
}

// the properties that carry the overlay's shadow. Their values come from the stylesheet at run time, so whichever is used is faded.
const SHADOW_PROPS = ["boxShadow", "filter"] as const;
type ShadowValues = Partial<Record<(typeof SHADOW_PROPS)[number], string>>;

// the shadow as it is painted right now, running animations included. Properties with no shadow are left out.
function paintedShadow(element: HTMLElement): ShadowValues {
  const style = getComputedStyle(element);
  const values: ShadowValues = {};
  for (const prop of SHADOW_PROPS) {
    if (style[prop] !== "none") {
      values[prop] = style[prop];
    }
  }
  return values;
}

// animates the shadow between two painted values; "none" as the target fades it out completely
function animateShadow(
  element: HTMLElement,
  from: ShadowValues,
  to: ShadowValues | "none",
  options: KeyframeAnimationOptions,
): Animation | null {
  const start: Keyframe = {};
  const end: Keyframe = {};
  for (const prop of SHADOW_PROPS) {
    const a = from[prop];
    const b = to === "none" ? undefined : to[prop];
    if (a === undefined && b === undefined) {
      continue;
    }
    start[prop] = a ?? "none";
    end[prop] = b ?? "none";
  }
  if (Object.keys(start).length === 0) {
    return null;
  }
  return element.animate([start, end], options);
}

function edgeScrollDelta(position: number, start: number, end: number) {
  const edgeSize = 56;
  const maxStep = 8;
  if (position < start + edgeSize) {
    return -Math.ceil(
      maxStep * Math.min(1, (start + edgeSize - position) / edgeSize),
    );
  }
  if (position > end - edgeSize) {
    return Math.ceil(
      maxStep * Math.min(1, (position - (end - edgeSize)) / edgeSize),
    );
  }
  return 0;
}

function scrollAtEdges(card: HTMLElement | null, x: number, y: number) {
  let scrolled = false;
  if (card) {
    const bounds = card.getBoundingClientRect();
    const maxScrollLeft = card.scrollWidth - card.clientWidth;
    const nextScrollLeft = Math.max(
      0,
      Math.min(
        maxScrollLeft,
        card.scrollLeft + edgeScrollDelta(x, bounds.left, bounds.right),
      ),
    );
    if (nextScrollLeft !== card.scrollLeft) {
      card.scrollLeft = nextScrollLeft;
      scrolled = true;
    }
  }

  const page = document.scrollingElement;
  if (page) {
    const maxScrollTop = page.scrollHeight - page.clientHeight;
    const nextScrollTop = Math.max(
      0,
      Math.min(
        maxScrollTop,
        page.scrollTop + edgeScrollDelta(y, 0, window.innerHeight),
      ),
    );
    if (nextScrollTop !== page.scrollTop) {
      page.scrollTop = nextScrollTop;
      scrolled = true;
    }
  }
  return scrolled;
}
type AllianceBuilderPageProps = {
  eventChoices: string[];
  aggregateEvents: string[];
  displayEvents: string[];
  teams: FrcTeam[];
  isActive: boolean;
  isTeamsDataUpdated: boolean;
};

type AllianceBuilderInteractionsProps = {
  board: Board;
  setBoard: Dispatch<SetStateAction<Board>>;
  names: string[];
  rankByName: ReadonlyMap<string, number>;
  teamNames: Set<string>;
  isActive: boolean;
};

function useAllianceBuilderInteractions({
  board,
  setBoard,
  names,
  rankByName,
  teamNames,
  isActive,
}: AllianceBuilderInteractionsProps) {
  const [dragTeam, setDragTeam] = useState<string | null>(null);
  // the team whose overlay is still flying to its box after a drop; its real chip stays hidden until it lands
  const [landingTeam, setLandingTeam] = useState<string | null>(null);
  const [dragTone, setDragTone] = useState<"yes" | "no">("yes");
  // the key of the live overlay element. Grabbing another chip while a drop is still flying hands that element over to `flights`
  // (it keeps flying on its own) and the new drag gets a fresh element under a new key.
  const [overlayKey, setOverlayKey] = useState(0);
  const [flights, setFlights] = useState<
    { key: number; team: string; tone: "yes" | "no" }[]
  >([]);
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
  const cancelPendingTouchDrag = useRef<(() => void) | null>(null);
  // resting chip boxes (no transforms) from the last animated commit, relative to the card
  const boxes = useRef(new Map<string, Box>());
  // painted chip boxes taken right before a state change; its presence is what makes the next commit animate
  const pendingMotion = useRef<Map<string, ChipSnapshot> | null>(null);
  const refreshBoxes = useRef(false);
  // the slides this component started on chips, so CSS transitions and fades are never mistaken for them
  const ownMotions = useRef(new WeakSet<Animation>());
  // the overlay's flight to its box after a drop, and the listeners that cut it short if the page moves under it
  const landingAnim = useRef<LandingFlight | null>(null);
  const landingCleanup = useRef<(() => void) | null>(null);
  // the overlay's shadow animation: the fade while it lands, or the ramp back up if it is grabbed again mid-fade
  const shadowAnim = useRef<Animation | null>(null);
  // flights handed over by detachLanding, by overlay key; each entry removes its overlay and shows the real chip
  const detached = useRef(
    new Map<number, { team: string; drop: () => void; dispose: () => void }>(),
  );
  // set by a drop and consumed by the next commit, which starts the overlay's flight
  const landing = useRef<Landing | null>(null);
  // how the next commit moves chips: reset and auto fill fade every chip, reorder flies them
  const motionMode = useRef<"fly" | "fade">("fly");
  // set when a drop swaps two slotted teams in neighboring slots, so both fly even if they change rows
  const swapCommit = useRef(false);

  const updatePoolOrder = useCallback(
    (order?: string[]) => {
      pendingMotion.current = null;
      landing.current = null;
      motionMode.current = "fly";
      swapCommit.current = false;
      refreshBoxes.current = true;
      setBoard((current) =>
        order ? { ...current, order } : { ...current },
      );
    },
    [setBoard],
  );

  useEffect(
    () => () => {
      cancelPendingTouchDrag.current?.();
      stopDrag.current?.();
      landingAnim.current?.cancel();
      shadowAnim.current?.cancel();
      landingCleanup.current?.();
      for (const entry of detached.current.values()) {
        entry.dispose();
      }
    },
    [],
  );

  useEffect(() => {
    if (isActive) {
      return;
    }

    cancelPendingTouchDrag.current?.();
    if (dragRef.current) {
      stopDrag.current?.();
      dragRef.current = null;
      setDragTeam(null);
      setHoverSlot(null);
      setOverPool(false);
    }
    if (landingAnim.current || landingTeam) {
      const animation = landingAnim.current;
      const shadow = shadowAnim.current;
      landingAnim.current = null;
      shadowAnim.current = null;
      landingCleanup.current?.();
      landingCleanup.current = null;
      landing.current = null;
      setLandingTeam(null);
      animation?.cancel();
      shadow?.cancel();
    }
    for (const entry of [...detached.current.values()]) {
      entry.drop();
    }
  }, [isActive, landingTeam]);

  useEffect(() => {
    for (let i = 0; i < board.slots.length; i++) {
      const slot = board.slots[i];
      if (slot === null) {
        continue;
      }
      if (teamNames.has(slot)) {
        continue;
      }
      board.slots[i] = null;
    }
  }, [board.slots, teamNames]);

  // eases the overlay toward the pointer and target size without re-rendering
  useLayoutEffect(() => {
    const overlay = overlayRef.current;
    const drag = dragRef.current;
    if (!isActive || !dragTeam || !overlay || !drag) {
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
  }, [dragTeam, isActive]);

  // records where every chip is painted right now, transforms included. Call this immediately before a state change that moves chips.
  function snapshotChips() {
    const card = cardRef.current;
    if (!card) {
      return;
    }
    const origin = card.getBoundingClientRect();
    const snapshot = new Map<string, ChipSnapshot>();
    card.querySelectorAll<HTMLElement>("[data-team]").forEach((element) => {
      snapshot.set(element.dataset.team ?? "", {
        box: relativeTo(element.getBoundingClientRect(), origin),
        moving: element
          .getAnimations()
          .some((animation) => ownMotions.current.has(animation)),
      });
    });
    pendingMotion.current = snapshot;
  }

  // hands the chip back from the overlay to the real chip. The animation is left alone (its fill holds the last frame) so the
  // overlay can't flash at the release point before React removes it.
  function settleLanding() {
    landingAnim.current = null;
    // the shadow fade ends with the flight and holds its last frame the same way; it goes when the overlay does
    shadowAnim.current = null;
    landingCleanup.current?.();
    landingCleanup.current = null;
    setLandingTeam(null);
  }

  // stops a flight in progress. Used where the overlay is about to be reused or the board is about to change, inside a discrete
  // event, so React commits before the next paint and the cancelled overlay is never shown.
  function endLanding() {
    const animation = landingAnim.current;
    const shadow = shadowAnim.current;
    settleLanding();
    animation?.cancel();
    shadow?.cancel();
  }

  // lets the flight in progress finish on its own element while the live overlay is freed for a new drag. The element stays mounted
  // (same key, now rendered from `flights`), so its animations are never interrupted; its chip appears when it lands.
  function detachLanding(team: string) {
    const animation = landingAnim.current;
    if (!animation) {
      return false;
    }
    const key = overlayKey;
    landingAnim.current = null;
    shadowAnim.current = null;
    landingCleanup.current?.();
    landingCleanup.current = null;
    const dispose = () => {
      window.removeEventListener("scroll", drop, { capture: true });
      window.removeEventListener("resize", drop);
    };
    function drop() {
      animation?.cancel();
      dispose();
      detached.current.delete(key);
      setFlights((current) => current.filter((flight) => flight.key !== key));
    }
    window.addEventListener("scroll", drop, { capture: true, passive: true });
    window.addEventListener("resize", drop);
    animation.finished.then(drop, drop);
    detached.current.set(key, { team, drop, dispose });
    setFlights((current) => [...current, { key, team, tone: dragTone }]);
    setOverlayKey(key + 1);
    setLandingTeam(null);
    return true;
  }

  // flies the overlay from where it was released to the dropped chip's resting box. The overlay is position: fixed, so no card
  // clipping or z-index juggling is involved, and the real chip appears only once the overlay has arrived and is removed.
  function startLanding(landed: Landing) {
    const overlay = overlayRef.current;
    const target = chipElement(landed.team);
    if (!overlay || !target) {
      return false;
    }
    const { from } = landed;
    const targetRect = target.getBoundingClientRect();
    const initialTarget: Box = {
      left: targetRect.left,
      top: targetRect.top,
      width: targetRect.width,
      height: targetRect.height,
    };
    const distance = Math.hypot(
      initialTarget.left - from.left,
      initialTarget.top - from.top,
    );
    const duration = Math.min(MAX_MOVE_MS, MOVE_MS + distance * MS_PER_PX);
    // the shadow fades out over the same flight, so it is gone exactly when the real chip (which has none) takes over. It starts
    // from what is painted right now, not from the stylesheet's value: a drop made while a shadow is still ramping up or
    // fading continues from there instead of jumping to full strength first. Read before the old animation is cancelled.
    const shadowFrom = paintedShadow(overlay);
    shadowAnim.current?.cancel();
    shadowAnim.current = animateShadow(overlay, shadowFrom, "none", {
      duration,
      easing: "ease-out",
      fill: "forwards",
    });
    const startTime = performance.now();
    let frameId = 0;
    let isRunning = true;
    let resolveFinished: () => void = () => {};
    const finished = new Promise<void>((resolve) => {
      resolveFinished = resolve;
    });
    const finish = () => {
      if (!isRunning) {
        return;
      }
      isRunning = false;
      cancelAnimationFrame(frameId);
      resolveFinished();
    };
    const flight: LandingFlight = { cancel: finish, finished };
    landingAnim.current = flight;
    finished.then(() => {
      if (landingAnim.current === flight) {
        settleLanding();
      }
    });

    const tick = (now: number) => {
      if (!isRunning) {
        return;
      }
      const liveTarget = chipElement(landed.team);
      if (!liveTarget) {
        finish();
        return;
      }

      const progress = Math.min(1, (now - startTime) / duration);
      const eased = landingEasing(progress);
      // The old pulse keyframes reached the target at offset 0.5, then scaled in place.
      const travelProgress = landed.pulse ? Math.min(1, eased / 0.5) : eased;
      const liveRect = liveTarget.getBoundingClientRect();
      const scrollX = liveRect.left - initialTarget.left;
      const scrollY = liveRect.top - initialTarget.top;
      const left = from.left + (initialTarget.left - from.left) * travelProgress + scrollX;
      const top = from.top + (initialTarget.top - from.top) * travelProgress + scrollY;
      const width = from.width + (liveRect.width - from.width) * travelProgress;
      const height = from.height + (liveRect.height - from.height) * travelProgress;
      let scale = 1;
      if (landed.pulse && eased < 0.5) {
        scale = 1 - 0.1 * (eased / 0.5);
      } else if (landed.pulse && eased < 0.75) {
        scale = 0.9 + 0.13 * ((eased - 0.5) / 0.25);
      } else if (landed.pulse) {
        scale = 1.03 - 0.03 * ((eased - 0.75) / 0.25);
      }

      overlay.style.width = `${width}px`;
      overlay.style.height = `${height}px`;
      overlay.style.transform = `translate(${left}px, ${top}px) scale(${scale})`;
      if (progress === 1) {
        finish();
      } else {
        frameId = requestAnimationFrame(tick);
      }
    };
    frameId = requestAnimationFrame(tick);
    return true;
  }

  // slides each chip from where it was painted before the change to its new box, and starts a dropped chip's overlay flight.
  // Only commits that were preceded by snapshotChips() or a drop animate; hover and tone re-renders leave running animations alone.
  useLayoutEffect(() => {
    const snapshot = pendingMotion.current;
    const landed = landing.current;
    if (!snapshot && !landed && !refreshBoxes.current) {
      return;
    }
    pendingMotion.current = null;
    landing.current = null;
    // the fade mode applies only to the commit that requested it
    const fadeAll = motionMode.current === "fade";
    motionMode.current = "fly";
    const swapping = swapCommit.current;
    swapCommit.current = false;

    const card = cardRef.current;
    const origin = card?.getBoundingClientRect();
    if (!card || !origin || origin.width === 0 || origin.height === 0) {
      if (landed) {
        setLandingTeam(null);
      }
      return;
    }

    if (refreshBoxes.current && !snapshot && !landed) {
      boxes.current = new Map(
        Array.from(card.querySelectorAll<HTMLElement>("[data-team]"), (element) => [
          element.dataset.team ?? "",
          relativeTo(element.getBoundingClientRect(), origin),
        ]),
      );
      refreshBoxes.current = false;
      return;
    }
    refreshBoxes.current = false;
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const next = new Map<string, Box>();

    const elements = Array.from(
      card.querySelectorAll<HTMLElement>("[data-team]"),
    );
    // reads and writes run in batches, so the browser lays out once per commit instead of once per chip.
    // Only our own slides are cancelled: fades keep playing and CSS hover transitions are left alone.
    const running = elements.map((element) =>
      element
        .getAnimations()
        .filter((animation) => ownMotions.current.has(animation)),
    );
    for (const animations of running) {
      for (const animation of animations) {
        animation.cancel();
      }
    }
    const nowRects = elements.map((element) =>
      relativeTo(element.getBoundingClientRect(), origin),
    );

    let landingStarted = false;
    for (let index = 0; index < elements.length; index++) {
      const element = elements[index];
      const team = element.dataset.team ?? "";
      const now = nowRects[index];
      next.set(team, now);

      // the dropped chip stays hidden under the overlay, which flies to the chip's resting box
      if (landed?.team === team) {
        landingStarted = !reduceMotion && startLanding(landed);
        continue;
      }

      const snap = snapshot?.get(team);
      if (!snap || reduceMotion) {
        continue;
      }
      const from = snap.box;

      const dx = from.left + from.width / 2 - (now.left + now.width / 2);
      const dy = from.top + from.height / 2 - (now.top + now.height / 2);
      const sx = from.width / Math.max(now.width, 1);
      const sy = from.height / Math.max(now.height, 1);
      const still =
        Math.abs(dx) + Math.abs(dy) < 0.5 &&
        Math.abs(sx - 1) + Math.abs(sy - 1) < 0.01;
      if (still) {
        continue;
      }
      // a chip that wrapped to another row would sweep diagonally across the card, so fade it in instead.
      // This compares resting layouts: `from` can be a mid-slide position, which says nothing about wrapping.
      const rest = boxes.current.get(team) ?? from;
      const wrapped =
        Math.abs(rest.top - now.top) > 1 ||
        Math.abs(rest.left - now.left) > now.width * 1.5;
      // a chip whose resting box is unchanged is only still travelling from an earlier change, so it keeps sliding. Fading is
      // for chips this change actually relocates: a chip caught mid-slide by an unrelated fade-mode drop must not turn into a fade.
      const relocated =
        Math.abs(rest.left - now.left) > 1 ||
        Math.abs(rest.top - now.top) > 1 ||
        Math.abs(rest.width - now.width) > 1 ||
        Math.abs(rest.height - now.height) > 1;
      if ((fadeAll && relocated) || (wrapped && !swapping)) {
        element.animate([{ opacity: 0 }, { opacity: 1 }], {
          duration: MOVE_MS,
        });
        continue;
      }
      const start = `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`;
      // a chip caught mid-slide only covers the distance left, so repeated drops don't stretch its motion
      const distance = Math.hypot(dx, dy);
      const duration = snap.moving
        ? Math.min(MOVE_MS, Math.max(120, distance * MS_PER_PX))
        : Math.min(MAX_MOVE_MS, MOVE_MS + distance * MS_PER_PX);
      const motion = element.animate(
        [{ transform: start }, { transform: "none" }],
        {
          duration,
          easing: "cubic-bezier(0.2, 0, 0, 1)",
        },
      );
      ownMotions.current.add(motion);
    }

    // no flight to wait for (reduced motion, or the chip is gone): show the real chip now
    if (landed && !landingStarted) {
      setLandingTeam(null);
    }
    // a detached flight is aiming at the box its chip had; if this change moved that chip, the flight is aiming at the wrong place
    for (const entry of Array.from(detached.current.values())) {
      const was = boxes.current.get(entry.team);
      const now = next.get(entry.team);
      if (
        !now ||
        !was ||
        Math.abs(was.left - now.left) > 1 ||
        Math.abs(was.top - now.top) > 1
      ) {
        entry.drop();
      }
    }
    boxes.current = next;
  });

  // places a team on release, from the board as it was when the drag started; a slotted team swaps with the team it lands on
  function placeInSlot(base: Board, team: string, target: number): Board {
    const from = base.slots.indexOf(team);
    if (from === target) {
      return base;
    }
    const slots = [...base.slots];
    if (from !== -1) {
      slots[from] = base.slots[target];
    }
    // a pool team dropped on an occupied slot replaces it, so the displaced team returns to the pool
    slots[target] = team;
    return { ...base, slots };
  }

  // index in the pool (without the dropped team) where a drop at (x, y) lands, found from the pool chips' current positions
  function poolIndexAt(x: number, y: number, team: string) {
    const chips = Array.from(
      cardRef.current?.querySelectorAll<HTMLElement>(
        '[data-slot="pool"] [data-team]',
      ) ?? [],
    );
    const rects = chips.map((chip) => chip.getBoundingClientRect());
    const held = chips.findIndex((chip) => chip.dataset.team === team);
    if (rects.length === 0 || y < rects[0].top) {
      return 0;
    }

    const lastRect = rects[rects.length - 1];
    let gap = rects.length;
    if (y <= lastRect.bottom) {
      const rows: { indices: number[]; centerY: number }[] = [];
      rects.forEach((rect, index) => {
        const row = rows[rows.length - 1];
        if (!row || Math.abs(rect.top - rects[row.indices[0]].top) > rect.height / 2) {
          rows.push({ indices: [index], centerY: rect.top + rect.height / 2 });
        } else {
          row.indices.push(index);
        }
      });

      const columnCount = rows[0].indices.length;
      const rowIndex = rows.reduce(
        (closestIndex, candidate, index) =>
          Math.abs(candidate.centerY - y) <
          Math.abs(rows[closestIndex].centerY - y)
            ? index
            : closestIndex,
        0,
      );
      const row = rows[rowIndex];
      const firstIndex = row.indices[0];
      const lastIndex = row.indices[row.indices.length - 1];
      const lastChip = rects[lastIndex];
      if (
        row.indices.length === columnCount &&
        x >= lastChip.left + lastChip.width / 2
      ) {
        return lastIndex;
      }
      gap = firstIndex + row.indices.filter((index) => {
        const rect = rects[index];
        return x > rect.left + rect.width / 2;
      }).length;
    }

    return Math.max(0, gap - (held !== -1 && held < gap ? 1 : 0));
  }

  function moveToPool(team: string, index: number) {
    motionMode.current = "fly";
    swapCommit.current = false;
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

  // fills empty boxes in draft order: each seed takes its captain then its 1st pick before the next seed, then the 2nd pick snakes (8-1) and the 3rd pick goes 1-8
  function autoFill() {
    endLanding();
    snapshotChips();
    motionMode.current = "fade";
    setBoard((prev) => {
      const slots = [...prev.slots];
      const available = [...names]
        .sort((a, b) => (rankByName.get(a) ?? 0) - (rankByName.get(b) ?? 0))
        .filter((name) => !slots.includes(name));
      const forward = Array.from({ length: ALLIANCE_COUNT }, (_, i) => i);
      const draftOrder: number[] = [];
      for (const alliance of forward) {
        draftOrder.push(
          alliance * PICK_COLUMNS.length,
          alliance * PICK_COLUMNS.length + 1,
        );
      }
      for (const alliance of [...forward].reverse()) {
        draftOrder.push(alliance * PICK_COLUMNS.length + 2);
      }
      for (const alliance of forward) {
        draftOrder.push(alliance * PICK_COLUMNS.length + 3);
      }
      let next = 0;
      for (const index of draftOrder) {
        if (slots[index] || next >= available.length) {
          continue;
        }
        slots[index] = available[next++];
      }
      return { ...prev, slots };
    });
  }

  function chipElement(team: string) {
    return Array.from(
      cardRef.current?.querySelectorAll<HTMLElement>("[data-team]") ?? [],
    ).find((element) => element.dataset.team === team);
  }

  function startDrag(event: DragStartEvent, team: string) {
    // a second finger or a non-primary button never starts (or hijacks) a drag
    if (event.button !== 0 || !event.isPrimary) {
      return;
    }
    // measured before anything below can cancel a flight: a chip grabbed from the landing overlay is picked up exactly where it is painted
    const rect = event.currentTarget.getBoundingClientRect();
    // the size the chip settles at. For the overlay that is its hidden real chip, not whatever size the flight has reached.
    const restRect =
      event.currentTarget === overlayRef.current
        ? (chipElement(team)?.getBoundingClientRect() ?? rect)
        : rect;
    // the shadow of a drop that is still fading, read before the flight is cancelled below
    const overlay = overlayRef.current;
    // a flight of a different chip carries on undisturbed on its own element; grabbing the flying chip itself reuses its overlay
    const handedOver =
      !!landingTeam && landingTeam !== team && detachLanding(landingTeam);
    const fadingShadow =
      !handedOver && overlay && shadowAnim.current
        ? paintedShadow(overlay)
        : null;
    // a drag whose pointerup was lost must not leak its listeners into this one
    stopDrag.current?.();
    // the chip being grabbed from its own flight is shown at its box so the overlay can be reused
    endLanding();
    // the reused overlay brings its shadow back from where the fade had got to, rather than snapping to full strength
    if (overlay && fadingShadow) {
      shadowAnim.current = animateShadow(
        overlay,
        fadingShadow,
        paintedShadow(overlay),
        { duration: SHADOW_RAMP_MS, easing: "ease-out" },
      );
    }
    // clear any text selection so the browser doesn't start a native drag of it
    window.getSelection()?.removeAllRanges();
    const pointerId = event.pointerId;
    // capture on the card: a chip moved between the pool and a slot is remounted, which can drop touch events aimed at it
    const card = cardRef.current;
    if (!card) {
      return;
    }
    try {
      card.setPointerCapture(pointerId);
    } catch {
      return;
    }
    const fromSlot = board.slots.includes(team);
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
      baseW: restRect.width,
      baseH: restRect.height,
      tone: fromSlot ? "yes" : "no",
    };
    setDragTeam(team);
    setDragTone(dragRef.current.tone);

    // the board before the drag, restored if the chip is released outside any box
    const startBoard = board;
    let hoverKey: string | undefined;
    let pointerX = event.clientX;
    let pointerY = event.clientY;
    let autoScrollFrame = 0;
    const updateDropTarget = (x: number, y: number) => {
      const drag = dragRef.current;
      if (!drag) {
        return;
      }
      let slot = document
        .elementFromPoint(x, y)
        ?.closest<HTMLElement>("[data-slot]");
      if (!slot) {
        const slots = Array.from(
          cardRef.current?.querySelectorAll<HTMLElement>(
            ".alliance-grid [data-slot]",
          ) ?? [],
        ).map((element) => ({ element, rect: element.getBoundingClientRect() }));
        if (slots.length > 0) {
          const left = Math.min(...slots.map(({ rect }) => rect.left));
          const right = Math.max(...slots.map(({ rect }) => rect.right));
          const top = Math.min(...slots.map(({ rect }) => rect.top));
          const bottom = Math.max(...slots.map(({ rect }) => rect.bottom));
          if (x >= left && x <= right && y >= top && y <= bottom) {
            slot = slots.reduce((nearest, candidate) => {
              const nearestX =
                nearest.rect.left + nearest.rect.width / 2 - x;
              const nearestY =
                nearest.rect.top + nearest.rect.height / 2 - y;
              const candidateX =
                candidate.rect.left + candidate.rect.width / 2 - x;
              const candidateY =
                candidate.rect.top + candidate.rect.height / 2 - y;
              return candidateX ** 2 + candidateY ** 2 <
                nearestX ** 2 + nearestY ** 2
                ? candidate
                : nearest;
            }).element;
          }
        }
      }
      const key = slot?.dataset.slot;
      hoverKey = key;
      drag.tx = x;
      drag.ty = y;
      if (key !== undefined) {
        const sample = slot?.querySelector<HTMLElement>("[data-team]");
        const size = sample?.getBoundingClientRect();
        if (size) {
          drag.tw = size.width;
          drag.th = size.height;
        } else if (key !== "pool" && slot) {
          const style = getComputedStyle(slot);
          drag.tw = slot.clientWidth;
          drag.th =
            slot.clientHeight +
            Number.parseFloat(style.borderTopWidth) +
            Number.parseFloat(style.borderBottomWidth);
        }
        const tone = key === "pool" ? "no" : "yes";
        if (tone !== drag.tone) {
          drag.tone = tone;
          setDragTone(tone);
        }
      } else {
        drag.tw = drag.baseW;
        drag.th = drag.baseH;
        const tone = fromSlot ? "yes" : "no";
        drag.tone = tone;
        setDragTone(tone);
      }
      setOverPool(key === "pool");
      const hovered =
        key !== undefined && key !== "pool"
          ? { team, index: Number(key) }
          : fromSlot
            ? { team, index: -1 }
            : null;
      setHoverSlot((prev) =>
        prev?.team === hovered?.team && prev?.index === hovered?.index
          ? prev
          : hovered,
      );
    };
    const onMove = (move: PointerEvent) => {
      if (move.pointerId !== pointerId) {
        return;
      }
      // a mouse button released outside the window, or swallowed by a context menu, never sends pointerup
      if (move.pointerType === "mouse" && move.buttons === 0) {
        onUp(move);
        return;
      }
      pointerX = move.clientX;
      pointerY = move.clientY;
      updateDropTarget(pointerX, pointerY);
    };

    const autoScroll = () => {
      if (!dragRef.current) {
        return;
      }
      if (scrollAtEdges(cardRef.current, pointerX, pointerY)) {
        updateDropTarget(pointerX, pointerY);
      }
      autoScrollFrame = requestAnimationFrame(autoScroll);
    };

    // stops the browser from starting a text selection or a native drag while the chip is held
    const blockDefault = (blocked: Event) => blocked.preventDefault();

    const stop = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onPointerCancel);
      window.removeEventListener("touchmove", onTouchMove);
      cancelAnimationFrame(autoScrollFrame);
      window.removeEventListener("blur", onAbort);
      window.removeEventListener("contextmenu", blockDefault);
      window.removeEventListener("dragstart", blockDefault);
      window.removeEventListener("selectstart", blockDefault);
      const card = cardRef.current;
      if (card?.hasPointerCapture(pointerId)) {
        card.releasePointerCapture(pointerId);
      }
      stopDrag.current = null;
    };

    // ends the drag. A release commits to the hovered box; an abort (pointercancel, window blur) puts the chip back
    const finish = (release: PointerEvent | null) => {
      stop();
      // painted positions are taken before any state changes, so chips still sliding start from where they are on screen
      snapshotChips();

      if (release && hoverKey === "pool") {
        moveToPool(team, poolIndexAt(release.clientX, release.clientY, team));
      } else if (release && hoverKey !== undefined) {
        const target = Number(hoverKey);
        const displaced = startBoard.slots[target];
        const swap = fromSlot && !!displaced && displaced !== team;
        const neighbors =
          swap && isNeighborSlot(startBoard.slots.indexOf(team), target);
        swapCommit.current = neighbors;
        // a swap between non-neighboring slots fades the displaced team; the dropped team always lands
        if (swap && !neighbors) {
          motionMode.current = "fade";
        }
        setBoard((prev) => placeInSlot(prev, team, target));
      } else {
        setBoard(startBoard);
      }
      const drag = dragRef.current;
      if (drag) {
        // the overlay keeps flying from where it is painted, not where it was heading, so a fast release doesn't pop
        landing.current = {
          team,
          pulse: !!release && hoverKey !== undefined && hoverKey !== "pool",
          from: {
            left: drag.x - drag.fx * drag.w,
            top: drag.y - drag.fy * drag.h,
            width: drag.w,
            height: drag.h,
          },
        };
        setLandingTeam(team);
      }
      setOverPool(false);
      setHoverSlot(null);
      dragRef.current = null;
      setDragTeam(null);
    };

    const onUp = (up: PointerEvent) => {
      if (up.pointerId !== pointerId) {
        return;
      }
      finish(up);
    };
    const onPointerCancel = (cancel: PointerEvent) => {
      if (cancel.pointerId === pointerId) {
        finish(null);
      }
    };
    const onTouchMove = (move: TouchEvent) => move.preventDefault();
    const onAbort = () => finish(null);

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onPointerCancel);
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("blur", onAbort);
    window.addEventListener("contextmenu", blockDefault);
    window.addEventListener("dragstart", blockDefault);
    window.addEventListener("selectstart", blockDefault);
    stopDrag.current = stop;
    if (event.pointerType === "touch") {
      autoScrollFrame = requestAnimationFrame(autoScroll);
    }
  }

  function handlePointerDown(
    event: ReactPointerEvent<HTMLButtonElement>,
    team: string,
  ) {
    if (event.pointerType !== "touch") {
      startDrag(event, team);
      return;
    }
    if (event.button !== 0 || !event.isPrimary) {
      return;
    }

    const button = event.currentTarget;
    const { pointerId, clientX, clientY } = event;
    let timeout = 0;
    const cleanup = () => {
      window.clearTimeout(timeout);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("pointerup", onEnd);
      window.removeEventListener("pointercancel", onEnd);
      if (cancelPendingTouchDrag.current === cleanup) {
        cancelPendingTouchDrag.current = null;
      }
    };
    const onMove = (move: PointerEvent) => {
      if (
        move.pointerId === pointerId &&
        Math.hypot(move.clientX - clientX, move.clientY - clientY) > 10
      ) {
        cleanup();
      }
    };
    const onTouchMove = (move: TouchEvent) => {
      for (const touch of Array.from(move.changedTouches)) {
        if (Math.hypot(touch.clientX - clientX, touch.clientY - clientY) > 10) {
          cleanup();
          return;
        }
      }
    };
    const onEnd = (end: PointerEvent) => {
      if (end.pointerId === pointerId) {
        cleanup();
      }
    };

    cancelPendingTouchDrag.current?.();
    cancelPendingTouchDrag.current = cleanup;
    window.addEventListener("pointermove", onMove);
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("pointerup", onEnd);
    window.addEventListener("pointercancel", onEnd);
    timeout = window.setTimeout(() => {
      cleanup();
      startDrag(
        {
          button: 0,
          isPrimary: true,
          pointerId,
          pointerType: "touch",
          clientX,
          clientY,
          currentTarget: button,
        },
        team,
      );
    }, 100);
  }

  function reorder() {
    endLanding();
    snapshotChips();
    motionMode.current = "fly";
    setBoard((prev) => ({
      ...prev,
      order: [...names].sort(
        (a, b) => (rankByName.get(a) ?? 0) - (rankByName.get(b) ?? 0),
      ),
    }));
  }

  function resetBoard() {
    endLanding();
    snapshotChips();
    motionMode.current = "fade";
    setBoard(emptyBoard());
  }

  return {
    cardRef,
    overlayRef,
    dragTeam,
    landingTeam,
    dragTone,
    overlayKey,
    flights,
    overPool,
    hoverSlot,
    snapshotChips,
    endLanding,
    autoFill,
    reorder,
    resetBoard,
    updatePoolOrder,
    handlePointerDown,
  };
}

export const AllianceBuilderPage = memo(function AllianceBuilderPage({
  eventChoices,
  aggregateEvents,
  displayEvents,
  teams: allTeams,
  isActive,
  isTeamsDataUpdated,
}: AllianceBuilderPageProps) {
  const headerMessage = useMemo(
    () => eventsLabel(eventChoices, aggregateEvents, displayEvents),
    [eventChoices, aggregateEvents, displayEvents],
  );

  // only teams with matches in the displayed events, with stats limited to those matches
  const teams = useMemo<FrcTeam[]>(() => {
    return allTeams.flatMap((team) => {
      return getDisplayTeamData(team, aggregateEvents, displayEvents);
    });
  }, [allTeams, displayEvents, aggregateEvents]);
  const teamNames = useMemo<Set<string>>(
    () => new Set(teams.flatMap((teams) => teams.getTeamName())),
    [teams],
  );

  const [board, setBoard] = useState<Board>(emptyBoard);
  const names = useMemo(() => teams.map((team) => team.getTeamName()), [teams]);
  // averages are computed once per teams change, not on every render or hover
  const teamAverages = useMemo(
    () =>
      new Map(
        teams.map((team) => [
          team.getTeamName(),
          {
            total: team.getAvgPointsNoFouls(),
            auto: team.getAvgAutoPoints(),
            teleop: team.getAvgTeleopPoints(),
            climb: team.getAvgClimbPoints(),
          },
        ]),
      ),
    [teams],
  );
  // same ordering as TeamsDisplay: highest average points first
  const rankByName = useMemo(
    () =>
      new Map(
        [...teams]
          .sort(
            (a, b) =>
              (teamAverages.get(b.getTeamName())?.total ?? 0) -
              (teamAverages.get(a.getTeamName())?.total ?? 0),
          )
          .map((team, index) => [team.getTeamName(), index + 1]),
      ),
    [teams, teamAverages],
  );
  const previousAggregateEvents = useRef<string[]>([]);
  const {
    cardRef,
    overlayRef,
    dragTeam,
    landingTeam,
    dragTone,
    overlayKey,
    flights,
    overPool,
    hoverSlot,
    autoFill,
    reorder,
    resetBoard,
    updatePoolOrder,
    handlePointerDown,
  } = useAllianceBuilderInteractions({
    board,
    setBoard,
    names,
    rankByName,
    teamNames,
    isActive,
  });
  useEffect(() => {
    const previous = previousAggregateEvents.current;
    const aggregateEventsChanged =
      previous.length !== aggregateEvents.length ||
      previous.some((event, index) => event !== aggregateEvents[index]);
    if (!aggregateEventsChanged || !isTeamsDataUpdated) {
      return;
    }

    previousAggregateEvents.current = aggregateEvents;
    updatePoolOrder(
      previous.length === 0 && aggregateEvents.length > 0
        ? [...names].sort(
          (a, b) => (rankByName.get(a) ?? 0) - (rankByName.get(b) ?? 0),
          )
        : undefined,
    );
  }, [
    aggregateEvents,
    isTeamsDataUpdated,
    names,
    rankByName,
    updatePoolOrder,
  ]);
  const label = (name: string) =>
    `${name.substring(3)} (#${rankByName.get(name)})`;
  const slottedTeams = new Set(board.slots);
  const pool = fullOrder(board.order, names).filter(
    (name) => !slottedTeams.has(name) && rankByName.has(name),
  );
  // the one overlay serves the held chip, then the same element carries it to its box, so it is never torn down mid-flight
  const ghostTeam = dragTeam ?? landingTeam;

  function allianceStats(alliance: number, slots: (string | null)[]) {
    const start = alliance * PICK_COLUMNS.length;
    const alliancePicks = slots.slice(start, start + PICK_COLUMNS.length);
    // the 3rd pick only counts once the alliance has all four teams
    const counted = alliancePicks.every(Boolean)
      ? alliancePicks.slice(0, 3)
      : alliancePicks;
    const members = counted.flatMap((name) => {
      const averages = name ? teamAverages.get(name) : undefined;
      return averages ? [averages] : [];
    });
    const sum = (get: (averages: TeamAverages) => number) =>
      members.reduce((total, averages) => total + get(averages), 0);
    return {
      total: sum((averages) => averages.total),
      auto: sum((averages) => averages.auto),
      teleop: sum((averages) => averages.teleop),
      climb: sum((averages) => averages.climb),
    };
  }

  // colors each stat relative to the other alliances, like TeamsDisplay does for teams
  const statSlots = [...board.slots];
  if (hoverSlot) {
    const from = statSlots.indexOf(hoverSlot.team);
    if (hoverSlot.index === -1) {
      if (from !== -1) {
        statSlots[from] = null;
      }
    } else {
      const displaced = statSlots[hoverSlot.index];
      if (from !== -1) {
        statSlots[from] = displaced;
      }
      statSlots[hoverSlot.index] = hoverSlot.team;
    }
  }
  const allStats = ALLIANCE_IDS.map((_, alliance) =>
    allianceStats(alliance, statSlots),
  );
  const statRanges = Object.fromEntries(
    STAT_KEYS.map((stat) => [stat, createDataRange()]),
  ) as Record<(typeof STAT_KEYS)[number], DataRange>;
  allStats.forEach((stats) => {
    STAT_KEYS.forEach((stat) => {
      if (!isZero(stats[stat])) {
        extendDataRange(statRanges[stat], stats[stat]);
      }
    });
  });

  // the held (or still landing) chip stays in layout, hidden, so the grid doesn't jump and the overlay is the only thing visible
  const chip = (team: string, tone: "yes" | "no") => (
    <button
      key={team}
      type="button"
      data-team={team}
      draggable={false}
      className={`button event-button ${tone} alliance-chip`}
      style={{
        visibility:
          ghostTeam === team || flights.some((flight) => flight.team === team)
            ? "hidden"
            : "visible",
      }}
      onPointerDown={(event) => handlePointerDown(event, team)}
      onDragStart={(event) => event.preventDefault()}
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
            onClick={reorder}
          >
            Reorder
          </button>
          <button
            type="button"
            disabled={board.slots.every((slot) => slot === null)}
            onClick={resetBoard}
          >
            Reset
          </button>
        </div>
      </div>
      <span className="text-container">{headerMessage}</span>
      {isTeamsDataUpdated ? (
        <>
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
                      style={{
                        color: statColor(stats.total, statRanges.total),
                      }}
                    >
                      {stats.total.toFixed(2)}
                    </span>
                    <span className="alliance-stat-label">Total</span>
                    <div className="alliance-stat-breakdown">
                      <span
                        style={{
                          color: statColor(stats.auto, statRanges.auto),
                        }}
                      >
                        {stats.auto.toFixed(2)}
                        <br />
                        Auto
                      </span>
                      <span
                        style={{
                          color: statColor(stats.teleop, statRanges.teleop),
                        }}
                      >
                        {stats.teleop.toFixed(2)}
                        <br />
                        Teleop
                      </span>
                      <span
                        style={{
                          color: statColor(stats.climb, statRanges.climb),
                        }}
                      >
                        {stats.climb.toFixed(2)}
                        <br />
                        Climb
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

          {/* one keyed list, so an overlay handed over to `flights` is the same DOM element and its animations keep running */}
          {[
            ...flights.map((flight) => (
              <button
                key={flight.key}
                type="button"
                tabIndex={-1}
                aria-hidden="true"
                draggable={false}
                className={`button event-button ${flight.tone} alliance-drag-overlay`}
                style={{ touchAction: "none", pointerEvents: "none" }}
              >
                <h4>{label(flight.team)}</h4>
              </button>
            )),
            ...(ghostTeam
              ? [
                  <button
                    key={overlayKey}
                    ref={overlayRef}
                    type="button"
                    tabIndex={-1}
                    draggable={false}
                    className={`button event-button ${dragTone} alliance-drag-overlay`}
                    // while the overlay carries a dropped chip to its box it is the chip, so it can be grabbed again mid-flight.
                    // During a drag it must ignore the pointer so the box underneath can be found.
                    style={{
                      touchAction: "auto",
                      pointerEvents: dragTeam ? undefined : "auto",
                    }}
                    onPointerDown={(event) =>
                      handlePointerDown(event, ghostTeam)
                    }
                    onDragStart={(event) => event.preventDefault()}
                  >
                    <h4>{label(ghostTeam)}</h4>
                  </button>,
                ]
              : []),
          ]}
        </>
      ) : (
        <FetchingDataText />
      )}
    </div>
  );
}, pagePropsEqual);
