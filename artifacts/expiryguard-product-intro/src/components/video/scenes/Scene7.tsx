import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useSceneTimer } from '@/lib/video';

const words = ['SEE IT.', 'PLAN IT.', 'DECIDE.'];
const EASE = [0.22, 1, 0.36, 1] as const;

export function Scene7() {
  const [wordIndex, setWordIndex] = useState(0);
  useSceneTimer([
    { time: 200, callback: () => setWordIndex(1) },
    { time: 400, callback: () => setWordIndex(2) },
  ]);

  return (
    <motion.section
      className="absolute inset-0 overflow-hidden"
      style={{ background: '#f6f1e5', color: '#29263f' }}
      initial={{ opacity: 1, clipPath: 'circle(0% at 50% 50%)' }}
      animate={{ opacity: 1, clipPath: 'circle(130% at 50% 50%)' }}
      exit={{ opacity: 0.96, scale: 1.035 }}
      transition={{ duration: 0.48, ease: EASE }}
    >
      <div className="film-grain" />
      <motion.div
        className="absolute inset-x-0 top-[6%] flex justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, 1, 0] }}
        transition={{ duration: 4.1, times: [0, 0.05, 0.91, 1], ease: EASE }}
      >
        <AnimatePresence mode="sync">
          <motion.div
            key={wordIndex}
            className="display absolute text-[15.5vmin] leading-none font-extrabold tracking-[-.075em] text-[#df5d39]"
            initial={{ opacity: 0, scale: 1.25, filter: 'blur(6px)' }}
            animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, scale: 0.78 }}
            transition={{ duration: 0.18, ease: EASE }}
          >
            {words[wordIndex]}
          </motion.div>
        </AnimatePresence>
      </motion.div>
      <motion.div
        className="absolute left-1/2 top-[31%] w-[43vmin] -translate-x-1/2"
        initial={{ opacity: 0, scale: 0.78, rotate: -2 }}
        animate={{ opacity: [0, 1, 1, 0], scale: [0.78, 1, 1, 1], rotate: [-2, 0, 0, 0] }}
        transition={{ duration: 4.1, times: [0, 0.16, 0.91, 1], ease: EASE }}
      >
        <img src={`${import.meta.env.BASE_URL}images/expiryguard-logo.svg`} alt="ExpiryGuardAI" className="block h-auto w-full" />
        <motion.div className="mx-auto mt-[1.4vmin] h-[.65vmin] w-[42vmin] origin-left bg-[#df5d39]" initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 1.2, duration: 0.48 }} />
      </motion.div>
      <motion.div className="absolute left-[8%] top-[56%] w-[37%] border-l-[.5vmin] border-[#2d7057] pl-[1.5vmin]" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 1.15, duration: 0.36 }}>
        <div className="eyebrow text-[#2d7057]" style={{ fontSize: '1.35vmin' }}>Expected benefit</div>
        <p className="mt-[.5vmin] text-[1.7vmin] leading-tight font-semibold">Fewer cross-checks · earlier expiry attention · steadier reviews.</p>
      </motion.div>
      <motion.div className="absolute right-[7%] top-[55%] w-[40%] text-right" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 1.8, duration: 0.36 }}>
        <div className="text-[1.5vmin] font-semibold text-[#706d7d]">Pilot must measure; savings and impact are not yet proven.</div>
        <div className="mt-[1vmin] mono text-[1.3vmin] leading-snug text-[#2d7057]">SDG 12.3 · better food-use measurement, not a proven impact</div>
      </motion.div>
      <motion.p
        className="absolute left-1/2 top-[73%] -translate-x-1/2 whitespace-nowrap text-center text-[1.75vmin] font-semibold text-[#706d7d]"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, 1, 0] }}
        transition={{ delay: 2.45, duration: 1.55, times: [0, 0.18, 0.78, 1] }}
      >
        Cafes · restaurants · food vendors · cloud kitchens
      </motion.p>
      <motion.div
        className="absolute left-[72%] top-[52%] grid h-[82vmin] w-[82vmin] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-[1.2vmin] border-[#df5d39] bg-[#e7dbc0]"
        initial={{ scale: 0.3, opacity: 0 }}
        animate={{ scale: 0.84, opacity: 1 }}
        transition={{ delay: 4.1, duration: 0.9, ease: EASE }}
      >
        <motion.div className="text-center text-[#29263f]" initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 1, 0] }} transition={{ delay: 4.62, duration: 0.34, times: [0, 0.1, 0.8, 1] }}>
          <div className="eyebrow text-[#706d7d]">Best by</div>
          <div className="display mt-[.8vmin] text-[7vmin] font-bold leading-none tracking-[-.06em]">08 JUN</div>
          <div className="mono mt-[1vmin] text-[1.35vmin] tracking-[.13em] text-[#706d7d]">PANTRY · LOT 014</div>
        </motion.div>
      </motion.div>
    </motion.section>
  );
}
