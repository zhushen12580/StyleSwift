import { Github, Twitter, Mail, MessageCircle } from "lucide-react";

const footerLinks = {
  product: {
    title: "PRODUCT",
    links: ["Features", "Pricing", "Changelog", "Roadmap"],
  },
  resources: {
    title: "RESOURCES",
    links: ["Documentation", "API", "FAQ", "Community"],
  },
  company: {
    title: "COMPANY",
    links: ["About", "Blog", "Careers", "Contact"],
  },
  legal: {
    title: "LEGAL",
    links: ["Privacy", "Terms", "Cookies"],
  },
};

const socialLinks = [
  { icon: Github, label: "GitHub" },
  { icon: Twitter, label: "Twitter" },
  { icon: MessageCircle, label: "Discord" },
  { icon: Mail, label: "Email" },
];

const Footer = () => {
  return (
    <footer className="relative border-t border-white/5">
      {/* Dot matrix */}
      <div className="absolute inset-0 dot-matrix-dense opacity-20" />

      <div className="container-minimal relative z-10 px-6 py-16">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-8 lg:gap-12">
          {/* Brand */}
          <div className="col-span-2">
            {/* ASCII Logo */}
            <div className="font-mono text-[8px] text-white/40 leading-none mb-4 hidden sm:block">
              <pre>
                {`  ███████╗████████╗
  ██╔════╝╚══██╔══╝
  ███████╗   ██║   
  ╚════██║   ██║   
  ███████║   ██║   
  ╚══════╝   ╚═╝   `}
              </pre>
            </div>

            <div className="sm:hidden mb-4">
              <span className="font-mono text-lg text-white">StyleSwift</span>
            </div>

            <p className="font-mono text-[10px] text-white/40 mb-6 max-w-xs leading-relaxed">
              {"// 用一句话个性化任意网页的视觉样式 · Chrome 扩展 · 安装即用"}
            </p>

            {/* Social */}
            <div className="flex gap-2">
              {socialLinks.map((social, index) => {
                const Icon = social.icon;
                return (
                  <a
                    key={index}
                    href="#"
                    aria-label={social.label}
                    className="w-8 h-8 border border-white/10 flex items-center justify-center hover:border-[#00ff41]/50 hover:text-[#00ff41] transition-colors duration-300"
                  >
                    <Icon className="w-4 h-4" />
                  </a>
                );
              })}
            </div>
          </div>

          {/* Links */}
          {Object.entries(footerLinks).map(([key, section]) => (
            <div key={key}>
              <h3 className="font-mono text-[10px] text-white/60 tracking-wider mb-4">
                {section.title}
              </h3>
              <ul className="space-y-2">
                {section.links.map((link, index) => (
                  <li key={index}>
                    <a
                      href="#"
                      className="font-mono text-xs text-white/40 hover:text-white transition-colors duration-300"
                    >
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-white/5">
        <div className="container-minimal px-6 py-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="font-mono text-[10px] text-white/30">
              {"/* © 2026 StyleSwift. All rights reserved. */"}
            </p>
            <div className="flex items-center gap-4">
              <span className="font-mono text-[10px] text-white/30">
                v1.0.0
              </span>
              <span className="w-1 h-1 bg-[#00ff41]" />
              <span className="font-mono text-[10px] text-white/30">
                CHROME_EXTENSION
              </span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
