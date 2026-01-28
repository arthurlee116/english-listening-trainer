import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import TcpLabPage from '@/app/tcp-concept-lab/page'

const sendTcpMessage = vi.fn()

vi.mock('@/app/tcp-concept-lab/action', () => ({
  sendTcpMessage: (...args: unknown[]) => sendTcpMessage(...args)
}))

describe('TcpLabPage', () => {
  beforeEach(() => {
    vi.useRealTimers()
    vi.useFakeTimers()
    sendTcpMessage.mockResolvedValue({
      success: true,
      logs: ['[Server] OK']
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders page and runs a demo flow', async () => {
    render(<TcpLabPage />)

    expect(screen.getByText('TCP 协议详细交互图解')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '开始演示' }))
    await act(async () => {
      await vi.runAllTimersAsync()
    })

    expect(sendTcpMessage).toHaveBeenCalled()
    expect(screen.getByText('[Server] OK')).toBeInTheDocument()
  }, 10000)
})
