import { motion } from 'framer-motion';

const EASE = [0.22, 1, 0.36, 1] as const;

export function Scene5() {
  return (
    <motion.section className="absolute inset-0 overflow-hidden" style={{ background: '#e7eddf', color: '#29263f' }}
      initial={{ opacity: 0, x: '4%', scale: 1.03 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, scale: 1.07, filter: 'blur(7px)' }}
      transition={{ duration: 0.42, ease: EASE }}>
      <div className="absolute inset-0" style={{ background: 'linear-gradient(118deg,#d9e4d7 0 46%,#f1ebdc 46% 100%)' }} />
      <div className="absolute left-[7%] top-[18%]">
        <div className="eyebrow text-[#2d7057]">Illustrative recommendation · human in the loop</div>
        <motion.h1 className="display mt-[3vmin] text-[12.2vmin] leading-[.84] font-extrabold tracking-[-.075em]"
          initial={{ opacity: 0, scale: 0.8, x: -18 }} animate={{ opacity: 1, scale: 1, x: 0 }} transition={{ duration: 0.6, ease: EASE }}>
          YOU<br /><span className="text-[#df5d39]">DECIDE.</span>
        </motion.h1>
        <motion.p className="mt-[3vmin] text-[2.8vmin] font-medium text-[#706d7d]"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.8, duration: 0.4 }}>Yuzu suggests. You approve.</motion.p>
        <motion.div className="mt-[5vmin] flex items-center gap-[1vmin] text-[1.55vmin] font-semibold text-[#2d7057]"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 4.0, duration: 0.35 }}>
          <span className="grid h-[3vmin] w-[3vmin] place-items-center rounded-full border border-[#2d7057]">✓</span>
          Owner approval required.
        </motion.div>
      </div>
      <motion.article
        className="film-shadow absolute right-[8%] top-[20%] w-[39%] rounded-[2.8vmin] border border-[#d6cbb9] bg-[#fbf8ef] p-[3vmin]"
        initial={{ opacity: 0, scale: 0.78, rotateY: 12, x: 34 }} animate={{ opacity: 1, scale: 1, rotateY: 0, x: 0 }}
        transition={{ delay: 0.15, duration: 0.72, ease: EASE }}
      >
        <div className="flex items-center justify-between border-b border-[#e5ddcf] pb-[1.8vmin]">
          <span className="eyebrow text-[#bc8734]">Pending your review</span>
          <span className="mono text-[1.2vmin] text-[#706d7d]">01 / 03</span>
        </div>
        <motion.div className="mt-[2.3vmin] flex items-start justify-between"
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55, duration: 0.35 }}>
          <div><div className="display text-[4.6vmin] font-bold tracking-[-.05em]">Use first</div><p className="mt-[.8vmin] text-[1.7vmin] text-[#706d7d]">Prioritise a short-dated ingredient.</p></div>
          <div className="rounded-full bg-[#f2e5d4] px-[1.15vmin] py-[.7vmin] eyebrow text-[#b94d30]">PANTRY</div>
        </motion.div>
        <div className="mt-[2.5vmin] rounded-[1.4vmin] bg-[#eee8db] p-[1.7vmin]">
          <div className="mono text-[1.15vmin] text-[#706d7d]">SUGGESTED NEXT STEP</div>
          <div className="mt-[.7vmin] text-[2.15vmin] font-bold">Check the earliest milk batch</div>
        </div>
        <div className="mt-[2.2vmin] flex gap-[1vmin]">
          <div className="rounded-full bg-[#29263f] px-[1.7vmin] py-[1vmin] eyebrow text-[#f6f1e5]">Review</div>
          <div className="rounded-full border border-[#d9d0c2] px-[1.7vmin] py-[1vmin] eyebrow text-[#706d7d]">Edit</div>
          <div className="rounded-full border border-[#d9d0c2] px-[1.7vmin] py-[1vmin] eyebrow text-[#706d7d]">Reject</div>
        </div>
        <motion.div className="mt-[2.3vmin] flex items-center gap-[1.2vmin] border-t border-[#e5ddcf] pt-[1.7vmin] text-[1.25vmin] text-[#706d7d]"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 3.4 }}>
          <span className="h-[.65vmin] w-[.65vmin] rounded-full bg-[#df5d39]" /> Suggestions never go to suppliers automatically.
        </motion.div>
        <motion.div className="absolute -bottom-[3vmin] -right-[2vmin] grid h-[9vmin] w-[9vmin] place-items-center rounded-full border-[.75vmin] border-[#2d7057] bg-[#e7eddf] text-[4vmin] text-[#2d7057]"
          initial={{ scale: 0, rotate: -40 }} animate={{ scale: [0, 1.14, 1], rotate: 0 }} transition={{ delay: 4.12, duration: 0.55, ease: EASE }}>✓</motion.div>
      </motion.article>
      <motion.div className="absolute bottom-[7%] left-[7%] h-[.65vmin] w-[44%] origin-left bg-[#29263f]"
        initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 0.7, duration: 0.55 }} />
      <div className="absolute bottom-[5%] right-[5%] eyebrow text-[#706d7d]">No order or plan changes without your sign-off</div>
    </motion.section>
  );
}
