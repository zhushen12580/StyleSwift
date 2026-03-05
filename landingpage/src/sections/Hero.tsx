import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { ArrowRight, Terminal, Download } from "lucide-react";

const Hero = () => {
  const heroRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const subtitleRef = useRef<HTMLParagraphElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [typedText, setTypedText] = useState("");
  const fullText = "StyleSwift";

  // Dot Matrix Canvas Animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const dots: { x: number; y: number; active: boolean; opacity: number }[] =
      [];
    const spacing = 24;
    const cols = Math.ceil(canvas.width / spacing);
    const rows = Math.ceil(canvas.height / spacing);

    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        dots.push({
          x: i * spacing + spacing / 2,
          y: j * spacing + spacing / 2,
          active: Math.random() > 0.97,
          opacity: Math.random() * 0.3 + 0.05,
        });
      }
    }

    let mouseX = canvas.width / 2;
    let mouseY = canvas.height / 2;

    const handleMouseMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    };
    window.addEventListener("mousemove", handleMouseMove);

    let frame = 0;
    let animationId: number;

    const animate = () => {
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      dots.forEach((dot) => {
        const dx = mouseX - dot.x;
        const dy = mouseY - dot.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Activate dots near mouse
        if (dist < 100 && Math.random() > 0.9) {
          dot.active = true;
        }

        // Randomly deactivate
        if (dot.active && Math.random() > 0.995) {
          dot.active = false;
        }

        const opacity = dot.active
          ? Math.min(0.8, dot.opacity + 0.3)
          : dot.opacity;

        ctx.beginPath();
        ctx.arc(dot.x, dot.y, dot.active ? 2 : 1, 0, Math.PI * 2);
        ctx.fillStyle = dot.active
          ? `rgba(0, 255, 65, ${opacity})`
          : `rgba(255, 255, 255, ${opacity})`;
        ctx.fill();
      });

      frame++;
      animationId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", handleMouseMove);
      cancelAnimationFrame(animationId);
    };
  }, []);

  // Typewriter effect
  useEffect(() => {
    let index = 0;
    const timer = setInterval(() => {
      if (index <= fullText.length) {
        setTypedText(fullText.slice(0, index));
        index++;
      } else {
        clearInterval(timer);
      }
    }, 80);
    return () => clearInterval(timer);
  }, []);

  // GSAP animations
  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(
        titleRef.current,
        { opacity: 0, y: 40 },
        { opacity: 1, y: 0, duration: 1, ease: "power3.out", delay: 0.5 },
      );

      gsap.fromTo(
        subtitleRef.current,
        { opacity: 0, y: 30 },
        { opacity: 1, y: 0, duration: 0.8, ease: "power3.out", delay: 0.8 },
      );
    }, heroRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={heroRef}
      className="relative min-h-screen w-full flex items-center justify-center overflow-hidden"
    >
      {/* Dot Matrix Canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 z-0" />

      {/* ASCII Grid Overlay */}
      <div className="absolute inset-0 ascii-grid opacity-50 z-[1]" />

      {/* Scanlines */}
      <div className="absolute inset-0 scanlines z-[2]" />

      {/* Content */}
      <div className="relative z-10 container-minimal px-6">
        <div className="max-w-4xl">
          {/* Logo：渐变字 + 终端点缀，清晰又好看 */}
          <div className="mb-8 hidden md:block">
            <div className="inline-flex items-baseline gap-2">
              <span className="font-mono text-lg text-[#00ff41]/80 select-none">
                $
              </span>
              <span
                className="font-mono text-2xl md:text-3xl font-bold tracking-tight select-none bg-clip-text text-transparent"
                style={{
                  backgroundImage:
                    "linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.7) 50%, rgba(0,255,65,0.6) 100%)",
                }}
              >
                StyleSwift
              </span>
            </div>
            <div
              className="mt-2 h-px w-20 rounded-full opacity-60"
              style={{
                background:
                  "linear-gradient(90deg, #00ff41 0%, transparent 100%)",
              }}
            />
          </div>

          {/* Terminal-style badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg glass-light mb-8 font-mono text-xs">
            <Terminal className="w-4 h-4 text-[#00ff41]" />
            <span className="text-white/60">$</span>
            <span className="text-[#00ff41]">{typedText}</span>
            <span className="w-2 h-4 bg-[#00ff41] animate-pulse" />
          </div>

          {/* Main Title - Apple-style typography */}
          <h1 ref={titleRef} className="text-display text-white mb-6">
            用一句话
            <br />
            <span className="text-white/40">//</span> 个性化任意网页
          </h1>

          {/* Subtitle */}
          <p
            ref={subtitleRef}
            className="text-body text-lg md:text-xl max-w-xl mb-12"
          >
            纯 Chrome 插件，安装即用、无需后端。在 Side Panel
            里说出你想要的样子——深色模式、护眼、极简风或赛博朋克，AI
            为你改好并保存。
          </p>

          {/* CTA Buttons - Minimal Apple style */}
          <div className="flex flex-col sm:flex-row gap-4">
            <button className="btn-minimal group">
              <Download className="w-4 h-4 mr-2" />
              安装扩展
              <ArrowRight className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-1" />
            </button>
            <button className="btn-ghost font-mono text-xs">
              <span className="text-[#00ff41]">$</span> 自带 API Key · 零订阅
            </button>
          </div>

          {/* ASCII Stats */}
          <div className="mt-20 pt-8 border-t border-white/10">
            <div className="grid grid-cols-3 gap-8">
              {[
                { value: "0", label: "BACKEND" },
                { value: "1", label: "SENTENCE" },
                { value: "∞", label: "STYLES" },
              ].map((stat, index) => (
                <div key={index}>
                  <div className="font-mono text-2xl md:text-3xl text-white tabular-nums mb-1">
                    {stat.value}
                  </div>
                  <div className="font-mono text-[10px] text-white/40 tracking-wider">
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Corner ASCII decorations */}
      <div className="absolute bottom-8 left-8 font-mono text-[10px] text-white/20 hidden lg:block">
        <div>/* v1.0.0 */</div>
        <div>/* Chrome Extension · Manifest V3 */</div>
      </div>

      <div className="absolute top-8 right-8 font-mono text-[10px] text-white/20 hidden lg:block">
        <div>[████░░░░░░] 40%</div>
        <div>MEM: 12MB</div>
      </div>
    </section>
  );
};

export default Hero;
