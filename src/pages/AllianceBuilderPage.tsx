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

// where a chip was painted (transforms included) just before a state change, and whether one of our slides was running
type ChipSnapshot = { box: Box; moving: boolean };

// a dropped chip: the overlay's painted box in viewport coordinates, from which the overlay flies to the chip's new box
type Landing = { team: string; from: Box; pulse: boolean };

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
  return getColor(value, range, false);
}

// slots are neighbors when they touch, including diagonally, like adjacent cells in minesweeper
function isNeighborSlot(a: number, b: number) {
  const columns = PICK_COLUMNS.length;
  return (
    Math.abs(Math.floor(a / columns) - Math.floor(b / columns)) <= 1 &&
    Math.abs((a % columns) - (b % columns)) <= 1
  );
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
  // the team whose overlay is still flying to its box after a drop; its real chip stays hidden until it lands
  const [landingTeam, setLandingTeam] = useState<string | null>(null);
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
  // resting chip boxes (no transforms) from the last animated commit, relative to the card
  const boxes = useRef(new Map<string, Box>());
  // painted chip boxes taken right before a state change; its presence is what makes the next commit animate
  const pendingMotion = useRef<Map<string, ChipSnapshot> | null>(null);
  // the slides this component started on chips, so CSS transitions and fades are never mistaken for them
  const ownMotions = useRef(new WeakSet<Animation>());
  // the overlay's flight to its box after a drop, and the listeners that cut it short if the page moves under it
  const landingAnim = useRef<Animation | null>(null);
  const landingCleanup = useRef<(() => void) | null>(null);
  // set by a drop and consumed by the next commit, which starts the overlay's flight
  const landing = useRef<Landing | null>(null);
  // how the next commit moves chips: reset and auto fill fade every chip, reorder flies them
  const motionMode = useRef<"fly" | "fade">("fly");
  // set when a drop swaps two slotted teams in neighboring slots, so both fly even if they change rows
  const swapCommit = useRef(false);

  const names = useMemo(() => teams.map((team) => team.getTeamName()), [teams]);
  // averages are computed once per teams change, not on every render or hover
  const teamAverages = useMemo(
    () =>
      new Map(
        teams.map((team) => [
          team.getTeamName(),
          {
            total: team.getAvgPoints(),
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
  const label = (name: string) =>
    `${name.substring(3)} (#${rankByName.get(name)})`;
  const pool = fullOrder(board.order, names).filter(
    (name) => !board.slots.includes(name),
  );
  // the one overlay serves the held chip, then the same element carries it to its box, so it is never torn down mid-flight
  const ghostTeam = dragTeam ?? landingTeam;

  useEffect(
    () => () => {
      stopDrag.current?.();
      landingAnim.current?.cancel();
      landingCleanup.current?.();
    },
    [],
  );

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
    landingCleanup.current?.();
    landingCleanup.current = null;
    setLandingTeam(null);
  }

  // stops a flight in progress. Used where the overlay is about to be reused or the board is about to change, inside a discrete
  // event, so React commits before the next paint and the cancelled overlay is never shown.
  function endLanding() {
    const animation = landingAnim.current;
    settleLanding();
    animation?.cancel();
  }

  // flies the overlay from where it was released to the dropped chip's resting box. The overlay is position: fixed, so no card
  // clipping or z-index juggling is involved, and the real chip appears only once the overlay has arrived and is removed.
  function startLanding(landed: Landing, rest: Box, origin: DOMRect) {
    const overlay = overlayRef.current;
    if (!overlay) {
      return false;
    }
    const left = origin.left + rest.left;
    const top = origin.top + rest.top;
    const { from } = landed;
    const frame = (box: Box, scale: number): Keyframe => ({
      transform: `translate(${box.left}px, ${box.top}px) scale(${scale})`,
      width: `${box.width}px`,
      height: `${box.height}px`,
    });
    const end: Box = { left, top, width: rest.width, height: rest.height };
    // a drop onto an alliance box shrinks the chip, overshoots, then settles at its normal size
    const keyframes: Keyframe[] = landed.pulse
      ? [
          { ...frame(from, 1), offset: 0 },
          { ...frame(end, 0.9), offset: 0.5 },
          { ...frame(end, 1.03), offset: 0.75 },
          { ...frame(end, 1), offset: 1 },
        ]
      : [frame(from, 1), frame(end, 1)];
    const distance = Math.hypot(left - from.left, top - from.top);
    const animation = overlay.animate(keyframes, {
      duration: Math.min(MAX_MOVE_MS, MOVE_MS + distance * MS_PER_PX),
      easing: "cubic-bezier(0.2, 0, 0, 1)",
      // holds the last frame until React swaps the overlay for the real chip, so it never snaps back to the release point
      fill: "forwards",
    });
    landingAnim.current = animation;
    const done = () => {
      // a flight that was cancelled or replaced has already been settled
      if (landingAnim.current === animation) {
        settleLanding();
      }
    };
    animation.finished.then(done, done);
    // the overlay flies to a viewport position computed now, so scrolling or resizing would leave it aiming at the wrong place;
    // the chip simply appears in its box instead
    window.addEventListener("scroll", settleLanding, {
      capture: true,
      passive: true,
    });
    window.addEventListener("resize", settleLanding);
    landingCleanup.current = () => {
      window.removeEventListener("scroll", settleLanding, { capture: true });
      window.removeEventListener("resize", settleLanding);
    };
    return true;
  }

  // slides each chip from where it was painted before the change to its new box, and starts a dropped chip's overlay flight.
  // Only commits that were preceded by snapshotChips() or a drop animate; hover and tone re-renders leave running animations alone.
  useLayoutEffect(() => {
    const snapshot = pendingMotion.current;
    const landed = landing.current;
    if (!snapshot && !landed) {
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
        landingStarted = !reduceMotion && startLanding(landed, now, origin);
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
      if (fadeAll || (wrapped && !swapping)) {
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
    // the gap the pointer is in, counted on the layout as it is on screen, where a held pool chip still has its hidden place
    let gap = 0;
    for (const rect of rects) {
      const before =
        y > rect.bottom || (y >= rect.top && x > rect.left + rect.width / 2);
      if (!before) {
        break;
      }
      gap++;
    }
    const held = chips.findIndex((chip) => chip.dataset.team === team);
    if (held === -1 || held >= gap) {
      // nothing before the gap moves when the team is inserted
      return gap;
    }
    // the held chip sits before the gap, so everything after it moves up one place once it leaves. The same gap can mean the
    // end of one row or the front of the next; a pointer on the lower row means that row's first place, which is index gap
    // (index gap - 1 would put the chip at the end of the row above).
    const next = rects[gap];
    const previous = rects[gap - 1];
    const startsRow = !!next && next.top - previous.top > previous.height / 2;
    const onLowerRow = startsRow && y >= (previous.bottom + next.top) / 2;
    return onLowerRow ? gap : gap - 1;
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

  // only the finger that started the drag is tracked; a second finger must not take over its id
  function trackTouch(event: { changedTouches: ArrayLike<{ identifier: number }> }) {
    if (dragRef.current && dragTouch.current === null) {
      dragTouch.current = event.changedTouches[0]?.identifier ?? null;
    }
  }

  function startDrag(
    event: ReactPointerEvent<HTMLButtonElement>,
    team: string,
  ) {
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
    // a drag whose pointerup was lost must not leak its listeners into this one
    stopDrag.current?.();
    // a chip still landing from the previous drop is shown at its box so the overlay can be reused
    endLanding();
    // clear any text selection so the browser doesn't start a native drag of it
    window.getSelection()?.removeAllRanges();
    const pointerId = event.pointerId;
    // capture on the card: a chip moved between the pool and a slot is remounted, which can drop touch events aimed at it
    cardRef.current?.setPointerCapture(pointerId);
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
    const onMove = (move: PointerEvent) => {
      if (move.pointerId !== pointerId) {
        return;
      }
      // a mouse button released outside the window, or swallowed by a context menu, never sends pointerup
      if (move.pointerType === "mouse" && move.buttons === 0) {
        onUp(move);
        return;
      }
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
      } else {
        drag.tw = drag.baseW;
        drag.th = drag.baseH;
        const tone = fromSlot ? "yes" : "no";
        drag.tone = tone;
        setDragTone(tone);
      }
      setOverPool(key === "pool");
      // index -1 previews a slotted team leaving its alliance, whether it's over the pool or over no box
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

    const onTouchMove = (move: TouchEvent) => {
      for (const touch of Array.from(move.changedTouches)) {
        if (touch.identifier === dragTouch.current) {
          move.preventDefault();
          return;
        }
      }
    };

    // stops the browser from starting a text selection or a native drag while the chip is held
    const blockDefault = (blocked: Event) => blocked.preventDefault();

    const stop = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onPointerCancel);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("blur", onAbort);
      window.removeEventListener("contextmenu", blockDefault);
      window.removeEventListener("dragstart", blockDefault);
      window.removeEventListener("selectstart", blockDefault);
      const card = cardRef.current;
      if (card?.hasPointerCapture(pointerId)) {
        card.releasePointerCapture(pointerId);
      }
      dragTouch.current = null;
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
  }

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

  // the held (or still landing) chip stays in layout, hidden, so the grid doesn't jump and the overlay is the only thing visible
  const chip = (team: string, tone: "yes" | "no") => (
    <button
      key={team}
      type="button"
      data-team={team}
      draggable={false}
      className={`button event-button ${tone} alliance-chip`}
      style={{ visibility: ghostTeam === team ? "hidden" : "visible" }}
      onPointerDown={(event) => startDrag(event, team)}
      onDragStart={(event) => event.preventDefault()}
      onTouchStart={trackTouch}
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
              endLanding();
              snapshotChips();
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
              endLanding();
              snapshotChips();
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
                    style={{ color: statColor(stats.climb, statRanges.climb) }}
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

      {ghostTeam && (
        <button
          ref={overlayRef}
          type="button"
          tabIndex={-1}
          aria-hidden="true"
          draggable={false}
          className={`button event-button ${dragTone} alliance-drag-overlay`}
          // while the overlay carries a dropped chip to its box it is the chip, so it can be grabbed again mid-flight.
          // During a drag it must ignore the pointer so the box underneath can be found.
          style={{
            touchAction: "none",
            pointerEvents: dragTeam ? undefined : "auto",
          }}
          onPointerDown={(event) => startDrag(event, ghostTeam)}
          onDragStart={(event) => event.preventDefault()}
          onTouchStart={trackTouch}
        >
          <h4>{label(ghostTeam)}</h4>
        </button>
      )}
    </div>
  );
}
