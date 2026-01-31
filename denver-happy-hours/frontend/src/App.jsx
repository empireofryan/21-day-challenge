import { useState, useMemo } from "react";
import Header from "./components/Header";
import FilterBar from "./components/FilterBar";
import VenueGrid from "./components/VenueGrid";
import data from "./data/happy_hours.json";

function App() {
  const [neighborhood, setNeighborhood] = useState("All");
  const [day, setDay] = useState("All");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    return data.filter((venue) => {
      // Neighborhood filter
      if (neighborhood !== "All" && venue.neighborhood !== neighborhood) {
        return false;
      }

      // Day filter
      if (day !== "All") {
        const hh = venue.happy_hour;
        if (!hh || !Array.isArray(hh.days) || !hh.days.includes(day)) {
          return false;
        }
      }

      // Search filter (case-insensitive on venue name)
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        if (!venue.name.toLowerCase().includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [neighborhood, day, search]);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <Header />
      <FilterBar
        neighborhood={neighborhood}
        setNeighborhood={setNeighborhood}
        day={day}
        setDay={setDay}
        search={search}
        setSearch={setSearch}
      />
      <VenueGrid venues={filtered} />
    </div>
  );
}

export default App;
