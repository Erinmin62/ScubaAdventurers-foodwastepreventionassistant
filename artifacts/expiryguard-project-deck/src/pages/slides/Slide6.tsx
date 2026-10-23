export default function Slide6() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg text-text">
      <section className="px-[6vw] pt-[8vh]">
        <p className="mb-[2vh] text-[1.6vw] font-bold uppercase tracking-[0.12em] text-accent">AI, with a clear boundary</p>
        <h1 className="max-w-[85vw] font-display text-[4.2vw] font-bold leading-[1.02]">Live demand is rules-based; AI forecasting is experimental.</h1>
        <div className="mt-[7vh] grid grid-cols-2 gap-[2vw]">
          <article className="bg-primary px-[3vw] py-[3.2vh] text-bg">
            <p className="text-[1.55vw] font-bold uppercase tracking-[0.12em] text-pale">Operational planning · live</p>
            <p className="mt-[2vh] font-display text-[2.6vw] font-bold leading-[1.08]">Workspace sales, last 7 days</p>
            <p className="mt-[2.7vh] max-w-[37vw] text-[2vw] leading-[1.22]">Rules-based: weekday adjustment; prep capped by usable recipe stock.</p>
          </article>
          <article className="bg-pale px-[3vw] py-[3.2vh]">
            <p className="text-[1.55vw] font-bold uppercase tracking-[0.12em] text-accent">AI scenario · synthetic demo</p>
            <p className="mt-[2vh] font-display text-[2.6vw] font-bold leading-[1.08]">28 sample days → 7-day scenario</p>
            <p className="mt-[2.7vh] max-w-[37vw] text-[2vw] leading-[1.22]">Forecast demo only: synthetic history, no owner records, and not yet validated.</p>
          </article>
        </div>
        <div className="mt-[4vh] flex items-center justify-between border-t border-ink/15 pt-[2.5vh]">
          <p className="text-[2vw] font-semibold">The AI demo does not change live stock, plans, or purchases.</p>
          <p className="text-[2vw] font-bold text-primary">Next: consented data → held-out evaluation</p>
        </div>
      </section>
    </div>
  );
}