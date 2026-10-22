const base = import.meta.env.BASE_URL;

export default function Slide4() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-pale text-text">
      <div className="absolute inset-y-0 left-0 w-[48vw]">
        <img src={base + "business-types.jpg"} crossOrigin="anonymous" alt="A collage of a cafe, restaurant, food stall and cloud kitchen" className="h-full w-full object-cover object-center" />
      </div>
      <section className="relative ml-[48vw] flex h-full w-[52vw] flex-col px-[4vw] py-[7vh]">
        <h1 className="max-w-[44vw] font-display text-[3.9vw] font-bold leading-[1] tracking-[-0.045em]">Designed for more than cafes</h1>
        <div className="mt-[5vh] max-w-[44vw] space-y-[3.3vh]">
          <div className="flex items-start gap-[1vw]"><span className="mt-[1vh] h-[0.75vw] w-[0.75vw] shrink-0 rounded-full bg-primary" aria-hidden="true" /><p className="text-[2vw] leading-[1.18]">Configure the business name and type</p></div>
          <div className="flex items-start gap-[1vw]"><span className="mt-[1vh] h-[0.75vw] w-[0.75vw] shrink-0 rounded-full bg-accent" aria-hidden="true" /><p className="text-[2vw] leading-[1.18]">Keep each owner's menu, pantry and records in a private workspace</p></div>
          <div className="flex items-start gap-[1vw]"><span className="mt-[1vh] h-[0.75vw] w-[0.75vw] shrink-0 rounded-full bg-primary" aria-hidden="true" /><p className="text-[2vw] leading-[1.18]">Start with labeled sample data or an empty workspace for your own records</p></div>
          <div className="flex items-start gap-[1vw]"><span className="mt-[1vh] h-[0.75vw] w-[0.75vw] shrink-0 rounded-full bg-accent" aria-hidden="true" /><p className="text-[2vw] leading-[1.18]">Reuse the same planning and food-safety rules across food-business types</p></div>
        </div>
      </section>
    </div>
  );
}