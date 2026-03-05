import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ChevronLeft, ChevronRight, Quote } from "lucide-react";

gsap.registerPlugin(ScrollTrigger);

const testimonials = [
  {
    name: "李明",
    role: "PRODUCT_MANAGER",
    avatar:
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop&crop=face",
    content:
      "在 Side Panel 里说一句「改成深色模式」，页面立刻变样并自动保存，下次打开还是深色。",
    rating: 5,
  },
  {
    name: "王芳",
    role: "UI_DESIGNER",
    avatar:
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop&crop=face",
    content:
      "在 GitHub 上调好的赛博朋克风格，保存成风格技能，在 Stack Overflow 一句话就套上了，很一致。",
    rating: 5,
  },
  {
    name: "张伟",
    role: "FRONTEND_DEV",
    avatar:
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&h=200&fit=crop&crop=face",
    content:
      "不用部署后端，自带 API Key 就行。撤销、回滚都支持，按域名会话也不乱。",
    rating: 5,
  },
  {
    name: "陈静",
    role: "MARKETING",
    avatar:
      "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&h=200&fit=crop&crop=face",
    content:
      "护眼模式、极简风都是一句话的事，模型自己决定改哪里，我只要说需求。",
    rating: 5,
  },
];

const Testimonials = () => {
  const sectionRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

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
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  // Auto-play
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % testimonials.length);
    }, 6000);
    return () => clearInterval(interval);
  }, []);

  const nextSlide = () => {
    setCurrentIndex((prev) => (prev + 1) % testimonials.length);
  };

  const prevSlide = () => {
    setCurrentIndex(
      (prev) => (prev - 1 + testimonials.length) % testimonials.length,
    );
  };

  return (
    <section ref={sectionRef} className="section-padding relative">
      {/* Dot matrix */}
      <div className="absolute inset-0 dot-matrix opacity-20" />

      <div className="container-minimal relative z-10">
        {/* Header */}
        <div ref={titleRef} className="text-center mb-16">
          <p className="font-mono text-[10px] text-white/40 tracking-widest mb-4">
            {"// TESTIMONIALS"}
          </p>
          <h2 className="text-headline text-white">用户评价</h2>
        </div>

        {/* Testimonial Card */}
        <div className="max-w-3xl mx-auto">
          <div className="relative border border-white/10 bg-white/[0.02] p-8 md:p-12">
            {/* Quote icon */}
            <Quote className="absolute top-6 right-6 w-8 h-8 text-white/10" />

            {/* Content */}
            <div className="relative z-10">
              {testimonials.map((testimonial, index) => (
                <div
                  key={index}
                  className={`transition-all duration-500 ${
                    index === currentIndex
                      ? "opacity-100 translate-y-0"
                      : "opacity-0 translate-y-4 absolute inset-0 pointer-events-none"
                  }`}
                >
                  {/* Rating */}
                  <div className="flex gap-1 mb-6">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <div key={i} className="w-2 h-2 bg-[#00ff41]" />
                    ))}
                  </div>

                  {/* Quote */}
                  <p className="text-lg md:text-xl text-white/90 leading-relaxed mb-8 font-light">
                    "{testimonial.content}"
                  </p>

                  {/* Author */}
                  <div className="flex items-center gap-4">
                    <img
                      src={testimonial.avatar}
                      alt={testimonial.name}
                      className="w-12 h-12 object-cover border border-white/20"
                    />
                    <div>
                      <div className="text-white font-medium">
                        {testimonial.name}
                      </div>
                      <div className="font-mono text-[10px] text-white/40 tracking-wider">
                        {testimonial.role}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Corner accents */}
            <div className="absolute top-0 left-0 w-4 h-4 border-t border-l border-white/20" />
            <div className="absolute top-0 right-0 w-4 h-4 border-t border-r border-white/20" />
            <div className="absolute bottom-0 left-0 w-4 h-4 border-b border-l border-white/20" />
            <div className="absolute bottom-0 right-0 w-4 h-4 border-b border-r border-white/20" />
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between mt-8">
            <div className="flex gap-2">
              {testimonials.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentIndex(index)}
                  className={`w-2 h-2 transition-all duration-300 ${
                    index === currentIndex
                      ? "bg-[#00ff41] w-6"
                      : "bg-white/20 hover:bg-white/40"
                  }`}
                />
              ))}
            </div>

            <div className="flex gap-2">
              <button
                onClick={prevSlide}
                className="w-10 h-10 border border-white/20 flex items-center justify-center hover:border-[#00ff41]/50 hover:text-[#00ff41] transition-colors duration-300"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={nextSlide}
                className="w-10 h-10 border border-white/20 flex items-center justify-center hover:border-[#00ff41]/50 hover:text-[#00ff41] transition-colors duration-300"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-px bg-white/10 mt-16 max-w-2xl mx-auto">
          {[
            { value: "1", label: "SENTENCE" },
            { value: "∞", label: "SITES" },
            { value: "0", label: "BACKEND" },
            { value: "1", label: "KEY" },
          ].map((stat, index) => (
            <div key={index} className="bg-black p-6 text-center">
              <div className="font-mono text-2xl text-white mb-1">
                {stat.value}
              </div>
              <div className="font-mono text-[10px] text-white/40 tracking-wider">
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Testimonials;
