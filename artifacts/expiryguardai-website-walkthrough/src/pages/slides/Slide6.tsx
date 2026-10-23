export default function Slide6() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg text-text px-[6vw] py-[8vh]">
      <h1 className="max-w-[82vw] font-display text-[4.2vw] font-bold leading-[1] tracking-[-0.045em]">
        Tomorrow and Decisions: plan, then review
      </h1>
      <div className="mt-[6vh] grid grid-cols-[1.08fr_0.92fr] gap-[4vw]">
        <div className="flex flex-col justify-center gap-[2.5vh]">
          <p className="border-b border-text/15 pb-[2vh] text-[2vw] font-medium leading-[1.2]">
            Tomorrow shows predicted portions and suggested preparation, limited by usable stock
          </p>
          <p className="border-b border-text/15 pb-[2vh] text-[2vw] font-medium leading-[1.2]">
            Synthetic mode uses sample sales; owner-data mode needs recent recorded sales
          </p>
          <p className="border-b border-text/15 pb-[2vh] text-[2vw] font-medium leading-[1.2]">
            Decisions lets the owner review and approve, edit, or reject recommendations
          </p>
          <p className="text-[2vw] font-semibold leading-[1.2] text-primary">
            The separate AI sample button creates an isolated demo; it does not change the live plan or stock
          </p>
        </div>
        <div className="flex flex-col justify-center gap-[3vh]">
          <div className="bg-surface px-[2.2vw] py-[2.5vh]">
            <p className="font-display text-[2.4vw] font-bold">Tomorrow</p>
            <p className="mt-[1.5vh] text-[1.8vw] text-muted">Predicted portions · Suggested preparation</p>
          </div>
          <div className="ml-[3vw] h-[3vh] w-[0.35vw] bg-primary" aria-hidden="true" />
          <div className="bg-pale px-[2.2vw] py-[2.5vh]">
            <p className="font-display text-[2.4vw] font-bold text-accent">Owner review</p>
            <p className="mt-[1.5vh] text-[1.8vw] text-muted">Approve · Edit · Reject</p>
          </div>
          <div className="border-t border-dashed border-text/25 pt-[2.5vh]">
            <p className="text-[1.8vw] font-bold text-primary">Separate demo</p>
            <p className="mt-[1vh] text-[1.8vw] text-muted">AI sample — isolated from the live plan</p>
          </div>
        </div>
      </div>
    </div>
  );
}
