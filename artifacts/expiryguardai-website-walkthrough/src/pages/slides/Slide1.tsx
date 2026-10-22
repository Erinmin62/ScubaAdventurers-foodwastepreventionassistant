const base = import.meta.env.BASE_URL;

export default function Slide1() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg text-text">
      <div className="absolute inset-y-0 right-0 w-[53vw]">
        <img
          src={base + "cover-kitchen.jpg"}
          crossOrigin="anonymous"
          alt="A small food-business kitchen preparing fresh ingredients for service"
          className="h-full w-full object-cover object-center"
        />
      </div>
      <div className="relative z-10 flex h-full w-[56vw] flex-col justify-between bg-bg px-[5.5vw] py-[8vh]">
        <svg viewBox="0 0 48 48" aria-hidden="true" className="h-[4vw] w-[4vw]">
          <rect x="2" y="2" width="44" height="44" rx="13" fill="#2D7057" />
          <path d="M11 29C10 15 22 10 37 10c0 16-8 26-22 24l14-16" fill="#E4F4CB" />
        </svg>
        <div className="max-w-[44vw]">
          <h1 className="font-display text-[4.8vw] font-extrabold leading-[0.98] tracking-[-0.05em] text-text">
            ExpiryGuardAI: a guided website tour
          </h1>
          <p className="mt-[3vh] max-w-[43vw] text-[2.2vw] font-semibold leading-[1.2] text-text">
            A six-minute walkthrough of the main buttons and how they fit together.
          </p>
          <p className="mt-[2.2vh] max-w-[42vw] text-[1.8vw] leading-[1.35] text-muted">
            For cafes, restaurants, food vendors, and cloud kitchens.
          </p>
        </div>
        <div className="h-[0.7vh] w-[12vw] bg-primary" aria-hidden="true" />
      </div>
    </div>
  );
}
