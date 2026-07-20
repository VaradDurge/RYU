#!/usr/bin/env swift
/**
 * Post keystrokes to a specific macOS process WITHOUT activating it.
 * Usage: post-keys-to-pid.swift <pid> <chord> [<chord>...]
 * Chords:
 *   cmd+shift+v | cmd+v | cmd+return | return
 *   type:<text>     — unicode string (may need shell-quoting)
 *   typeb64:<b64>   — unicode from base64 (preferred for prompts)
 */
import AppKit
import CoreGraphics
import Foundation

guard CommandLine.arguments.count >= 3,
      let pid = Int32(CommandLine.arguments[1]) else {
  fputs("usage: post-keys-to-pid.swift <pid> <chord>...\n", stderr)
  exit(2)
}

let chords = Array(CommandLine.arguments.dropFirst(2))

func postKey(_ keyCode: CGKeyCode, flags: CGEventFlags) {
  let src = CGEventSource(stateID: .combinedSessionState)
  if let down = CGEvent(keyboardEventSource: src, virtualKey: keyCode, keyDown: true) {
    down.flags = flags
    down.postToPid(pid)
  }
  if let up = CGEvent(keyboardEventSource: src, virtualKey: keyCode, keyDown: false) {
    up.flags = flags
    up.postToPid(pid)
  }
}

func postUnicode(_ text: String) {
  guard !text.isEmpty else { return }
  let src = CGEventSource(stateID: .combinedSessionState)
  // Chunk to stay within CGEvent unicode limits
  let scalars = Array(text.utf16)
  let chunkSize = 64
  var i = 0
  while i < scalars.count {
    let end = min(i + chunkSize, scalars.count)
    var slice = Array(scalars[i..<end])
    if let down = CGEvent(keyboardEventSource: src, virtualKey: 0, keyDown: true) {
      down.keyboardSetUnicodeString(stringLength: slice.count, unicodeString: &slice)
      down.postToPid(pid)
    }
    if let up = CGEvent(keyboardEventSource: src, virtualKey: 0, keyDown: false) {
      up.keyboardSetUnicodeString(stringLength: slice.count, unicodeString: &slice)
      up.postToPid(pid)
    }
    i = end
    usleep(8_000)
  }
}

func runChord(_ name: String) {
  let lower = name.lowercased()
  if lower.hasPrefix("typeb64:") {
    let b64 = String(name.dropFirst("typeb64:".count))
    guard let data = Data(base64Encoded: b64),
          let text = String(data: data, encoding: .utf8) else {
      fputs("bad typeb64 payload\n", stderr)
      exit(4)
    }
    postUnicode(text)
    return
  }
  if lower.hasPrefix("type:") {
    postUnicode(String(name.dropFirst("type:".count)))
    return
  }

  switch lower {
  case "cmd+shift+v":
    postKey(9, flags: [.maskCommand, .maskShift])
  case "cmd+v", "paste":
    postKey(9, flags: [.maskCommand])
  case "cmd+return", "cmd+enter":
    postKey(36, flags: [.maskCommand])
  case "return", "enter":
    postKey(36, flags: [])
  default:
    fputs("unknown chord: \(name)\n", stderr)
    exit(3)
  }
}

for (i, chord) in chords.enumerated() {
  runChord(chord)
  if i < chords.count - 1 {
    usleep(120_000)
  }
}

usleep(60_000)
print("ok")
