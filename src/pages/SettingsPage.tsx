import { useState } from "react";

type SettingsPageProps = {
  eventsChosen: string[];
  eventChoices: string[];
  toggleEvent: (event: string) => void;
};

export function SettingsPage({
  eventsChosen: events,
  eventChoices,
  toggleEvent: toggleEvent,
}: SettingsPageProps) {
  const [searchValue, setSearchValue] = useState("");
  return (
    <div>
      <div className="card">
        <h1>Choose Events</h1>

        <input
          placeholder="Search"
          value={searchValue}
          onChange={(input) => setSearchValue(input.target.value)}
        ></input>

        <div className="grid-container">
          {eventChoices.map((event) => {
            if (!event.toLowerCase().includes(searchValue.toLowerCase())) {
              return;
            }
            const className = `button event-button ${events.includes(event) ? "yes" : "no"}`
            return (
              <button className={className} onClick={() => toggleEvent(event)}>
                <h4>{event}</h4>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
