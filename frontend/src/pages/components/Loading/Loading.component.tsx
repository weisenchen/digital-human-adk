"use client";

import { motion } from "framer-motion";

const bounceTransition = {
  duration: 0.4,
  repeat: Infinity,
  repeatType: "reverse" as const,
  ease: [0.2, 0, 0, 1.0],
};

const Loading = () =>{
    return (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15, ease: [0.2, 0, 0, 1.0] }}
          className="flex items-center justify-center p-2 gap-1.5"
        >
          <span className="text-[11px] text-[var(--md-on-surface-variant)] font-medium tracking-wide uppercase mr-1">
            ...thinking
          </span>
          <motion.div
            className="w-1.5 h-1.5 bg-[var(--md-primary)] rounded-[var(--shape-full)]"
            animate={{ y: [0, -5, 0] }}
            transition={bounceTransition}
          />
          <motion.div
            className="w-1.5 h-1.5 bg-[var(--md-tertiary)] rounded-[var(--shape-full)]"
            animate={{ y: [0, -5, 0] }}
            transition={{ ...bounceTransition, delay: 0.1 }}
          />
          <motion.div
            className="w-1.5 h-1.5 bg-[var(--md-primary)] rounded-[var(--shape-full)]"
            animate={{ y: [0, -5, 0] }}
            transition={{ ...bounceTransition, delay: 0.2 }}
          />
        </motion.div>
    )
}
export default Loading
