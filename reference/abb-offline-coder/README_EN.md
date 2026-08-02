# abb-offline-coder

**Offline AI-assisted programming for ABB industrial robots and RAPID code generation.**

abb-offline-coder is an offline command-line AI assistant for generating ABB RAPID programs from natural-language task descriptions. The project is designed for industrial robot programming workflows, especially spray-coating scenarios, local deployment, and RobotStudio-oriented validation.

> Disclaimer: This project is not affiliated with, endorsed by, or supported by ABB Ltd. ABB, RobotStudio, RAPID, IRC5, and IRC5P are trademarks of ABB Ltd. Generated code must be validated in RobotStudio and reviewed by qualified personnel before use on any physical robot.

## Why This Project Matters

Industrial robot deployment often requires repetitive offline programming, manual parameter tuning, process-specific RAPID code, and careful validation before execution. A local AI-assisted workflow can reduce programming overhead, improve reproducibility, and make it easier to connect task-level planning with executable robot code.

## Main Features

- Fully offline operation with local LLM, embeddings, and vector database
- Chinese natural-language input for RAPID program generation
- Spray-coating-oriented process knowledge
- IRC5 and IRC5P controller modes
- Pack&Go-style output bundle for RobotStudio loading
- RAG-based retrieval over manuals, code examples, and local documents
- CPU-friendly deployment on industrial PCs
- Code post-processing, formatting, and validation workflow

## System Pipeline

```text
natural-language task description
    ↓
query rewriting
    ↓
RAG hybrid retrieval
    ↓
prompt assembly with retrieved context
    ↓
local LLM inference
    ↓
RAPID code post-processing and validation
    ↓
.mod / Pack&Go-style output for RobotStudio validation
```

## Typical Use Cases

- Generate ABB RAPID modules from process descriptions
- Build spray-coating robot programs from high-level requirements
- Create reusable templates for manufacturing tasks
- Package generated `.mod`, `.sys`, and task-loading assets
- Support offline robot programming on factory or field computers
- Bridge AI planning, process optimization, and industrial robot execution

## Recommended Starting Points

- `README.md` — main Chinese documentation with screenshots, demo page, setup, and examples
- `PROJECT_PROFILE.md` — research positioning and roadmap
- `README_PUBLIC_DRAFT.md` — concise public-facing research draft
- `docs/screenshots/` — project images for public presentation
- `scripts/` — installation, bundling, and deployment scripts
- `abb_agent/` — core implementation, configuration, and RAPID generation logic

## Evaluation Dimensions

- Correctness of generated RAPID code
- Programming-time reduction
- Compatibility with target controller mode
- RobotStudio validation success
- Reusability across task variants
- Safety and constraint-checking coverage
- Offline deployment reliability

## Long-Term Direction

This repository can become a practical bridge between AI planning and real industrial robot deployment. Its strongest research value lies in connecting natural-language task descriptions, process-aware code generation, simulation validation, execution-error compensation, and smart manufacturing workflows.
