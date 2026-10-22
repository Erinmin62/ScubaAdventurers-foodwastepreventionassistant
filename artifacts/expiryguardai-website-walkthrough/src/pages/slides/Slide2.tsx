export default function Slide2() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg text-text px-[6vw] py-[8vh]">
      <h1 className="max-w-[78vw] font-display text-[4.2vw] font-bold leading-[1] tracking-[-0.045em]">
        Choose the workspace before you begin
      </h1>
      <div className="mt-[8vh] border-y border-text/15 py-[3vh]">
        <p className="max-w-[80vw] text-[2.2vw] font-semibold leading-[1.22]">
          Business: set the workspace name and business type
        </p>
      </div>
      <div className="mt-[6vh] grid grid-cols-2 gap-[4vw]">
        <section className="relative min-h-[43vh] bg-pale px-[3vw] py-[4vh]">
          <div className="mb-[3vh] h-[0.6vh] w-[9vw] bg-accent" aria-hidden="true" />
          <p className="max-w-[36vw] text-[2.25vw] font-semibold leading-[1.25]">
            Synthetic demo: explore clearly labeled sample records
          </p>
          <div className="mt-[5vh] flex items-center gap-[1.2vw] text-[1.8vw] font-semibold text-accent">
            <span className="h-[1.2vw] w-[1.2vw] rounded-full bg-accent" aria-hidden="true" />
            Sample workspace
          </div>
        </section>
        <section className="relative min-h-[43vh] bg-surface px-[3vw] py-[4vh]">
          <div className="mb-[3vh] h-[0.6vh] w-[9vw] bg-primary" aria-hidden="true" />
          <p className="max-w-[36vw] text-[2.25vw] font-semibold leading-[1.25]">
            Owner data: start with your own pantry, menu, and sales records
          </p>
          <p className="mt-[4vh] max-w-[37vw] border-t border-text/15 pt-[2.5vh] text-[2vw] leading-[1.3] text-muted">
            In owner-data mode, the forecast waits until recent sales are recorded
          </p>
        </section>
      </div>
    </div>
  );
}
