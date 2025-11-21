/**
 * Collaborative Whiteboard Component
 * Real-time drawing canvas for teaching
 */

import { useRef, useEffect, useState } from 'react'

function Whiteboard({ socket, channelName, isTeacher }) {
  const canvasRef = useRef(null)
  const containerRef = useRef(null)
  const whiteboardRef = useRef(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [color, setColor] = useState('#000000')
  const [brushSize, setBrushSize] = useState(3)
  const [tool, setTool] = useState('pen') // pen, eraser
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [pages, setPages] = useState([null]) // Array of page canvases (null = blank page)
  const [currentPage, setCurrentPage] = useState(0)
  
  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const ctx = canvas.getContext('2d')
    
    // Set canvas size to be responsive (use container width)
    const resizeCanvas = () => {
      const width = container.offsetWidth
      // Larger height for scrollable notebook feel - 2000px for full notebook
      const height = isFullscreen ? Math.max(window.innerHeight - 120, 800) : 2000
      
      // Save current canvas content
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      
      canvas.width = width
      canvas.height = height
      
      // Restore canvas content after resize
      ctx.putImageData(imageData, 0, 0)
      
      // Reset context properties
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
    }
    
    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)

    // Listen for drawing from others
    if (socket) {
      socket.on('whiteboard:draw', (data) => {
        if (data.channelName === channelName) {
          drawLine(ctx, data.x0, data.y0, data.x1, data.y1, data.color, data.brushSize, data.tool)
        }
      })

      socket.on('whiteboard:clear', (data) => {
        if (data.channelName === channelName && data.page === currentPage) {
          clearCanvas()
        }
      })

      socket.on('whiteboard:newPage', (data) => {
        if (data.channelName === channelName) {
          setPages(prev => [...prev, null])
        }
      })

      socket.on('whiteboard:changePage', (data) => {
        if (data.channelName === channelName) {
          goToPage(data.page)
        }
      })
    }

    return () => {
      window.removeEventListener('resize', resizeCanvas)
      if (socket) {
        socket.off('whiteboard:draw')
        socket.off('whiteboard:clear')
        socket.off('whiteboard:newPage')
        socket.off('whiteboard:changePage')
      }
    }
  }, [socket, channelName, isFullscreen, currentPage])

  const drawLine = (ctx, x0, y0, x1, y1, color, brushSize, tool) => {
    ctx.beginPath()
    ctx.moveTo(x0, y0)
    ctx.lineTo(x1, y1)
    ctx.strokeStyle = tool === 'eraser' ? '#ffffff' : color
    ctx.lineWidth = tool === 'eraser' ? brushSize * 3 : brushSize
    ctx.stroke()
    ctx.closePath()
  }

  const getCoordinates = (e) => {
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    
    // Handle both mouse and touch events
    const clientX = e.touches ? e.touches[0].clientX : e.clientX
    const clientY = e.touches ? e.touches[0].clientY : e.clientY
    
    // Calculate relative coordinates accounting for canvas scaling
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    
    const x = (clientX - rect.left) * scaleX
    const y = (clientY - rect.top) * scaleY
    
    return { x, y }
  }

  const startDrawing = (e) => {
    if (!isTeacher) return // Only teacher can draw
    
    e.preventDefault() // Prevent scrolling on touch devices
    setIsDrawing(true)
    
    const canvas = canvasRef.current
    const { x, y } = getCoordinates(e)
    
    // Store last position
    canvas._lastX = x
    canvas._lastY = y
  }

  const draw = (e) => {
    if (!isDrawing || !isTeacher) return

    e.preventDefault() // Prevent scrolling while drawing
    
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const { x, y } = getCoordinates(e)

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
      socket.emit('whiteboard:clear', { channelName, page: currentPage })
    }
  }

  const saveCurrentPage = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    // Save current page as image data
    const imageData = canvas.toDataURL('image/png')
    const newPages = [...pages]
    newPages[currentPage] = imageData
    setPages(newPages)
  }

  const addNewPage = () => {
    if (!isTeacher) return
    
    // Save current page before adding new one
    saveCurrentPage()
    
    // Add new blank page
    setPages([...pages, null])
    setCurrentPage(pages.length)
    
    // Clear canvas for new page
    clearCanvas()
    
    if (socket) {
      socket.emit('whiteboard:newPage', { channelName, pageCount: pages.length + 1 })
    }
  }

  const goToPage = (pageIndex) => {
    // Save current page before switching
    saveCurrentPage()
    
    setCurrentPage(pageIndex)
    
    // Load the selected page
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    clearCanvas()
    
    if (pages[pageIndex]) {
      const img = new Image()
      img.onload = () => {
        ctx.drawImage(img, 0, 0)
      }
      img.src = pages[pageIndex]
    }
    
    if (socket) {
      socket.emit('whiteboard:changePage', { channelName, page: pageIndex })
    }
  }

  const downloadNotes = () => {
    // Save current page first
    saveCurrentPage()
    
    // Create a temporary canvas to combine all pages
    const tempCanvas = document.createElement('canvas')
    const canvas = canvasRef.current
    tempCanvas.width = canvas.width
    tempCanvas.height = canvas.height * pages.length
    const ctx = tempCanvas.getContext('2d')
    
    // Fill with white background
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height)
    
    // Draw all pages
    let loadedPages = 0
    const pagesToLoad = pages.map((pageData, index) => {
      return new Promise((resolve) => {
        if (pageData) {
          const img = new Image()
          img.onload = () => {
            ctx.drawImage(img, 0, canvas.height * index)
            resolve()
          }
          img.src = pageData
        } else if (index === currentPage) {
          // Current page (not yet saved)
          ctx.drawImage(canvas, 0, canvas.height * index)
          resolve()
        } else {
          // Blank page
          resolve()
        }
      })
    })
    
    Promise.all(pagesToLoad).then(() => {
      // Download the combined image
      const link = document.createElement('a')
      link.download = `whiteboard-notes-${channelName}-${Date.now()}.png`
      link.href = tempCanvas.toDataURL('image/png')
      link.click()
    })
  }

  const toggleFullscreen = async () => {
    const element = whiteboardRef.current
    
    if (!isFullscreen) {
      // Enter fullscreen
      try {
        if (element.requestFullscreen) {
          await element.requestFullscreen()
        } else if (element.webkitRequestFullscreen) {
          await element.webkitRequestFullscreen()
        } else if (element.msRequestFullscreen) {
          await element.msRequestFullscreen()
        }
      } catch (err) {
        console.error('❌ Fullscreen error:', err)
        // Fallback: don't change state if fullscreen fails
      }
    } else {
      // Exit fullscreen
      try {
        if (document.exitFullscreen) {
          await document.exitFullscreen()
        } else if (document.webkitExitFullscreen) {
          await document.webkitExitFullscreen()
        } else if (document.msExitFullscreen) {
          await document.msExitFullscreen()
        }
      } catch (err) {
        console.error('❌ Exit fullscreen error:', err)
      }
    }
  }

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isCurrentlyFullscreen = !!(
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.msFullscreenElement
      )
      setIsFullscreen(isCurrentlyFullscreen)
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange)
    document.addEventListener('msfullscreenchange', handleFullscreenChange)

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange)
      document.removeEventListener('msfullscreenchange', handleFullscreenChange)
    }
  }, [])

  return (
    <div 
      ref={whiteboardRef}
      style={{ 
        background: isFullscreen ? '#f9fafb' : '#fff', 
        borderRadius: isFullscreen ? '0' : '8px', 
        padding: '1rem', 
        boxShadow: isFullscreen ? 'none' : '0 2px 8px rgba(0,0,0,0.1)', 
        width: '100%', 
        height: isFullscreen ? '100vh' : 'auto',
        overflow: isFullscreen ? 'hidden' : 'visible',
        position: isFullscreen ? 'fixed' : 'relative',
        top: isFullscreen ? '0' : 'auto',
        left: isFullscreen ? '0' : 'auto',
        zIndex: isFullscreen ? '9999' : 'auto'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <h3 style={{ margin: 0, flex: '1 1 auto', marginBottom: '0.5rem' }}>
          📝 Whiteboard - Page {currentPage + 1}/{pages.length} {isFullscreen && '(Fullscreen)'}
        </h3>
        
        <button
          onClick={downloadNotes}
          style={{
            padding: '0.5rem 0.75rem',
            background: '#10b981',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '0.875rem'
          }}
        >
          📥 Download Notes
        </button>
        
        <button
          onClick={toggleFullscreen}
          style={{
            padding: '0.5rem 0.75rem',
            background: '#6b7280',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '0.875rem'
          }}
        >
          {isFullscreen ? '🔙 Exit' : '⛶ Fullscreen'}
        </button>
        
        {isTeacher && (
          <>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                onClick={() => setTool('pen')}
                style={{
                  padding: '0.5rem 0.75rem',
                  background: tool === 'pen' ? '#3b82f6' : '#e5e7eb',
                  color: tool === 'pen' ? '#fff' : '#000',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '0.875rem'
                }}
              >
                ✏️ Pen
              </button>
              <button
                onClick={() => setTool('eraser')}
                style={{
                  padding: '0.5rem 0.75rem',
                  background: tool === 'eraser' ? '#3b82f6' : '#e5e7eb',
                  color: tool === 'eraser' ? '#fff' : '#000',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '0.875rem'
                }}
              >
                🧹 Eraser
              </button>
              
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                title="Color"
                style={{ width: '40px', height: '40px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
              />
              
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input
                  type="range"
                  min="1"
                  max="20"
                  value={brushSize}
                  onChange={(e) => setBrushSize(Number(e.target.value))}
                  style={{ width: '80px' }}
                />
                <span style={{ fontSize: '0.75rem', minWidth: '35px' }}>{brushSize}px</span>
              </div>

              <button
                onClick={handleClear}
                style={{
                  padding: '0.5rem 0.75rem',
                  background: '#ef4444',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '0.875rem'
                }}
              >
                🗑️ Clear Page
              </button>

              <button
                onClick={addNewPage}
                style={{
                  padding: '0.5rem 0.75rem',
                  background: '#8b5cf6',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '0.875rem'
                }}
              >
                ➕ New Page
              </button>
            </div>
          </>
        )}
        
        {!isTeacher && (
          <p style={{ margin: 0, fontSize: '0.875rem', color: '#6b7280', flex: '1 1 100%' }}>
            📖 View only - Teacher can draw
          </p>
        )}
      </div>

      {/* Page Navigation */}
      {pages.length > 1 && (
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => goToPage(Math.max(0, currentPage - 1))}
            disabled={currentPage === 0}
            style={{
              padding: '0.5rem 0.75rem',
              background: currentPage === 0 ? '#d1d5db' : '#3b82f6',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: currentPage === 0 ? 'not-allowed' : 'pointer',
              fontSize: '0.875rem'
            }}
          >
            ◀ Previous
          </button>
          
          {pages.map((_, index) => (
            <button
              key={index}
              onClick={() => goToPage(index)}
              style={{
                padding: '0.5rem 0.75rem',
                background: index === currentPage ? '#3b82f6' : '#e5e7eb',
                color: index === currentPage ? '#fff' : '#000',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.875rem',
                minWidth: '40px'
              }}
            >
              {index + 1}
            </button>
          ))}
          
          <button
            onClick={() => goToPage(Math.min(pages.length - 1, currentPage + 1))}
            disabled={currentPage === pages.length - 1}
            style={{
              padding: '0.5rem 0.75rem',
              background: currentPage === pages.length - 1 ? '#d1d5db' : '#3b82f6',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: currentPage === pages.length - 1 ? 'not-allowed' : 'pointer',
              fontSize: '0.875rem'
            }}
          >
            Next ▶
          </button>
        </div>
      )}

      <div 
        ref={containerRef}
        style={{ 
          width: '100%',
          height: isFullscreen ? 'calc(100vh - 100px)' : '600px',
          overflow: 'auto',
          WebkitOverflowScrolling: 'touch', // Smooth scrolling on iOS
          border: '2px solid #e5e7eb',
          borderRadius: '4px',
          background: '#ffffff',
          position: 'relative'
        }}
      >
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          onTouchCancel={stopDrawing}
          style={{
            display: 'block',
            width: '100%',
            height: 'auto',
            cursor: isTeacher ? (tool === 'pen' ? 'crosshair' : 'cell') : 'default',
            touchAction: 'none', // Prevent scrolling while drawing
            background: '#ffffff',
            minHeight: '2000px' // Tall notebook-like canvas
          }}
        />
      </div>
      
      {/* Scrollbar hint */}
      {!isFullscreen && (
        <p style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#6b7280', textAlign: 'center' }}>
          💡 Scroll down for more space • Click Fullscreen for better view
        </p>
      )}
    </div>
  )
}

export default Whiteboard
