// refactor-fragile: the assertions below read source files as text, so they fail on
// renames, moves and reformatting as readily as on real behaviour changes. Before
// adding one, read tests/README.md — assert the contract, not the characters.
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, it } from "node:test"

const read = path => readFileSync(join(process.cwd(), path), "utf8")

describe("Editor video preview contract", () => {
  it("autoplays Meta video previews when a video id is available", () => {
    const editor = read("components/ads-manager/UnifiedWorkspaceEditor.tsx")

    assert.match(editor, /videoSrc = videoId/)
    assert.match(editor, /<video[\s\S]*autoPlay[\s\S]*muted[\s\S]*loop[\s\S]*playsInline/)
    assert.match(editor, /\/api\/insights\/video-proxy\?videoId=/)
  })
})
