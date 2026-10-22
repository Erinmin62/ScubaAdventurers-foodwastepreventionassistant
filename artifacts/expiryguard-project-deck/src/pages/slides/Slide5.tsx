export default function Slide5() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg text-text">
      <section className="px-[6vw] pt-[7vh]">
        <h1 className="max-w-[84vw] font-display text-[4.2vw] font-bold leading-[1] tracking-[-0.045em]">Turn recent sales into a practical plan</h1>
        <div className="mt-[5vh] grid h-[69vh] grid-cols-[0.95fr_1.05fr] gap-[2vw]">
          <div className="relative flex flex-col justify-between overflow-hidden bg-primary px-[4vw] py-[4vh] text-bg">
            <span className="absolute right-[1vw] top-[1vh] font-display text-[22vw] font-extrabold leading-none text-bg opacity-15" aria-hidden="true">7</span>
            <p className="relative z-10 max-w-[38vw] text-[2.25vw] font-semibold leading-[1.18]">Current planning uses the last seven days of sales, adjusted by weekday</p>
            <div className="h-[0.7vh] w-[11vw] bg-pale" aria-hidden="true" />
          </div>
          <div className="flex flex-col justify-center gap-[4vh] px-[2vw]">
            <p className="text-[2vw] leading-[1.2]">Capacity is checked against non-expired stock and shared recipe ingredients</p>
            <div className="h-px w-full bg-accent/30" aria-hidden="true" />
            <p className="text-[2vw] leading-[1.2]">Suggestions can cover preparation, purchasing review and which safe stock to use first</p>
            <div className="h-px w-full bg-accent/30" aria-hidden="true" />
            <p className="text-[2vw] leading-[1.2]">In an owner-data workspace, a forecast waits until recent actual sales are recorded</p>
          </div>
        </div>
      </section>
    </div>
  );
}