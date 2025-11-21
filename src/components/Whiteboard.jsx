/**
 * Collaborative Whiteboard Component
 * Real-time drawing canvas for teaching
 */

import { useRef, useEffect, useState } from 'react'
import jsPDF from 'jspdf'

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
      // Dynamic height: fullscreen uses available viewport, normal uses scrollable 2000px
      const height = isFullscreen 
        ? Math.max(window.innerHeight - 140, 600)  // Fit to screen in fullscreen
        : 2000  // Scrollable notebook height in normal mode
      
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

  const downloadNotes = async () => {
    // Save current page first
    saveCurrentPage()
    
    // Get updated pages after saving
    const canvas = canvasRef.current
    const updatedPages = [...pages]
    updatedPages[currentPage] = canvas.toDataURL('image/png')
    
    // Create PDF
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    })
    
    // Add header/info page
    const now = new Date()
    const dateStr = now.toLocaleDateString()
    const timeStr = now.toLocaleTimeString()
    
    pdf.setFontSize(20)
    pdf.setFont('helvetica', 'bold')
    pdf.text('Whiteboard Notes', 105, 30, { align: 'center' })
    
    pdf.setFontSize(12)
    pdf.setFont('helvetica', 'normal')
    pdf.text(`Class: ${channelName}`, 20, 50)
    pdf.text(`Date: ${dateStr}`, 20, 60)
    pdf.text(`Time: ${timeStr}`, 20, 70)
    pdf.text(`Total Pages: ${updatedPages.length}`, 20, 80)
    
    pdf.setFontSize(10)
    pdf.setTextColor(100)
    pdf.text('Generated by Student Engagement Portal', 105, 280, { align: 'center' })
    
    // Add each whiteboard page
    for (let i = 0; i < updatedPages.length; i++) {
      const pageData = updatedPages[i]
      
      // Add new page for each whiteboard page
      pdf.addPage()
      
      // Add page number header
      pdf.setFontSize(10)
      pdf.setTextColor(0)
      pdf.text(`Page ${i + 1} of ${updatedPages.length}`, 105, 10, { align: 'center' })
      
      if (pageData) {
        // Calculate dimensions to fit A4 (210mm x 297mm with margins)
        const pageWidth = 190 // Leave 10mm margin on each side
        const pageHeight = 270 // Leave space for header and footer
        
        // Add image to PDF
        pdf.addImage(pageData, 'PNG', 10, 15, pageWidth, pageHeight, undefined, 'FAST')
      } else {
        // Empty page
        pdf.setFontSize(12)
        pdf.setTextColor(150)
        pdf.text('(Blank Page)', 105, 150, { align: 'center' })
      }
    }
    
    // Download PDF
    pdf.save(`${channelName}-whiteboard-notes-${dateStr.replace(/\//g, '-')}.pdf`)
    
    alert(`✅ Downloaded PDF with ${updatedPages.length} page(s)!`)
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
        } else if (element.mozRequestFullScreen) {
          await element.mozRequestFullScreen()
        } else if (element.msRequestFullscreen) {
          await element.msRequestFullscreen()
        } else {
          // Fallback for mobile: use CSS-based fullscreen
          console.log('📱 Using CSS fullscreen fallback for mobile')
          element.style.position = 'fixed'
          element.style.top = '0'
          element.style.left = '0'
          element.style.width = '100vw'
          element.style.height = '100vh'
          element.style.zIndex = '9999'
          element.style.background = '#f9fafb'
          setIsFullscreen(true)
          return
        }
      } catch (err) {
        console.error('❌ Fullscreen error:', err)
        // Fallback for mobile
        element.style.position = 'fixed'
        element.style.top = '0'
        element.style.left = '0'
        element.style.width = '100vw'
        element.style.height = '100vh'
        element.style.zIndex = '9999'
        element.style.background = '#f9fafb'
        setIsFullscreen(true)
      }
    } else {
      // Exit fullscreen
      try {
        if (document.exitFullscreen) {
          await document.exitFullscreen()
        } else if (document.webkitExitFullscreen) {
          await document.webkitExitFullscreen()
        } else if (document.mozCancelFullScreen) {
          await document.mozCancelFullScreen()
        } else if (document.msExitFullscreen) {
          await document.msExitFullscreen()
        } else {
          // Fallback: remove CSS fullscreen
          element.style.position = ''
          element.style.top = ''
          element.style.left = ''
          element.style.width = ''
          element.style.height = ''
          element.style.zIndex = ''
          element.style.background = ''
          setIsFullscreen(false)
        }
      } catch (err) {
        console.error('❌ Exit fullscreen error:', err)
        // Fallback: remove CSS fullscreen
        element.style.position = ''
        element.style.top = ''
        element.style.left = ''
        element.style.width = ''
        element.style.height = ''
        element.style.zIndex = ''
        element.style.background = ''
        setIsFullscreen(false)
      }
    }
  }

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isCurrentlyFullscreen = !!(
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.mozFullScreenElement ||
        document.msFullscreenElement
      )
      setIsFullscreen(isCurrentlyFullscreen)
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange)
    document.addEventListener('mozfullscreenchange', handleFullscreenChange)
    document.addEventListener('msfullscreenchange', handleFullscreenChange)

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange)
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange)
      document.removeEventListener('msfullscreenchange', handleFullscreenChange)
    }
  }, [])

  return (
    <div 
      ref={whiteboardRef}
      style={{ 
        background: isFullscreen ? '#f9fafb' : '#fff', 
        borderRadius: isFullscreen ? '0' : '8px', 
        padding: isFullscreen ? '0.5rem' : '1rem', 
        boxShadow: isFullscreen ? 'none' : '0 2px 8px rgba(0,0,0,0.1)', 
        width: isFullscreen ? '100vw' : '100%', 
        height: isFullscreen ? '100vh' : 'auto',
        overflow: isFullscreen ? 'hidden' : 'visible',
        position: isFullscreen ? 'fixed' : 'relative',
        top: isFullscreen ? '0' : 'auto',
        left: isFullscreen ? '0' : 'auto',
        zIndex: isFullscreen ? '9999' : 'auto',
        maxWidth: isFullscreen ? '100vw' : 'none'
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
          height: isFullscreen ? 'calc(100vh - 140px)' : '600px',
          overflow: 'auto',
          WebkitOverflowScrolling: 'touch', // Smooth scrolling on iOS
          border: isFullscreen ? '1px solid #d1d5db' : '2px solid #e5e7eb',
          borderRadius: '4px',
          background: '#ffffff',
          position: 'relative',
          touchAction: 'pan-y' // Allow vertical scrolling on touch devices
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
            height: isFullscreen ? '100%' : 'auto',
            cursor: isTeacher ? (tool === 'pen' ? 'crosshair' : 'cell') : 'default',
            touchAction: isTeacher ? 'none' : 'pan-y', // Allow scrolling for students, prevent for teacher when drawing
            background: '#ffffff',
            minHeight: isFullscreen ? '100%' : '2000px'
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
