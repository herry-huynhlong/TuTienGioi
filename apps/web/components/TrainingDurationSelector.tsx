"use client";

import { startTrainingAction } from "@/lib/forms";
import { Check, Clock, Play, TrendingUp, Zap } from "lucide-react";
import { useMemo, useState } from "react";

type DurationOption = {
  key: string;
  label: string;
  energyCost: number;
  gain: number;
};

export function TrainingDurationSelector({
  trainingType,
  statLabel,
  energy,
  locked,
  options
}: {
  trainingType: string;
  statLabel: string;
  energy: number;
  locked: boolean;
  options: DurationOption[];
}) {
  const [selectedKey, setSelectedKey] = useState(options[0]?.key ?? "");
  const selected = useMemo(() => options.find((option) => option.key === selectedKey) ?? options[0], [options, selectedKey]);
  if (!selected) return null;

  const disabledReason =
    locked ? "Đang có phiên rèn khác"
    : energy < selected.energyCost ? `Không đủ Thể Lực. Hiện có ${energy}, cần ${selected.energyCost}.`
    : selected.gain <= 0 ? "Đã đạt giới hạn"
    : null;

  return (
    <form action={startTrainingAction} className="training-duration-compact">
      <input type="hidden" name="trainingType" value={trainingType} />
      <input type="hidden" name="duration" value={selected.key} />

      <div className="training-duration-label">Thời gian rèn</div>
      <div className="training-duration-segmented" role="group" aria-label={`Chọn thời gian rèn ${statLabel}`}>
        {options.map((option) => {
          const active = option.key === selected.key;
          return (
            <button key={option.key} type="button" className={active ? "selected" : ""} onClick={() => setSelectedKey(option.key)}>
              {active ? <Check size={13} aria-hidden /> : null}
              {option.label}
            </button>
          );
        })}
      </div>

      <div className="training-duration-summary">
        <div><Clock size={14} aria-hidden /><span>Thời gian</span><b>{selected.label}</b></div>
        <div className={energy < selected.energyCost ? "warning" : ""}><Zap size={14} aria-hidden /><span>Tiêu hao</span><b>-{selected.energyCost} Thể Lực</b></div>
        <div><TrendingUp size={14} aria-hidden /><span>Dự kiến nhận</span><b>+{selected.gain} {statLabel}</b></div>
      </div>

      {disabledReason ? <em>{disabledReason}</em> : null}
      <button className="btn btn-secondary w-full" disabled={Boolean(disabledReason)}>
        <Play size={15} aria-hidden /> {disabledReason ? disabledReason.split(".")[0] : "Bắt đầu rèn luyện"}
      </button>
    </form>
  );
}
