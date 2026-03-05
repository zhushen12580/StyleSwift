import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { Menu, X, Download } from "lucide-react";

const navLinks = [
  { name: "FEATURES", href: "#features" },
  { name: "HOW_IT_WORKS", href: "#how-it-works" },
  { name: "TESTIMONIALS", href: "#testimonials" },
  { name: "PRICING", href: "#pricing" },
];

const Navigation = () => {
  const navRef = useRef<HTMLElement>(null);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    gsap.fromTo(
      navRef.current,
      { y: -100, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.8, ease: "power3.out", delay: 0.5 },
    );
  }, []);

  const scrollToSection = (href: string) => {
    setIsMobileMenuOpen(false);
    const element = document.querySelector(href);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <>
      <nav
        ref={navRef}
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
          isScrolled
            ? "bg-black/80 backdrop-blur-xl border-b border-white/5"
            : "bg-transparent"
        }`}
      >
        <div className="container-minimal px-6">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <a href="#" className="flex items-center gap-3 group">
              <div className="font-mono text-[10px] text-white/60 group-hover:text-[#00ff41] transition-colors">
                <pre className="leading-none">
                  {`╔═══╗
║ S ║
╚═══╝`}
                </pre>
              </div>
              <div>
                <span className="font-mono text-sm text-white tracking-wider">
                  StyleSwift
                </span>
                <span className="font-mono text-[8px] text-white/40 block">
                  v1.0.0
                </span>
              </div>
            </a>

            {/* Desktop Navigation */}
            <div className="hidden lg:flex items-center gap-8">
              {navLinks.map((link) => (
                <button
                  key={link.name}
                  onClick={() => scrollToSection(link.href)}
                  className="font-mono text-[10px] text-white/50 hover:text-white transition-colors duration-300 tracking-wider"
                >
                  {link.name}
                </button>
              ))}
            </div>

            {/* CTA */}
            <div className="hidden lg:flex items-center gap-4">
              <button className="px-4 py-2 bg-white text-black font-mono text-[10px] hover:bg-white/90 transition-colors duration-300 flex items-center gap-2">
                <Download className="w-3 h-3" />
                INSTALL
              </button>
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="lg:hidden w-10 h-10 border border-white/10 flex items-center justify-center"
            >
              {isMobileMenuOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Menu */}
      <div
        className={`fixed inset-0 z-40 lg:hidden transition-all duration-500 ${
          isMobileMenuOpen ? "opacity-100 visible" : "opacity-0 invisible"
        }`}
      >
        <div
          className="absolute inset-0 bg-black/95 backdrop-blur-xl"
          onClick={() => setIsMobileMenuOpen(false)}
        />

        <div
          className={`absolute top-16 left-4 right-4 border border-white/10 bg-black p-6 transition-all duration-500 ${
            isMobileMenuOpen
              ? "translate-y-0 opacity-100"
              : "-translate-y-4 opacity-0"
          }`}
        >
          <div className="space-y-1">
            {navLinks.map((link) => (
              <button
                key={link.name}
                onClick={() => scrollToSection(link.href)}
                className="block w-full text-left font-mono text-xs text-white/60 hover:text-white transition-colors duration-300 py-3 border-b border-white/5"
              >
                {link.name}
              </button>
            ))}
            <div className="pt-4">
              <button className="w-full py-3 bg-white text-black font-mono text-xs flex items-center justify-center gap-2">
                <Download className="w-4 h-4" />
                INSTALL_EXTENSION
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Navigation;
