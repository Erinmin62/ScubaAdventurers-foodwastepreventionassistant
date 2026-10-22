export default function Slide8() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-accent text-bg">
      <div className="absolute bottom-0 right-0 h-[2vh] w-[45vw] bg-primary" aria-hidden="true" />
      <section className="relative z-10 px-[6vw] pt-[8vh]">
        <h1 className="max-w-[87vw] font-display text-[5vw] font-extrabold leading-[0.98] tracking-[-0.05em]">Demo today. Validation next.</h1>
        <div className="mt-[9vh] grid grid-cols-2 gap-x-[5vw] gap-y-[6vh]">
          <p className="border-t border-bg/40 pt-[2.5vh] text-[2.1vw] leading-[1.2]">Build consistent, owner-approved records for sales, preparation, leftovers and stock</p>
          <p className="border-t border-bg/40 pt-[2.5vh] text-[2.1vw] leading-[1.2]">Compare forecasts with held-out actual results before relying on them</p>
          <p className="border-t border-bg/40 pt-[2.5vh] text-[2.1vw] leading-[1.2]">Measure waste and purchasing changes over time; treat savings as unproven until measured</p>
          <p className="border-t border-bg/40 pt-[2.5vh] text-[2.1vw] leading-[1.2]">Expand through reusable setup for menus, ingredients and different food businesses</p>
        </div>
      </section>
    </div>
  );
}