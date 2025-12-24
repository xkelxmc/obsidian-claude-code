#!/usr/bin/env python3
"""
Minimal PTY wrapper for Obsidian plugin
Based on obsidian-terminal but simplified for Claude Code use case
"""
import os
import pty
import sys
import select
from struct import pack
from fcntl import ioctl
from termios import TIOCSWINSZ

def main():
    """Fork PTY and execute shell"""
    # Fork a new PTY
    pid, master_fd = pty.fork()

    if pid == 0:  # Child process
        # Execute the shell as login shell
        # This loads ~/.zprofile, ~/.zshrc properly
        os.execvp(sys.argv[1], sys.argv[1:])

    # Parent process - relay data between PTY and stdio
    stdin_fd = sys.stdin.fileno()
    stdout_fd = sys.stdout.fileno()
    cmdio_fd = 3  # Extra channel for resize commands

    try:
        while True:
            # Wait for data from any source
            readable, _, _ = select.select([master_fd, stdin_fd, cmdio_fd], [], [])

            for fd in readable:
                if fd == master_fd:
                    # PTY -> stdout
                    try:
                        data = os.read(master_fd, 1024)
                        if not data:
                            return
                        os.write(stdout_fd, data)
                    except OSError:
                        return

                elif fd == stdin_fd:
                    # stdin -> PTY
                    data = os.read(stdin_fd, 1024)
                    if not data:
                        return
                    os.write(master_fd, data)

                elif fd == cmdio_fd:
                    # Resize commands (format: "COLSxROWS\n")
                    data = os.read(cmdio_fd, 1024)
                    if not data:
                        continue
                    for line in data.decode('utf-8').strip().split('\n'):
                        if 'x' in line:
                            cols, rows = line.split('x')
                            # IMPORTANT: TIOCSWINSZ expects (rows, cols, xpixel, ypixel) order!
                            ioctl(master_fd, TIOCSWINSZ, pack('HHHH', int(rows), int(cols), 0, 0))

    finally:
        # Wait for child process
        os.waitpid(pid, 0)

if __name__ == "__main__":
    main()
