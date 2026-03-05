import { useRef, useEffect, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Chrome, Cpu, Globe, Terminal, Zap, Shield } from "lucide-react";

gsap.registerPlugin(ScrollTrigger);

const items = [
  { icon: Chrome, label: "CHROME_EXTENSION" },
  { icon: Cpu, label: "ANTHROPIC_API" },
  { icon: Globe, label: "ANY_WEBSITE" },
  { icon: Terminal, label: "ONE_SENTENCE" },
  { icon: Zap, label: "INSTALL_AND_GO" },
  { icon: Shield, label: "NO_BACKEND" },
];

const LogoMarquee = () => {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(
        sectionRef.current,
        { opacity: 0 },
        {
          opacity: 1,
          duration: 0.8,
          scrollTrigger: {
            trigger: sectionRef.current,
            start: "top 90%",
            toggleActions: "play none none reverse",
          },
        },
      );
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      className="relative py-12 overflow-hidden border-y border-white/5"
    >
      {/* Dot matrix background */}
      <div className="absolute inset-0 dot-matrix-dense opacity-30" />

      <div className="relative z-10">
        <p className="text-center font-mono text-[10px] text-white/30 mb-6 tracking-widest">
          {"// ONE_SENTENCE · ANY_PAGE · YOUR_STYLE"}
        </p>

        <div
          className="relative overflow-hidden"
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
        >
          <div
            className={`flex gap-12 ${isPaused ? "" : "animate-marquee"}`}
            style={{
              animationPlayState: isPaused ? "paused" : "running",
              width: "fit-content",
            }}
          >
            {[...items, ...items, ...items, ...items].map((item, index) => {
              const Icon = item.icon;
              return (
                <div
                  key={index}
                  className="flex items-center gap-3 px-6 py-3 border border-white/10 hover:border-[#00ff41]/50 transition-colors duration-300 group"
                >
                  <Icon className="w-4 h-4 text-white/40 group-hover:text-[#00ff41] transition-colors duration-300" />
                  <span className="font-mono text-xs text-white/60 whitespace-nowrap tracking-wider">
                    {item.label}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Edge fades */}
          <div className="absolute left-0 top-0 bottom-0 w-24 bg-gradient-to-r from-black to-transparent pointer-events-none" />
          <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-black to-transparent pointer-events-none" />
        </div>
      </div>
    </section>
  );
};

export default LogoMarquee;
