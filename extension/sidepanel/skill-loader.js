/**
 * StyleSwift - Skill Loader Module
 *
 * Auto-discovers and loads skills from the extension's skills directory.
 * Supports YAML frontmatter for metadata extraction.
 *
 * Two-layer approach:
 * - Layer 1: getDescriptions() - short descriptions for system prompt
 * - Layer 2: getContent(name) - full skill body on demand
 */

// =============================================================================
// SkillLoader Class
// =============================================================================

/**
 * Skill Loader - Auto-discovers and manages skills
 *
 * Scans the skills directory for SKILL.md files, parses frontmatter,
 * and provides unified access to both static and user skills.
 */
class SkillLoader {
  /**
   * @param {string} skillsDir - Base URL for skills directory (chrome-extension://...)
   */
  constructor(skillsDir) {
    this.skillsDir = skillsDir;
    /** @type {Map<string, {meta: object, body: string, path: string}>} */
    this.skills = new Map();
    /** @type {boolean} */
    this.initialized = false;
  }

  /**
   * Initialize the loader by scanning for SKILL.md files
   * Must be called before using the loader
   * @returns {Promise<void>}
   */
  async init() {
    if (this.initialized) return;

    // Scan for skill files
    const skillFiles = await this._scanSkillFiles();

    // Load each skill file
    await Promise.all(
      skillFiles.map(async (path) => {
        try {
          const content = await this._fetchFile(path);
          const { meta, body } = this._parseFrontmatter(content);
          const name = meta.name || this._extractNameFromPath(path);
          this.skills.set(name, { meta, body, path });
        } catch (err) {
          console.warn(`[SkillLoader] Failed to load ${path}:`, err);
        }
      })
    );

    this.initialized = true;
  }

  /**
   * Scan for skill files in the skills directory
   * Looks for both SKILL.md files and regular .md files
   * @returns {Promise<string[]>} Array of file paths
   * @private
   */
  async _scanSkillFiles() {
    // In Chrome extension, we need to predefine the skill files
    // since we can't dynamically list directory contents
    // This list should match the actual files in extension/skills/
    const knownFiles = [
      "skills/design-principles.md",
      "skills/color-theory.md",
      "skills/css-selectors-guide.md",
      "skills/style-templates/dark-mode.md",
      "skills/style-templates/minimal.md",
    ];

    // Verify files exist by trying to fetch them
    const existingFiles = [];
    for (const file of knownFiles) {
      try {
        const url = `${this.skillsDir}/${file}`;
        const resp = await fetch(url, { method: "HEAD" });
        if (resp.ok) {
          existingFiles.push(file);
        }
      } catch {
        // File doesn't exist, skip
      }
    }

    return existingFiles;
  }

  /**
   * Fetch a file from the extension
   * @param {string} path - Relative path to the file
   * @returns {Promise<string>} File content
   * @private
   */
  async _fetchFile(path) {
    const url = `${this.skillsDir}/${path}`;
    const resp = await fetch(url);
    if (!resp.ok) {
      throw new Error(`Failed to fetch ${path}: ${resp.status}`);
    }
    return await resp.text();
  }

  /**
   * Parse YAML frontmatter from markdown content
   *
   * Frontmatter format:
   * ---
   * name: skill-name
   * description: Short description
   * tags: tag1, tag2
   * ---
   *
   * @param {string} text - Markdown content with optional frontmatter
   * @returns {{meta: object, body: string}} Parsed metadata and body
   * @private
   */
  _parseFrontmatter(text) {
    // Match frontmatter between --- delimiters
    const match = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);

    if (!match) {
      // No frontmatter, try to extract from first heading
      const headingMatch = text.match(/^#\s+(.+)(?:\n|$)/);
      const name = headingMatch ? headingMatch[1].trim() : "Unnamed";
      const descMatch = text.match(/^>\s*(.+)$/m);
      const description = descMatch ? descMatch[1].trim() : "";

      return {
        meta: { name, description },
        body: text.trim(),
      };
    }

    const frontmatter = match[1];
    const body = match[2].trim();
    const meta = {};

    // Parse simple YAML key: value pairs
    for (const line of frontmatter.split("\n")) {
      const colonIndex = line.indexOf(":");
      if (colonIndex > 0) {
        const key = line.slice(0, colonIndex).trim();
        const value = line.slice(colonIndex + 1).trim();
        meta[key] = value;
      }
    }

    return { meta, body };
  }

  /**
   * Extract skill name from file path
   * @param {string} path - File path like "skills/design-principles.md"
   * @returns {string} Extracted name
   * @private
   */
  _extractNameFromPath(path) {
    const filename = path.split("/").pop() || path;
    return filename.replace(/\.md$/, "").replace(/-/g, "_");
  }

  /**
   * Layer 1: Get short descriptions for system prompt injection
   *
   * Returns a formatted list of all available skills with their descriptions.
   * Used to inform the LLM about available skills without loading full content.
   *
   * @returns {string} Formatted skill descriptions
   *
   * @example
   * const loader = new SkillLoader(baseUrl);
   * await loader.init();
   * const descriptions = loader.getDescriptions();
   * // "- design-principles: 设计原则 (视觉设计的核心原则与最佳实践) [design, contrast]"
   */
  getDescriptions() {
    if (this.skills.size === 0) {
      return "(no skills available)";
    }

    const lines = [];
    for (const [name, skill] of this.skills) {
      const desc = skill.meta.description || "No description";
      const tags = skill.meta.tags ? ` [${skill.meta.tags}]` : "";
      lines.push(`  - ${name}: ${desc}${tags}`);
    }

    return lines.join("\n");
  }

  /**
   * Layer 2: Get full skill content by name
   *
   * Returns the complete skill body wrapped in a skill tag.
   * Used when the LLM needs the full knowledge content.
   *
   * @param {string} name - Skill name
   * @returns {string|null} Skill content or null if not found
   *
   * @example
   * const content = loader.getContent('dark-mode-template');
   * // '<skill name="dark-mode-template">\n# 深色模式模板\n...\n</skill>'
   */
  getContent(name) {
    const skill = this.skills.get(name);
    if (!skill) return null;

    return `<skill name="${name}">\n${skill.body}\n</skill>`;
  }

  /**
   * Get list of all available skill names
   * @returns {string[]} Array of skill names
   */
  getNames() {
    return Array.from(this.skills.keys());
  }

  /**
   * Check if a skill exists
   * @param {string} name - Skill name
   * @returns {boolean}
   */
  has(name) {
    return this.skills.has(name);
  }

  /**
   * Get skill metadata without body
   * @param {string} name - Skill name
   * @returns {object|null} Metadata object or null
   */
  getMeta(name) {
    const skill = this.skills.get(name);
    return skill ? { ...skill.meta } : null;
  }

  /**
   * Get all skills as an array of {name, meta}
   * Useful for listing available skills
   * @returns {Array<{name: string, description: string, tags?: string}>}
   */
  list() {
    const result = [];
    for (const [name, skill] of this.skills) {
      result.push({
        name,
        description: skill.meta.description || "",
        tags: skill.meta.tags,
      });
    }
    return result;
  }
}

// =============================================================================
// Unified Skill Manager (Static + User Skills)
// =============================================================================

/**
 * Unified Skill Manager
 *
 * Combines static skills (from SkillLoader) and user skills (from StyleSkillStore)
 * into a single interface for the agent.
 */
class UnifiedSkillManager {
  /**
   * @param {SkillLoader} staticLoader - Loader for static skills
   * @param {object} userStore - StyleSkillStore for user skills
   */
  constructor(staticLoader, userStore) {
    this.staticLoader = staticLoader;
    this.userStore = userStore;
  }

  /**
   * Initialize the static skill loader
   * @returns {Promise<void>}
   */
  async init() {
    await this.staticLoader.init();
  }

  /**
   * Get descriptions of all available skills (static + user)
   *
   * Layer 1 output for system prompt injection.
   *
   * @returns {Promise<string>} Formatted skill descriptions
   */
  async getDescriptions() {
    const staticDescs = this.staticLoader.getDescriptions();

    // Get user skills
    const userSkills = await this.userStore.list();
    let userDescs = "(no user skills)";
    if (userSkills.length > 0) {
      userDescs = userSkills
        .map((s) => `  - skill:${s.id}: ${s.name} — ${s.mood || ""} (user)`)
        .join("\n");
    }

    return `Static skills:\n${staticDescs}\n\nUser skills:\n${userDescs}`;
  }

  /**
   * Get full content of a skill by name
   *
   * Layer 2 output for loading skill knowledge.
   *
   * @param {string} name - Skill name (static name or "skill:{id}" for user skill)
   * @returns {Promise<string>} Skill content or error message
   */
  async getContent(name) {
    // User skill: skill:{id}
    if (name.startsWith("skill:")) {
      const id = name.slice(6);
      const content = await this.userStore.load(id);
      if (!content) {
        return `Error: User skill '${id}' not found. Use list_style_skills to see available skills.`;
      }
      return `<skill name="${name}">\n${content}\n</skill>`;
    }

    // Static skill
    const content = this.staticLoader.getContent(name);
    if (!content) {
      const available = [
        ...this.staticLoader.getNames(),
        ...(await this.userStore.list()).map((s) => `skill:${s.id}`),
      ];
      return `Error: Unknown skill '${name}'. Available: ${available.join(", ")}`;
    }

    return content;
  }

  /**
   * Check if a skill exists
   * @param {string} name - Skill name
   * @returns {Promise<boolean>}
   */
  async has(name) {
    if (name.startsWith("skill:")) {
      const id = name.slice(6);
      const skills = await this.userStore.list();
      return skills.some((s) => s.id === id);
    }
    return this.staticLoader.has(name);
  }

  /**
   * List all available skills
   * @returns {Promise<Array<{name: string, type: 'static'|'user', description: string}>>}
   */
  async list() {
    const staticSkills = this.staticLoader.list().map((s) => ({
      ...s,
      type: "static",
    }));

    const userSkills = (await this.userStore.list()).map((s) => ({
      name: `skill:${s.id}`,
      type: "user",
      description: `${s.name} — ${s.mood || ""}`,
    }));

    return [...staticSkills, ...userSkills];
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create and initialize the skill manager
 *
 * @param {string} extensionId - Chrome extension ID for constructing base URL
 * @param {object} userStore - StyleSkillStore instance
 * @returns {Promise<UnifiedSkillManager>} Initialized skill manager
 *
 * @example
 * import { StyleSkillStore } from './style-skill.js';
 *
 * const manager = await createSkillManager(chrome.runtime.id, StyleSkillStore);
 * const descriptions = await manager.getDescriptions();
 * const content = await manager.getContent('dark-mode-template');
 */
async function createSkillManager(extensionId, userStore) {
  const baseUrl = `chrome-extension://${extensionId}`;
  const staticLoader = new SkillLoader(baseUrl);
  const manager = new UnifiedSkillManager(staticLoader, userStore);
  await manager.init();
  return manager;
}

// =============================================================================
// Exports
// =============================================================================

export { SkillLoader, UnifiedSkillManager, createSkillManager };