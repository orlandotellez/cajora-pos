import { describe, it, afterEach, spyOn, mock } from "bun:test"
import assert from "node:assert/strict"

const sseStub = {
  handleSseConnection: async (_request: unknown, _reply: unknown) => {},
}

spyOn(sseStub, "handleSseConnection")

mock.module("@/config/sse", () => sseStub)

const { eventsController } = await import("../../presentation/events.controller")

describe("events controller", () => {
  afterEach(() => {
    mock.restore()
  })

  it("stream delegates the request and reply to handleSseConnection", async () => {
    const request = { headers: { accept: "text/event-stream" } }
    const reply = { raw: {} }

    await eventsController.stream(request as any, reply as any)

    assert.equal(sseStub.handleSseConnection.mock.calls.length, 1)
    assert.equal(sseStub.handleSseConnection.mock.calls[0][0], request)
    assert.equal(sseStub.handleSseConnection.mock.calls[0][1], reply)
  })
})