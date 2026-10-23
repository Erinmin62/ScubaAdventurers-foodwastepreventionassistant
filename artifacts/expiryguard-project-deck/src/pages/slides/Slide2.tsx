const base = import.meta.env.BASE_URL;

export default function Slide2() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg text-text">
      <div className="absolute inset-y-0 left-0 w-[39vw]">
        <img src={base + "prep-counter.jpg"} crossOrigin="anonymous" alt="Fresh produce and prepared ingredients on a working kitchen counter" className="h-full w-full object-cover object-center" />
      </div>
      <section className="relative ml-[39vw] flex h-full w-[61vw] flex-col justify-center bg-bg px-[6vw] py-[8vh]">
        <p className="mb-[2vh] text-[1.6vw] font-bold uppercase tracking-[0.12em] text-accent">The operating challenge</p>
        <h1 className="max-w-[51vw] font-display text-[4.35vw] font-bold leading-[1.02] text-text">Perishable decisions are disconnected.</h1>
        <p className="mt-[3vh] max-w-[49vw] text-[2.05vw] leading-[1.25] text-muted">Each service depends on bringing stock, expiry, sales, and preparation together—often while the shift is already moving.</p>
        <div className="mt-[6vh] grid grid-cols-3 gap-[2vw]">
          <div className="border-t-[0.45vw] border-primary pt-[2vh]">
            <p className="text-[2vw] font-bold">STOCK</p>
            <p className="mt-[1vh] text-[2vw] leading-[1.2] text-muted">What is usable—and what expires first?</p>
          </div>
          <div className="border-t-[0.45vw] border-accent pt-[2vh]">
            <p className="text-[2vw] font-bold">DEMAND</p>
            <p className="mt-[1vh] text-[2vw] leading-[1.2] text-muted">What is selling, by dish and day?</p>
          </div>
          <div className="border-t-[0.45vw] border-primary pt-[2vh]">
            <p className="text-[2vw] font-bold">ACTION</p>
            <p className="mt-[1vh] text-[2vw] leading-[1.2] text-muted">What should the owner prep or review?</p>
          </div>
        </div>
      </section>
    </div>
  );
}