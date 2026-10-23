import { motion } from 'framer-motion';

const EASE = [0.22, 1, 0.36, 1] as const;

export function Scene6() {
  return (
    <motion.section className="absolute inset-0 overflow-hidden" style={{ background: '#29263f', color: '#f6f1e5' }}
      initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9, filter: 'blur(8px)' }}
      transition={{ duration: 0.4, ease: EASE }}>
      <div className="film-grain" />
      <motion.div className="absolute left-[5%] top-[10%] h-[80%] w-[90%] rounded-[2.8vmin] border-[.55vmin] border-[#c9aa55]"
        initial={{ scale: 0.72, opacity: 0 }}
        animate={{ scale: [0.72, 1, 1, 0.22], opacity: [0, 1, 1, 0] }}
        transition={{ duration: 6.7, times: [0, 0.08, 0.82, 1], ease: EASE }} />
      <div className="absolute left-[8%] right-[8%] top-[15%] flex items-center justify-between">
        <div className="eyebrow text-[#e2c56e]">Separate experiments · outside operations</div>
        <motion.div className="flex h-[7vmin] w-[7vmin] items-center justify-center rounded-full border border-[#c9aa55]/75 text-[3vmin] text-[#e2c56e]"
          animate={{ rotate: [0, 8, -4, 0] }} transition={{ delay: 0.5, duration: 3.1 }}>
          <span className="mono">i</span>
        </motion.div>
      </div>
      <motion.h1 className="display absolute left-[8%] top-[24%] text-[6.4vmin] leading-[.95] font-extrabold tracking-[-.055em]"
        initial={{ opacity: 0, clipPath: 'inset(0 100% 0 0)' }} animate={{ opacity: 1, clipPath: 'inset(0 0% 0 0)' }} transition={{ delay: 0.45, duration: 0.62, ease: EASE }}>
        EXPERIMENTAL AI.<br /><span className="text-[#e2c56e]">ADVISORY ONLY.</span>
      </motion.h1>
      <motion.div className="absolute left-[8%] right-[8%] top-[46%] h-px origin-left bg-[#807d8d]"
        initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 1.1, duration: 0.45 }} />
      <div className="absolute left-[8%] right-[8%] top-[51%] grid grid-cols-3 gap-[2.4vmin]">
        {[
          ['SYNTHETIC DEMO', 'Sample data only—not workspace records. Temporary output; no operational changes.'],
          ['OWNER HISTORY · OPT IN', 'Preview date range + sales/prep counts; explicit consent per request. Archived sales and prep only.'],
          ['LOCAL FORECAST CHECK', 'Owner-approved; records stay local. Rules vs prior-week baseline on held-out dates.'],
        ].map(([title, description], i) => (
          <motion.div key={title} className="border-l-[.45vmin] border-[#c9aa55] pl-[1.5vmin]"
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.35 + i * 0.35, duration: 0.38 }}>
            <div className="eyebrow text-[#e2c56e]" style={{ fontSize: '1.95vmin', letterSpacing: '.1em' }}>{title}</div>
            <div className="mt-[.9vmin] text-[1.9vmin] leading-snug text-[#d1ccdc]">{description}</div>
          </motion.div>
        ))}
      </div>
      <motion.div className="absolute bottom-[4.5%] left-[8%] right-[8%] border-t border-[#c9aa55]/65 pt-[1vmin] mono leading-snug text-[#e7d6a1]"
        style={{ fontSize: '1.35vmin' }}
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2.9, duration: 0.35 }}>
        Owner-history AI: only archived sales/prep after preview + explicit consent; excludes stock + current data. Both AI outputs are temporary, unvalidated and change no operations. Local check stays local. Leftovers proxy waste—not discarded weight/cost. Checks do not validate AI, purchasing or food safety.
      </motion.div>
    </motion.section>
  );
}
