import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Clock, Code2, Infinity, Check } from "lucide-react";

gsap.registerPlugin(ScrollTrigger);

const benefits = [
  {
    id: "ZERO",
    icon: Clock,
    title: "零部署",
    description: "纯 Chrome 插件，不依赖后端服务器，数据存本地。",
    features: ["安装即用", "chrome.storage + IndexedDB", "隐私可控"],
  },
  {
    id: "AGENT",
    icon: Code2,
    title: "模型即智能体",
    description: "改什么、怎么改、改到什么程度，由模型根据页面与你的描述决定。",
    features: ["工具原子化", "按需加载知识", "信任模型"],
  },
  {
    id: "SKILL",
    icon: Infinity,
    title: "风格可迁移",
    description:
      "保存满意风格为 Style Skill，在任意网站一键应用，色彩与氛围一致。",
    features: ["保存风格 DNA", "跨站复用", "自然语言描述"],
  },
];

const WhyChooseUs = () => {
  const sectionRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

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

      const items = sectionRef.current?.querySelectorAll(".benefit-item");
      if (items) {
        gsap.fromTo(
          items,
          { opacity: 0, y: 20 },
          {
            opacity: 1,
            y: 0,
            duration: 0.6,
            ease: "power3.out",
            stagger: 0.15,
            scrollTrigger: {
              trigger: items[0],
              start: "top 80%",
              toggleActions: "play none none reverse",
            },
          },
        );
      }
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} className="section-padding relative">
      {/* Grid background */}
      <div className="absolute inset-0 ascii-grid opacity-20" />

      <div className="container-minimal relative z-10">
        {/* Header */}
        <div ref={titleRef} className="mb-16">
          <p className="font-mono text-[10px] text-white/40 tracking-widest mb-4">
            {"// WHY_CHOOSE_US"}
          </p>
          <h2 className="text-headline text-white">为什么选 StyleSwift</h2>
        </div>

        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20">
          {/* Benefits List */}
          <div className="space-y-1">
            {benefits.map((benefit, index) => {
              const Icon = benefit.icon;
              const isActive = activeIndex === index;

              return (
                <div
                  key={index}
                  className={`benefit-item border-l-2 transition-all duration-300 cursor-pointer ${
                    isActive
                      ? "border-[#00ff41] bg-white/[0.02]"
                      : "border-white/10 hover:border-white/30"
                  }`}
                  onClick={() => setActiveIndex(index)}
                  onMouseEnter={() => setActiveIndex(index)}
                >
                  <div className="p-6">
                    <div className="flex items-start gap-4">
                      {/* ID Badge */}
                      <div
                        className={`font-mono text-[10px] px-2 py-1 border ${
                          isActive
                            ? "border-[#00ff41]/50 text-[#00ff41]"
                            : "border-white/20 text-white/40"
                        }`}
                      >
                        {benefit.id}
                      </div>

                      <div className="flex-1">
                        <h3
                          className={`text-title mb-2 transition-colors duration-300 ${
                            isActive ? "text-white" : "text-white/70"
                          }`}
                        >
                          {benefit.title}
                        </h3>
                        <p className="text-body text-sm mb-4">
                          {benefit.description}
                        </p>

                        {/* Features */}
                        <div
                          className={`flex flex-wrap gap-2 transition-all duration-500 ${
                            isActive
                              ? "opacity-100"
                              : "opacity-0 h-0 overflow-hidden"
                          }`}
                        >
                          {benefit.features.map((feature, fIndex) => (
                            <span
                              key={fIndex}
                              className="inline-flex items-center gap-1 font-mono text-[10px] text-[#00ff41]"
                            >
                              <Check className="w-3 h-3" />
                              {feature}
                            </span>
                          ))}
                        </div>
                      </div>

                      <Icon
                        className={`w-5 h-5 transition-colors duration-300 ${
                          isActive ? "text-[#00ff41]" : "text-white/20"
                        }`}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Visual */}
          <div className="relative">
            <div className="aspect-square border border-white/10 bg-white/[0.02] relative overflow-hidden">
              {/* Dot matrix overlay */}
              <div className="absolute inset-0 dot-matrix-dense opacity-30" />

              {/* Large ASCII art */}
              <div className="absolute inset-0 flex items-center justify-center p-8">
                <pre className="font-mono text-[8px] md:text-xs text-white/10 leading-none select-none">
                  {`    ███████╗████████╗██╗   ██╗██╗     ███████╗███████╗██╗    ██╗██╗███████╗████████╗
    ██╔════╝╚══██╔══╝╚██╗ ██╔╝██║     ██╔════╝██╔════╝██║    ██║██║██╔════╝╚══██╔══╝
    ███████╗   ██║    ╚████╔╝ ██║     █████╗  ███████╗██║ █╗ ██║██║█████╗     ██║   
    ╚════██║   ██║     ╚██╔╝  ██║     ██╔══╝  ╚════██║██║███╗██║██║██╔══╝     ██║   
    ███████║   ██║      ██║   ███████╗███████╗███████║╚███╔███╔╝██║██║        ██║   
    ╚══════╝   ╚═╝      ╚═╝   ╚══════╝╚══════╝╚══════╝ ╚══╝╚══╝ ╚═╝╚═╝        ╚═╝   `}
                </pre>
              </div>

              {/* Active indicator */}
              <div className="absolute bottom-6 left-6 right-6">
                <div className="flex items-center justify-between font-mono text-[10px] text-white/40">
                  <span>
                    STATUS: <span className="text-[#00ff41]">ACTIVE</span>
                  </span>
                  <span>MEM: 14MB</span>
                </div>
              </div>

              {/* Corner accents */}
              <div className="absolute top-0 left-0 w-6 h-6 border-t border-l border-[#00ff41]/30" />
              <div className="absolute top-0 right-0 w-6 h-6 border-t border-r border-[#00ff41]/30" />
              <div className="absolute bottom-0 left-0 w-6 h-6 border-b border-l border-[#00ff41]/30" />
              <div className="absolute bottom-0 right-0 w-6 h-6 border-b border-r border-[#00ff41]/30" />
            </div>

            {/* Floating stats */}
            <div className="absolute -bottom-4 -right-4 px-4 py-3 border border-white/10 bg-black font-mono text-[10px]">
              <div className="text-white/40">UPTIME</div>
              <div className="text-[#00ff41] text-lg">99.9%</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default WhyChooseUs;
