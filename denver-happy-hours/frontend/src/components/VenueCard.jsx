const BADGE_COLORS = {
  LoDo: "bg-blue-100 text-blue-800",
  LoHi: "bg-green-100 text-green-800",
};

export default function VenueCard({ venue }) {
  const hh = venue.happy_hour;
  const hasHappyHour = hh && Array.isArray(hh.days) && hh.days.length > 0;
  const badgeClass = BADGE_COLORS[venue.neighborhood] || "bg-gray-100 text-gray-700";

  return (
    <div className="bg-white rounded-2xl shadow-md hover:shadow-xl transition-shadow duration-300 p-6 flex flex-col gap-3 border border-gray-100">
      {/* Top row: name + badge */}
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-lg font-bold text-gray-900 leading-tight">
          {venue.website ? (
            <a
              href={venue.website}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-orange-600 transition-colors"
            >
              {venue.name}
            </a>
          ) : (
            venue.name
          )}
        </h3>
        <span
          className={`shrink-0 px-2.5 py-0.5 rounded-full text-xs font-semibold ${badgeClass}`}
        >
          {venue.neighborhood}
        </span>
      </div>

      {/* Address */}
      <p className="text-sm text-gray-500">{venue.address}</p>

      {/* Happy hour info */}
      {hasHappyHour ? (
        <div className="mt-1 space-y-2">
          {/* Time */}
          <div className="flex items-center gap-2 text-sm text-gray-700">
            <span className="font-medium text-orange-600">
              {hh.start_time} &ndash; {hh.end_time}
            </span>
          </div>

          {/* Days */}
          <div className="flex flex-wrap gap-1">
            {hh.days.map((d) => (
              <span
                key={d}
                className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 text-xs font-medium"
              >
                {d.slice(0, 3)}
              </span>
            ))}
          </div>

          {/* Drink deals */}
          {Array.isArray(hh.drink_deals) && hh.drink_deals.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                Drink Deals
              </p>
              <ul className="space-y-0.5">
                {hh.drink_deals.map((deal, i) => (
                  <li key={i} className="text-sm text-gray-700">
                    {deal}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Food deals */}
          {Array.isArray(hh.food_deals) && hh.food_deals.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                Food Deals
              </p>
              <ul className="space-y-0.5">
                {hh.food_deals.map((deal, i) => (
                  <li key={i} className="text-sm text-gray-700">
                    {deal}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : (
        <p className="text-sm italic text-gray-400 mt-1">
          Happy hour info unknown
        </p>
      )}
    </div>
  );
}
