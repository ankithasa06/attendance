import { useEffect, useState } from "react";

export function LiveTimer({ startTime, label = "Time Elapsed" }: { startTime: string | Date; label?: string }) {
  const [elapsed, setElapsed] = useState("");

  useEffect(() => {
    const start = new Date(startTime).getTime();
    
    const interval = setInterval(() => {
      const now = new Date().getTime();
      let diff = Math.floor((now - start) / 1000);
      
      if (diff < 0) diff = 0;
      
      const h = Math.floor(diff / 3600);
      const m = Math.floor((diff % 3600) / 60);
      const s = diff % 60;
      
      setElapsed(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
    }, 1000);
    
    // Initial call
    const now = new Date().getTime();
    let diff = Math.floor((now - start) / 1000);
    if (diff < 0) diff = 0;
    const h = Math.floor(diff / 3600);
    const m = Math.floor((diff % 3600) / 60);
    const s = diff % 60;
    setElapsed(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
    
    return () => clearInterval(interval);
  }, [startTime]);

  return (
    <div className="flex flex-col items-center justify-center p-6 bg-primary/5 rounded-xl border border-primary/20">
      <p className="text-sm font-medium text-primary mb-1">{label}</p>
      <div className="text-4xl font-bold tracking-widest font-mono text-primary">
        {elapsed || "00:00:00"}
      </div>
    </div>
  );
}
