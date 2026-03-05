import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Wand2, Palette, RotateCcw, Share2 } from "lucide-react";

gsap.registerPlugin(ScrollTrigger);

const features = [
  {
    id: "01",
    icon: Wand2,
    title: "一句话改样式",
    description:
      "用自然语言描述你想要的风格，AI 理解页面结构并生成 CSS，即时应用。",
    code: `> "把这个页面改成深色模式"
> get_page_structure → apply_styles
> 已应用深色模式 ✓`,
  },
  {
    id: "02",
    icon: Palette,
    title: "风格技能迁移",
    description:
      "在任意网站打磨出满意风格后，保存为 Style Skill，在其他网站一键应用。",
    code: `> save_style_skill "赛博朋克"
> 在 stackoverflow 说 "用我的赛博朋克风格"
> 风格迁移完成 ✓`,
  },
  {
    id: "03",
    icon: RotateCcw,
    title: "撤销与回滚",
    description:
      "支持撤销最后一步或全部回滚，样式按会话保存，下次访问自动应用。",
    code: `> apply_styles(mode: 'rollback_last')
> 已撤销最后一次修改
> 或 rollback_all 恢复原样 ✓`,
  },
  {
    id: "04",
    icon: Share2,
    title: "按域名会话",
    description:
      "每个网站独立会话与样式，内置深色/极简等模板，Side Panel 内流式对话。",
    code: `> github.com · 深色模式调整
> notion.so · 极简风
> 会话与样式隔离 ✓`,
  },
];

const Features = () => {
  const sectionRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<HTMLDivElement>(null);

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

      const cards = cardsRef.current?.querySelectorAll(".feature-card");
      if (cards) {
        gsap.fromTo(
          cards,
          { opacity: 0, y: 40 },
          {
            opacity: 1,
            y: 0,
            duration: 0.6,
            ease: "power3.out",
            stagger: 0.1,
            scrollTrigger: {
              trigger: cardsRef.current,
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
      <div className="absolute inset-0 ascii-grid opacity-30" />

      <div className="container-minimal relative z-10">
        {/* Section Header */}
        <div ref={titleRef} className="mb-20">
          <p className="font-mono text-[10px] text-white/40 tracking-widest mb-4">
            {"// CORE_FEATURES"}
          </p>
          <h2 className="text-headline text-white mb-4">为任意网页设计</h2>
          <p className="text-body max-w-md">
            模型决定改什么、怎么改；你只需说一句话。
          </p>
        </div>

        {/* Feature Grid */}
        <div ref={cardsRef} className="grid md:grid-cols-2 gap-px bg-white/5">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <div
                key={index}
                className="feature-card relative p-8 md:p-12 bg-black group hover:bg-white/[0.02] transition-colors duration-500"
              >
                {/* Index number */}
                <div className="absolute top-6 right-6 font-mono text-[10px] text-white/20">
                  {feature.id}
                </div>

                {/* Icon */}
                <div className="w-10 h-10 border border-white/20 flex items-center justify-center mb-6 group-hover:border-[#00ff41]/50 transition-colors duration-300">
                  <Icon className="w-5 h-5 text-white/60 group-hover:text-[#00ff41] transition-colors duration-300" />
                </div>

                {/* Content */}
                <h3 className="text-title text-white mb-3">{feature.title}</h3>
                <p className="text-body text-sm mb-6">{feature.description}</p>

                {/* Code snippet */}
                <div className="font-mono text-[11px] leading-relaxed text-white/40 p-4 border border-white/5 bg-white/[0.02]">
                  {feature.code.split("\n").map((line, i) => (
                    <div key={i} className="flex">
                      <span className="text-white/20 w-4">{i + 1}</span>
                      <span
                        className={line.includes("✓") ? "text-[#00ff41]" : ""}
                      >
                        {line}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Hover corner accent */}
                <div className="absolute bottom-0 right-0 w-8 h-8 border-r border-b border-white/10 group-hover:border-[#00ff41]/30 transition-colors duration-300" />
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default Features;
