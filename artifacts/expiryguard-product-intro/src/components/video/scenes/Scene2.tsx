import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

const EASE = [0.22, 1, 0.36, 1] as const;

function WorkspacePanel({ title, className, delay, children }: { title: string; className: string; delay: number; children: ReactNode }) {
  return (
    <motion.article
      className={`film-shadow absolute rounded-[2.2vmin] border border-[#d7cdb9] bg-[#fbf8ef] p-[2.2vmin] ${className}`}
      initial={{ opacity: 0, y: 24, scale: 0.84, rotateX: 8 }}
      animate={{ opacity: 1, y: 0, scale: 1, rotateX: 0 }}
      transition={{ delay, duration: 0.65, ease: EASE }}
    >
      <div className="mb-[1.5vmin] flex items-center justify-between border-b border-[#e4ddcf] pb-[1.2vmin]">
        <span className="eyebrow text-[#2d7057]">{title}</span>
        <span className="h-[.8vmin] w-[.8vmin] rounded-full bg-[#df5d39]" />
      </div>
      {children}
    </motion.article>
  );
}

export function Scene2() {
  return (
    <motion.section className="absolute inset-0 overflow-hidden" style={{ background: '#e7eddf', color: '#29263f' }}
      initial={{ opacity: 0, scale: 1.06 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95, rotateZ: -2 }}
      transition={{ duration: 0.42, ease: EASE }}>
      <div className="absolute inset-0 opacity-50" style={{ background: 'linear-gradient(126deg,#dce8d8 0 34%,#f4efdf 34% 71%,#e4dccc 71%)' }} />
      <div className="film-grain" />
      <motion.div className="absolute inset-0" initial={{ scale: 1.25, x: '5%', y: '4%' }} animate={{ scale: 1, x: 0, y: 0 }} transition={{ duration: 1.15, ease: EASE }}>
        <WorkspacePanel title="PANTRY · EXPIRY BATCHES" className="left-[8%] top-[18%] z-20 w-[39%] h-[57%]" delay={0.1}>
          <div className="flex items-center justify-between">
             <div className="display text-[4.4vmin] font-bold tracking-[-.05em]">Use stock first</div>
            <motion.div className="grid h-[6vmin] w-[6vmin] place-items-center rounded-full border-[.7vmin] border-[#df5d39] text-[1.5vmin] mono font-semibold" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.55, type: 'spring', stiffness: 280 }}>2d</motion.div>
          </div>
          <div className="mt-[3vmin] space-y-[1.3vmin]">
            {['Fresh milk', 'Cherry tomato', 'Oat cream'].map((name, i) => <div key={name} className="flex items-center gap-[1.5vmin] rounded-[1vmin] bg-[#f0eadc] px-[1.4vmin] py-[1.15vmin]">
              <span className={`h-[1.1vmin] w-[1.1vmin] rounded-full ${i === 0 ? 'bg-[#df5d39]' : 'bg-[#2d7057]'}`} />
              <span className="flex-1 text-[1.6vmin] font-semibold">{name}</span>
              <span className="mono text-[1.35vmin] text-[#706d7d]">{i + 2}d</span>
            </div>)}
          </div>
        </WorkspacePanel>

        <WorkspacePanel title="SERVICE RECORDS" className="left-[56%] top-[12%] z-10 w-[34%] h-[34%]" delay={0.52}>
          <div className="flex h-[17vmin] items-end gap-[1.1vmin] border-b border-[#d8cfbf] px-[1vmin]">
            {[32, 58, 42, 76, 55, 88, 69].map((h, i) => <motion.div key={i} className="flex-1 rounded-t-[.7vmin] bg-[#2d7057]" initial={{ height: 0 }} animate={{ height: `${h}%` }} transition={{ delay: 0.85 + i * 0.08, duration: 0.45, ease: EASE }} />)}
          </div>
          <div className="mt-[1.1vmin] flex justify-between mono text-[1.15vmin] text-[#706d7d]"><span>SALES · PREP</span><span>LEFTOVERS</span></div>
        </WorkspacePanel>

        <WorkspacePanel title="LIVE PLAN" className="left-[57%] top-[51%] z-30 w-[35%] h-[30%]" delay={0.84}>
          <div className="rounded-[1.1vmin] border-l-[.8vmin] border-[#df5d39] bg-[#f1e6d2] px-[1.6vmin] py-[1.3vmin]">
            <div className="eyebrow text-[#bc8734]">Demand + usable recipe stock</div>
            <div className="mt-[.8vmin] text-[2.1vmin] font-bold">Prep plan · review</div>
          </div>
          <div className="mt-[1.5vmin] flex gap-[.8vmin]">
            {['Review', 'Edit', 'Decide'].map((label, i) => <div key={label} className={`rounded-full px-[1.2vmin] py-[.6vmin] text-[1.2vmin] font-bold ${i === 2 ? 'bg-[#29263f] text-[#f6f1e5]' : 'bg-[#ede7da] text-[#706d7d]'}`}>{label}</div>)}
          </div>
        </WorkspacePanel>
      </motion.div>
      <div className="absolute bottom-[5%] left-[6%] z-40">
        <motion.h1 className="display text-[9vmin] leading-[.85] font-extrabold tracking-[-.06em]" initial={{ opacity: 0, x: -28 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.25, duration: 0.5, ease: EASE }}>FROM<br />STOCK TO<br />SERVICE.</motion.h1>
      </div>
      <motion.p className="absolute bottom-[6.5%] right-[6%] z-40 max-w-[31%] text-right text-[2.35vmin] leading-tight font-medium"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2.8, duration: 0.4 }}>One connected view. Decisions stay yours.</motion.p>
      <motion.div className="absolute top-[5%] right-[5%] z-40 rounded-full border border-[#2d7057]/40 bg-[#f6f1e5]/90 px-[1.5vmin] py-[.7vmin] mono text-[1.15vmin] text-[#2d7057]"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25, duration: 0.3 }}>ILLUSTRATIVE WORKSPACE · SAMPLE RECORDS</motion.div>
    </motion.section>
  );
}
