import { useState, useEffect } from "react";
import headstarterLogo from "@/assets/headstarter-logo.png";
const TARGET_DATE = new Date("2026-02-26T14:00:00Z"); // 06:00 PST = 14:00 UTC

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

const getTimeLeft = (): TimeLeft => {
  const diff = Math.max(0, TARGET_DATE.getTime() - Date.now());
  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((diff / (1000 * 60)) % 60),
    seconds: Math.floor((diff / 1000) % 60),
  };
};

const pad = (n: number) => String(n).padStart(2, "0");

const Countdown = () => {
  const [timeLeft, setTimeLeft] = useState(getTimeLeft);

  useEffect(() => {
    const id = setInterval(() => setTimeLeft(getTimeLeft()), 1000);
    return () => clearInterval(id);
  }, []);

  const units: { label: string; value: number }[] = [
    { label: "Days", value: timeLeft.days },
    { label: "Hours", value: timeLeft.hours },
    { label: "Minutes", value: timeLeft.minutes },
    { label: "Seconds", value: timeLeft.seconds },
  ];

  return (
    <a
      href="https://app.headstarter.org/projects/prism-market-ino"
      target="_blank"
      rel="noopener noreferrer"
      className="block group"
    >
      <div className="inline-flex flex-col items-center gap-4">
        <p className="text-lg md:text-2xl font-semibold text-prism-gold tracking-widest uppercase">
          INO Launch Countdown
        </p>
        <div className="flex gap-4 md:gap-6">
          {units.map(({ label, value }) => (
            <div
              key={label}
              className="flex flex-col items-center bg-secondary/60 backdrop-blur-sm border border-prism-gold/30 rounded-xl px-5 py-4 md:px-8 md:py-6 min-w-[85px] md:min-w-[120px] group-hover:border-prism-gold/60 transition-colors"
            >
              <span className="text-4xl md:text-6xl font-bold font-mono text-foreground tabular-nums leading-none">
                {pad(value)}
              </span>
              <span className="text-xs md:text-sm text-muted-foreground uppercase tracking-wider mt-2">
                {label}
              </span>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 group-hover:opacity-80 transition-opacity">
          <span className="text-base text-muted-foreground">View on</span>
          <img src={headstarterLogo} alt="HeadStarter" className="h-8 md:h-10 w-auto" />
          <span className="text-base text-muted-foreground">→</span>
        </div>
      </div>
    </a>
  );
};

export default Countdown;
