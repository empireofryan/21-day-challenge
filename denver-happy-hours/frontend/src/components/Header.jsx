export default function Header() {
  return (
    <header className="bg-gradient-to-r from-amber-500 via-orange-500 to-sky-700 text-white py-8 px-4 shadow-lg">
      <div className="max-w-6xl mx-auto text-center">
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight drop-shadow-md">
          Denver Happy Hours
        </h1>
        <p className="mt-2 text-lg md:text-xl font-medium text-amber-100 tracking-wide">
          LoDo &amp; LoHi Neighborhoods
        </p>
      </div>
    </header>
  );
}
