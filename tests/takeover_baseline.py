"""Frozen-input checks after the 2026-10-27 hand-over (docs/delivery/claude-takeover-plan.zh-CN.md).

Earlier plans pinned SHA-256 digests of code files as evidence of the exact inputs they were written
against. Code under the Claude Code development scope now keeps changing, so those pins are checked
against the hand-over baseline commit instead of the working tree; documents are still checked live.
"""
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASELINE = 'ecfb54e70fe5356ed87e82f2e8b2ea1defcf1602'
DEV_SCOPE = ('apps/', 'packages/', 'pnpm-lock.yaml', 'package.json', 'pnpm-workspace.yaml')


def pinned_bytes(path: str) -> bytes:
    if str(path).startswith(DEV_SCOPE):
        return subprocess.run(['git', 'show', f'{BASELINE}:{path}'], cwd=ROOT, check=True, capture_output=True).stdout
    return (ROOT / path).read_bytes()
