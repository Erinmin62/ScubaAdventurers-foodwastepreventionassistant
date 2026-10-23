const base = import.meta.env.BASE_URL;

export default function Slide1() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg text-text">
      <div className="absolute inset-y-0 right-0 w-[45vw]">
        <img src={base + "cover-kitchen.jpg"} crossOrigin="anonymous" alt="A food-business team preparing fresh ingredients for service" className="h-full w-full object-cover object-center" />
        <div className="absolute inset-0 bg-gradient-to-r from-bg/40 via-transparent to-transparent" aria-hidden="true" />
      </div>
      <div className="relative z-10 flex h-full w-[61vw] flex-col justify-between bg-bg px-[6vw] py-[8vh]">
        <svg viewBox="0 0 48 48" aria-hidden="true" className="h-[3.5vw] w-[3.5vw]">
          <rect x="2" y="2" width="44" height="44" rx="13" fill="#2D7057" />
          <path d="M11 29C10 15 22 10 37 10c0 16-8 26-22 24l14-16" fill="#E4F4CB" />
        </svg>
        <div className="max-w-[46vw]">
          <p className="mb-[2.5vh] text-[1.6vw] font-bold uppercase tracking-[0.12em] text-primary">Five-minute investor pitch</p>
          <h1 className="max-w-[45vw] font-display text-[6.1vw] font-bold leading-[0.96] text-text">ExpiryGuardAI</h1>
          <p className="mt-[3vh] max-w-[43vw] text-[2.45vw] font-semibold leading-[1.12] text-text">Less waste. Smarter prep. Owner-approved action.</p>
          <p className="mt-[2.4vh] max-w-[42vw] text-[2vw] leading-[1.3] text-muted">Food-waste planning for cafes, restaurants, food vendors, and cloud kitchens.</p>
        </div>
        <div className="flex items-center gap-[1vw]">
          <div className="h-[0.8vh] w-[8vw] bg-primary" aria-hidden="true" />
          <span className="text-[1.6vw] font-semibold text-muted">Demo-stage product · Pilot validation next</span>
        </div>
      </div>
    </div>
  );
}