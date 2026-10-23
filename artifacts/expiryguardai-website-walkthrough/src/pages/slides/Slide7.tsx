export default function Slide7() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg text-text px-[6vw] py-[8vh]">
      <h1 className="max-w-[80vw] font-display text-[4.2vw] font-bold leading-[1] tracking-[-0.045em]">
        Reordering and Automations: keep control
      </h1>
      <div className="mt-[7vh] grid grid-cols-2 gap-[5vw]">
        <section className="flex flex-col gap-[3vh]">
          <div className="h-[0.6vh] w-[10vw] bg-primary" aria-hidden="true" />
          <p className="text-[2.1vw] font-semibold leading-[1.2]">
            Run reorder scan to create purchase suggestions for review
          </p>
          <p className="border-t border-text/15 pt-[2.5vh] text-[2vw] leading-[1.2]">
            Review, adjust, approve, or reject a suggestion; no supplier order is placed
          </p>
          <div className="mt-[1vh] inline-flex w-fit bg-primary/10 px-[1.6vw] py-[1.3vh] text-[1.8vw] font-bold text-primary">
            Owner approval gate
          </div>
        </section>
        <section className="flex flex-col gap-[3vh]">
          <div className="h-[0.6vh] w-[10vw] bg-accent" aria-hidden="true" />
          <p className="text-[2.1vw] font-semibold leading-[1.2]">
            A scheduled expiry scan checks stock dates hourly and flags items approaching expiry
          </p>
          <p className="border-t border-text/15 pt-[2.5vh] text-[2vw] leading-[1.2]">
            Notifications shows expiry alerts and the last check status. Daily planning and Follow-up have separate controls
          </p>
          <div className="mt-[1vh] flex gap-[1vw]">
            <span className="bg-pale px-[1.4vw] py-[1.2vh] text-[1.7vw] font-semibold text-accent">Hourly expiry scan</span>
            <span className="bg-pale px-[1.4vw] py-[1.2vh] text-[1.7vw] font-semibold text-accent">Daily planning</span>
            <span className="bg-surface px-[1.4vw] py-[1.2vh] text-[1.7vw] font-semibold text-text">Follow-up handling</span>
          </div>
        </section>
      </div>
    </div>
  );
}
