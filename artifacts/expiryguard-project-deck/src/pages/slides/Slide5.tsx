export default function Slide5() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg text-text">
      <section className="px-[6vw] pt-[8vh]">
        <p className="mb-[2vh] text-[1.6vw] font-bold uppercase tracking-[0.12em] text-primary">A visible, accountable workflow</p>
        <h1 className="max-w-[82vw] font-display text-[4.25vw] font-bold leading-[1.02]">Every recommendation has a review path.</h1>
        <div className="mt-[10vh] grid grid-cols-3 gap-[3vw]">
          <article className="pr-[2vw]">
            <p className="font-display text-[3.4vw] font-bold leading-none text-primary">01</p>
            <p className="mt-[2vh] text-[2.25vw] font-bold">Surface</p>
            <p className="mt-[2vh] text-[2vw] leading-[1.22] text-muted">Notifications surface expiry risks; new actionable alerts can toast briefly.</p>
          </article>
          <article className="border-l border-ink/15 pl-[3vw]">
            <p className="font-display text-[3.4vw] font-bold leading-none text-accent">02</p>
            <p className="mt-[2vh] text-[2.25vw] font-bold">Decide</p>
            <p className="mt-[2vh] text-[2vw] leading-[1.22] text-muted">Owners edit, approve, or reject drafts. No supplier order is sent.</p>
          </article>
          <article className="border-l border-ink/15 pl-[3vw]">
            <p className="font-display text-[3.4vw] font-bold leading-none text-primary">03</p>
            <p className="mt-[2vh] text-[2.25vw] font-bold">Record</p>
            <p className="mt-[2vh] text-[2vw] leading-[1.22] text-muted">Result checks use owner observations; Ledger keeps decision history.</p>
          </article>
        </div>
        <div className="mt-[10vh] flex items-center gap-[2vw]">
          <div className="h-[0.7vh] w-[9vw] bg-accent" aria-hidden="true" />
          <p className="text-[2vw] font-semibold text-text">Review before action. Evidence after.</p>
        </div>
      </section>
    </div>
  );
}