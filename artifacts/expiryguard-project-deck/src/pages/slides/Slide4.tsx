const base = import.meta.env.BASE_URL;

export default function Slide4() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg text-text">
      <section className="relative z-10 px-[6vw] pt-[7vh]">
        <p className="mb-[2vh] text-[1.6vw] font-bold uppercase tracking-[0.12em] text-accent">Automation</p>
        <h1 className="max-w-[83vw] font-display text-[4.2vw] font-bold leading-[1.02]">Routine checks run. Owners decide.</h1>
        <div className="mt-[7vh] grid grid-cols-3 gap-[2vw]">
          <article className="border-t-[0.5vw] border-primary pt-[2.5vh]">
            <p className="text-[1.55vw] font-bold uppercase tracking-[0.1em] text-primary">Daily planning</p>
            <p className="mt-[1.8vh] font-display text-[3.05vw] font-bold leading-none">Once a day</p>
            <p className="mt-[2.5vh] max-w-[25vw] text-[2vw] leading-[1.2]">Refreshes the plan, scans reorders, and saves a review snapshot.</p>
          </article>
          <article className="border-t-[0.5vw] border-accent pt-[2.5vh]">
            <p className="text-[1.55vw] font-bold uppercase tracking-[0.1em] text-accent">Expiry monitoring</p>
            <p className="mt-[1.8vh] font-display text-[3.05vw] font-bold leading-none">Hourly</p>
            <p className="mt-[2.5vh] max-w-[25vw] text-[2vw] leading-[1.2]">Flags stock at risk—even when planning is paused.</p>
          </article>
          <article className="border-t-[0.5vw] border-primary pt-[2.5vh]">
            <p className="text-[1.55vw] font-bold uppercase tracking-[0.1em] text-primary">Follow-up handling</p>
            <p className="mt-[1.8vh] font-display text-[3.05vw] font-bold leading-none">When due</p>
            <p className="mt-[2.5vh] max-w-[25vw] text-[2vw] leading-[1.2]">Schedules a 1–2 day check after approval; uses owner observations.</p>
          </article>
        </div>
        <div className="mt-[7vh] flex items-center justify-between bg-pale px-[3vw] py-[2.7vh]">
          <p className="text-[1.7vw] font-bold uppercase tracking-[0.1em]">Owner approval gate</p>
          <p className="text-[2vw] font-semibold">Review → Edit / Approve / Reject</p>
          <p className="text-[1.75vw] font-semibold text-accent">No orders placed automatically</p>
        </div>
      </section>
    </div>
  );
}