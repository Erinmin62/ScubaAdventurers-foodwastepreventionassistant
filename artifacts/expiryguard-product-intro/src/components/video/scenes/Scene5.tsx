import { motion } from 'framer-motion';

const EASE = [0.22, 1, 0.36, 1] as const;

export function Scene5() {
  return (
    <motion.section
      className="absolute inset-0 overflow-hidden"
      style={{ background: '#e7eddf', color: '#29263f' }}
      initial={{ opacity: 0, x: '2%', scale: 1.03 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 1.08, filter: 'blur(6px)' }}
      transition={{ duration: 0.4, ease: EASE }}
    >
      <div className="absolute inset-0" style={{ background: 'linear-gradient(118deg,#d9e4d7 0 43%,#f1ebdc 43% 100%)' }} />
      <div className="absolute left-[6%] top-[13%] w-[36%]">
        <div className="eyebrow text-[#2d7057]">Daily routines · human in the loop</div>
        <motion.h1
          className="display mt-[2.4vmin] text-[9.7vmin] leading-[.84] font-extrabold tracking-[-.075em]"
          initial={{ opacity: 0, scale: 0.86, x: -12 }}
          animate={{ opacity: 1, scale: 1, x: 0 }}
          transition={{ duration: 0.52, ease: EASE }}
        >
          OWNER<br /><span className="text-[#df5d39]">DECIDES.</span>
        </motion.h1>
        <motion.p className="mt-[2.2vmin] max-w-[34vmin] text-[2.3vmin] leading-tight font-semibold text-[#706d7d]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6, duration: 0.35 }}>
          Review the plan. Record the choice.
        </motion.p>
        <motion.div className="mt-[2.6vmin] flex flex-col gap-[.7vmin] text-[1.55vmin] font-semibold text-[#2d7057]" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 3.05, duration: 0.38 }}>
          <span>Expiry checks · hourly</span>
          <span>Follow-up after approval · owner observations</span>
        </motion.div>
      </div>
      <motion.article
        className="film-shadow absolute right-[7%] top-[12%] w-[48%] rounded-[2.5vmin] border border-[#d6cbb9] bg-[#fbf8ef] p-[2.4vmin]"
        initial={{ opacity: 0, scale: 0.76, rotateY: 10, x: 24 }}
        animate={{ opacity: 1, scale: 1, rotateY: 0, x: 0 }}
        transition={{ delay: 0.15, duration: 0.68, ease: EASE }}
      >
        <div className="flex items-center justify-between border-b border-[#e5ddcf] pb-[1.35vmin]">
          <span className="eyebrow text-[#bc8734]" style={{ fontSize: '1.45vmin' }}>Waste-aware reorder suggestion</span>
          <span className="mono text-[1.25vmin] text-[#706d7d]">DRAFT</span>
        </div>
        <motion.div className="mt-[1.8vmin] flex items-center justify-between" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.52, duration: 0.32 }}>
          <div className="display text-[3.8vmin] font-bold tracking-[-.05em]">Review before action</div>
          <span className="rounded-full bg-[#f2e5d4] px-[1.1vmin] py-[.65vmin] eyebrow text-[#b94d30]" style={{ fontSize: '1.2vmin' }}>RULES</span>
        </motion.div>
        <div className="mt-[1vmin] text-[1.55vmin] leading-snug text-[#706d7d]">Demand · expiry · lead time · safety stock · shelf life</div>
        <motion.div className="mt-[1.7vmin] rounded-[1.15vmin] bg-[#eee8db] p-[1.35vmin]" initial={{ scaleX: 0.65, opacity: 0 }} animate={{ scaleX: 1, opacity: 1 }} transition={{ delay: 0.85, duration: 0.36, ease: EASE }}>
          <div className="mono text-[1.15vmin] text-[#706d7d]">OWNER WORKSPACE · APPROVAL REQUIRED</div>
          <div className="mt-[.6vmin] text-[1.8vmin] font-bold">Edit · approve · reject</div>
        </motion.div>
        <motion.div className="mt-[1.45vmin] border-t border-[#e5ddcf] pt-[1.2vmin] text-[1.45vmin] font-semibold text-[#b94d30]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.25, duration: 0.3 }}>
          No supplier order is placed automatically.
        </motion.div>
        <motion.div className="absolute -bottom-[2.7vmin] -right-[2.1vmin] grid h-[8vmin] w-[8vmin] place-items-center rounded-full border-[.7vmin] border-[#2d7057] bg-[#e7eddf] text-center mono text-[1.05vmin] font-bold leading-tight text-[#2d7057]" initial={{ scale: 0, rotate: -30 }} animate={{ scale: [0, 1.13, 1], rotate: 0 }} transition={{ delay: 1.55, duration: 0.48, ease: EASE }}>
          APPROVAL<br />REQUIRED
        </motion.div>
      </motion.article>
      <motion.div
        className="absolute right-[5%] bottom-[7%] w-[56%] overflow-hidden rounded-[1.4vmin] border border-[#d6cbb9] bg-[#29263f] px-[1.5vmin] py-[1.1vmin] text-[#f6f1e5]"
        initial={{ scaleX: 0.55, opacity: 0, transformOrigin: 'right' }}
        animate={{ scaleX: 1, opacity: 1 }}
        transition={{ delay: 2.05, duration: 0.52, ease: EASE }}
      >
        <div className="flex items-center justify-between">
          <span className="eyebrow text-[#e1b34d]" style={{ fontSize: '1.3vmin' }}>Searchable activity · Ledger</span>
          <span className="mono text-[1.15vmin] text-[#d1ccdc]">IMPORT · EDIT · APPROVED · REJECTED</span>
        </div>
        <motion.div className="mt-[.9vmin] h-[.28vmin] w-full origin-left bg-[#df5d39]" initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 2.6, duration: 0.48 }} />
      </motion.div>
      <motion.div
        className="absolute left-[6%] bottom-[7%] h-[.65vmin] w-[38%] origin-left bg-[#29263f]"
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ delay: 0.75, duration: 0.52 }}
      />
    </motion.section>
  );
}
