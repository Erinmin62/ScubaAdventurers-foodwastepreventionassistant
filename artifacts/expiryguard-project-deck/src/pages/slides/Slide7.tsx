export default function Slide7() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg text-text">
      <section className="relative z-10 px-[6vw] pt-[8vh]">
        <p className="mb-[2vh] text-[1.6vw] font-bold uppercase tracking-[0.12em] text-primary">Reusable product</p>
        <h1 className="max-w-[86vw] font-display text-[4.2vw] font-bold leading-[1.02]">One workflow adapts across food SMEs.</h1>
        <div className="mt-[6vh] grid grid-cols-4 gap-[1.4vw]">
          <div className="border-t-[0.4vw] border-primary pt-[2vh]"><p className="text-[2.1vw] font-bold">Cafes</p></div>
          <div className="border-t-[0.4vw] border-accent pt-[2vh]"><p className="text-[2.1vw] font-bold">Restaurants</p></div>
          <div className="border-t-[0.4vw] border-primary pt-[2vh]"><p className="text-[2.1vw] font-bold">Food vendors</p></div>
          <div className="border-t-[0.4vw] border-accent pt-[2vh]"><p className="text-[2.1vw] font-bold">Cloud kitchens</p></div>
        </div>
        <div className="mt-[7vh] grid grid-cols-[1.05fr_0.95fr] gap-[4vw]">
          <div>
            <p className="font-display text-[2.7vw] font-bold leading-[1.08]">Configure each owner workspace.</p>
            <p className="mt-[2vh] max-w-[43vw] text-[2vw] leading-[1.22] text-muted">Set profile, menu, recipes, and pantry. The demo uses shared rules across business types.</p>
          </div>
          <div className="border-l border-ink/15 pl-[3vw]">
            <p className="font-display text-[2.7vw] font-bold leading-[1.08]">Measure the business case.</p>
            <p className="mt-[2vh] text-[2vw] leading-[1.22] text-muted">Track prep, sales, leftovers, waste value, and purchasing. Savings need real pilot evidence.</p>
          </div>
        </div>
      </section>
    </div>
  );
}