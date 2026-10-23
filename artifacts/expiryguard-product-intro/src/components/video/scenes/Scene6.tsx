import { motion } from 'framer-motion';

const EASE = [0.22, 1, 0.36, 1] as const;
const lanes = [
  {
    title: 'SYNTHETIC SAMPLE DATA',
    body: 'Temporary demo output. Not workspace records.',
    mark: '01 / GENERATED',
  },
  {
    title: 'OWNER HISTORY · OPT IN',
    body: 'Preview date + sales/prep counts. Explicit consent per request. Archived sales/prep only; no stock or current data.',
    mark: '02 / CONSENT',
  },
  {
    title: 'LOCAL HELD-OUT CHECK',
    body: 'Owner-approved. Records stay local. Rules vs prior-week baseline.',
    mark: '03 / LOCAL',
  },
];

export function Scene6() {
  return (
    <motion.section
      className="absolute inset-0 overflow-hidden"
      style={{ background: '#29263f', color: '#f6f1e5' }}
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.92, filter: 'blur(7px)' }}
      transition={{ duration: 0.4, ease: EASE }}
    >
      <div className="film-grain" />
      <motion.div
        className="absolute left-[5%] top-[7%] h-[86%] w-[90%] rounded-[2.6vmin] border-[.5vmin] border-[#c9aa55]"
        initial={{ scale: 0.82, opacity: 0 }}
        animate={{ scale: [0.82, 1, 1, 0.26], opacity: [0, 1, 1, 0] }}
        transition={{ duration: 6.75, times: [0, 0.1, 0.83, 1], ease: EASE }}
      />
      <div className="absolute left-[8%] top-[11%]">
        <div className="eyebrow text-[#e2c56e]">Separate experiments · outside operations</div>
        <motion.h1
          className="display mt-[1.2vmin] text-[6.4vmin] leading-[.92] font-extrabold tracking-[-.06em]"
          initial={{ opacity: 0, clipPath: 'inset(0 100% 0 0)' }}
          animate={{ opacity: 1, clipPath: 'inset(0 0% 0 0)' }}
          transition={{ delay: 0.35, duration: 0.58, ease: EASE }}
        >
          AI FORECASTS.<br /><span className="text-[#e2c56e]">ADVISORY ONLY.</span>
        </motion.h1>
      </div>
      <motion.div className="absolute right-[9%] top-[14%] h-[7vmin] w-[7vmin] rounded-full border border-[#c9aa55]/75 text-center leading-[7vmin] text-[2.6vmin] text-[#e2c56e]" animate={{ rotate: [0, 8, -4, 0] }} transition={{ delay: 0.55, duration: 3.1 }}>
        <span className="mono">i</span>
      </motion.div>
      <motion.div className="absolute left-[8%] right-[8%] top-[43%] h-px origin-left bg-[#807d8d]" initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 0.9, duration: 0.45 }} />
      <div className="absolute left-[8%] right-[8%] top-[48%] grid grid-cols-3 gap-[2.2vmin]">
        {lanes.map((lane, i) => (
          <motion.div
            key={lane.title}
            className={`relative min-h-[23vmin] border-l-[.45vmin] pl-[1.45vmin] ${i === 1 ? 'border-[#e2c56e]' : i === 2 ? 'border-[#87b89d]' : 'border-[#df8a66]'}`}
            initial={{ opacity: 0, y: 18, rotateX: 7 }}
            animate={{ opacity: 1, y: 0, rotateX: 0 }}
            transition={{ delay: 1.05 + i * 0.34, duration: 0.4, ease: EASE }}
          >
            <div className="mono mb-[.65vmin] text-[1.05vmin] text-[#a8a3b3]">{lane.mark}</div>
            <div className="eyebrow text-[#e2c56e]" style={{ fontSize: '1.6vmin', letterSpacing: '.075em' }}>{lane.title}</div>
            <div className="mt-[.8vmin] text-[1.7vmin] leading-snug text-[#d1ccdc]">{lane.body}</div>
            {i < 2 && <motion.div className="absolute -right-[1.5vmin] top-[20%] h-[.8vmin] w-[.8vmin] rounded-full bg-[#e2c56e]" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 1.75 + i * 0.3, type: 'spring', stiffness: 280 }} />}
          </motion.div>
        ))}
      </div>
      <motion.div
        className="absolute bottom-[5.5%] left-[8%] right-[8%] border-t border-[#c9aa55]/65 pt-[1.3vmin] text-[1.42vmin] leading-[1.3] text-[#e7d6a1]"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 2.75, duration: 0.35 }}
      >
        Both AI outputs are temporary, advisory and unvalidated; they change no operations. The local check is separate from AI and stays local. Leftovers are a proxy—not disposal weight or cost. No check validates AI, purchasing or food safety.
      </motion.div>
    </motion.section>
  );
}
