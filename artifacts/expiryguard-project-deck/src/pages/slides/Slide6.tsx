export default function Slide6() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg text-text">
      <section className="px-[6vw] pt-[7vh]">
        <h1 className="max-w-[88vw] font-display text-[3.9vw] font-bold leading-[1] tracking-[-0.045em]">Automate routine checks; keep decisions with the owner</h1>
        <div className="mt-[7vh] grid grid-cols-[1.18fr_0.82fr] gap-[3vw]">
          <div className="space-y-[4.1vh] pt-[1vh]">
            <div className="flex items-start gap-[1.3vw]"><span className="mt-[1vh] h-[0.8vw] w-[0.8vw] shrink-0 rounded-full bg-primary" aria-hidden="true" /><p className="text-[2.05vw] leading-[1.2]">Daily planning saves a review snapshot and creates draft recommendations</p></div>
            <div className="flex items-start gap-[1.3vw]"><span className="mt-[1vh] h-[0.8vw] w-[0.8vw] shrink-0 rounded-full bg-accent" aria-hidden="true" /><p className="text-[2.05vw] leading-[1.2]">Expiry checks flag stock that needs attention</p></div>
            <div className="flex items-start gap-[1.3vw]"><span className="mt-[1vh] h-[0.8vw] w-[0.8vw] shrink-0 rounded-full bg-primary" aria-hidden="true" /><p className="text-[2.05vw] leading-[1.2]">Follow-up checks can track what happened after an approved change</p></div>
          </div>
          <div className="flex min-h-[49vh] items-center bg-accent px-[3vw] py-[4vh] text-bg">
            <p className="font-display text-[2.7vw] font-semibold leading-[1.13] tracking-[-0.02em]">Owners can approve, edit or reject recommendations; the system does not place orders automatically</p>
          </div>
        </div>
      </section>
    </div>
  );
}