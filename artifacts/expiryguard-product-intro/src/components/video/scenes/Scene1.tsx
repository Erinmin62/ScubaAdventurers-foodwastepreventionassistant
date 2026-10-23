import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useSceneTimer } from '@/lib/video';

const EASE = [0.18, 0.92, 0.25, 1] as const;

export function Scene1() {
  const [beat, setBeat] = useState(0);
  useSceneTimer([{ time: 450, callback: () => setBeat(1) }]);

  return (
    <motion.section
      className="absolute inset-0 overflow-hidden"
      style={{ background: '#f6f1e5', color: '#29263f' }}
      initial={{ opacity: 0, scale: 1.035 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.08, filter: 'blur(8px)' }}
      transition={{ duration: 0.38, ease: EASE }}
    >
      <div className="film-grain" />
      <div className="absolute left-[6%] top-[12%] eyebrow text-[#2d7057]">Food business, every day</div>
      <div className="absolute left-[6%] top-[27%] z-10 w-[48%]">
        <AnimatePresence mode="sync">
          <motion.h1
            key={beat}
            className="display font-extrabold leading-[.81] tracking-[-.075em]"
            style={{ fontSize: '13.5vmin', color: beat ? '#df5d39' : '#29263f' }}
            initial={{ opacity: 0, y: 28, scale: 0.82, filter: 'blur(7px)' }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -15, scale: 1.04 }}
            transition={{ duration: 0.22, ease: EASE }}
          >
            {beat ? <>FOUR<br />RECORDS.</> : <>ONE<br />RUSH.</>}
          </motion.h1>
        </AnimatePresence>
        <motion.p
          className="mt-[3.2vmin] max-w-[42vmin] text-[2.8vmin] leading-[1.12] font-semibold"
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.85, duration: 0.35, ease: EASE }}
        >
          What to use, prepare or reorder?
        </motion.p>
        <motion.p
          className="mt-[1.4vmin] max-w-[40vmin] text-[2.2vmin] leading-tight text-[#706d7d]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2.2, duration: 0.35 }}
        >
          Expiry dates need a place in the daily plan.
        </motion.p>
      </div>
      <div className="absolute left-[6%] top-[66%] flex gap-[1.2vmin]">
        {['STOCK', 'SALES', 'PREP'].map((label, i) => (
          <motion.div
            key={label}
            className="rounded-full border border-[#29263f]/20 bg-[#fbf8ef] px-[1.7vmin] py-[.9vmin] mono text-[1.55vmin] tracking-[.09em]"
            initial={{ opacity: 0, y: 0, rotate: 0 }}
            animate={i === 0
              ? { opacity: 1, y: 0, rotate: -4 }
              : { opacity: [0, 1, 1, 1], y: [8, 0, 0, 0], rotate: [0, 5, -4, 6] }}
            transition={{ delay: 0.95 + i * 0.35, duration: 1.25, times: [0, 0.18, 0.6, 1], ease: EASE }}
          >
            {label}
          </motion.div>
        ))}
      </div>
      <motion.div
        className="absolute right-[5%] top-[11%] grid place-items-center rounded-full border-[1.15vmin] border-[#df5d39] bg-[#e7dbc0]"
        style={{ width: '82vmin', height: '82vmin', boxShadow: 'inset 0 0 0 1.1vmin rgba(255,255,255,.34)' }}
        initial={{ scale: 0.84, rotate: -2 }}
        animate={{ scale: [0.84, 1.025, 0.99, 1], rotate: [0, 2, -1, 0] }}
        transition={{ duration: 0.86, times: [0, 0.38, 0.68, 1], ease: EASE }}
        exit={{ scale: 3.2, x: '-7vw', y: '4vh', opacity: 0 }}
      >
        <motion.div
          className="absolute inset-[8%] rounded-full border border-dashed border-[#29263f]/35"
          animate={{ rotate: 360 }}
          transition={{ duration: 32, repeat: Infinity, ease: 'linear' }}
        />
        <div className="relative z-10 text-center">
          <div className="eyebrow text-[#706d7d]">Best by</div>
          <div className="display mt-[1vmin] text-[9vmin] leading-none font-bold tracking-[-.06em]">08 JUN</div>
          <div className="mono mt-[1.5vmin] text-[1.55vmin] tracking-[.13em] text-[#706d7d]">PANTRY · LOT 014</div>
          <motion.div
            className="mt-[3.2vmin] inline-flex rounded-full bg-[#29263f] px-[2vmin] py-[1.05vmin] eyebrow text-[#f6f1e5]"
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: [0.7, 1.08, 1], opacity: 1 }}
            transition={{ delay: 1.6, duration: 0.42, ease: EASE }}
          >
            Expiry risk · review stock
          </motion.div>
        </div>
        <motion.div
          className="absolute right-[3%] top-[19%] h-[2.5vmin] w-[2.5vmin] rounded-full bg-[#c48c32] ring-[.8vmin] ring-[#f6f1e5]"
          animate={{ scale: [1, 1.55, 1], opacity: [0.8, 1, 0.72] }}
          transition={{ delay: 1.15, duration: 0.7, repeat: Infinity, repeatDelay: 1.1 }}
        />
      </motion.div>
      <motion.div
        className="absolute bottom-[8%] left-[6%] h-[.6vmin] w-[23vmin] origin-left bg-[#df5d39]"
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ delay: 1.35, duration: 0.55 }}
      />
      <motion.div
        className="absolute bottom-[7.2%] right-[7%] rounded-full border border-[#bc8734] px-[1.4vmin] py-[.6vmin] mono text-[1.15vmin] text-[#815d20]"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 2.55, duration: 0.3 }}
      >
        ILLUSTRATIVE LABEL
      </motion.div>
    </motion.section>
  );
}
