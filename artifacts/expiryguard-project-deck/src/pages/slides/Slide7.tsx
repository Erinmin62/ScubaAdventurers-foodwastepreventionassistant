export default function Slide7() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg text-text">
      <div className="absolute bottom-0 right-0 h-[75vh] w-[34vw] bg-pale" aria-hidden="true" />
      <section className="relative z-10 px-[6vw] pt-[7vh]">
        <h1 className="max-w-[85vw] font-display text-[4vw] font-bold leading-[1] tracking-[-0.045em]">AI output is a demonstration—not a validated forecast</h1>
        <div className="mt-[6vh] max-w-[60vw] space-y-[3.2vh]">
          <div className="flex items-start gap-[1.2vw]"><span className="mt-[1vh] h-[0.8vw] w-[0.8vw] shrink-0 rounded-full bg-primary" aria-hidden="true" /><p className="text-[2.05vw] leading-[1.18]">A separate experimental model produces a seven-day scenario from generated sample data</p></div>
          <div className="flex items-start gap-[1.2vw]"><span className="mt-[1vh] h-[0.8vw] w-[0.8vw] shrink-0 rounded-full bg-accent" aria-hidden="true" /><p className="text-[2.05vw] leading-[1.18]">Its output is temporary and does not change stock, plans or purchases</p></div>
          <div className="flex items-start gap-[1.2vw]"><span className="mt-[1vh] h-[0.8vw] w-[0.8vw] shrink-0 rounded-full bg-primary" aria-hidden="true" /><p className="text-[2.05vw] leading-[1.18]">Results are illustrative and have not been evaluated against real business outcomes</p></div>
          <div className="flex items-start gap-[1.2vw]"><span className="mt-[1vh] h-[0.8vw] w-[0.8vw] shrink-0 rounded-full bg-accent" aria-hidden="true" /><p className="text-[2.05vw] leading-[1.18]">Real historical business data is still needed before making accuracy or savings claims</p></div>
        </div>
        <svg viewBox="0 0 360 360" aria-hidden="true" className="absolute right-[4vw] top-[36vh] h-[29vw] w-[29vw]">
          <path d="M147 28h66M161 28v83l-84 137c-14 23 2 52 29 52h148c27 0 43-29 29-52l-84-137V28" fill="#2d7057" fillOpacity="0.16" stroke="#2d7057" strokeWidth="8" strokeLinejoin="round" />
          <path d="M111 230c31-16 53 17 84 0 24-13 43 9 63 1l25 41c8 14-2 30-18 30H95c-16 0-26-16-18-30z" fill="#e85d37" fillOpacity="0.78" />
          <circle cx="139" cy="199" r="11" fill="#2d7057" />
          <circle cx="222" cy="177" r="8" fill="#2d7057" />
          <circle cx="196" cy="216" r="6" fill="#2d7057" />
        </svg>
      </section>
    </div>
  );
}