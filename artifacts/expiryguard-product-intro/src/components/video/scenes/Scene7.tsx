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
    <motion.section className="absolute inset-0 overflow-hidden" style={{ background: '#f6f1e5', color: '#29263f' }}
      initial={{ opacity: 0, clipPath: 'circle(0% at 50% 50%)' }} animate={{ opacity: 1, clipPath: 'circle(130% at 50% 50%)' }}
      exit={{ opacity: 0.92, scale: 1.04 }} transition={{ duration: 0.55, ease: EASE }}>
      <div className="film-grain" />
      <motion.div className="absolute inset-x-0 top-[9%] flex justify-center">
        <AnimatePresence mode="sync">
          <motion.div key={wordIndex} className="display absolute text-[19vmin] leading-none font-extrabold tracking-[-.07em] text-[#df5d39]"
            initial={{ opacity: 0, scale: 1.35, filter: 'blur(7px)' }} animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, scale: 0.72, filter: 'blur(5px)' }} transition={{ duration: 0.19, ease: EASE }}>{words[wordIndex]}</motion.div>
        </AnimatePresence>
      </motion.div>
      <motion.div className="absolute left-1/2 top-[45%] w-[46vmin] -translate-x-1/2"
        initial={{ opacity: 0, scale: 0.72, rotate: -3 }} animate={{ opacity: 1, scale: 1, rotate: 0 }} transition={{ delay: 0.65, duration: 0.55, ease: EASE }}>
        <img src={`${import.meta.env.BASE_URL}images/expiryguard-logo.svg`} alt="ExpiryGuardAI" className="block h-auto w-full" />
        <motion.div className="mx-auto mt-[1.7vmin] h-[.72vmin] w-[45vmin] origin-left bg-[#df5d39]"
          initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 1.5, duration: 0.55 }} />
      </motion.div>
      <motion.p className="absolute left-1/2 top-[66%] -translate-x-1/2 whitespace-nowrap text-center text-[2.2vmin] font-semibold text-[#706d7d]"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.8, duration: 0.4 }}>Expiry tracking. Demand context. Owner-led decisions.</motion.p>
      <motion.p className="absolute left-1/2 top-[74%] -translate-x-1/2 whitespace-nowrap eyebrow text-[#2d7057]"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2.6, duration: 0.4 }}>Cafes · restaurants · food vendors · cloud kitchens</motion.p>
      <motion.div className="absolute bottom-[-20vmin] left-1/2 h-[25vmin] w-[25vmin] -translate-x-1/2 rounded-full border-[1.2vmin] border-[#df5d39]"
        initial={{ y: 0, scale: 0.3 }} animate={{ y: '-4vmin', scale: 1 }} transition={{ delay: 4.3, duration: 0.7, ease: EASE }} />
    </motion.section>
  );
}
