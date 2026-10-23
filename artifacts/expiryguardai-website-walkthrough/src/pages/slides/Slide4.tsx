const base = import.meta.env.BASE_URL;

export default function Slide4() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg text-text px-[6vw] py-[8vh]">
      <h1 className="max-w-[78vw] font-display text-[4.3vw] font-bold leading-[1] tracking-[-0.045em]">
        Pantry: record what is on hand
      </h1>
      <div className="mt-[6vh] grid grid-cols-[0.9fr_1.1fr] gap-[4vw]">
        <div className="relative h-[68vh] overflow-hidden bg-pale">
          <img
            src={base + "prep-counter.jpg"}
            crossOrigin="anonymous"
            alt="Fresh produce and ingredients on a small business prep counter"
            className="h-full w-full object-cover"
          />
          <div className="absolute bottom-[3vh] left-[2vw] right-[2vw] bg-surface/95 px-[2vw] py-[2.5vh]">
            <p className="font-display text-[2vw] font-bold">Quantity · Unit · Cost · Expiry date</p>
            <div className="mt-[2vh] flex gap-[1.2vw]">
              <span className="bg-pale px-[1.3vw] py-[0.9vh] text-[1.7vw] font-semibold text-accent">Usable</span>
              <span className="bg-primary/10 px-[1.3vw] py-[0.9vh] text-[1.7vw] font-semibold text-primary">Expired</span>
            </div>
          </div>
        </div>
        <div className="flex flex-col justify-center gap-[3vh]">
          <p className="border-b border-text/15 pb-[2.2vh] text-[2vw] font-medium leading-[1.2]">
            Add ingredient: save quantity, unit, cost, expiry date, and an optional photo
          </p>
          <p className="border-b border-text/15 pb-[2.2vh] text-[2vw] font-medium leading-[1.2]">
            Search and category filters help find ingredients quickly
          </p>
          <p className="border-b border-text/15 pb-[2.2vh] text-[2vw] font-medium leading-[1.2]">
            Batches / receive records incoming stock
          </p>
          <p className="text-[2vw] font-semibold leading-[1.2] text-primary">
            Expired stock is excluded from planning
          </p>
        </div>
      </div>
    </div>
  );
}
