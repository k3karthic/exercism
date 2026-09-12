#!/usr/bin/env bash

set -euo pipefail

target="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/cpp_style_guide.md}"

if [[ ! -f "$target" ]]; then
  printf 'error: file not found: %s\n' "$target" >&2
  exit 1
fi

tmp="$(mktemp "${target##*/}.XXXXXX")"
trap 'rm -f "$tmp"' EXIT

awk '
function strip_wrapping_code(line,  text) {
  text = line
  if (match(text, /^([[:space:]]*)`([^`]*)`[[:space:]]*$/, m)) {
    return m[1] m[2]
  }

  return text
}

function normalize_heading(line,  m, hashes, title) {
  if (line ~ /^(#{1,6})[[:space:]]+\*\*.*\*\*([[:space:]]+\{#.*\})?[[:space:]]*$/) {
    match(line, /^(#{1,6})[[:space:]]+\*\*(.*)\*\*([[:space:]]+\{#.*\})?[[:space:]]*$/, m)
    return m[1] " " m[2] m[3]
  }

  if (line ~ /^#{1,6}[[:space:]]*$/) {
    return ""
  }

  return line
}

function emit_buffer(    i, content, first, last) {
  if (buffer_count == 0) {
    return
  }

  if (buffer_has_wrapped) {
    first = 1
    last = buffer_count

    while (first <= last && buffer_kind[first] == "blank") {
      first++
    }

    while (last >= first && buffer_kind[last] == "blank") {
      last--
    }

    print "```"
    for (i = first; i <= last; i++) {
      if (buffer_kind[i] == "blank") {
        print ""
      } else {
        print strip_wrapping_code(buffer_line[i])
      }
    }
    print "```"
  } else {
    for (i = 1; i <= buffer_count; i++) {
      print buffer_line[i]
    }
  }

  buffer_count = 0
  buffer_has_wrapped = 0
}

{
  line = $0
  sub(/\r$/, "", line)
  sub(/[[:space:]]+$/, "", line)

  if (!saw_summary) {
    if (line ~ /^# [^#]/) {
      print normalize_heading(line)
      print ""
      saw_title = 1
      next
    }

    if (line ~ /^##[[:space:]]+Summary([[:space:]]+\{#summary\})?[[:space:]]*$/) {
      emit_buffer()
      print normalize_heading(line)
      saw_summary = 1
      next
    }

    if (line ~ /^\[[^]]+\]\(#.*\)$/ || line ~ /^[[:space:]]*$/ || line ~ /^[[:space:]]*&nbsp;[[:space:]]*$/ || line ~ /^[[:space:]]*\*[[:space:]]*&nbsp;[[:space:]]*$/) {
      next
    }
  }

  if (line ~ /^[[:space:]]*&nbsp;[[:space:]]*$/ || line ~ /^[[:space:]]*\*[[:space:]]*&nbsp;[[:space:]]*$/) {
    line = ""
  }

  if (line ~ /^[[:space:]]*`[^`]*`[[:space:]]*$/) {
    buffer_count++
    buffer_kind[buffer_count] = "wrapped"
    buffer_line[buffer_count] = line
    buffer_has_wrapped = 1
    next
  }

  if (line ~ /^[[:space:]]*$/) {
    buffer_count++
    buffer_kind[buffer_count] = "blank"
    buffer_line[buffer_count] = ""
    next
  }

  emit_buffer()
  line = normalize_heading(line)
  if (line != "") {
    print line
  } else {
    print ""
  }
}

END {
  emit_buffer()
}
' "$target" | awk '
function is_heading(line) {
  return line ~ /^#{1,6}[[:space:]]+[^[:space:]]/
}

function is_fence(line) {
  return line ~ /^```/
}

function is_table_row(line) {
  return line ~ /^[[:space:]]*\|.*\|[[:space:]]*$/
}

{
  line = $0

  if (is_fence(line)) {
    if (!in_code && !prev_blank) {
      print ""
    }
    print line
    in_code = !in_code
    prev_blank = 0
    after_heading = 0
    in_table = 0
    next
  }

  if (in_code) {
    print line
    next
  }

  if (line ~ /^[[:space:]]*$/) {
    if (!prev_blank) {
      print ""
    }
    prev_blank = 1
    after_heading = 0
    in_table = 0
    next
  }

  if (is_table_row(line)) {
    if (!in_table && !prev_blank) {
      print ""
    }
    print line
    in_table = 1
    prev_blank = 0
    after_heading = 0
    next
  }

  if (in_table) {
    in_table = 0
    if (!prev_blank) {
      print ""
    }
  }

  if (is_heading(line)) {
    if (!prev_blank) {
      print ""
    }
    print line
    prev_blank = 0
    after_heading = 1
    in_table = 0
    next
  }

  if (after_heading && !prev_blank) {
    print ""
  }

  print line
  prev_blank = 0
  after_heading = 0
}
' > "$tmp"

mv "$tmp" "$target"
trap - EXIT
