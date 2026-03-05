import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ArrowRight, Download } from "lucide-react";

gsap.registerPlugin(ScrollTrigger);

const CTA = () => {
  const sectionRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // ASCII rain effect
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = canvas.parentElement?.clientHeight || 600;
    };
    resize();
    window.addEventListener("resize", resize);

    const chars =
      "01アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン";
    const fontSize = 14;
    const columns = Math.floor(canvas.width / fontSize);
    const drops: number[] = new Array(columns).fill(1);

    let animationId: number;
    const draw = () => {
      ctx.fillStyle = "rgba(0, 0, 0, 0.05)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = "#00ff41";
      ctx.font = `${fontSize}px monospace`;

      for (let i = 0; i < drops.length; i++) {
        const char = chars[Math.floor(Math.random() * chars.length)];
        ctx.fillText(char, i * fontSize, drops[i] * fontSize);

        if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) {
          drops[i] = 0;
        }
        drops[i]++;
      }

      animationId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animationId);
    };
  }, []);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(
        contentRef.current,
        { opacity: 0, y: 30 },
        {
          opacity: 1,
          y: 0,
          duration: 0.8,
          ease: "power3.out",
          scrollTrigger: {
            trigger: sectionRef.current,
            start: "top 70%",
            toggleActions: "play none none reverse",
          },
        },
      );
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} className="relative py-32 overflow-hidden">
      {/* Matrix rain canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 z-0 opacity-30" />

      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-black via-transparent to-black z-[1]" />

      {/* Grid overlay */}
      <div className="absolute inset-0 ascii-grid opacity-20 z-[2]" />

      {/* Content */}
      <div className="container-minimal relative z-10 px-6">
        <div ref={contentRef} className="max-w-2xl mx-auto text-center">
          {/* Terminal prompt */}
          <div className="inline-flex items-center gap-2 px-4 py-2 border border-white/10 mb-8 font-mono text-xs">
            <span className="text-[#00ff41]">$</span>
            <span className="text-white/60">init_styleswift</span>
            <span className="w-2 h-4 bg-[#00ff41] animate-pulse" />
          </div>

          <h2 className="text-headline text-white mb-6">
            用一句话，改任意网页
          </h2>

          <p className="text-body text-lg mb-10 max-w-md mx-auto">
            安装 Chrome 扩展，配置 API Key，在 Side Panel
            里说出你想要的风格——零订阅、零后端。
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button className="btn-minimal group">
              <Download className="w-4 h-4 mr-2" />
              立即安装
              <ArrowRight className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-1" />
            </button>
            <button className="btn-ghost font-mono text-xs">
              $ view_documentation
            </button>
          </div>

          {/* Trust badges */}
          <div className="flex flex-wrap justify-center gap-6 mt-12">
            {["NO_BACKEND", "YOUR_API_KEY", "INSTALL_AND_GO"].map(
              (badge, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 font-mono text-[10px] text-white/40"
                >
                  <div className="w-1 h-1 bg-[#00ff41]" />
                  {badge}
                </div>
              ),
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default CTA;
