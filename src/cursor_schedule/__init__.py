# src/cursor_schedule/__init__.py
# @ai-rules:
# 1. [Constraint]: Version comes from setuptools-scm via git tags. Never hardcode.
# 2. [Pattern]: importlib.metadata at runtime, _version.py fallback for editable installs.
"""cursor-schedule: Scheduled task execution for Cursor Agent."""

from importlib.metadata import PackageNotFoundError, version

try:
    __version__ = version("cursor-schedule")
except PackageNotFoundError:
    __version__ = "0.0.0-dev"
