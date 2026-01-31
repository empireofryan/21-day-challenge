const NEIGHBORHOODS = ["All", "LoDo", "LoHi"];

const DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

function todayName() {
  return DAYS[new Date().getDay()];
}

export default function FilterBar({
  neighborhood,
  setNeighborhood,
  day,
  setDay,
  search,
  setSearch,
}) {
  const today = todayName();

  return (
    <div className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-gray-200 shadow-sm">
      <div className="max-w-6xl mx-auto px-4 py-4 flex flex-col sm:flex-row sm:items-center gap-4">
        {/* Neighborhood pills */}
        <div className="flex gap-2">
          {NEIGHBORHOODS.map((n) => (
            <button
              key={n}
              onClick={() => setNeighborhood(n)}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors cursor-pointer ${
                neighborhood === n
                  ? "bg-orange-500 text-white shadow-md"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {n}
            </button>
          ))}
        </div>

        {/* Day of week dropdown */}
        <select
          value={day}
          onChange={(e) => setDay(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-400"
        >
          <option value="All">Any Day</option>
          {DAYS.map((d) => (
            <option key={d} value={d}>
              {d}
              {d === today ? " (today)" : ""}
            </option>
          ))}
        </select>

        {/* Search input */}
        <div className="flex-1 min-w-0">
          <input
            type="text"
            placeholder="Search venues..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-4 py-1.5 text-sm bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
        </div>
      </div>
    </div>
  );
}
