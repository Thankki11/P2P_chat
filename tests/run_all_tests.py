#!/usr/bin/env python3
"""Master test runner — runs pytest, parses output, writes bug_report.md on failures."""
import subprocess, sys, os, re
from datetime import datetime


def main():
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    result = subprocess.run(
        [sys.executable, "-m", "pytest", "tests/", "-v", "--tb=short", "--no-header"],
        capture_output=True, text=True, cwd=root
    )
    output = result.stdout + result.stderr
    print(output)

    # Parse summary line
    summary_match = re.search(r"(\d+) passed", output)
    failed_match  = re.search(r"(\d+) failed", output)
    error_match   = re.search(r"(\d+) error", output)

    passed = int(summary_match.group(1)) if summary_match else 0
    failed = int(failed_match.group(1)) if failed_match else 0
    errors = int(error_match.group(1)) if error_match else 0
    total  = passed + failed + errors

    if failed == 0 and errors == 0:
        print("\nALL TESTS PASSED. Backend ready.")
        return 0

    # Parse failed test details
    failed_tests = []
    fail_blocks  = re.split(r"_{3,} (.*?) _{3,}", output)
    for i in range(1, len(fail_blocks), 2):
        test_name = fail_blocks[i].strip()
        body = fail_blocks[i + 1] if i + 1 < len(fail_blocks) else ""
        error_line = ""
        for line in body.splitlines():
            if "Error" in line or "assert" in line.lower() or "Exception" in line:
                error_line = line.strip()
                break
        failed_tests.append({"name": test_name, "body": body[:800], "error": error_line})

    # Detect import errors
    import_errors = [
        line for line in output.splitlines()
        if "ImportError" in line or "ModuleNotFoundError" in line
    ]

    # Determine files to fix
    files_to_fix = set()
    for t in failed_tests:
        for fname in ["protocol", "bootstrap_server", "peer_node", "connection_manager",
                      "message_handler", "api_bridge"]:
            if fname in t["name"] or fname in t["body"]:
                files_to_fix.add(f"backend/{fname}.py")

    report = f"""# Bug Report — P2P Chat Backend
Generated: {datetime.now().isoformat()}

## Summary
- Total: {total} | Passed: {passed} | Failed: {failed} | Errors: {errors}

## Failed Tests
"""
    for t in failed_tests:
        report += f"""
### {t['name']}
- Error: {t['error'] or '(see body)'}
- Body:
```
{t['body'][:600]}
```
"""

    if import_errors:
        report += "\n## Import Errors\n"
        for e in import_errors:
            report += f"- {e}\n"

    if files_to_fix:
        report += "\n## Action Required\n"
        for f in sorted(files_to_fix):
            report += f"- Fix: {f}\n"

    bug_path = os.path.join(root, "bug_report.md")
    with open(bug_path, "w", encoding="utf-8") as f:
        f.write(report)

    print(f"\nbug_report.md written to {bug_path}")
    return 1


if __name__ == "__main__":
    sys.exit(main())
