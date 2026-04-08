# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog and this project follows Semantic Versioning.

## [Unreleased]

### Added

* OS-aware Pandoc executable resolution when `xsltRunner.pandoc.path` is empty.
* OS-aware PATH augmentation for Pandoc subprocesses to improve helper tool discovery (for example, `pdflatex` for PDF output).
* New `xsltRunner.pandoc.extraPathEntries` setting for custom PATH directories.
* Output channel diagnostics showing the resolved Pandoc executable and PATH additions used during Pandoc runs.
* Documentation for format-specific requirements and PDF tooling expectations.

## [0.1.0] - 2026-04-08

* Initial release of XSLT Runner.
* Java + Saxon XSLT conversion workflow.
* Pandoc conversion workflow with configurable input/output formats and extra arguments.
* Command Palette and context menu commands for running conversions.
