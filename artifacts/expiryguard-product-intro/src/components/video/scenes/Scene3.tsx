import { motion } from 'framer-motion';

const rows = [
  { name: 'Fresh milk', category: 'DAIRY · BATCH A', amount: 'Stock', expiry: '2 days', risk: 'REVIEW' },
  { name: 'Cherry tomato', category: 'PRODUCE · BATCH B', amount: 'Stock', expiry: '4 days', risk: 'WATCH' },
  { name: 'Oat cream', category: 'DAIRY ALT · BATCH C', amount: 'Stock', expiry: '6 days', risk: 'CLEAR' },
];
const EASE = [0.22, 1, 0.36, 1] as const;

export function Scene3() {
  return (
    <motion.section className="absolute inset-0 overflow-hidden" style={{ background: '#29263f', color: '#f6f1e5' }}
      initial={{ opacity: 0, x: '3%', scale: 1.04 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, scale: 1.12, filter: 'blur(8px)' }}
      transition={{ duration: 0.45, ease: EASE }}>
      <div className="absolute inset-0 opacity-20 paper-grid" />
      <div className="absolute left-[6%] top-[13%] w-[32%]">
        <div className="eyebrow text-[#d6b65e]">Stock → recipes → service</div>
        <motion.h1 className="display mt-[3.2vmin] text-[8.7vmin] leading-[.89] font-extrabold tracking-[-.06em]"
          initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.52, ease: EASE }}>THE PANTRY,<br /><span className="text-[#e36a45]">AT A GLANCE.</span></motion.h1>
        <motion.p className="mt-[3vmin] max-w-[29vmin] text-[2.6vmin] leading-[1.22] text-[#d6d0df]"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.45, duration: 0.4 }}>Each batch keeps its own expiry date.</motion.p>
        <motion.div className="mt-[6vmin] flex items-center gap-[1.2vmin] text-[1.6vmin] text-[#d6d0df]"
          initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 4.2, duration: 0.4 }}>
          <span className="h-[.55vmin] w-[5.5vmin] bg-[#d6b65e]" /> Sales, prep and leftovers complete the daily picture.
        </motion.div>
      </div>

      <motion.div className="film-shadow absolute right-[6%] top-[12%] h-[76%] w-[52%] overflow-hidden rounded-[2.5vmin] border border-[#cfc5b4] bg-[#f8f3e7] text-[#29263f]"
        initial={{ scale: 0.74, rotateY: -10, x: 30, opacity: 0 }} animate={{ scale: 1, rotateY: 0, x: 0, opacity: 1 }}
        transition={{ duration: 0.78, ease: EASE }}>
        <div className="flex items-center justify-between border-b border-[#ded5c5] px-[2.6vmin] py-[1.8vmin]">
          <div><div className="eyebrow text-[#2d7057]">Illustrative workspace · sample records</div><div className="display mt-[.7vmin] text-[3.7vmin] font-bold tracking-[-.04em]">Pantry &amp; recipe flow</div></div>
          <div className="rounded-full bg-[#e8efe2] px-[1.4vmin] py-[1vmin] eyebrow text-[#2d7057]">SAMPLE</div>
        </div>
        <div className="grid grid-cols-[1.3fr_.6fr_.65fr_.65fr] gap-[1vmin] bg-[#eee8db] px-[2.2vmin] py-[1.2vmin] eyebrow text-[1.1vmin] text-[#706d7d]">
          <span>Ingredient</span><span>Usable</span><span>Expiry</span><span>Review</span>
        </div>
        <div className="relative">
          {rows.map((row, i) => <motion.div key={row.name}
            className={`relative grid grid-cols-[1.3fr_.6fr_.65fr_.65fr] items-center gap-[1vmin] border-b border-[#e7e0d4] px-[2.2vmin] py-[2.25vmin] ${i === 0 ? 'bg-[#f1e4d4]' : ''}`}
            initial={{ opacity: 0, x: 28 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.45 + i * 0.32, duration: 0.45, ease: EASE }}>
            <span><span className="block text-[1.8vmin] font-bold">{row.name}</span><span className="mono text-[1.05vmin] text-[#8d8793]">{row.category}</span></span>
            <span className="mono text-[1.45vmin]">{row.amount}</span>
            <span className="mono text-[1.45vmin]">{row.expiry}</span>
            <span className={`w-fit rounded-full px-[1vmin] py-[.65vmin] mono text-[1vmin] font-semibold ${i === 0 ? 'bg-[#df5d39] text-[#fff7e9]' : i === 1 ? 'bg-[#f1e3bb] text-[#8a6121]' : 'bg-[#e3eee3] text-[#2d7057]'}`}>{row.risk}</span>
          </motion.div>)}
        </div>
        <motion.div className="mx-[2.2vmin] mt-[2.1vmin] rounded-[1.2vmin] border border-dashed border-[#b8ac98] px-[1.6vmin] py-[1.25vmin]"
          initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} transition={{ delay: 4.1, duration: 0.45 }}>
          <span className="eyebrow text-[#706d7d]">AI recipe draft · owner review</span>
          <div className="mt-[.6vmin] flex justify-between text-[1.3vmin]"><span>Draft uses listed pantry ingredients</span><span className="mono">Review before saving</span></div>
        </motion.div>
        <motion.div className="absolute right-[10%] top-[29%] rounded-full border-[.65vmin] border-[#df5d39] px-[1.4vmin] py-[.65vmin] eyebrow text-[#b94d30]"
          initial={{ scale: 0, rotate: -12 }} animate={{ scale: [0, 1.12, 1], rotate: 0 }} transition={{ delay: 3.6, duration: 0.52, ease: EASE }}>HIGH RISK</motion.div>
      </motion.div>
      <motion.div className="absolute bottom-[5%] right-[5%] eyebrow text-[#c9bdcf]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 4.8 }}>
        Expiry monitoring runs hourly.
      </motion.div>
    </motion.section>
  );
}
