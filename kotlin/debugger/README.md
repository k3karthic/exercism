## Run Program

```bash
./gradlew run --debug-jvm# Use './gradlew test --debug-jvm' for unit tests
```

Open a new terminal window and attach jdb. Include the path to your source files so you can read your code lines inside the debugger.

```bash
jdb -sourcepath src/main/kotlin -attach 5005
```

## Breakpoint Commands

* By line number: stop at com.package.Class:42
* By method name: stop in com.package.Class.methodName
* By overloaded method: stop in com.package.Class.main([Ljava/lang/String;)V
* Kotlin file-level main: stop in com.package.AppKt.main
* On Exception throw: catch java.lang.NullPointerException
* List breakpoints: breakpoints
* Delete breakpoint: clear com.package.Class:42
* Clear exception trap: uncatch java.lang.NullPointerException [8, 9]

## Execution Control

* Resume execution: cont
* Step into line: step
* Step over line: next
* Step out of method: step up
* Step instruction (bytecode): stepi

## State Inspection

* Show local variables: locals
* Print variable / field: print myVar
* Evaluate expression: print myObj.toString()
* Deep dump object fields: dump myObj
* Move up/down stack frames: up / down (Changes context to view caller variables) [10]

## Context & Information

* Show current source lines: list
* Show current stack trace: where
* Show all thread stacks: where all
* List all active threads: threads
* Switch context to thread: thread 3
* List class methods: methods com.package.Class
* List class fields: fields com.package.Class

## Exit & Help

* List all CLI commands: help
* Exit debugger session: quit (or exit) [11]