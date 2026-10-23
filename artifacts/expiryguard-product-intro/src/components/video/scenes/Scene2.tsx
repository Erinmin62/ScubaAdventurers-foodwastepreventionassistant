import { motion } from 'framer-motion';

const EASE = [0.22, 1, 0.36, 1] as const;

function FlowNode({ title, className, delay, accent = false }: { title: string; className: string; delay: number; accent?: boolean }) {
  return (
    <motion.div
      className={`absolute z-10 flex min-h-[10vmin] items-center gap-[1.5vmin] rounded-[1.8vmin] border border-[#d7cdb9] bg-[#fbf8ef] px-[2vmin] py-[1.5vmin] film-shadow ${className}`}
      initial={{ opacity: 0, scale: 0.78, rotateY: 9 }}
      animate={{ opacity: 1, scale: 1, rotateY: 0 }}
      transition={{ delay, duration: 0.48, ease: EASE }}
    >
      <span className={`h-[2.2vmin] w-[2.2vmin] shrink-0 rounded-full border-[.55vmin] ${accent ? 'border-[#df5d39]' : 'border-[#2d7057]'}`} />
      <span className="eyebrow text-[#29263f]" style={{ fontSize: '1.55vmin', letterSpacing: '.08em' }}>{title}</span>
    </motion.div>
  );
}

export function Scene2() {
  return (
    <motion.section
      className="absolute inset-0 overflow-hidden"
      style={{ background: '#e7eddf', color: '#29263f' }}
      initial={{ opacity: 0, scale: 1.08, rotateZ: 1 }}
      animate={{ opacity: 1, scale: 1, rotateZ: 0 }}
      exit={{ opacity: 0, scale: 0.96, rotateZ: -1 }}
      transition={{ duration: 0.42, ease: EASE }}
    >
      <div className="absolute inset-0" style={{ background: 'linear-gradient(120deg,#dbe7d8 0 48%,#f6f1e5 48% 100%)' }} />
      <div className="film-grain" />
      <motion.div
        className="absolute inset-0"
        initial={{ scale: 1.18, x: '3%', y: '2%' }}
        animate={{ scale: 1, x: 0, y: 0 }}
        transition={{ duration: 1.2, ease: EASE }}
      >
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 1600 900" fill="none" aria-hidden="true">
          <motion.path d="M470 288 C610 288 620 430 755 430 S930 270 1060 270 M755 430 C850 430 875 600 1050 600" stroke="#2d7057" strokeWidth="4" strokeDasharray="9 13" initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 0.72 }} transition={{ delay: 0.55, duration: 1.7, ease: EASE }} />
          <motion.path d="M755 430 C770 535 810 630 930 674" stroke="#df5d39" strokeWidth="5" strokeDasharray="2 14" strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 1.8, duration: 0.6, ease: EASE }} />
        </svg>
        <FlowNode title="PANTRY + EXPIRY BATCHES" className="left-[7%] top-[25%] w-[31%]" delay={0.05} accent />
        <FlowNode title="MENU ↔ RECIPES" className="left-[40%] top-[42%] w-[26%]" delay={0.35} />
        <FlowNode title="SALES · PREP · LEFTOVERS" className="left-[8%] top-[58%] w-[33%]" delay={0.65} />
        <FlowNode title="RULES-BASED PLAN" className="right-[7%] top-[24%] w-[28%]" delay={0.95} />
        <motion.div
          className="absolute right-[10%] top-[58%] z-20 rounded-[2vmin] border-[.6vmin] border-[#df5d39] bg-[#29263f] px-[2.4vmin] py-[1.65vmin] text-[#f6f1e5]"
          initial={{ opacity: 0, scale: 0.3, rotate: -10 }}
          animate={{ opacity: 1, scale: 1, rotate: 0 }}
          transition={{ delay: 1.65, type: 'spring', stiffness: 260, damping: 18 }}
        >
          <div className="eyebrow text-[#e1b34d]">OWNER REVIEW</div>
          <div className="mt-[.5vmin] text-[2.2vmin] font-bold">Outcome · not an order</div>
        </motion.div>
      </motion.div>
      <div className="absolute left-[6%] top-[6%] z-30">
        <div className="eyebrow text-[#2d7057]">One reusable food workflow</div>
        <motion.div className="mt-[1vmin] text-[2.1vmin] font-semibold" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 2.1, duration: 0.35 }}>
          Cafes · restaurants · food vendors · cloud kitchens
        </motion.div>
      </div>
      <motion.div
        className="absolute bottom-[5%] left-[6%] z-30 flex items-center gap-[1.2vmin] rounded-[1.2vmin] bg-[#29263f] px-[1.7vmin] py-[1vmin] text-[#f6f1e5]"
        initial={{ opacity: 0, x: -14, scaleX: 0.8 }}
        animate={{ opacity: 1, x: 0, scaleX: 1 }}
        transition={{ delay: 3.35, duration: 0.38, ease: EASE }}
      >
        <span className="eyebrow text-[#e1b34d]">Potential Orbyte fit</span>
        <span className="mono text-[1.35vmin]">Standalone today · no live integration</span>
      </motion.div>
      <motion.div
        className="absolute right-[5%] bottom-[6%] z-30 mono text-[1.2vmin] text-[#706d7d]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2.75, duration: 0.3 }}
      >
        SAMPLE WORKSPACE
      </motion.div>
    </motion.section>
  );
}
