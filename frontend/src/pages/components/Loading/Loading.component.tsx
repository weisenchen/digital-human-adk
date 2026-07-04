"use client";

import { motion } from "framer-motion";

const Loading = () =>{
    return (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="flex items-center justify-center p-3 gap-1.5"
        >
          <span className="text-xs text-[#4A5568] mr-1">thinking</span>
          <motion.div
            className="w-2 h-2 bg-[#6B46C1] rounded-full"
            animate={{ y: [0, -8, 0] }}
            transition={{ duration: 0.6, repeat: Infinity, repeatType: "reverse" }}
          />
          <motion.div
            className="w-2 h-2 bg-[#667EEA] rounded-full"
            animate={{ y: [0, -8, 0] }}
            transition={{ duration: 0.6, repeat: Infinity, repeatType: "reverse", delay: 0.15 }}
          />
          <motion.div
            className="w-2 h-2 bg-[#6B46C1] rounded-full"
            animate={{ y: [0, -8, 0] }}
            transition={{ duration: 0.6, repeat: Infinity, repeatType: "reverse", delay: 0.3 }}
          />
        </motion.div>
    )
}
export default Loading
