# ROADMAP.md

> **Current Milestone**: Docker Lock Optimization & Panel Colors Change
> **Goal**: Resolve Windows/Docker/WSL2 file locking conflicts across the repo and improve the processing panel semantic colors.

## Must-Haves
- [ ] Comprehensive research document on fixing Windows/Docker/WSL2 file locking conflicts.
- [ ] Discussion and finalized decisions on optimal processing panel colors (e.g., p99 should not be green).

## Nice-to-Haves
- [ ] Implementation of the chosen file locking fix across the repository.
- [ ] Implementation of the new panel colors in the processing panel.

## Phases

### Phase 1: WSL/Docker File Locking Optimization Research
**Status**: ✅ Complete
**Objective**: Analyze the current Docker + WSL2 + VS Code setup, review web search findings on file locking conflicts, and the content of /docs/ideas.md for ideas, and recommend the best architectural solution for this project in a new document.

### Phase 2: Panel Color Design & Discussion
**Status**: ⬜ Not Started
**Objective**: Review the current processing panel metric colors, discuss alternatives for proper semantic coloring (e.g., why p99 shouldn't be green), and finalize a color palette.

### Phase 3: Docker Fix Implementation (Nice-to-have)
**Status**: ⬜ Not Started
**Objective**: Execute the recommendations from Phase 1 to implement the optimal Docker/WSL2 file locking solution.

### Phase 4: Panel Color Implementation (Nice-to-have)
**Status**: ⬜ Not Started
**Objective**: Apply the finalized color changes to the processing panel codebase.
