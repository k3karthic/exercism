Documentation: [PDB](https://docs.python.org/3/library/pdb.html)

## Run Program

```bash
uv run python debugger/debugger_test.py
```

## Quick Reference

c - continue, stop at next breakpoint
n - continue execution until next line in the current function
s - execute current line, stop at the first possible occasion (either function that is being called or next line in the current function)
r - continue till current function returns

l - list source code

a - args of current function
p - evaluate expression
pp - evaluate and pretty-print expression

display - add expression to watch and print when value changes
undisplay - stop watch

interact - start interactive repl

! - execute the one-line statement in the context of the current stack frame

restart
q - quit

b(reak) [([filename:]lineno | function) [, condition]]

    With a lineno argument, set a break at line lineno in the current file. The line number may be prefixed with a filename and a colon, to specify a breakpoint in another file (possibly one that hasn’t been loaded yet). The file is searched on sys.path. Acceptable forms of filename are /abspath/to/file.py, relpath/file.py, module and package.module.
    
    With a function argument, set a break at the first executable statement within that function. function can be any expression that evaluates to a function in the current namespace.
    
    If a second argument is present, it is an expression which must evaluate to true before the breakpoint is honored.
    
    Without argument, list all breaks, including for each breakpoint, the number of times that breakpoint has been hit, the current ignore count, and the associated condition if any.
    
    Each breakpoint is assigned a number to which all the other breakpoint commands refer.

tbreak [([filename:]lineno | function) [, condition]]
Temporary breakpoint, which is removed automatically when it is first hit. The arguments are the same as for break.

cl(ear) [filename:lineno | bpnumber ...]
With a filename:lineno argument, clear all the breakpoints at this line. With a space separated list of breakpoint numbers, clear those breakpoints. Without argument, clear all breaks (but first ask confirmation).

disable bpnumber [bpnumber ...]
Disable the breakpoints given as a space separated list of breakpoint numbers. Disabling a breakpoint means it cannot cause the program to stop execution, but unlike clearing a breakpoint, it remains in the list of breakpoints and can be (re-)enabled.

enable bpnumber [bpnumber ...]
Enable the breakpoints specified.

ignore bpnumber [count]
Set the ignore count for the given breakpoint number. If count is omitted, the ignore count is set to 0. A breakpoint becomes active when the ignore count is zero. When non-zero, the count is decremented each time the breakpoint is reached and the breakpoint is not disabled and any associated condition evaluates to true.

condition bpnumber [condition]
Set a new condition for the breakpoint, an expression which must evaluate to true before the breakpoint is honored. If condition is absent, any existing condition is removed; i.e., the breakpoint is made unconditional.

? - mini help

```text
(Pdb) ?

Documented commands (type help <topic>):
========================================
EOF    cl         disable     ignore    n        return  u          where
a      clear      display     interact  next     retval  unalias
alias  commands   down        j         p        run     undisplay
args   condition  enable      jump      pp       rv      unt
b      cont       exceptions  l         q        s       until
break  continue   exit        list      quit     source  up
bt     d          h           ll        r        step    w
c      debug      help        longlist  restart  tbreak  whatis

Miscellaneous help topics:
==========================
exec  pdb

(Pdb)
```