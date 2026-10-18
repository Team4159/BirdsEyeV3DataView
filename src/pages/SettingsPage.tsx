import { useState } from "react";

type SettingsPageProps = {
  aggregateEvents: string[];
  eventChoices: string[];
  displayEvents: string[];
  toggleAggregateEvent: (event: string) => void;
  toggleDisplayEvent: (event: string) => void;
  toggleAllAggregateEvents: () => void;
  toggleAllUndisplayedAggregateEvents: () => void;
  toggleAllDisplayEvents: () => void;
};

export function SettingsPage({
  aggregateEvents,
  eventChoices,
  displayEvents,
  toggleAggregateEvent,
  toggleDisplayEvent,
  toggleAllAggregateEvents,
  toggleAllUndisplayedAggregateEvents,
  toggleAllDisplayEvents,
}: SettingsPageProps) {
  const [searchValue, setSearchValue] = useState("");
  const [displaySearchValue, setDisplaySearchValue] = useState("");
  return (
    <div>
      <div className="card">
        <div className="card-title-row">
          <h1>Aggregate Events</h1>
          <div className="card-button-container">
            <button
              type="button"
              disabled={eventChoices.length === 0}
              onClick={toggleAllAggregateEvents}
            >
              {aggregateEvents.length === eventChoices.length
                ? "Clear All"
                : "Select All"}
            </button>
            <button
              type="button"
              disabled={
                eventChoices.length === 0 ||
                aggregateEvents.length === displayEvents.length
              }
              onClick={toggleAllUndisplayedAggregateEvents}
            >
              Clear Not Displayed
            </button>
          </div>
        </div>

        <input
          id="aggregate-events-search"
          placeholder="Search"
          value={searchValue}
          onChange={(input) => setSearchValue(input.target.value)}
        ></input>

        <div className="grid-container scrollable-container">
          {eventChoices.map((event) => {
            if (!event.toLowerCase().includes(searchValue.toLowerCase())) {
              return null;
            }
            const className = `button event-button ${aggregateEvents.includes(event) ? "yes" : "no"}`;
            return (
              <button
                type="button"
                key={event}
                className={className}
                onClick={() => toggleAggregateEvent(event)}
              >
                <h4>{event}</h4>
              </button>
            );
          })}
        </div>
      </div>

      <div className="card">
        <div className="card-title-row">
          <h1>Display Events</h1>
          <button
            type="button"
            disabled={aggregateEvents.length === 0}
            onClick={toggleAllDisplayEvents}
          >
            {displayEvents.length === aggregateEvents.length
              ? "Clear All"
              : "Select All"}
          </button>
        </div>

        {aggregateEvents.length > 0 && (
          <input
            id="display-events-search"
            placeholder="Search"
            value={displaySearchValue}
            onChange={(input) => setDisplaySearchValue(input.target.value)}
          ></input>
        )}

        {aggregateEvents.length === 0 ? (
          <p>
            No aggregate events selected. Choose events under Aggregate Events.
          </p>
        ) : (
          displayEvents.length === 0 && (
            <p>No events selected. No teams will be displayed.</p>
          )
        )}

        <div className="grid-container scrollable-container">
          {aggregateEvents
            .filter((event) =>
              event.toLowerCase().includes(displaySearchValue.toLowerCase()),
            )
            .map((event) => {
              const className = `button event-button ${displayEvents.includes(event) ? "yes" : "no"}`;
              return (
                <button
                  type="button"
                  key={event}
                  className={className}
                  onClick={() => toggleDisplayEvent(event)}
                >
                  <h4>{event}</h4>
                </button>
              );
            })}
        </div>
      </div>
    </div>
  );
}
