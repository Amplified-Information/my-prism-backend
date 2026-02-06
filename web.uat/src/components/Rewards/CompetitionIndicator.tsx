interface CompetitionIndicatorProps {
  level: number; // 1-5 scale
}

const CompetitionIndicator = ({ level }: CompetitionIndicatorProps) => {
  const getColor = () => {
    if (level <= 2) return 'bg-yellow-400';
    if (level <= 3) return 'bg-orange-500';
    return 'bg-red-500';
  };

  const bars = Array.from({ length: 5 }, (_, i) => i < level);

  return (
    <div className="flex gap-0.5 items-end h-5">
      {bars.map((filled, index) => (
        <div
          key={index}
          className={`w-1.5 rounded-sm transition-colors ${
            filled ? getColor() : 'bg-muted'
          }`}
          style={{ height: `${(index + 1) * 20}%` }}
        />
      ))}
    </div>
  );
};

export default CompetitionIndicator;
