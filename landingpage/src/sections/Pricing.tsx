import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Check, Key } from "lucide-react";

gsap.registerPlugin(ScrollTrigger);

const plans = [
  {
    name: "STYLESWIFT",
    icon: Key,
    price: null,
    description:
      "自带 Anthropic API Key，零订阅、零后端。扩展免费使用，按你的 API 用量计费。",
    features: [
      "一句话改任意网页样式",
      "风格技能保存与跨站迁移",
      "按域名会话，撤销/回滚",
      "内置深色、极简等模板",
      "Side Panel 流式对话",
    ],
    cta: "安装扩展",
    popular: true,
  },
];

const Pricing = () => {
  const sectionRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);

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

      const cards = sectionRef.current?.querySelectorAll(".pricing-card");
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
              trigger: cards[0],
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
        <div ref={titleRef} className="text-center mb-12">
          <p className="font-mono text-[10px] text-white/40 tracking-widest mb-4">
            {"// PRICING"}
          </p>
          <h2 className="text-headline text-white mb-4">自带 Key，零订阅</h2>
          <p className="text-body max-w-md mx-auto mb-8">
            扩展免费；使用 Anthropic API 按量计费，由你掌控。
          </p>
        </div>

        {/* Single Plan Card */}
        <div className="grid md:grid-cols-1 gap-px bg-white/10 max-w-2xl mx-auto">
          {plans.map((plan, index) => {
            const Icon = plan.icon;

            return (
              <div
                key={index}
                className="pricing-card relative p-8 bg-black border border-[#00ff41]/20"
              >
                <div className="absolute -top-px left-0 right-0 h-px bg-[#00ff41]" />

                <div className="flex items-center gap-3 mb-6">
                  <div className="w-8 h-8 border border-[#00ff41] flex items-center justify-center">
                    <Icon className="w-4 h-4 text-[#00ff41]" />
                  </div>
                  <div>
                    <h3 className="font-mono text-sm text-white">
                      {plan.name}
                    </h3>
                    <span className="font-mono text-[10px] text-[#00ff41]">
                      NO_SUBSCRIPTION
                    </span>
                  </div>
                </div>

                <div className="mb-6">
                  <span className="font-mono text-2xl text-white">¥0</span>
                  <span className="font-mono text-sm text-white/40 ml-2">
                    / 扩展 · 按 API 用量
                  </span>
                </div>

                <p className="text-body text-sm mb-6">{plan.description}</p>

                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature, fIndex) => (
                    <li
                      key={fIndex}
                      className="flex items-center gap-3 text-sm text-white/80"
                    >
                      <Check className="w-4 h-4 text-[#00ff41]" />
                      {feature}
                    </li>
                  ))}
                </ul>

                <button className="w-full py-3 bg-white text-black font-mono text-xs hover:bg-white/90 transition-colors">
                  {plan.cta}
                </button>
              </div>
            );
          })}
        </div>

        <p className="text-center font-mono text-[10px] text-white/40 mt-8">
          {"// 需要 Anthropic API Key · 支持自定义代理地址"}
        </p>
      </div>
    </section>
  );
};

export default Pricing;
