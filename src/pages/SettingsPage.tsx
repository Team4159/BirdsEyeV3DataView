import { useState } from "react";

type SettingsPageProps = {
  events: string[];
  eventChoices: string[];
  toggleEvent: (event: string) => void;
};

export function SettingsPage({
  events,
  eventChoices,
  toggleEvent: toggleEvent,
}: SettingsPageProps) {
  const [searchValue, setSearchValue] = useState("");
  return (
    <div>
      <div className="card">
        <h1>Events</h1>

        <input
          placeholder="Search"
          value={searchValue}
          onChange={(input) => setSearchValue(input.target.value)}
        ></input>

        <div className="gridcontainer">
          {eventChoices.map((event) => {
            if (!event.toLowerCase().includes(searchValue.toLowerCase())) {
              return;
            }
            return (
              <button onClick={() => toggleEvent(event)}>
                <h4>{event}</h4>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
