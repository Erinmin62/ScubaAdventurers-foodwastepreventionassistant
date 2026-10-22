import { motion } from 'framer-motion';

const EASE = [0.22, 1, 0.36, 1] as const;
const heights = [30, 46, 36, 70, 55, 78, 62, 90, 69, 83];

export function Scene4() {
  return (
    <motion.section className="absolute inset-0 overflow-hidden" style={{ background: '#f6f1e5', color: '#29263f' }}
      initial={{ opacity: 0, scale: 1.08 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, x: '-3%', scale: 0.98 }}
      transition={{ duration: 0.45, ease: EASE }}>
      <div className="absolute left-[5.5%] top-[14%] w-[27%]">
        <div className="eyebrow text-[#2d7057]">Daily sales → planning</div>
        <motion.h1 className="display mt-[2.5vmin] text-[8.6vmin] leading-[.9] font-extrabold tracking-[-.06em]"
          initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.52, ease: EASE }}>PLAN FROM<br /><span className="text-[#df5d39]">RECORDED</span><br />SALES.</motion.h1>
        <motion.p className="mt-[2.7vmin] text-[2.4vmin] leading-[1.22] text-[#706d7d]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.45 }}>Recent daily sales inform a seven-day demand estimate.</motion.p>
      </div>
      <motion.div className="absolute right-[6%] top-[14%] h-[71%] w-[59%] overflow-hidden rounded-[2.3vmin] border border-[#d6cdbd] bg-[#fbf8ef] p-[2.2vmin] film-shadow"
        initial={{ scale: 0.76, rotateY: 8, opacity: 0 }} animate={{ scale: 1, rotateY: 0, opacity: 1 }} transition={{ duration: 0.7, ease: EASE }}>
        <div className="flex items-center justify-between">
          <div><div className="eyebrow text-[#706d7d]">Demand by day</div><div className="display mt-[.7vmin] text-[3.6vmin] font-bold tracking-[-.04em]">Portions · planning view</div></div>
          <div className="rounded-full border border-[#bc8734]/50 bg-[#f2e7c9] px-[1.25vmin] py-[.7vmin] mono text-[1.05vmin] font-semibold text-[#815d20]">DEMO VIEW · SYNTHETIC SAMPLE DATA</div>
        </div>
        <div className="absolute bottom-[16%] left-[8%] right-[8%] top-[29%]">
          <div className="absolute inset-0 flex flex-col justify-between">
            {[0, 1, 2, 3].map(i => <div key={i} className="h-px w-full bg-[#dcd5c7]" />)}
          </div>
          <div className="absolute inset-0 flex items-end justify-around gap-[1.2vmin]">
            {heights.map((height, i) => <motion.div key={i} className="relative flex-1 rounded-t-[.85vmin] bg-[#2d7057]"
              style={{ height: `${height}%`, transformOrigin: 'bottom' }} initial={{ scaleY: 0 }} animate={{ scaleY: 1 }}
              transition={{ delay: 0.55 + i * 0.075, duration: 0.44, ease: EASE }}>
              <div className="absolute inset-x-0 top-0 h-[.75vmin] rounded-full bg-[#df5d39]" />
            </motion.div>)}
          </div>
          <motion.div className="absolute bottom-0 z-10 w-[.7vmin] bg-[#29263f]"
            style={{ height: '100%', left: '61%' }} initial={{ scaleY: 0, transformOrigin: 'bottom' }} animate={{ scaleY: 1 }}
            transition={{ delay: 2.8, duration: 0.48, ease: EASE }}>
            <div className="absolute -top-[1.2vmin] -left-[.7vmin] h-[2vmin] w-[2vmin] rounded-full border-[.5vmin] border-[#29263f] bg-[#df5d39]" />
            <div className="absolute -top-[4.4vmin] left-[1vmin] whitespace-nowrap rounded-full bg-[#29263f] px-[1vmin] py-[.6vmin] eyebrow text-[#f6f1e5]">CAPACITY</div>
          </motion.div>
        </div>
        <div className="absolute bottom-[7%] left-[7%] flex items-center gap-[3vmin] text-[1.25vmin] font-semibold">
          <span className="flex items-center gap-[.7vmin]"><i className="h-[1vmin] w-[1vmin] rounded-full bg-[#2d7057]" /> Recorded sales</span>
          <span className="flex items-center gap-[.7vmin]"><i className="h-[1vmin] w-[1vmin] rounded-full bg-[#df5d39]" /> Capacity marker</span>
          <span className="mono text-[#706d7d]">PORTIONS</span>
        </div>
      </motion.div>
      <motion.div className="absolute bottom-[7%] left-[6%] flex max-w-[30%] items-center gap-[1.1vmin] text-[1.75vmin] text-[#706d7d]"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 4.25 }}>
        <span className="h-[.55vmin] w-[4vmin] bg-[#df5d39]" /> Stock limits the prep suggestion.
      </motion.div>
      <motion.div className="absolute bottom-[3%] right-[7%] mono text-[1.05vmin] text-[#8a8492]"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 5.45 }}>Estimate — not a guarantee</motion.div>
    </motion.section>
  );
}
