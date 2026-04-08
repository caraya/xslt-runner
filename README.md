# XSLT Runner

Run file conversions directly from the command palette using either:

- Java + Saxon (XSLT transformations)
- Pandoc (document format conversions)

## Commands

- `XSLT Runner: Run Conversion (Configured Backend)`
- `XSLT Runner: Run XSLT with Java`
- `XSLT Runner: Run Conversion with Pandoc`

## Settings

- `xsltRunner.backend`: `java` or `pandoc`
- `xsltRunner.java.path`: Java executable path (default: `java`)
- `xsltRunner.java.saxonJarPath`: path to Saxon JAR (required for Java mode)
- `xsltRunner.java.stylesheetDirectory`: default folder for stylesheet selection (you will still be prompted to confirm/select location per run)
- `xsltRunner.java.extraArgs`: extra args appended to Java command
- `xsltRunner.pandoc.path`: Pandoc executable path (default: empty, resolved by OS)
- `xsltRunner.pandoc.extraPathEntries`: additional PATH entries used when running Pandoc (useful for PDF engines like `pdflatex`)
- `xsltRunner.pandoc.from`: optional Pandoc input format
- `xsltRunner.pandoc.to`: default Pandoc output format hint
- `xsltRunner.pandoc.extraArgs`: extra args appended to Pandoc command

## Required Inputs Per Run

- Java conversion: requires selecting the stylesheet directory and stylesheet file to apply.
- Pandoc conversion: requires selecting a target format from formats reported by `pandoc --list-output-formats`.

## Format-Specific Requirements

Some Pandoc output formats require additional external tools beyond `pandoc` itself.

- Example: PDF output typically requires a LaTeX engine such as `pdflatex`.
- If the PDF engine is not installed or not discoverable in `PATH`, the conversion will fail even when `pandoc` is available.
- Use `xsltRunner.pandoc.extraPathEntries` to add directories that contain helper tools (for example, `/Library/TeX/texbin` on macOS).

### Pandoc Path Resolution

If `xsltRunner.pandoc.path` is empty, the extension uses OS-specific defaults:

- macOS Apple Silicon: `/opt/homebrew/bin/pandoc`, then `/usr/local/bin/pandoc`, then `pandoc` from `PATH`
- macOS Intel: `/usr/local/bin/pandoc`, then `/opt/homebrew/bin/pandoc`, then `pandoc` from `PATH`
- Linux: `/usr/bin/pandoc`, then `/usr/local/bin/pandoc`, then `pandoc` from `PATH`
- Windows: `pandoc.exe` from `PATH`

When running Pandoc, the extension also prepends OS-specific PATH entries so helper tools (for example, `pdflatex`) can be discovered:

- macOS: `/Library/TeX/texbin`, `/opt/homebrew/bin`, `/usr/local/bin`
- Linux: `/usr/local/bin`, `/usr/bin`
- Windows: no extra defaults (set `xsltRunner.pandoc.extraPathEntries` if needed)

## Java Mode Example

With `xsltRunner.java.saxonJarPath` set to `/opt/saxon/saxon-he.jar`, the extension runs:

```bash
java -jar /opt/saxon/saxon-he.jar -s:/path/in.xml -xsl:/path/style.xsl -o:/path/out.xml
```

## Pandoc Mode Example

With `xsltRunner.pandoc.to` set to `docx`, the extension runs:

```bash
pandoc /path/in.md --to docx --output /path/in.docx
```
