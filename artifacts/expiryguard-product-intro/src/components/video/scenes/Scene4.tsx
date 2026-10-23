import { motion } from 'framer-motion';

const EASE = [0.22, 1, 0.36, 1] as const;
const heights = [34, 52, 42, 77, 59, 85, 66, 92, 72, 81];

export function Scene4() {
  return (
    <motion.section
      className="absolute inset-0 overflow-hidden"
      style={{ background: '#f6f1e5', color: '#29263f' }}
      initial={{ opacity: 0, scale: 1.06, rotateZ: -0.7 }}
      animate={{ opacity: 1, scale: 1, rotateZ: 0 }}
      exit={{ opacity: 0, scale: 0.97, x: '-2%' }}
      transition={{ duration: 0.42, ease: EASE }}
    >
      <div className="absolute left-[5.5%] top-[14%] w-[27%]">
        <div className="eyebrow text-[#2d7057]">Live operational plan</div>
        <motion.h1
          className="display mt-[2.2vmin] text-[8.4vmin] leading-[.88] font-extrabold tracking-[-.065em]"
          initial={{ opacity: 0, y: 20, clipPath: 'inset(0 0 100% 0)' }}
          animate={{ opacity: 1, y: 0, clipPath: 'inset(0 0 0% 0)' }}
          transition={{ duration: 0.52, ease: EASE }}
        >
          SALES<br /><span className="text-[#df5d39]">INFORM.</span><br />STOCK<br />LIMITS.
        </motion.h1>
        <motion.p
          className="mt-[2.2vmin] text-[2.05vmin] leading-[1.2] text-[#706d7d]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.52, duration: 0.35 }}
        >
          Recent workspace sales meet usable recipe stock.
        </motion.p>
        <motion.div
          className="mt-[2.1vmin] max-w-[31vmin] border-l-[.55vmin] border-[#df5d39] pl-[1.2vmin] mono text-[1.45vmin] leading-snug text-[#706d7d]"
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 4.1, duration: 0.35 }}
        >
          7-day average · weekday adjustment
        </motion.div>
      </div>
      <motion.div
        className="absolute right-[6%] top-[13%] h-[72%] w-[59%] overflow-hidden rounded-[2.4vmin] border border-[#d6cdbd] bg-[#fbf8ef] p-[2.1vmin] film-shadow"
        initial={{ scale: 0.8, rotateY: 8, opacity: 0 }}
        animate={{ scale: 1, rotateY: 0, opacity: 1 }}
        transition={{ duration: 0.68, ease: EASE }}
        exit={{ scale: 1.12, rotateY: -4, opacity: 0 }}
      >
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="eyebrow text-[#706d7d]" style={{ fontSize: '1.4vmin' }}>Demand by dish · illustrative bars</div>
            <div className="display mt-[.5vmin] text-[3.45vmin] font-bold tracking-[-.04em]">Suggested prep</div>
          </div>
          <div className="rounded-full border border-[#bc8734]/50 bg-[#f2e7c9] px-[1.1vmin] py-[.65vmin] mono text-[1.05vmin] font-semibold text-[#815d20]">NO RESULT CLAIM</div>
        </div>
        <div className="absolute bottom-[17%] left-[8%] right-[8%] top-[28%]">
          <div className="absolute inset-0 flex flex-col justify-between">{[0, 1, 2, 3].map(i => <div key={i} className="h-px w-full bg-[#dcd5c7]" />)}</div>
          <div className="absolute inset-0 flex items-end justify-around gap-[1.1vmin]">
            {heights.map((height, i) => (
              <motion.div
                key={i}
                className="relative flex-1 rounded-t-[.75vmin] bg-[#2d7057]"
                style={{ height: `${height}%`, transformOrigin: 'bottom' }}
                initial={{ scaleY: 0 }}
                animate={{ scaleY: 1 }}
                transition={{ delay: 0.45 + i * 0.08, duration: 0.42, ease: EASE }}
              >
                <div className="absolute inset-x-0 top-0 h-[.65vmin] rounded-full bg-[#df5d39]" />
              </motion.div>
            ))}
          </div>
          <motion.div
            className="absolute bottom-0 z-10 w-[.65vmin] bg-[#29263f]"
            style={{ height: '100%', left: '61%' }}
            initial={{ scaleY: 0, transformOrigin: 'bottom' }}
            animate={{ scaleY: 1 }}
            transition={{ delay: 2.2, duration: 0.48, ease: EASE }}
          >
            <div className="absolute -top-[1.1vmin] -left-[.65vmin] h-[1.9vmin] w-[1.9vmin] rounded-full border-[.45vmin] border-[#29263f] bg-[#df5d39]" />
            <div className="absolute -top-[4vmin] left-[1vmin] whitespace-nowrap rounded-full bg-[#29263f] px-[.95vmin] py-[.55vmin] eyebrow text-[#f6f1e5]" style={{ fontSize: '1.2vmin' }}>USABLE STOCK</div>
          </motion.div>
          <motion.div className="absolute bottom-[3%] left-[4%] rounded-full bg-[#df5d39] px-[1.25vmin] py-[.7vmin] mono text-[1.2vmin] font-bold text-[#fff7e9]" initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 2.8, duration: 0.35 }}>
            SUGGESTED PREP
          </motion.div>
        </div>
        <div className="absolute bottom-[6%] right-[6%] flex items-center gap-[1.5vmin] text-[1.15vmin] font-semibold">
          <span className="flex items-center gap-[.6vmin]"><i className="h-[.9vmin] w-[.9vmin] rounded-full bg-[#2d7057]" /> Recent sales</span>
          <span className="flex items-center gap-[.6vmin]"><i className="h-[.9vmin] w-[.9vmin] rounded-full bg-[#df5d39]" /> Usable recipe stock</span>
        </div>
      </motion.div>
      <motion.div
        className="absolute bottom-[6%] left-[5.5%] max-w-[28%] text-[1.6vmin] font-semibold text-[#706d7d]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 3.05, duration: 0.35 }}
      >
        Estimate, not guarantee.<br /><span className="mono text-[1.3vmin]">Rules-based · not experimental AI</span>
      </motion.div>
    </motion.section>
  );
}
