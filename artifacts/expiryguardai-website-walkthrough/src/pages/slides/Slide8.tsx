const base = import.meta.env.BASE_URL;

export default function Slide8() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg text-text">
      <div className="absolute inset-y-0 left-0 w-[42vw]">
        <img
          src={base + "business-types.jpg"}
          crossOrigin="anonymous"
          alt="Different kinds of small food businesses"
          className="h-full w-full object-cover object-center"
        />
      </div>
      <div className="relative z-10 ml-[34vw] flex h-full w-[66vw] flex-col justify-center bg-bg px-[6vw] py-[8vh]">
        <h1 className="max-w-[52vw] font-display text-[4.2vw] font-bold leading-[1] tracking-[-0.045em]">
          Close with records, not assumptions
        </h1>
        <div className="mt-[5vh] flex flex-col gap-[2.1vh]">
          <p className="border-b border-text/15 pb-[1.8vh] text-[2vw] font-medium leading-[1.2]">
            Notifications: review hourly scan alerts, pending actions, and the last completed expiry check
          </p>
          <p className="border-b border-text/15 pb-[1.8vh] text-[2vw] font-medium leading-[1.2]">
            Impact: record preparation, sales, and leftovers; compare baseline and recent results
          </p>
          <p className="border-b border-text/15 pb-[1.8vh] text-[2vw] font-medium leading-[1.2]">
            Ledger: search imports, decisions, edits, and follow-up checks
          </p>
          <p className="text-[2vw] font-semibold leading-[1.2] text-primary">
            Sample baselines and projected savings are illustrative, not proven results
          </p>
        </div>
        <div className="mt-[4vh] h-[0.7vh] w-[11vw] bg-primary" aria-hidden="true" />
      </div>
    </div>
  );
}
