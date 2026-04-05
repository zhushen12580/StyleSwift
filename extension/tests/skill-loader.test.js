/**
 * StyleSwift - Skill Loader Tests
 */

import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";

// Import the module under test
import { SkillLoader, UnifiedSkillManager } from "../sidepanel/skill-loader.js";

// =============================================================================
// SkillLoader Tests
// =============================================================================

describe("SkillLoader", () => {
  const mockSkillsDir = "chrome-extension://test-id";
  let loader;

  // Mock skill files content — must match knownFiles in skill-loader.js
  const mockSkillFiles = {
    "skills/frontend-design.md": `---
name: frontend-design
description: 前端设计 - 视觉设计的核心原则与最佳实践
tags: design, contrast, hierarchy
---

# 设计原则

> 内置知识：视觉设计的核心原则与最佳实践

## 一、对比度 (Contrast)

对比度创造视觉层级和焦点。`,

    "skills/audit.md": `---
name: audit
description: 视觉审计 - 页面质量检查与问题发现
tags: audit, quality, accessibility
---

# 视觉审计

> 内置知识：页面质量检查与问题发现`,

    "skills/colorize.md": `---
name: colorize
description: 配色方案 - 色彩基础与网页配色最佳实践
tags: color, design, palette
---

# 配色理论

> 内置知识：色彩基础与网页配色最佳实践`,

    "skills/polish.md": `---
name: polish
description: 细节打磨 - 提升视觉品质的精细化技巧
tags: polish, refinement, details
---

# 细节打磨

> 内置知识：提升视觉品质的精细化技巧`,

    "skills/normalize.md": `---
name: normalize
description: 样式归一化 - 跨浏览器一致性处理
tags: normalize, css, cross-browser
---

# 样式归一化

> 内置知识：跨浏览器一致性处理`,

    "skills/distill.md": `---
name: distill
description: 内容提炼 - 信息层次与视觉简化
tags: distill, simplification, hierarchy
---

# 内容提炼

> 内置知识：信息层次与视觉简化`,

    "skills/delight.md": `---
name: delight
description: 惊喜设计 - 微交互与愉悦体验设计
tags: delight, micro-interaction, animation
---

# 惊喜设计

> 内置知识：微交互与愉悦体验设计`,

    "skills/critique.md": `---
name: critique
description: 设计评审 - 视觉设计的质量评估
tags: critique, review, evaluation
---

# 设计评审

> 内置知识：视觉设计的质量评估`,

    "skills/animate.md": `---
name: animate
description: 动画设计 - CSS 动画与过渡效果最佳实践
tags: animate, css, transition
---

# 动画设计

> 内置知识：CSS 动画与过渡效果最佳实践`,

    "skills/adapt.md": `---
name: adapt
description: 响应式适配 - 多设备屏幕适配策略
tags: responsive, adapt, mobile
---

# 响应式适配

> 内置知识：多设备屏幕适配策略`,

    "skills/bolder.md": `---
name: bolder
description: 大胆设计 - 突破常规的视觉方案
tags: bold, creative, experimental
---

# 大胆设计

> 内置知识：突破常规的视觉方案`,

    "skills/reference/color-and-contrast.md": `---
name: reference/color-and-contrast
description: 色彩与对比度参考
tags: reference, color, contrast
---

# 色彩与对比度参考`,

    "skills/reference/interaction-design.md": `---
name: reference/interaction-design
description: 交互设计参考
tags: reference, interaction, ux
---

# 交互设计参考`,

    "skills/reference/motion-design.md": `---
name: reference/motion-design
description: 动效设计参考
tags: reference, motion, animation
---

# 动效设计参考`,

    "skills/reference/responsive-design.md": `---
name: reference/responsive-design
description: 响应式设计参考
tags: reference, responsive, layout
---

# 响应式设计参考`,

    "skills/reference/spatial-design.md": `---
name: reference/spatial-design
description: 空间设计参考
tags: reference, spatial, layout
---

# 空间设计参考`,

    "skills/reference/typography.md": `---
name: reference/typography
description: 排版参考
tags: reference, typography, font
---

# 排版参考`,

    "skills/reference/ux-writing.md": `---
name: reference/ux-writing
description: UX 写作参考
tags: reference, ux, writing
---

# UX 写作参考`,

    "skills/style-templates/dark-mode.md": `---
name: dark-mode-template
description: 深色模式模板 - 深色背景+高对比度文字的护眼风格
tags: template, dark-mode
---

# 深色模式模板

> 内置知识：深色背景 + 高对比度文字的护眼风格`,

    "skills/style-templates/minimal.md": `---
name: minimal-template
description: 极简风格模板 - 简洁、留白、功能导向的设计风格
tags: template, minimal, clean
---

# 极简风格模板

> 内置知识：简洁、留白、功能导向的设计风格`,

    "skills/no-frontmatter.md": `# 无 Frontmatter 技能

> 这是一个没有 frontmatter 的技能文件

内容在这里。`,
  };

  beforeEach(() => {
    loader = new SkillLoader(mockSkillsDir);

    // Mock fetch
    global.fetch = vi.fn(async (url, options) => {
      // HEAD request for file existence check
      if (options?.method === "HEAD") {
        const path = url.replace(`${mockSkillsDir}/`, "");
        const exists = path in mockSkillFiles;
        return { ok: exists };
      }

      // GET request for file content
      for (const [path, content] of Object.entries(mockSkillFiles)) {
        if (url.includes(path)) {
          return {
            ok: true,
            text: async () => content,
          };
        }
      }

      return { ok: false, status: 404, text: async () => "" };
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("_parseFrontmatter", () => {
    test("解析带 frontmatter 的文件", () => {
      const text = mockSkillFiles["skills/frontend-design.md"];
      const { meta, body } = loader._parseFrontmatter(text);

      expect(meta.name).toBe("frontend-design");
      expect(meta.description).toBe("前端设计 - 视觉设计的核心原则与最佳实践");
      expect(meta.tags).toBe("design, contrast, hierarchy");
      expect(body).toContain("# 设计原则");
      expect(body).not.toContain("---");
    });

    test("解析无 frontmatter 的文件 - 从标题提取名称", () => {
      const text = mockSkillFiles["skills/no-frontmatter.md"];
      const { meta, body } = loader._parseFrontmatter(text);

      expect(meta.name).toBe("无 Frontmatter 技能");
      expect(meta.description).toBe("这是一个没有 frontmatter 的技能文件");
      expect(body).toContain("# 无 Frontmatter 技能");
    });

    test("处理空文件", () => {
      const { meta, body } = loader._parseFrontmatter("");

      expect(meta.name).toBe("Unnamed");
      expect(meta.description).toBe("");
      expect(body).toBe("");
    });
  });

  describe("_extractNameFromPath", () => {
    test("从路径提取名称", () => {
      expect(loader._extractNameFromPath("skills/frontend-design.md")).toBe(
        "frontend_design",
      );
      expect(
        loader._extractNameFromPath("skills/style-templates/dark-mode.md"),
      ).toBe("dark_mode");
    });
  });

  describe("init", () => {
    test("初始化后加载所有技能", async () => {
      await loader.init();

      expect(loader.initialized).toBe(true);
      expect(loader.skills.size).toBeGreaterThan(0);
    });

    test("重复初始化不会重复加载", async () => {
      await loader.init();
      const firstSize = loader.skills.size;

      await loader.init();

      expect(loader.skills.size).toBe(firstSize);
    });
  });

  describe("getDescriptions", () => {
    test("返回格式化的技能描述", async () => {
      await loader.init();
      const descs = loader.getDescriptions();

      expect(descs).toContain("frontend-design");
      expect(descs).toContain("前端设计");
      expect(descs).toContain("[design, contrast, hierarchy]");
    });

    test("无技能时返回默认消息", () => {
      const emptyLoader = new SkillLoader(mockSkillsDir);
      emptyLoader.skills = new Map();

      expect(emptyLoader.getDescriptions()).toBe("(no skills available)");
    });
  });

  describe("getContent", () => {
    test("返回技能内容", async () => {
      await loader.init();
      const content = loader.getContent("frontend-design");

      expect(content).toContain('<skill name="frontend-design">');
      expect(content).toContain("# 设计原则");
      expect(content).toContain("</skill>");
    });

    test("技能不存在时返回 null", async () => {
      await loader.init();
      const content = loader.getContent("nonexistent");

      expect(content).toBeNull();
    });
  });

  describe("has", () => {
    test("检查技能是否存在", async () => {
      await loader.init();

      expect(loader.has("frontend-design")).toBe(true);
      expect(loader.has("nonexistent")).toBe(false);
    });
  });

  describe("list", () => {
    test("返回技能列表", async () => {
      await loader.init();
      const list = loader.list();

      expect(Array.isArray(list)).toBe(true);
      expect(list.length).toBeGreaterThan(0);
      expect(list[0]).toHaveProperty("name");
      expect(list[0]).toHaveProperty("description");
    });
  });
});

// =============================================================================
// UnifiedSkillManager Tests
// =============================================================================

describe("UnifiedSkillManager", () => {
  let manager;
  let mockStaticLoader;
  let mockUserStore;

  beforeEach(() => {
    // Mock static loader
    mockStaticLoader = {
      init: vi.fn(async () => {}),
      getDescriptions: vi.fn(
        () => "- design-principles: 设计原则\n- color-theory: 配色理论",
      ),
      getContent: vi.fn((name) => {
        if (name === "design-principles") {
          return '<skill name="design-principles">\n# 设计原则\n</skill>';
        }
        return null;
      }),
      has: vi.fn((name) => name === "design-principles"),
      getNames: vi.fn(() => ["design-principles", "color-theory"]),
      list: vi.fn(() => [
        { name: "design-principles", description: "设计原则" },
        { name: "color-theory", description: "配色理论" },
      ]),
    };

    // Mock user store
    mockUserStore = {
      load: vi.fn(async (id) => {
        if (id === "abc123") {
          return "# 赛博朋克\n\n深色背景+霓虹色调";
        }
        return null;
      }),
      list: vi.fn(async () => [
        { id: "abc123", name: "赛博朋克", mood: "深色背景+霓虹色调" },
      ]),
    };

    manager = new UnifiedSkillManager(mockStaticLoader, mockUserStore);
  });

  describe("init", () => {
    test("初始化静态加载器", async () => {
      await manager.init();

      expect(mockStaticLoader.init).toHaveBeenCalled();
    });
  });

  describe("getDescriptions", () => {
    test("返回静态和用户技能描述", async () => {
      const descs = await manager.getDescriptions();

      expect(descs).toContain("Static skills:");
      expect(descs).toContain("design-principles");
      expect(descs).toContain("User skills:");
      expect(descs).toContain("skill:abc123");
    });
  });

  describe("getContent", () => {
    test("加载静态技能", async () => {
      const content = await manager.getContent("design-principles");

      expect(content).toContain('<skill name="design-principles">');
      expect(content).toContain("# 设计原则");
    });

    test("加载用户技能", async () => {
      const content = await manager.getContent("skill:abc123");

      expect(content).toContain('<skill name="skill:abc123">');
      expect(content).toContain("# 赛博朋克");
    });

    test("技能不存在时返回错误", async () => {
      const content = await manager.getContent("nonexistent");

      expect(content).toContain("Error: Unknown skill 'nonexistent'");
      expect(content).toContain("Available:");
    });

    test("用户技能不存在时返回错误", async () => {
      const content = await manager.getContent("skill:notfound");

      expect(content).toContain("Error: User skill 'notfound' not found");
    });
  });

  describe("has", () => {
    test("检查静态技能存在", async () => {
      const exists = await manager.has("design-principles");

      expect(exists).toBe(true);
    });

    test("检查用户技能存在", async () => {
      const exists = await manager.has("skill:abc123");

      expect(exists).toBe(true);
    });

    test("检查不存在的技能", async () => {
      const exists = await manager.has("nonexistent");

      expect(exists).toBe(false);
    });
  });

  describe("list", () => {
    test("返回所有技能列表", async () => {
      const list = await manager.list();

      expect(list.length).toBe(3); // 2 static + 1 user
      expect(list.find((s) => s.name === "design-principles")?.type).toBe(
        "static",
      );
      expect(list.find((s) => s.name === "skill:abc123")?.type).toBe("user");
    });
  });
});
