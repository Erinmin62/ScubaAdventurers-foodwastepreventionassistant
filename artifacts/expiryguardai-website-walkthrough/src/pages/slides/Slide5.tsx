export default function Slide5() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg text-text px-[6vw] py-[8vh]">
      <h1 className="max-w-[78vw] font-display text-[4.3vw] font-bold leading-[1] tracking-[-0.045em]">
        Menu and Sales: describe service
      </h1>
      <div className="mt-[7vh] grid grid-cols-[1.1fr_0.9fr] gap-[4vw]">
        <div className="flex flex-col justify-center gap-[2.5vh]">
          <p className="border-l-[0.45vw] border-primary pl-[1.6vw] text-[2vw] font-medium leading-[1.18]">
            Menu → Add a dish: connect the dish to its recipe ingredients
          </p>
          <p className="border-l-[0.45vw] border-accent pl-[1.6vw] text-[2vw] font-medium leading-[1.18]">
            Request a recipe draft, then review and edit the suggested ingredient rows
          </p>
          <p className="border-l-[0.45vw] border-primary pl-[1.6vw] text-[2vw] font-medium leading-[1.18]">
            Sales → search for a menu item, enter portions, Add item, then Record items
          </p>
          <p className="border-l-[0.45vw] border-accent pl-[1.6vw] text-[2vw] font-medium leading-[1.18]">
            Daily sales entries feed the live seven-day planning forecast
          </p>
        </div>
        <div className="relative flex h-[58vh] flex-col justify-center gap-[2vh] border-y border-text/15 px-[2vw]">
          <div className="bg-pale px-[2vw] py-[2.4vh]">
            <span className="font-display text-[2.5vw] font-bold text-accent">Menu</span>
            <span className="ml-[1vw] text-[1.8vw] text-muted">Add a dish</span>
          </div>
          <div className="ml-[3vw] h-[3vh] w-[0.3vw] bg-primary" aria-hidden="true" />
          <div className="bg-surface px-[2vw] py-[2.4vh]">
            <span className="font-display text-[2.5vw] font-bold text-text">Recipe ingredients</span>
            <span className="ml-[1vw] text-[1.8vw] text-muted">Review the rows</span>
          </div>
          <div className="ml-[3vw] h-[3vh] w-[0.3vw] bg-accent" aria-hidden="true" />
          <div className="bg-primary/10 px-[2vw] py-[2.4vh]">
            <span className="font-display text-[2.5vw] font-bold text-primary">Sales</span>
            <span className="ml-[1vw] text-[1.8vw] text-muted">Search and record portions</span>
          </div>
        </div>
      </div>
    </div>
  );
}
