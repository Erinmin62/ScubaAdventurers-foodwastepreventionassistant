export default function Slide3() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg text-text">
      <section className="relative z-10 px-[6vw] pt-[8vh]">
        <p className="mb-[2vh] text-[1.6vw] font-bold uppercase tracking-[0.12em] text-primary">The product</p>
        <h1 className="max-w-[80vw] font-display text-[4.25vw] font-bold leading-[1.02]">One record connects stock, demand, and action.</h1>
        <div className="relative mt-[10vh] grid grid-cols-5 gap-[1.5vw]">
          <div className="absolute left-[8vw] right-[8vw] top-[1.35vw] h-[0.22vw] bg-primary/25" aria-hidden="true" />
          <article className="relative pt-[0.2vw]">
            <span className="relative z-10 grid h-[2.8vw] w-[2.8vw] place-items-center rounded-full bg-primary font-display text-[1.5vw] font-bold text-bg">01</span>
            <p className="mt-[3vh] text-[2.15vw] font-bold">Pantry</p>
            <p className="mt-[1.4vh] max-w-[15vw] text-[2vw] leading-[1.2] text-muted">Quantity, cost, expiry, batches</p>
          </article>
          <article className="relative pt-[0.2vw]">
            <span className="relative z-10 grid h-[2.8vw] w-[2.8vw] place-items-center rounded-full bg-accent font-display text-[1.5vw] font-bold text-bg">02</span>
            <p className="mt-[3vh] text-[2.15vw] font-bold">Menu</p>
            <p className="mt-[1.4vh] max-w-[15vw] text-[2vw] leading-[1.2] text-muted">AI recipe drafts, owner-reviewed</p>
          </article>
          <article className="relative pt-[0.2vw]">
            <span className="relative z-10 grid h-[2.8vw] w-[2.8vw] place-items-center rounded-full bg-primary font-display text-[1.5vw] font-bold text-bg">03</span>
            <p className="mt-[3vh] text-[2.15vw] font-bold">Service</p>
            <p className="mt-[1.4vh] max-w-[15vw] text-[2vw] leading-[1.2] text-muted">Sales, preparation, leftovers</p>
          </article>
          <article className="relative pt-[0.2vw]">
            <span className="relative z-10 grid h-[2.8vw] w-[2.8vw] place-items-center rounded-full bg-accent font-display text-[1.5vw] font-bold text-bg">04</span>
            <p className="mt-[3vh] text-[2.15vw] font-bold">Plan</p>
            <p className="mt-[1.4vh] max-w-[15vw] text-[2vw] leading-[1.2] text-muted">Demand, expiry, usable stock</p>
          </article>
          <article className="relative pt-[0.2vw]">
            <span className="relative z-10 grid h-[2.8vw] w-[2.8vw] place-items-center rounded-full bg-primary font-display text-[1.5vw] font-bold text-bg">05</span>
            <p className="mt-[3vh] text-[2.15vw] font-bold">Review</p>
            <p className="mt-[1.4vh] max-w-[15vw] text-[2vw] leading-[1.2] text-muted">Owner action, follow-up, history</p>
          </article>
        </div>
        <div className="mt-[10vh] flex items-center justify-between bg-primary px-[3vw] py-[3vh] text-bg">
          <p className="text-[1.7vw] font-bold uppercase tracking-[0.1em]">One connected operating loop</p>
          <p className="text-[2vw] font-semibold">Tomorrow · Decisions · Reordering · Notifications</p>
        </div>
      </section>
    </div>
  );
}