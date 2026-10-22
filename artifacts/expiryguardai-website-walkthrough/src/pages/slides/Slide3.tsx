export default function Slide3() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg text-text px-[6vw] py-[8vh]">
      <h1 className="max-w-[78vw] font-display text-[4.3vw] font-bold leading-[1] tracking-[-0.045em]">
        The sidebar is your tour map
      </h1>
      <div className="mt-[7vh] grid grid-cols-2 gap-x-[4vw] gap-y-[3.2vh]">
        <p className="border-t-[0.45vw] border-primary pt-[1.8vh] text-[2vw] font-medium leading-[1.2]">
          Today: summary and work needing review; Impact: waste results and comparisons
        </p>
        <p className="border-t-[0.45vw] border-accent pt-[1.8vh] text-[2vw] font-medium leading-[1.2]">
          Pantry: ingredient stock and expiry; Menu: dishes and recipe ingredients
        </p>
        <p className="border-t-[0.45vw] border-accent pt-[1.8vh] text-[2vw] font-medium leading-[1.2]">
          Sales: record portions sold; Tomorrow: view demand and suggested preparation
        </p>
        <p className="border-t-[0.45vw] border-primary pt-[1.8vh] text-[2vw] font-medium leading-[1.2]">
          Decisions: review, approve, or reject suggestions; Reordering: review purchase plans
        </p>
        <p className="border-t-[0.45vw] border-primary pt-[1.8vh] text-[2vw] font-medium leading-[1.2]">
          Automations: manage routine checks; Notifications: alerts and check status
        </p>
        <p className="border-t-[0.45vw] border-accent pt-[1.8vh] text-[2vw] font-medium leading-[1.2]">
          Ledger: searchable history; Business: business profile and workspace choice
        </p>
      </div>
    </div>
  );
}
