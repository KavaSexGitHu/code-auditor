import React from 'react';
import { motion } from 'motion/react';

interface RiskMeterProps {
  level: 'low' | 'medium' | 'high';
}

export const RiskMeter: React.FC<RiskMeterProps> = ({ level }) => {
  const colors = {
    low: 'bg-emerald-500',
    medium: 'bg-amber-500',
    high: 'bg-rose-500',
  };

  const labels = {
    low: 'Safe / Low Risk',
    medium: 'Caution / Medium Risk',
    high: 'Critical / High Risk',
  };

  const percentage = {
    low: 20,
    medium: 60,
    high: 95,
  };

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-end">
        <span className="text-xs font-mono uppercase tracking-widest opacity-50">Risk Assessment</span>
        <span className={`text-sm font-bold ${level === 'high' ? 'text-rose-500' : level === 'medium' ? 'text-amber-500' : 'text-emerald-500'}`}>
          {labels[level]}
        </span>
      </div>
      <div className="h-4 bg-black/10 rounded-full overflow-hidden border border-black/5">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percentage[level]}%` }}
          transition={{ duration: 1, ease: "easeOut" }}
          className={`h-full ${colors[level]}`}
        />
      </div>
    </div>
  );
};
