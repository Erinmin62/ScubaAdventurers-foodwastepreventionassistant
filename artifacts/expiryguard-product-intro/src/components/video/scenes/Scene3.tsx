import { motion } from 'framer-motion';

const rows = [
  { ingredient: 'Fresh milk', batch: 'BATCH A', expiry: '2 days', link: 'Oat latte', tone: '#f1e4d4' },
  { ingredient: 'Cherry tomato', batch: 'BATCH B', expiry: '4 days', link: 'Lunch bowl', tone: '#fbf8ef' },
  { ingredient: 'Oat cream', batch: 'BATCH C', expiry: '6 days', link: 'Chai', tone: '#fbf8ef' },
];
const EASE = [0.22, 1, 0.36, 1] as const;

export function Scene3() {
  return (
    <motion.section
      className="absolute inset-0 overflow-hidden"
      style={{ background: '#29263f', color: '#f6f1e5' }}
      initial={{ opacity: 0, x: '2%', scale: 1.035 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 1.1, filter: 'blur(7px)' }}
      transition={{ duration: 0.42, ease: EASE }}
    >
      <div className="absolute inset-0 opacity-20 paper-grid" />
      <div className="absolute left-[5.5%] top-[17%] w-[28%]">
        <div className="eyebrow text-[#d6b65e]">Pantry → menu → service</div>
        <motion.h1
          className="display mt-[2.5vmin] text-[8.3vmin] leading-[.88] font-extrabold tracking-[-.065em]"
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.48, ease: EASE }}
        >
          FAMILIAR<br /><span className="text-[#e36a45]">INPUTS.</span>
        </motion.h1>
        <motion.p
          className="mt-[2.2vmin] max-w-[31vmin] text-[2.25vmin] leading-[1.18] text-[#d6d0df]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.45, duration: 0.36 }}
        >
          Structured fields and clear links support consistency.
        </motion.p>
        <motion.div
          className="mt-[3.5vmin] flex items-center gap-[.9vmin] mono text-[1.5vmin] text-[#d6d0df]"
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 3.55, duration: 0.35 }}
        >
          <span className="h-[.5vmin] w-[4vmin] bg-[#d6b65e]" /> Sales · prep · leftovers
        </motion.div>
      </div>
      <motion.div
        className="film-shadow absolute right-[5%] top-[10%] h-[80%] w-[59%] overflow-hidden rounded-[2.4vmin] border border-[#cfc5b4] bg-[#f8f3e7] text-[#29263f]"
        initial={{ scale: 0.78, rotateY: -9, x: 22, opacity: 0 }}
        animate={{ scale: 1, rotateY: 0, x: 0, opacity: 1 }}
        transition={{ duration: 0.7, ease: EASE }}
        exit={{ scale: 1.08, x: 20, opacity: 0 }}
      >
        <div className="flex items-center justify-between border-b border-[#ded5c5] px-[2.3vmin] py-[1.5vmin]">
          <div>
            <div className="eyebrow text-[#2d7057]" style={{ fontSize: '1.35vmin' }}>Illustrative workspace · sample records</div>
            <div className="display mt-[.45vmin] text-[3.6vmin] font-bold tracking-[-.04em]">Pantry &amp; recipe links</div>
          </div>
          <div className="rounded-full bg-[#e8efe2] px-[1.2vmin] py-[.75vmin] eyebrow text-[#2d7057]" style={{ fontSize: '1.2vmin' }}>BATCH VIEW</div>
        </div>
        <div className="grid grid-cols-[1.1fr_.55fr_.65fr_.9fr] gap-[.7vmin] bg-[#eee8db] px-[1.9vmin] py-[1vmin] eyebrow text-[1.05vmin] text-[#706d7d]">
          <span>Ingredient</span><span>Usable</span><span>Expiry</span><span>Recipe link</span>
        </div>
        <div>
          {rows.map((row, i) => (
            <motion.div
              key={row.ingredient}
              className="relative grid grid-cols-[1.1fr_.55fr_.65fr_.9fr] items-center gap-[.7vmin] border-b border-[#e7e0d4] px-[1.9vmin] py-[1.75vmin]"
              style={{ background: row.tone }}
              initial={{ opacity: 0, x: 24, clipPath: 'inset(0 100% 0 0)' }}
              animate={{ opacity: 1, x: 0, clipPath: 'inset(0 0% 0 0)' }}
              transition={{ delay: 0.36 + i * 0.26, duration: 0.4, ease: EASE }}
            >
              <span>
                <span className="block text-[1.85vmin] font-bold">{row.ingredient}</span>
                <span className="mono text-[1.05vmin] text-[#8d8793]">{row.batch}</span>
              </span>
              <span className="mono text-[1.35vmin]">Usable</span>
              <span className="mono text-[1.35vmin]">{row.expiry}</span>
              <motion.span
                className="text-[1.45vmin] font-semibold text-[#2d7057]"
                animate={i === 0 ? { color: ['#2d7057', '#df5d39', '#2d7057'] } : {}}
                transition={i === 0 ? { delay: 1.8, duration: 0.7, ease: EASE } : undefined}
              >
                {row.link}
              </motion.span>
            </motion.div>
          ))}
        </div>
        <motion.div
          className="mx-[1.9vmin] mt-[1.25vmin] rounded-[1.1vmin] border border-dashed border-[#b8ac98] px-[1.45vmin] py-[1vmin]"
          initial={{ opacity: 0, y: 10, scaleY: 0.7 }}
          animate={{ opacity: 1, y: 0, scaleY: 1 }}
          transition={{ delay: 2.55, duration: 0.38, ease: EASE }}
        >
          <span className="eyebrow text-[#706d7d]" style={{ fontSize: '1.25vmin' }}>AI recipe draft · owner review</span>
          <div className="mt-[.45vmin] flex justify-between text-[1.35vmin]"><span>Draft uses listed pantry ingredients</span><span className="mono">Review before saving</span></div>
        </motion.div>
        <motion.div
          className="absolute right-[8%] top-[23%] rounded-full border-[.6vmin] border-[#df5d39] px-[1.25vmin] py-[.55vmin] eyebrow text-[#b94d30]"
          initial={{ scale: 0, rotate: -12 }}
          animate={{ scale: [0, 1.12, 1], rotate: 0 }}
          transition={{ delay: 2.1, duration: 0.46, ease: EASE }}
        >
          REVIEW
        </motion.div>
        <motion.div className="absolute bottom-[6%] left-[2%] flex gap-[.8vmin]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 3.15 }}>
          {['SALES', 'PREPARATION', 'LEFTOVERS'].map((label, i) => (
            <motion.div key={label} className="rounded-full bg-[#e8efe2] px-[1.1vmin] py-[.6vmin] mono text-[1.05vmin] text-[#2d7057]" initial={{ y: 7, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 3.15 + i * 0.12 }}>
              {label}
            </motion.div>
          ))}
        </motion.div>
      </motion.div>
      <motion.div className="absolute bottom-[4.7%] right-[6%] eyebrow text-[#c9bdcf]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 4.6 }}>
        Batch-level expiry · monitored hourly
      </motion.div>
    </motion.section>
  );
}
