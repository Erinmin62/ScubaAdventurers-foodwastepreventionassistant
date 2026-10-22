const base = import.meta.env.BASE_URL;

export default function Slide2() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg text-text">
      <div className="absolute inset-y-0 right-0 w-[43vw]">
        <img src={base + "prep-counter.jpg"} crossOrigin="anonymous" alt="Fresh ingredients organized on a small-business prep counter" className="h-full w-full object-cover object-center" />
      </div>
      <section className="relative z-10 flex h-full w-[61vw] flex-col bg-bg px-[5.5vw] py-[8vh] pr-[4vw]">
        <h1 className="max-w-[54vw] font-display text-[4vw] font-bold leading-[1.02] tracking-[-0.045em] text-text">Food businesses make perishable-stock decisions every day</h1>
        <div className="mt-[6vh] max-w-[51vw] space-y-[4.3vh]">
          <div className="flex items-start gap-[1.2vw]"><span className="mt-[1.1vh] h-[0.8vw] w-[0.8vw] shrink-0 rounded-full bg-primary" aria-hidden="true" /><p className="text-[2.1vw] leading-[1.2]">Stock, expiry dates, sales and prep need to be considered together</p></div>
          <div className="flex items-start gap-[1.2vw]"><span className="mt-[1.1vh] h-[0.8vw] w-[0.8vw] shrink-0 rounded-full bg-accent" aria-hidden="true" /><p className="text-[2.1vw] leading-[1.2]">Leftovers show where plans and actual demand diverged</p></div>
          <div className="flex items-start gap-[1.2vw]"><span className="mt-[1.1vh] h-[0.8vw] w-[0.8vw] shrink-0 rounded-full bg-primary" aria-hidden="true" /><p className="text-[2.1vw] leading-[1.2]">Owners need clear next steps without losing control of decisions</p></div>
        </div>
      </section>
    </div>
  );
}