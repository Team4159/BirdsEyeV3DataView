import { useDrawingArea, useYScale } from "@mui/x-charts/hooks";
import {
  LineChart,
  LineHighlightElement,
  type LineHighlightElementProps,
} from "@mui/x-charts/LineChart";
import type { ComponentPropsWithoutRef } from "react";
import {
  createContext,
  useContext,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { FrcTeam } from "../util/FrcTeam";
import { formatMatchLabel, formatShortMatchLabel } from "../util/matchNameUtil";
import {
  autoClimbBorderColor,
  autoFuelBorderColor,
  driverRatingBorderColor,
  foulBorderColor,
  techFoulBorderColor,
  teleopFuelBorderColor,
  totalPointsBorderColor,
} from "./colorConstants";

type MatchLineGraphProps = {
  team: FrcTeam;
  seriesType: SeriesType;
};

type ScoreSeriesId =
  | "total"
  | "auto"
  | "teleop"
  | "climb"
  | "driverRating"
  | "fouls"
  | "majorFouls";

type EventBand = {
  event: string;
  start: number;
  end: number;
};

type EventBandContextValue = {
  bands: EventBand[];
  matchCount: number;
  backgroundSeriesId: ScoreSeriesId | null;
};

const areaColors: Record<Exclude<ScoreSeriesId, "driverRating">, string> = {
  total: totalPointsBorderColor,
  auto: autoFuelBorderColor,
  teleop: teleopFuelBorderColor,
  climb: autoClimbBorderColor,
  fouls: foulBorderColor,
  majorFouls: techFoulBorderColor,
};

const seriesLayer: Record<ScoreSeriesId, number> = {
  driverRating: 7,
  total: 6,
  auto: 5,
  teleop: 4,
  climb: 3,
  fouls: 2,
  majorFouls: 1,
};

const EVENT_BAND_COLORS = [
  "rgba(54, 162, 235, 0.14)",
  "rgba(255, 206, 86, 0.14)",
  "rgba(75, 192, 192, 0.14)",
  "rgba(153, 102, 255, 0.14)",
  "rgba(255, 159, 64, 0.14)",
];
const DRIVER_RATING_AXIS_MAXIMUM = 5.5;

type ScoreSeriesItem = {
  readonly id: ScoreSeriesId;
  readonly label: string;
  readonly color: string;
};

const SCORE_SERIES = [
  { id: "total", label: "Total", color: totalPointsBorderColor },
  { id: "auto", label: "Auto", color: autoFuelBorderColor },
  { id: "teleop", label: "Teleop", color: teleopFuelBorderColor },
  { id: "climb", label: "Climb", color: autoClimbBorderColor },
  {
    id: "driverRating",
    label: "Driver Rating",
    color: driverRatingBorderColor,
  },
  { id: "fouls", label: "Fouls", color: foulBorderColor },
  { id: "majorFouls", label: "Major Fouls", color: techFoulBorderColor },
] as const satisfies ReadonlyArray<ScoreSeriesItem>;

type GradientAreaProps = ComponentPropsWithoutRef<"path"> & {
  d: string;
  ownerState: {
    seriesId: string | number;
  };
  skipAnimation?: boolean;
};

type AreaGradientHalf = {
  id: "positive" | "negative";
  clipY: number;
  clipHeight: number;
  gradientStartY: number;
  gradientEndY: number;
  startOpacity: number;
  endOpacity: number;
};

function NoDataOverlay(
  props: ComponentPropsWithoutRef<"text"> & { sx?: unknown },
) {
  const drawingArea = useDrawingArea();
  const { sx: _sx, ...textProps } = props;
  return (
    <text
      {...textProps}
      x={drawingArea.left + drawingArea.width / 2}
      y={drawingArea.top + drawingArea.height / 2}
      textAnchor="middle"
      fill="var(--text)"
      fontStyle="italic"
    >
      No data to display
    </text>
  );
}

const EventBandContext = createContext<EventBandContextValue>({
  bands: [],
  matchCount: 0,
  backgroundSeriesId: null,
});

function getBandPosition(position: number, matchCount: number): number {
  if (matchCount === 1) {
    return position === 0 ? 0 : 1;
  }

  return position / (matchCount - 1);
}

function getBandBounds(
  band: EventBand,
  matchCount: number,
): { start: number; end: number } {
  const start = getBandPosition(
    band.start === 0 ? 0 : band.start - 0.5,
    matchCount,
  );
  const end = getBandPosition(
    matchCount === 1
      ? 1
      : band.end === matchCount
        ? matchCount - 1
        : band.end - 0.5,
    matchCount,
  );

  return { start, end };
}

function getChartData<T>(
  matches: Match[],
  isSingleMatch: boolean,
  getValue: (match: Match) => T,
): T[] {
  return isSingleMatch
    ? [getValue(matches[0]), getValue(matches[0]), getValue(matches[0])]
    : matches.map(getValue);
}

type Match = ReturnType<FrcTeam["getMatches"]>[number];

type SeriesType = "points" | "fouls";

function getSeriesData<T>(
  matches: Match[],
  isSingleMatch: boolean,
  hiddenSeries: Set<ScoreSeriesId>,
  seriesId: ScoreSeriesId,
  getValue: (match: Match) => T,
): Array<T | null> {
  return getChartData(
    matches,
    isSingleMatch,
    hiddenSeries.has(seriesId) ? () => null : getValue,
  );
}

function createChartSeries(
  matches: Match[],
  isSingleMatch: boolean,
  hiddenSeries: Set<ScoreSeriesId>,
  seriesType: SeriesType,
) {
  const round = (value: number) => Math.round(value * 100) / 100;
  const series = (() => {
    switch (seriesType) {
      case "points":
        return [
          [
            "climb" as ScoreSeriesId,
            "Climb",
            autoClimbBorderColor,
            (match: Match) => round(match.getClimbPoints()),
          ],
          [
            "teleop" as ScoreSeriesId,
            "Teleop",
            teleopFuelBorderColor,
            (match: Match) => round(match.getTeleopPoints()),
          ],
          [
            "auto" as ScoreSeriesId,
            "Auto",
            autoFuelBorderColor,
            (match: Match) => round(match.getAutoPoints()),
          ],
          [
            "total" as ScoreSeriesId,
            "Total",
            totalPointsBorderColor,
            (match: Match) => round(match.getPointsNoFouls()),
          ],
          [
            "driverRating" as ScoreSeriesId,
            "Driver Rating",
            driverRatingBorderColor,
            (match: Match) => round(match.getDriverRating()),
          ],
        ] as const satisfies ReadonlyArray<
          [ScoreSeriesId, string, string, (match: Match) => number]
        >;
      case "fouls":
        return [
          [
            "majorFouls" as ScoreSeriesId,
            "Major Fouls",
            techFoulBorderColor,
            (match: Match) => round(match.getTechFouls()),
          ],
          [
            "fouls" as ScoreSeriesId,
            "Fouls",
            foulBorderColor,
            (match: Match) => match.getFouls(),
          ],
          [
            "driverRating" as ScoreSeriesId,
            "Driver Rating",
            driverRatingBorderColor,
            (match: Match) => round(match.getDriverRating()),
          ],
        ] as const satisfies ReadonlyArray<
          [ScoreSeriesId, string, string, (match: Match) => number]
        >;
    }
  })();

  return series.map(([id, label, color, getValue]) => ({
    id,
    ...(id === "driverRating" ? { yAxisId: "driverRating" } : {}),
    data: getSeriesData(matches, isSingleMatch, hiddenSeries, id, getValue),
    label,
    color,
    area: true,
    showMark: false,
  }));
}

function getScoreSeries(seriesType: SeriesType): ScoreSeriesItem[] {
  switch (seriesType) {
    case "points":
      return [
        SCORE_SERIES.find((series) => series.id === "total"),
        SCORE_SERIES.find((series) => series.id === "auto"),
        SCORE_SERIES.find((series) => series.id === "teleop"),
        SCORE_SERIES.find((series) => series.id === "climb"),
        SCORE_SERIES.find((series) => series.id === "driverRating"),
      ] as ScoreSeriesItem[];
    case "fouls":
      return [
        SCORE_SERIES.find((series) => series.id === "fouls"),
        SCORE_SERIES.find((series) => series.id === "majorFouls"),
        SCORE_SERIES.find((series) => series.id === "driverRating"),
      ] as ScoreSeriesItem[];
  }
}
function getPointAxisConfig(scoreValues: number[]) {
  const scoreMinimum = Math.min(...scoreValues);
  const scoreMaximum = Math.max(...scoreValues);
  const axisMinimum = scoreMinimum < 0 ? scoreMinimum : 0;
  const rawTickStep = Math.max(1, (scoreMaximum - axisMinimum) / 5);
  const tickMagnitude = 10 ** Math.floor(Math.log10(rawTickStep));
  const normalizedTickStep = rawTickStep / tickMagnitude;
  const tickStep =
    (normalizedTickStep <= 1
      ? 1
      : normalizedTickStep <= 2
        ? 2
        : normalizedTickStep <= 5
          ? 5
          : 10) * tickMagnitude;
  const tickInterval = Math.max(5, tickStep);
  const minimum = Math.floor(axisMinimum / tickInterval) * tickInterval;
  const maximum = Math.max(
    Math.ceil(scoreMaximum / tickStep) * tickStep,
    minimum + tickInterval,
  );
  const tickCount = Math.max(
    2,
    Math.floor((maximum - minimum) / tickInterval) + 1,
  );
  const ticks = Array.from(
    { length: tickCount },
    (_, index) => minimum + ((maximum - minimum) * index) / (tickCount - 1),
  );

  return {
    min: minimum,
    max: minimum + (maximum - minimum) * (DRIVER_RATING_AXIS_MAXIMUM / 5),
    ticks,
  };
}

function GradientArea({
  d,
  ownerState,
  skipAnimation,
  ...pathProps
}: GradientAreaProps) {
  const drawingArea = useDrawingArea();
  const yScale = useYScale();
  const gradientInstanceId = useId();
  const { bands, matchCount, backgroundSeriesId } =
    useContext(EventBandContext);
  const seriesId = String(ownerState.seriesId) as ScoreSeriesId;
  const gradientId = `match-score-gradient-${seriesId}-${gradientInstanceId}`;
  const color =
    seriesId === "driverRating" ? "var(--text)" : areaColors[seriesId];
  const chartBottom = drawingArea.top + drawingArea.height;
  const baselineY = Math.min(
    chartBottom,
    Math.max(drawingArea.top, yScale?.(0) ?? chartBottom),
  );
  const gradientHalves: AreaGradientHalf[] = [
    {
      id: "positive",
      clipY: drawingArea.top,
      clipHeight: baselineY - drawingArea.top,
      gradientStartY: drawingArea.top,
      gradientEndY: baselineY,
      startOpacity: 0.55,
      endOpacity: 0,
    },
    {
      id: "negative",
      clipY: baselineY,
      clipHeight: chartBottom - baselineY,
      gradientStartY: baselineY,
      gradientEndY: chartBottom,
      startOpacity: 0,
      endOpacity: 0.55,
    },
  ];

  return (
    <>
      {ownerState.seriesId === backgroundSeriesId &&
        bands.map((band, index) => (
          <EventBandOverlay
            key={band.event}
            band={band}
            index={index}
            matchCount={matchCount}
            drawingArea={drawingArea}
          />
        ))}
      {seriesId !== "driverRating" && (
        <>
          <defs>
            {gradientHalves.map((half) => (
              <clipPath key={half.id} id={`${gradientId}-${half.id}-clip`}>
                <rect
                  x={drawingArea.left}
                  y={half.clipY}
                  width={drawingArea.width}
                  height={half.clipHeight}
                />
              </clipPath>
            ))}
            {gradientHalves.map((half) => (
              <linearGradient
                key={half.id}
                id={`${gradientId}-${half.id}`}
                gradientUnits="userSpaceOnUse"
                x1="0"
                y1={half.gradientStartY}
                x2="0"
                y2={half.gradientEndY}
              >
                <stop
                  offset="0%"
                  stopColor={color}
                  stopOpacity={half.startOpacity}
                />
                <stop
                  offset="100%"
                  stopColor={color}
                  stopOpacity={half.endOpacity}
                />
              </linearGradient>
            ))}
          </defs>
          {gradientHalves.map((half) => (
            <g key={half.id} clipPath={`url(#${gradientId}-${half.id}-clip)`}>
              <path
                {...pathProps}
                d={d}
                data-series-id={seriesId}
                fill={`url(#${gradientId}-${half.id})`}
                stroke="none"
                style={{ zIndex: seriesLayer[seriesId] }}
              />
            </g>
          ))}
        </>
      )}
    </>
  );
}

function EventBandOverlay({
  band,
  index,
  matchCount,
  drawingArea,
}: {
  band: EventBand;
  index: number;
  matchCount: number;
  drawingArea: ReturnType<typeof useDrawingArea>;
}) {
  const { start, end } = getBandBounds(band, matchCount);
  const color = EVENT_BAND_COLORS[index % EVENT_BAND_COLORS.length];
  const center = (start + end) / 2;

  return (
    <g>
      <rect
        x={drawingArea.left + start * drawingArea.width}
        y={drawingArea.top}
        width={(end - start) * drawingArea.width}
        height={drawingArea.height}
        fill={color}
      />
      <text
        x={drawingArea.left + center * drawingArea.width}
        y={drawingArea.top + 16}
        textAnchor="middle"
        fill={color.replace("0.14", "0.8")}
        fontWeight={700}
        fontSize={12}
      >
        {band.event}
      </text>
    </g>
  );
}

function CenterLineHighlight(props: LineHighlightElementProps) {
  const drawingArea = useDrawingArea();
  const { backgroundSeriesId } = useContext(EventBandContext);
  const centerX = drawingArea.left + drawingArea.width / 2;
  return (
    <>
      {props.seriesId === backgroundSeriesId && (
        <path
          className="MuiChartsAxisHighlight-root"
          d={`M ${centerX} ${drawingArea.top} V ${drawingArea.top + drawingArea.height}`}
          pointerEvents="none"
          style={{ strokeDasharray: "5 2" }}
        />
      )}
      <LineHighlightElement {...props} x={centerX} />
    </>
  );
}

export function MatchLineGraph({ team, seriesType }: MatchLineGraphProps) {
  const scoreSeries = useMemo(() => getScoreSeries(seriesType), [seriesType]);
  const [hiddenSeries, setHiddenSeries] = useState<Set<ScoreSeriesId>>(
    new Set(),
  );
  const [chartWidth, setChartWidth] = useState(0);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const matches = team.getMatches();
  const isSingleMatch = matches.length === 1;
  useLayoutEffect(() => {
    const element = chartContainerRef.current;
    if (!element) {
      return;
    }

    const resizeObserver = new ResizeObserver((entries) => {
      setChartWidth(Math.floor(entries[0]?.contentRect.width ?? 0));
    });
    resizeObserver.observe(element);
    return () => resizeObserver.disconnect();
  }, []);

  const maxVisibleLabels = Math.max(3, Math.floor((chartWidth - 120) / 55));
  const labelInterval = Math.max(
    1,
    Math.ceil(matches.length / maxVisibleLabels),
  );
  const axisMargin = 16;
  const scoreValues = (() => {
    switch (seriesType) {
      case "points":
        return matches.flatMap((match) => [
          match.getPointsNoFouls(),
          match.getAutoPoints(),
          match.getTeleopPoints(),
          match.getClimbPoints(),
        ]);
      case "fouls":
        return matches.flatMap((match) => [
          match.getFouls(),
          match.getTechFouls(),
        ]);
    }
  })();
  const pointAxis = getPointAxisConfig(scoreValues);
  const visibleAreaSeries = getScoreSeries(seriesType)
    .filter(
      (series) => series.id !== "driverRating" && !hiddenSeries.has(series.id),
    )
    .map((series) => series.id);
  if (
    visibleAreaSeries.length === 0 &&
    !hiddenSeries.has("driverRating")
  ) {
    visibleAreaSeries.push("driverRating");
  }
  const backgroundSeriesId = visibleAreaSeries.at(-1) ?? null;
  const toggleSeries = (seriesId: ScoreSeriesId) => {
    setHiddenSeries((current) => {
      const next = new Set(current);
      if (next.has(seriesId)) {
        next.delete(seriesId);
      } else {
        next.add(seriesId);
      }
      return next;
    });
  };
  const eventBands = useMemo(
    () =>
      matches.reduce<EventBand[]>((bands, match, index) => {
        const event = match.getEvent();
        const previousBand = bands.at(-1);
        if (previousBand?.event === event) {
          previousBand.end = index + 1;
        } else {
          bands.push({ event, start: index, end: index + 1 });
        }
        return bands;
      }, []),
    [matches],
  );
  if (matches.length === 0) {
    return (
      <p style={{ color: "var(--text)", fontStyle: "italic" }}>
        No match data available for this team.
      </p>
    );
  }

  return (
    <div className="match-line-graph-container">
      <fieldset className="match-line-graph-legend">
        <legend className="visually-hidden">Score series</legend>
        {scoreSeries.map((series) => {
          const hidden = hiddenSeries.has(series.id);
          return (
            <button
              key={series.id}
              type="button"
              aria-pressed={!hidden}
              className={hidden ? "hidden" : undefined}
              onClick={() => toggleSeries(series.id)}
            >
              <span
                className="match-line-graph-legend-mark"
                style={{ backgroundColor: series.color }}
              />
              {series.label}
            </button>
          );
        })}
      </fieldset>
      <div
        ref={chartContainerRef}
        className="match-line-graph-chart"
        role="application"
      >
        <EventBandContext.Provider
          value={{
            bands: eventBands,
            matchCount: matches.length,
            backgroundSeriesId,
          }}
        >
          <LineChart
            hideLegend
            axisHighlight={{
              x:
                hiddenSeries.size === scoreSeries.length || isSingleMatch
                  ? "none"
                  : "line",
              y: "none",
            }}
            xAxis={[
              {
                scaleType: "point",
                data: isSingleMatch
                  ? [0, 1, 2]
                  : matches.map((match) => match.getMatchKey()),
                label: "Match",
                valueFormatter: (value, context) => {
                  const matchKey = isSingleMatch
                    ? matches[0].getMatchKey()
                    : String(value);
                  return context.location === "tooltip"
                    ? formatMatchLabel(matchKey)
                    : formatShortMatchLabel(matchKey);
                },
                tickLabelInterval: (_value, index) =>
                  isSingleMatch ? index === 1 : index % labelInterval === 0,
                tickLabelMinGap: 24,
              },
            ]}
            yAxis={
              seriesType === "points"
                ? [
                    {
                      label: "Points",
                      min: pointAxis.min,
                      max: pointAxis.max,
                      tickInterval: pointAxis.ticks,
                      domainLimit: "strict",
                    },
                    {
                      id: "driverRating",
                      label: "Driver Rating",
                      min: 0,
                      max: DRIVER_RATING_AXIS_MAXIMUM,
                      tickInterval: [0, 1, 2, 3, 4, 5],
                      domainLimit: "strict",
                      position: "right",
                    },
                  ]
                : [
                    {
                      label: "Fouls",
                      min: pointAxis.min,
                      max: pointAxis.max,
                      tickInterval: pointAxis.ticks,
                      domainLimit: "strict",
                    },
                    {
                      id: "driverRating",
                      label: "Driver Rating",
                      min: 0,
                      max: DRIVER_RATING_AXIS_MAXIMUM,
                      tickInterval: [0, 1, 2, 3, 4, 5],
                      domainLimit: "strict",
                      position: "right",
                    },
                  ]
            }
            series={createChartSeries(
              matches,
              isSingleMatch,
              hiddenSeries,
              seriesType,
            ).filter((series) => !hiddenSeries.has(series.id))}
            slots={{
              area: GradientArea,
              noDataOverlay: NoDataOverlay,
              ...(isSingleMatch ? { lineHighlight: CenterLineHighlight } : {}),
            }}
            slotProps={{
              axisLabel: {
                style: {
                  fontWeight: 400,
                },
              },
              tooltip: {
                trigger: "axis",
              },
            }}
            skipAnimation={true}
            height={400}
            margin={{
              left: axisMargin,
              right: axisMargin,
              top: 20,
              bottom: 60,
            }}
            sx={{
              width: "100%",
              minWidth: 0,
              color: "var(--text)",
              "&& .MuiChartsAxis-tickLabel": {
                color: "var(--text)",
                fill: "var(--text)",
                fontWeight: 400,
                fontStyle: "italic",
              },
              "&& .MuiChartsAxis-label": {
                color: "var(--text)",
                fill: "var(--text)",
              },
              "& .MuiChartsLegend-root, & .MuiChartsLegend-series": {
                color: "var(--text)",
              },
              "&& .MuiChartsAxis-line, && .MuiChartsAxis-tick, && .MuiChartsGrid-line":
                {
                  stroke: "var(--text)",
                },
              "&& .MuiChartsAxisHighlight-root": {
                stroke: "var(--text)",
              },
              "& .MuiChartsTooltip-table tbody": {
                display: "flex",
                flexDirection: "column-reverse",
              },
              "& .MuiLineElement-root": {
                strokeWidth: 3,
                "&[data-series-id='total']": { zIndex: seriesLayer.total },
                "&[data-series-id='auto']": { zIndex: seriesLayer.auto },
                "&[data-series-id='teleop']": { zIndex: seriesLayer.teleop },
                "&[data-series-id='climb']": { zIndex: seriesLayer.climb },
                "&[data-series-id='driverRating']": {
                  zIndex: seriesLayer.driverRating,
                },
                "&[data-series-id='fouls']": { zIndex: seriesLayer.fouls },
                "&[data-series-id='majorFouls']": {
                  zIndex: seriesLayer.majorFouls,
                },
              },
            }}
          />
        </EventBandContext.Provider>
      </div>
    </div>
  );
}
