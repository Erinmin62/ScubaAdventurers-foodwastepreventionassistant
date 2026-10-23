import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useSceneTimer } from '@/lib/video';

export function Scene1() {
  const [headline, setHeadline] = useState(0);
  useSceneTimer([{ time: 720, callback: () => setHeadline(1) }]);

  return (
    <motion.section
      className="absolute inset-0 overflow-hidden"
      style={{ background: '#f6f1e5', color: '#29263f' }}
      initial={{ opacity: 0, scale: 1.04 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.08, filter: 'blur(8px)' }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="film-grain" />
      <div className="absolute left-[6%] top-[13%] eyebrow text-[#2d7057]">Food business, every day</div>
      <div className="absolute left-[6%] top-[29%] z-10 max-w-[51%]">
        <AnimatePresence mode="sync">
          <motion.h1
            key={headline}
            className="display font-extrabold leading-[.82] tracking-[-.065em]"
            style={{ fontSize: '15.2vmin', color: headline ? '#df5d39' : '#29263f' }}
            initial={{ opacity: 0, y: 25, scale: 0.82, filter: 'blur(8px)' }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -18, scale: 1.08, filter: 'blur(5px)' }}
            transition={{ duration: 0.28, ease: [0.18, 0.9, 0.28, 1] }}
          >
            {headline ? <>USE IT<br />FIRST.</> : <>USE<br />IT.</>}
          </motion.h1>
        </AnimatePresence>
        <motion.p
          className="mt-[4.5vmin] max-w-[35vmin] text-[3.05vmin] leading-[1.16] font-medium"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.15, duration: 0.5 }}
        >
          Expiry dates. Stock on hand. A plan before the rush.
        </motion.p>
        <motion.div
          className="mt-[3.2vmin] eyebrow text-[#706d7d]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 3.95, duration: 0.35 }}
        >
          ExpiryGuardAI · operational workspace
        </motion.div>
      </div>

      <motion.div
        className="absolute right-[5%] top-[11%] grid place-items-center rounded-full border-[1.15vmin] border-[#df5d39] bg-[#e7dbc0]"
        style={{ width: '82vmin', height: '82vmin', boxShadow: 'inset 0 0 0 1.2vmin rgba(255,255,255,.34), 0 2vmin 5vmin rgba(41,38,63,.13)' }}
        initial={{ scale: 0.84, rotate: 0 }}
        animate={{ scale: [0.84, 0.84, 1.035, 1], rotate: [0, 0, 2, 0] }}
        transition={{ duration: 0.8, times: [0, 0.45, 0.75, 1], ease: [0.18, 0.92, 0.25, 1] }}
        exit={{ scale: 3.25, opacity: 0, x: '-8vw', y: '4vh' }}
      >
        <motion.div className="absolute inset-[8%] rounded-full border border-dashed border-[#29263f]/35" animate={{ rotate: 360 }} transition={{ duration: 28, repeat: Infinity, ease: 'linear' }} />
        <div className="relative z-10 text-center">
          <div className="eyebrow text-[#706d7d]">Best by</div>
          <div className="display mt-[1vmin] text-[9vmin] leading-none font-bold tracking-[-.06em]">08 JUN</div>
          <div className="mono mt-[1.5vmin] text-[1.6vmin] tracking-[.13em] text-[#706d7d]">PANTRY · LOT 014</div>
        <motion.div
          className="mt-[4vmin] inline-flex items-center gap-[1vmin] rounded-full bg-[#29263f] px-[2.3vmin] py-[1.25vmin] text-[#f6f1e5]"
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: [0.6, 1.08, 1], opacity: 1 }}
          transition={{ delay: 2.15, duration: 0.48, ease: [0.15, 0.85, 0.25, 1] }}
        >
          <span className="eyebrow text-[#e1b34d]">Expiry risk · review stock</span>
        </motion.div>
        </div>
        <motion.div
          className="absolute right-[3%] top-[19%] h-[2.6vmin] w-[2.6vmin] rounded-full bg-[#c48c32] ring-[.8vmin] ring-[#f6f1e5]"
          animate={{ scale: [1, 1.6, 1], opacity: [0.8, 1, 0.72] }}
          transition={{ delay: 1.7, duration: 0.8, repeat: Infinity, repeatDelay: 1.2 }}
        />
        <div className="absolute bottom-[9%] left-[16%] rounded-full bg-[#2d7057] px-[2vmin] py-[1vmin] eyebrow text-[#f6f1e5]">first in · fresh out</div>
      </motion.div>
      <motion.div
        className="absolute bottom-[8%] left-[6%] h-[.55vmin] w-[22vmin] origin-left bg-[#df5d39]"
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ delay: 1.2, duration: 0.7 }}
      />
    </motion.section>
  );
}
