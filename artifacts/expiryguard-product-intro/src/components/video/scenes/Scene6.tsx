import { motion } from 'framer-motion';

const EASE = [0.22, 1, 0.36, 1] as const;

export function Scene6() {
  return (
    <motion.section className="absolute inset-0 overflow-hidden" style={{ background: '#29263f', color: '#f6f1e5' }}
      initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9, filter: 'blur(8px)' }}
      transition={{ duration: 0.4, ease: EASE }}>
      <div className="film-grain" />
      <motion.div className="absolute left-[8%] top-[17%] h-[64%] w-[84%] rounded-[2.8vmin] border-[.55vmin] border-[#c9aa55]"
        initial={{ scale: 0.72, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.48, ease: EASE }} />
      <div className="absolute left-[10%] top-[21%] eyebrow text-[#e2c56e]">Experimental AI lab · synthetic sample only</div>
      <motion.h1 className="display absolute left-[10%] top-[34%] max-w-[74%] text-[7.5vmin] leading-[.95] font-extrabold tracking-[-.055em]"
        initial={{ opacity: 0, clipPath: 'inset(0 100% 0 0)' }} animate={{ opacity: 1, clipPath: 'inset(0 0% 0 0)' }} transition={{ delay: 0.65, duration: 0.62, ease: EASE }}>
        Illustrative output.<br /><span className="text-[#e2c56e]">Not validated</span> against<br />real business outcomes.
      </motion.h1>
      <motion.div className="absolute left-[10%] top-[66%] h-px w-[72%] origin-left bg-[#807d8d]"
        initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 1.7, duration: 0.45 }} />
      <div className="absolute left-[10%] top-[71%] grid w-[73%] grid-cols-3 gap-[3vmin]">
        {[
          ['SEPARATE DATA', 'Not your workspace records'],
          ['NO STOCK CHANGES', 'No plans or orders updated'],
          ['NO APPROVALS', 'No action taken from output'],
        ].map(([title, description], i) => (
          <motion.div key={title} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 2.05 + i * 0.43, duration: 0.38 }}>
            <div className="eyebrow text-[#e2c56e]">{title}</div>
            <div className="mt-[.7vmin] text-[1.5vmin] text-[#d1ccdc]">{description}</div>
          </motion.div>
        ))}
      </div>
      <motion.div className="absolute bottom-[4.5%] left-[10%] right-[10%] border-t border-[#c9aa55]/65 pt-[1.1vmin] mono text-[1.18vmin] text-[#e7d6a1]"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2.7, duration: 0.35 }}>
        Not trained on real business-specific data · do not use for real purchasing or food-safety decisions.
      </motion.div>
      <motion.div className="absolute left-[5%] top-[48%] h-[.55vmin] w-[36%] bg-[#df5d39]"
        initial={{ scaleX: 0, transformOrigin: 'left' }} animate={{ scaleX: 1 }} transition={{ delay: 2.8, duration: 0.4 }} />
      <motion.div className="absolute right-[7%] top-[11%] flex h-[10vmin] w-[10vmin] items-center justify-center rounded-full border border-[#c9aa55]/75 text-[4vmin] text-[#e2c56e]"
        animate={{ rotate: [0, 8, -4, 0], scale: [1, 1.06, 1] }} transition={{ delay: 0.5, duration: 3.1 }}>
        <span className="mono text-[3vmin]">i</span>
      </motion.div>
    </motion.section>
  );
}
