Documentation: [Node.js Inspector](https://nodejs.org/api/debugger.html)

## Run Program

```bash
npx node --import tsx inspect debugger/debugger_test.ts
```

## Quick Reference

c - continue, stop at next breakpoint
n - continue execution until next line in the current function
s - execute current line, stop at the first possible occasion (either function that is being called or next line in the current function)

list(n) - list source code

watch(expr): Add expression to watch list
unwatch(expr): Remove expression from watch list
unwatch(index): Remove expression at specific index from watch list
watchers: List all watchers and their values (automatically listed on each breakpoint)

repl - start interactive repl

exec/p - execute the one-line statement in the context of the current stack frame

restart
Ctrl+d - exit

setBreakpoint(), sb(): Set breakpoint on current line
setBreakpoint(line), sb(line): Set breakpoint on specific line
setBreakpoint('fn()'), sb(...): Set breakpoint on a first statement in function's body
setBreakpoint('script.js', 1), sb(...): Set breakpoint on first line of script.js
setBreakpoint('script.js', 1, 'num < 4'), sb(...): Set conditional breakpoint on first line of script.js that only breaks when num < 4 evaluates to true
clearBreakpoint('script.js', 1), cb(...): Clear breakpoint in script.js on line 1
