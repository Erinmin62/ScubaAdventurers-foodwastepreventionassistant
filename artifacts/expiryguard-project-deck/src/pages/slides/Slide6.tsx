export default function Slide6() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg text-text">
      <section className="px-[6vw] pt-[8vh]">
        <p className="mb-[2vh] text-[1.6vw] font-bold uppercase tracking-[0.12em] text-accent">AI, with a clear boundary</p>
        <h1 className="max-w-[85vw] font-display text-[4.2vw] font-bold leading-[1.02]">Live planning is rules-based; AI has a separate, limited role.</h1>
        <div className="mt-[7vh] grid grid-cols-2 gap-[2vw]">
          <article className="bg-primary px-[3vw] py-[3.2vh] text-bg">
            <p className="text-[1.55vw] font-bold uppercase tracking-[0.12em] text-pale">Live planning · rules-based</p>
            <p className="mt-[2vh] font-display text-[2.6vw] font-bold leading-[1.08]">Seven-day sales + stock</p>
            <p className="mt-[2.7vh] max-w-[37vw] text-[2vw] leading-[1.22]">Weekday adjustment; preparation capped by usable recipe stock.</p>
          </article>
          <article className="bg-pale px-[3vw] py-[3.2vh]">
            <p className="text-[1.55vw] font-bold uppercase tracking-[0.12em] text-accent">AI · owner-reviewed drafts + separate forecasts</p>
            <p className="mt-[2vh] font-display text-[2.6vw] font-bold leading-[1.08]">AI recipe drafts + experiments</p>
            <p className="mt-[2.7vh] max-w-[37vw] text-[2vw] leading-[1.22]">Recipe rows need review. Forecasts: synthetic history or consented archived sales/prep.</p>
          </article>
        </div>
        <div className="mt-[4vh] flex items-center justify-between border-t border-ink/15 pt-[2.5vh]">
          <p className="text-[2vw] font-semibold">Owner-history excludes stock/current data; requires scope preview + one-request consent.</p>
          <p className="text-[2vw] font-bold text-primary">Forecasts are temporary, advisory, unvalidated; no live changes. Local checks stay in the workspace.</p>
        </div>
      </section>
    </div>
  );
}