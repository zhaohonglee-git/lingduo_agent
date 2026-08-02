# CrateFit Website

Official website for [CrateFit](https://github.com/supra126/cratefit-starter) - 3D bin packing library for TypeScript/JavaScript.

🌐 **Live:** [cratefit.vercel.app](https://cratefit.vercel.app)

## Features

- **Landing Page** - Product introduction, features, and use cases
- **Documentation** - Complete SDK documentation with MDX support
- **Interactive Demo** - Try bin packing with real-time 3D visualization
- **Public API** - REST API for bin packing operations
- **i18n** - English and 繁體中文 support
- **Dark/Light Mode** - Theme switching with system preference detection

## Tech Stack

- [Next.js 16](https://nextjs.org) - React framework with App Router
- [Tailwind CSS 4](https://tailwindcss.com) - Styling
- [next-intl](https://next-intl.dev) - Internationalization
- [next-themes](https://github.com/pacocoursey/next-themes) - Theme management
- [MDX](https://mdxjs.com) - Documentation with Mermaid support
- [@cratefit/pack](https://www.npmjs.com/package/@cratefit/pack) - Bin packing engine
- [@cratefit/viz](https://www.npmjs.com/package/@cratefit/viz) - 3D visualization

## Development

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Build for production
pnpm build

# Type check
pnpm type-check
```

## Project Structure

```
app/
├── [locale]/           # i18n routes (en, zh-TW)
│   ├── (marketing)/    # Landing, pricing pages
│   ├── (docs)/         # Documentation
│   └── demo/           # Interactive demo
├── api/                # REST API routes
└── *.tsx               # Favicon, OG image generators

components/
├── marketing/          # Landing page components
├── docs/               # MDX, Mermaid components
├── demo/               # 3D viewer, packing demo
├── shared/             # Header, Footer, Logo
└── seo/                # JSON-LD structured data

content/docs/           # MDX documentation files
├── en/                 # English docs
└── zh-TW/              # 繁體中文 docs
```

## Environment Variables

All environment variables have sensible defaults. Optional configuration:

| Variable | Default | Description |
|----------|---------|-------------|
| `NEXT_PUBLIC_SITE_URL` | `https://cratefit.vercel.app` | Site URL for SEO |
| `RATE_LIMIT_MAX` | `60` | API rate limit per minute |
| `RATE_LIMIT_WINDOW_MS` | `60000` | Rate limit window |

## Deployment

Optimized for [Vercel](https://vercel.com). Just connect the repository and deploy.

## License

MIT
