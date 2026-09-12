# **Engineering Guide: Bridging Modern C++ Toward Rust-Level Safety**

## **Executive Summary**

While C++ does not enforce memory safety by default through an integrated borrow checker, modern language standards (C++11 through C++23) paired with strict standard library hardening, AST-based policy enforcement, static analysis, and sanitizers can significantly close the gap. This document details the architectural guidelines, tooling configurations, automated enforcement policies, and language mappings required to emulate Rust’s safety guarantees within C++ codebases.

## **1\. Architectural & Language Mapping**

Use modern C++ vocabulary types to eliminate undefined behavior, null pointer exceptions, and unmanaged memory lifetimes.

| Rust Construct | Modern C++ Equivalent | Standard | Safety Objective |
| :---- | :---- | :---- | :---- |
| Option\<T\> | std::optional\<T\> | C++17 | Eliminates sentinel values (-1, nullptr) for missing data. Supports monadic operations (.and\_then(), .transform()) in C++23. |
| Result\<T, E\> | std::expected\<T, E\> | C++23 | Explicit, non-exception-based error propagation with monadic chaining (.and\_then(), .or\_else()). |
| &\[T\] (Slice) | std::span\<T\> | C++20 | Replaces raw pointer \+ size pairs with a single, bounds-checkable view. |
| \&str | std::string\_view | C++17 | Read-only slice referencing contiguous character sequences without heap allocations. |
| enum (Tagged Union) | std::variant\<Ts...\> | C++17 | Type-safe sum types. Eliminates raw C-style union type confusion via std::visit. |
| Box\<T\> | std::unique\_ptr\<T\> | C++11 | Strict single-ownership dynamic allocation. Forbid raw new/delete; use std::make\_unique. |
| Arc\<T\> | std::shared\_ptr\<const T\> | C++11 | Thread-safe reference counting. Keep pointees const to prevent multithreaded mutation races. |
| NonNull\<T\> | gsl::not\_null\<T\*\> | GSL | Enforces at the type system level that a pointer or smart pointer cannot be nullptr. |

## 

## **2\. Dependency Management & Tooling Supply Chain with Conan**

To guarantee consistent enforcement of memory-safety standards across diverse developer workstations and CI runners, dependency management and compiler toolchains must be strictly hermetic. Conan 2.x serves as the primary package and environment orchestrator for acquiring safety-critical dependencies, standard library abstractions (e.g., GSL), static analysis tools, and managing build profiles.

### **Hermetic Tooling & Build Requirements (conanfile.py)**

Static analysis tools such as `clang-tidy`, `ast-grep`, and `cppcheck` are provisioned directly via Conan build requirements. This prevents version drift between local developer machines and CI gates.

`from conan import ConanFile`  
`from conan.tools.cmake import CMake, CMakeToolchain, cmake_layout`

`class SafetyEngineeredProject(ConanFile):`  
    `name = "safety_cpp_project"`  
    `version = "1.0.0"`  
    `settings = "os", "compiler", "build_type", "arch"`  
    `generators = "CMakeDeps", "CMakeToolchain"`

    `def requirements(self):`  
        `# GSL for non-owning non-null bounds and pointers`  
        `self.requires("ms-gsl/4.0.0")`

    `def build_requirements(self):`  
        `# Hermetic static analysis toolchain`  
        `self.tool_requires("llvm-tools/17.0.6")`  
        `self.tool_requires("cmake/3.28.1")`

    `def layout(self):`  
        `cmake_layout(self)`

### **Conan Profiles for Sanitizers and Hardening**

Sanitizer configurations and standard library hardening modes are declared cleanly via Conan profile injection rather than manual flag management in build scripts:

`# profiles/sanitizer-asan`  
`[settings]`  
`os=Linux`  
`arch=x86_64`  
`compiler=clang`  
`compiler.version=17`  
`compiler.libcxx=libc++`  
`build_type=RelWithDebInfo`

`[conf]`  
`tools.build:cxxflags=["-fsanitize=address,undefined", "-fno-omit-frame-pointer", "-D_LIBCPP_HARDENING_MODE=_LIBCPP_HARDENING_MODE_FAST"]`  
`tools.build:sharedlinkflags=["-fsanitize=address,undefined"]`  
`tools.build:exelinkflags=["-fsanitize=address,undefined"]`

## **3\. CMake Build System & Compiler Configuration**

CMake integrates seamlessly with Conan 2.x using the automatically generated `CMakeToolchain` context. Flags passed from Conan profiles drive compiler warnings, hardening macros, and target property configurations.

### **Compiler Warning Baseline**

Enforce strict conformance across all translation units:

`# Recommended CMake compiler flag baseline`  
`target_compile_options(${PROJECT_NAME} PRIVATE`  
    `$<$<CXX_COMPILER_ID:Clang,AppleClang,GNU>:`  
        `-Wall`  
        `-Wextra`  
        `-Wpedantic`  
        `-Wconversion`  
        `-Wshadow`  
        `-Wnon-virtual-dtor`  
        `-Wold-style-cast`  
        `-Wcast-align`  
        `-Wunused`  
        `-Woverloaded-virtual`  
        `-Wuninitialized`  
        `-Werror>`  
`)`

### **Standard Library Hardening Flags**

> * **LLVM Clang (libc++):**  
>   `# Injected via Conan profile or CMake Preset`  
>   `target_compile_definitions(${PROJECT_NAME} PRIVATE`  
>       `$<$<CXX_COMPILER_ID:Clang>:_LIBCPP_HARDENING_MODE=_LIBCPP_HARDENING_MODE_FAST>`  
>   `)`

> * **GCC (libstdc++):**  
>   `# Lightweight production runtime assertions`  
>   `target_compile_definitions(${PROJECT_NAME} PRIVATE`  
>       `$<$<CXX_COMPILER_ID:GNU>:_GLIBCXX_ASSERTIONS>`  
>   `)`

## **4\. Concurrency Safety: Thread Safety Analysis**

Emulate Rust's Mutex\<T\> (where data cannot be accessed without holding the lock) using Clang's Thread Safety Analysis annotations:

`#include <mutex>`

`#define GUARDED_BY(x) __attribute__((guarded_by(x)))`

`class ThreadSafeAccount {`  
`private:`  
    `std::mutex mtx_;`  
    `int balance_ GUARDED_BY(mtx_) = 0;`

`public:`  
    `void deposit(int amount) {`  
        `std::lock_guard<std::mutex> lock(mtx_);`  
        `balance_ += amount; // Validated at compile time`  
    `}`

    `// Attempting to read or write balance_ without holding mtx_`  
    `// produces a compile-time error under Clang with -Wthread-safety.`  
`};`

## **5\. Development Policies & Automated Enforcement**

To ensure safety without relying on code review vigilance, each core development policy is bound directly to automated verification tools distributed via Conan build requirements and hooked into CMake target analysis properties.

### **Policy-to-Tool Matrix**

| Policy Rule | Primary Enforcement Tool | Specific Check / Rule |
| :---- | :---- | :---- |
| **1\. Zero Raw Owning Pointers** | Conan (llvm-tools) / Clang-Tidy & ast-grep | cppcoreguidelines-owning-memory \+ AST pattern ban on new/delete. |
| **2\. Bounds-Safe Passing** | Conan Build Req / Semgrep & Clang-Tidy | Semgrep rule banning (T\*, size\_t) \+ cppcoreguidelines-pro-bounds-pointer-arithmetic. |
| **3\. No Uninitialized Variables** | CMake Targets & Clang-Tidy | Flags \-Wuninitialized, \-Wsometimes-uninitialized, and cppcoreguidelines-init-variables. |
| **4\. Const by Default** | Conan (llvm-tools) / Clang-Tidy | misc-const-correctness flags mutable declarations that could be const. |

### 

### **Static Analysis Configuration (.clang-tidy)**

Place this configuration at the project root to enforce rules 1, 3, and 4 as hard build errors during CMake target compilation:

`---`  
`Checks: >`  
  `-*,`  
  `bugprone-*,`  
  `cppcoreguidelines-*,`  
  `misc-const-correctness,`  
  `misc-use-after-move,`  
  `modernize-*,`  
  `performance-*,`  
  `readability-*`

`WarningsAsErrors: >`  
  `cppcoreguidelines-owning-memory,`  
  `cppcoreguidelines-init-variables,`  
  `cppcoreguidelines-pro-bounds-pointer-arithmetic,`  
  `misc-const-correctness,`  
  `misc-use-after-move,`  
  `bugprone-use-after-move`

`CheckOptions:`  
  `- key: misc-const-correctness.AnalyzeValues`  
    `value: 'true'`  
  `- key: misc-const-correctness.AnalyzeReferences`  
    `value: 'true'`  
  `- key: misc-const-correctness.WarnPointersAsValues`  
    `value: 'true'`  
  `- key: cppcoreguidelines-special-member-functions.AllowMissingMoveOperations`  
    `value: '0'`  
`...`

### **Structural Rule Bans via AST Linters**

#### **Blocking Raw new and delete (sgconfig.yml for ast-grep)**

Enforces Rule 1 at the syntax tree level, failing builds immediately if raw allocations bypass smart pointer factories:

`id: ban-raw-heap-allocation`  
`language: cpp`  
`severity: error`  
`message: "Raw heap allocation/deallocation is prohibited. Use std::make_unique or std::make_shared."`  
`rule:`  
  `any:`  
    `- pattern: new $TYPE($$$ARGS)`  
    `- pattern: new $TYPE[$$$ARGS]`  
    `- pattern: delete $VAR`  
    `- pattern: delete[] $VAR`

#### **Banning Raw Pointer-Size Argument Pairs (Semgrep Rule)**

Enforces Rule 2 by rejecting functions that accept unbounded C-style buffers instead of std::span:

`rules:`  
  `- id: forbid-raw-pointer-with-size`  
    `languages: [cpp]`  
    `severity: error`  
    `message: "Do not pass raw pointer and size pairs. Use std::span<T> instead."`  
    `patterns:`  
      `- pattern: $RET $FUNC(..., $TYPE* $PTR, size_t $LEN, ...)`

## **6\. Dynamic Verification (Conan & CMake CI/CD Strategy)**

Because static analysis cannot guarantee 100% sound lifetime validation for arbitrary pointer graphs, all continuous integration pipelines must execute CMake test suites built with Conan sanitizer profiles.

| Sanitizer | Build Flag | Target Failure Class | Equivalent Rust Safety Layer |
| :---- | :---- | :---- | :---- |
| **AddressSanitizer (ASan)** | \-fsanitize=address | Heap/stack/global buffer overflow, Use-After-Free (UAF), Use-After-Scope | Borrow checker & safe slices |
| **UndefinedBehaviorSanitizer (UBSan)** | \-fsanitize=undefined | Integer overflow, null pointer dereference, misaligned pointers, invalid enums | Safe arithmetic traps & enum invariants |
| **ThreadSanitizer (TSan)** | \-fsanitize=thread | Data races, unprotected shared data access | Send and Sync marker traits |

*Note: ASan and TSan are mutually exclusive and must run in parallel, distinct CI pipeline jobs.*

## **7\. CI/CD Pipeline Orchestration Flow**

Embed verification gates directly into the Conan-CMake development lifecycle:

> 1. **Pre-commit Stage:** Run git-clang-tidy over staged diffs to prevent unformatted or guideline-violating code from being committed.  
> 2. **Fast Linting Gate (AST-Grep / Semgrep):** Run structural scans in CI prior to compilation; runs complete in milliseconds without requiring header resolution.  
> 3. **CMake Analysis Target Binding:** In CMake, bind Clang-Tidy (provisioned via Conan build requirements) directly to compilation targets so violations halt compilation:  
>    `find_program(CLANG_TIDY_EXE NAMES clang-tidy REQUIRED)`  
>    `set_target_properties(${PROJECT_NAME} PROPERTIES`  
>        `CXX_CLANG_TIDY "${CLANG_TIDY_EXE};--warnings-as-errors=*"`  
>    `)`

> 4. **Conan Profile Matrix Execution:** Run unit and integration tests across distinct Conan profiles in parallel CI jobs:  
   * Job A: conan install . \-pr:b=default \-pr:h=profiles/sanitizer-asan && cmake \--build \--preset conan-relwithdebinfo && ctest  
   * Job B: conan install . \-pr:b=default \-pr:h=profiles/sanitizer-tsan && cmake \--build \--preset conan-relwithdebinfo && ctest