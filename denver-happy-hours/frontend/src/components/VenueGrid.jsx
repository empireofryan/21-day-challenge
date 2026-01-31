import VenueCard from "./VenueCard";

export default function VenueGrid({ venues }) {
  return (
    <section className="max-w-6xl mx-auto px-4 py-8">
      {/* Results count */}
      <p className="text-sm text-gray-500 mb-4">
        Showing{" "}
        <span className="font-semibold text-gray-800">{venues.length}</span>{" "}
        {venues.length === 1 ? "venue" : "venues"}
      </p>

      {venues.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-xl font-semibold text-gray-400">
            No venues match your filters
          </p>
          <p className="mt-2 text-sm text-gray-400">
            Try adjusting the neighborhood, day, or search query.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {venues.map((venue) => (
            <VenueCard key={venue.id} venue={venue} />
          ))}
        </div>
      )}
    </section>
  );
}
