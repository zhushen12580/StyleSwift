import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Download, Palette, Rocket } from "lucide-react";

gsap.registerPlugin(ScrollTrigger);

const steps = [
  {
    number: "001",
    icon: Download,
    title: "安装扩展",
    description: "从 Chrome 商店安装 StyleSwift，无需部署任何后端。",
    detail: "Chrome Extension loaded · Manifest V3",
  },
  {
    number: "010",
    icon: Palette,
    title: "配置 API Key",
    description:
      "在 Side Panel 设置中填入你的 Anthropic API Key，支持自定义代理地址。",
    detail: "API Key verified · Ready",
  },
  {
    number: "011",
    icon: Rocket,
    title: "一句话改样式",
    description:
      "打开任意网页，在 Side Panel 里说出需求——深色模式、护眼、极简风，即刻生效。",
    detail: "Style applied · Persisted by domain",
  },
];

const HowItWorks = () => {
  const sectionRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);
  const stepsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(
        titleRef.current,
        { opacity: 0, y: 30 },
        {
          opacity: 1,
          y: 0,
          duration: 0.8,
          ease: "power3.out",
          scrollTrigger: {
            trigger: titleRef.current,
            start: "top 85%",
            toggleActions: "play none none reverse",
          },
        },
      );

      const stepItems = stepsRef.current?.querySelectorAll(".step-item");
      if (stepItems) {
        stepItems.forEach((step, index) => {
          gsap.fromTo(
            step,
            { opacity: 0, x: index % 2 === 0 ? -30 : 30 },
            {
              opacity: 1,
              x: 0,
              duration: 0.8,
              ease: "power3.out",
              scrollTrigger: {
                trigger: step,
                start: "top 80%",
                toggleActions: "play none none reverse",
              },
            },
          );
        });
      }
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} className="section-padding relative">
      {/* Dot matrix */}
      <div className="absolute inset-0 dot-matrix opacity-20" />

      <div className="container-minimal relative z-10">
        {/* Header */}
        <div ref={titleRef} className="text-center mb-20">
          <p className="font-mono text-[10px] text-white/40 tracking-widest mb-4">
            {"// HOW_IT_WORKS"}
          </p>
          <h2 className="text-headline text-white mb-4">三步开始</h2>
          <p className="text-body max-w-md mx-auto">
            纯 Chrome 插件，安装即用；自带 API Key，零订阅。
          </p>
        </div>

        {/* Steps */}
        <div ref={stepsRef} className="relative max-w-4xl mx-auto">
          {/* Connection line */}
          <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/10 hidden md:block" />

          <div className="space-y-16 md:space-y-24">
            {steps.map((step, index) => {
              const Icon = step.icon;
              const isEven = index % 2 === 0;

              return (
                <div
                  key={index}
                  className={`step-item relative grid md:grid-cols-2 gap-8 items-center ${
                    isEven ? "" : "md:text-right"
                  }`}
                >
                  {/* Content */}
                  <div
                    className={`${isEven ? "md:pr-16" : "md:order-2 md:pl-16"}`}
                  >
                    <div
                      className={`flex items-center gap-4 mb-4 ${isEven ? "" : "md:justify-end"}`}
                    >
                      <div className="font-mono text-[10px] text-[#00ff41] border border-[#00ff41]/30 px-2 py-1">
                        {step.number}
                      </div>
                      <div className="w-8 h-px bg-white/20" />
                    </div>

                    <h3 className="text-title text-white mb-3 flex items-center gap-3">
                      <Icon className="w-5 h-5 text-white/40" />
                      {step.title}
                    </h3>

                    <p className="text-body text-sm mb-4">{step.description}</p>

                    {/* Terminal output */}
                    <div
                      className={`font-mono text-[10px] text-white/40 ${isEven ? "" : "md:text-right"}`}
                    >
                      <span className="text-[#00ff41]">$</span> {step.detail}
                    </div>
                  </div>

                  {/* Visual */}
                  <div className={`${isEven ? "md:order-2" : ""}`}>
                    <div className="aspect-[4/3] border border-white/10 bg-white/[0.02] relative overflow-hidden group">
                      {/* Step number large */}
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-[8rem] md:text-[12rem] font-bold text-white/[0.03] tabular-nums">
                          {step.number}
                        </span>
                      </div>

                      {/* Icon overlay */}
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Icon className="w-12 h-12 text-white/20 group-hover:text-[#00ff41]/50 transition-colors duration-500" />
                      </div>

                      {/* Corner accents */}
                      <div className="absolute top-0 left-0 w-4 h-4 border-t border-l border-white/20" />
                      <div className="absolute bottom-0 right-0 w-4 h-4 border-b border-r border-white/20" />

                      {/* Scanline */}
                      <div className="absolute inset-0 scanlines opacity-50" />
                    </div>
                  </div>

                  {/* Center node */}
                  <div className="absolute left-1/2 -translate-x-1/2 w-3 h-3 bg-[#00ff41] hidden md:block">
                    <div className="absolute inset-0 bg-[#00ff41] animate-ping opacity-50" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
