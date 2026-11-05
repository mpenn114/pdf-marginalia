# PDF Marginalia

Review a PDF that lives in a GitHub repository, comment on it line by line, and file all your comments as a single issue in the source repo.

Handy for reviewing papers, reports and specifications that are kept in version control.

## Features

- **Open any PDF on GitHub** by pasting its `blob` URL, including from private repos you can access.
- **Line-level comments:** click a line to comment on it, or shift-click to select a range. Lines are numbered per page in the margin.
- **Autosave:** every keystroke is saved to disk, so closing the tab never loses work. Reloading the same URL restores your comments.
- **One-click issue:** submitting creates a single GitHub issue listing each comment with its page, line range and quoted text.
- **No dependencies:** one small Node.js server and one HTML file. PDF.js is loaded from a CDN.

## Requirements

- [Node.js](https://nodejs.org) 18 or newer
- GitHub access, via **either** the [GitHub CLI](https://cli.github.com) signed in (`gh auth login`) **or** a `GITHUB_TOKEN` environment variable with `repo` scope (or Contents read and Issues write for a fine-grained token)

## Usage

```bash
git clone https://github.com/mpenn114/pdf-marginalia.git
cd pdf-marginalia
npm start
```

Then open <http://localhost:8787> and paste a URL such as:

```
https://github.com/owner/repo/blob/main/paper/paper.pdf
```

On Windows you can instead double-click `Launch PDF Marginalia.bat`, which starts the server and opens the browser. Close the minimised server window to stop it.

### Commenting

| Action | Result |
| --- | --- |
| Click a line | Select it and open the comment box |
| Shift-click another line | Extend the selection on the same page |
| Ctrl+Enter | Add the comment |
| Click a comment's heading | Scroll to its page |

Then press **Submit as issue** to file everything in the source repository.

### Example issue

```markdown
### Page 3, lines 12-14
> We optimise the objective over all trees using a shared evaluator...

Is the shared evaluator exact, or an approximation?
```

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `8787` | Port for the local server |
| `GITHUB_TOKEN` / `GH_TOKEN` | from `gh auth token` | GitHub credentials |

Comments are stored as JSON in a local `comments/` folder (git-ignored), one file per PDF.

## Limitations

- PDFs have no real line numbers, so lines are inferred from the text layer and counted per page, top to bottom. In two-column layouts the columns may interleave. The quoted text in each issue keeps every comment unambiguous.
- Scanned PDFs without a text layer cannot be annotated.
- Branch names containing `/` are not supported in the URL.
- The server only listens on `127.0.0.1` and is intended for local, single-user use.

## Licence

[MIT](LICENSE)
