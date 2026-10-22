export default function Slide3() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg text-text">
      <section className="relative z-10 px-[6vw] pt-[8vh]">
        <h1 className="max-w-[79vw] font-display text-[4.3vw] font-bold leading-[1] tracking-[-0.045em]">One workflow—from pantry to review</h1>
        <div className="mt-[12vh] grid grid-cols-4 gap-[1.8vw]">
          <article className="relative min-h-[42vh] border-t-[0.45vw] border-primary pt-[3vh]">
            <span className="font-display text-[6vw] font-bold leading-none text-primary">1</span>
            <p className="mt-[3vh] text-[2vw] font-medium leading-[1.18]">Record ingredients, quantities, costs and expiry dates</p>
          </article>
          <article className="relative min-h-[42vh] border-t-[0.45vw] border-accent pt-[3vh]">
            <span className="font-display text-[6vw] font-bold leading-none text-accent">2</span>
            <p className="mt-[3vh] text-[2vw] font-medium leading-[1.18]">Connect menu dishes to their recipe ingredients</p>
          </article>
          <article className="relative min-h-[42vh] border-t-[0.45vw] border-primary pt-[3vh]">
            <span className="font-display text-[6vw] font-bold leading-none text-primary">3</span>
            <p className="mt-[3vh] text-[2vw] font-medium leading-[1.18]">Enter daily sales, portions prepared and leftovers</p>
          </article>
          <article className="relative min-h-[42vh] border-t-[0.45vw] border-accent pt-[3vh]">
            <span className="font-display text-[6vw] font-bold leading-none text-accent">4</span>
            <p className="mt-[3vh] text-[2vw] font-medium leading-[1.18]">Review forecasts, expiry risks and suggested actions</p>
          </article>
        </div>
      </section>
    </div>
  );
}