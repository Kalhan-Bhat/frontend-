/**
 * Collaborative Whiteboard Component
 * Real-time drawing canvas for teaching
 */

import { useRef, useEffect, useState } from 'react'

function Whiteboard({ socket, channelName, isTeacher }) {
  const canvasRef = useRef(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [color, setColor] = useState('#000000')
  const [brushSize, setBrushSize] = useState(3)
  const [tool, setTool] = useState('pen') // pen, eraser
  
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    
    // Set canvas size
    canvas.width = canvas.offsetWidth
    canvas.height = canvas.offsetHeight
    
    // Set initial context properties
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    // Listen for drawing from others
    if (socket) {
      socket.on('whiteboard:draw', (data) => {
        if (data.channelName === channelName) {
          drawLine(ctx, data.x0, data.y0, data.x1, data.y1, data.color, data.brushSize, data.tool)
        }
      })

      socket.on('whiteboard:clear', (data) => {
        if (data.channelName === channelName) {
          clearCanvas()
        }
      })
    }

    return () => {
      if (socket) {
        socket.off('whiteboard:draw')
        socket.off('whiteboard:clear')
      }
    }
  }, [socket, channelName])

  const drawLine = (ctx, x0, y0, x1, y1, color, brushSize, tool) => {
    ctx.beginPath()
    ctx.moveTo(x0, y0)
    ctx.lineTo(x1, y1)
    ctx.strokeStyle = tool === 'eraser' ? '#ffffff' : color
    ctx.lineWidth = tool === 'eraser' ? brushSize * 3 : brushSize
    ctx.stroke()
    ctx.closePath()
  }

  const startDrawing = (e) => {
    if (!isTeacher) return // Only teacher can draw
    
    setIsDrawing(true)
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    
    // Store last position
    canvas._lastX = x
    canvas._lastY = y
  }

  const draw = (e) => {
    if (!isDrawing || !isTeacher) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    // Draw locally
    drawLine(ctx, canvas._lastX, canvas._lastY, x, y, color, brushSize, tool)

    // Emit to others
    if (socket) {
      socket.emit('whiteboard:draw', {
        channelName,
        x0: canvas._lastX,
        y0: canvas._lastY,
        x1: x,
        y1: y,
        color,
        brushSize,
        tool
      })
    }

    // Update last position
    canvas._lastX = x
    canvas._lastY = y
  }

  const stopDrawing = () => {
    setIsDrawing(false)
  }

  const clearCanvas = () => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
  }

  const handleClear = () => {
    if (!isTeacher) return
    
    clearCanvas()
    
    if (socket) {
      socket.emit('whiteboard:clear', { channelName })
    }
  }

  return (
    <div style={{ background: '#fff', borderRadius: '8px', padding: '1rem', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <h3 style={{ margin: 0, flex: 1 }}>📝 Whiteboard</h3>
        
        {isTeacher && (
          <>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <label style={{ fontSize: '0.875rem' }}>Tool:</label>
              <button
                onClick={() => setTool('pen')}
                style={{
                  padding: '0.5rem 1rem',
                  background: tool === 'pen' ? '#3b82f6' : '#e5e7eb',
                  color: tool === 'pen' ? '#fff' : '#000',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                ✏️ Pen
              </button>
              <button
                onClick={() => setTool('eraser')}
                style={{
                  padding: '0.5rem 1rem',
                  background: tool === 'eraser' ? '#3b82f6' : '#e5e7eb',
                  color: tool === 'eraser' ? '#fff' : '#000',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                🧹 Eraser
              </button>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <label style={{ fontSize: '0.875rem' }}>Color:</label>
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                style={{ width: '40px', height: '40px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <label style={{ fontSize: '0.875rem' }}>Size:</label>
              <input
                type="range"
                min="1"
                max="20"
                value={brushSize}
                onChange={(e) => setBrushSize(Number(e.target.value))}
                style={{ width: '100px' }}
              />
              <span style={{ fontSize: '0.875rem', minWidth: '30px' }}>{brushSize}px</span>
            </div>

            <button
              onClick={handleClear}
              style={{
                padding: '0.5rem 1rem',
                background: '#ef4444',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              🗑️ Clear
            </button>
          </>
        )}
        
        {!isTeacher && (
          <p style={{ margin: 0, fontSize: '0.875rem', color: '#6b7280' }}>
            📖 View only - Teacher can draw
          </p>
        )}
      </div>

      <canvas
        ref={canvasRef}
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
        style={{
          width: '100%',
          height: '400px',
          border: '2px solid #e5e7eb',
          borderRadius: '4px',
          cursor: isTeacher ? (tool === 'pen' ? 'crosshair' : 'cell') : 'default',
          touchAction: 'none'
        }}
      />
    </div>
  )
}

export default Whiteboard
