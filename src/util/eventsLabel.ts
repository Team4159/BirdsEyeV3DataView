export function eventsLabel(
  eventChoices: string[],
  aggregateEvents: string[],
  displayEvents: string[],
): string {
  if (displayEvents.length === 0) {
    return "No events to display.";
  }
  const allAggregated =
    eventChoices.length > 0 && aggregateEvents.length > 1 && aggregateEvents.length === eventChoices.length;
  const allDisplayed =
    eventChoices.length > 0  && displayEvents.length === aggregateEvents.length;
  const aggregate = allAggregated
    ? "Aggregating all"
    : `Aggregating (${aggregateEvents.length}): ${aggregateEvents.length > 0 ? aggregateEvents.join(", ") : "None"}`;
  const display = allDisplayed
    ? "Displaying all aggregated"
    : `Displaying (${displayEvents.length}): ${displayEvents.join(", ")}`;
  return `${aggregate} | ${display}`;
}
