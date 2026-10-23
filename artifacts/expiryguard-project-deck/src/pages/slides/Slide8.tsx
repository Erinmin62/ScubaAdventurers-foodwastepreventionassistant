export default function Slide8() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg text-text">
      <section className="relative z-10 flex h-full">
        <div className="flex w-[43vw] flex-col justify-between bg-primary px-[5vw] py-[8vh] text-bg">
          <p className="text-[1.6vw] font-bold uppercase tracking-[0.12em] text-pale">The ask</p>
          <div>
            <h1 className="font-display text-[4.65vw] font-bold leading-[1.02]">Pilot with us.</h1>
            <p className="mt-[3vh] max-w-[32vw] text-[2.15vw] font-semibold leading-[1.2]">Help test whether connected stock and prep decisions reduce waste.</p>
          </div>
          <p className="text-[1.8vw] leading-[1.25] text-bg/85">Seeking food-SME pilot partners and validation support.</p>
        </div>
        <div className="flex w-[57vw] flex-col justify-center px-[5vw] py-[8vh]">
          <p className="mb-[2vh] text-[1.6vw] font-bold uppercase tracking-[0.12em] text-accent">The proof plan</p>
          <h2 className="max-w-[47vw] font-display text-[3.8vw] font-bold leading-[1.02]">Validate before scaling.</h2>
          <div className="mt-[5vh] space-y-[2.2vh]">
            <div className="flex items-start gap-[1.5vw] border-b border-ink/15 pb-[2vh]">
              <span className="font-display text-[2.2vw] font-bold text-primary">01</span>
              <p className="text-[2vw] leading-[1.2]">Compare forecasts with held-out actual sales.</p>
            </div>
            <div className="flex items-start gap-[1.5vw] border-b border-ink/15 pb-[2vh]">
              <span className="font-display text-[2.2vw] font-bold text-primary">02</span>
              <p className="text-[2vw] leading-[1.2]">Measure waste and purchasing changes over time.</p>
            </div>
            <div className="flex items-start gap-[1.5vw] border-b border-ink/15 pb-[2vh]">
              <span className="font-display text-[2.2vw] font-bold text-primary">03</span>
              <p className="text-[2vw] leading-[1.2]">Test adoption, reliability, and willingness to pay.</p>
            </div>
          </div>
          <p className="mt-[3vh] text-[1.9vw] font-semibold">Commercial hypothesis: affordable per-location subscription.</p>
          <p className="mt-[1.5vh] text-[1.8vw] font-semibold text-accent">Pricing, support costs, and savings still need evidence.</p>
        </div>
      </section>
    </div>
  );
}