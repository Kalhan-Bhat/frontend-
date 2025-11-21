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
    
    // Dynamically import jsPDF
    const { jsPDF } = await import('jspdf')
    
    // Create PDF
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    })
    
    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    const margin = 15
    const contentWidth = pageWidth - (2 * margin)
    
    // Add title page
    pdf.setFontSize(24)
    pdf.setTextColor(37, 99, 235) // Blue color
    pdf.text('Whiteboard Notes', pageWidth / 2, 40, { align: 'center' })
    
    pdf.setFontSize(14)
    pdf.setTextColor(75, 85, 99) // Gray color
    pdf.text(`Class: ${channelName}`, pageWidth / 2, 55, { align: 'center' })
    pdf.text(`Date: ${new Date().toLocaleDateString()}`, pageWidth / 2, 65, { align: 'center' })
    pdf.text(`Time: ${new Date().toLocaleTimeString()}`, pageWidth / 2, 75, { align: 'center' })
    pdf.text(`Total Pages: ${updatedPages.length}`, pageWidth / 2, 85, { align: 'center' })
    
    // Add divider line
    pdf.setDrawColor(229, 231, 235)
    pdf.setLineWidth(0.5)
    pdf.line(margin, 100, pageWidth - margin, 100)
    
    // Add pages
    for (let i = 0; i < updatedPages.length; i++) {
      const pageData = updatedPages[i]
      
      // Add new page for each whiteboard page (except first one which is title page)
      pdf.addPage()
      
      // Page header
      pdf.setFontSize(12)
      pdf.setTextColor(107, 114, 128)
      pdf.text(`Page ${i + 1} of ${updatedPages.length}`, pageWidth / 2, margin, { align: 'center' })
      
      if (pageData) {
        // Calculate dimensions to fit image in page while maintaining aspect ratio
        const imgAspectRatio = canvas.width / canvas.height
        const maxContentHeight = pageHeight - (3 * margin)
        
        let imgWidth = contentWidth
        let imgHeight = imgWidth / imgAspectRatio
        
        // If height exceeds page, scale down
        if (imgHeight > maxContentHeight) {
          imgHeight = maxContentHeight
          imgWidth = imgHeight * imgAspectRatio
        }
        
        const xPos = (pageWidth - imgWidth) / 2
        const yPos = margin + 10
        
        // Add image to PDF
        pdf.addImage(pageData, 'PNG', xPos, yPos, imgWidth, imgHeight, `page-${i}`, 'FAST')
      } else {
        // Empty page indicator
        pdf.setFontSize(14)
        pdf.setTextColor(156, 163, 175)
        pdf.text('(Blank Page)', pageWidth / 2, pageHeight / 2, { align: 'center' })
      }
      
      // Page footer
      pdf.setFontSize(10)
      pdf.setTextColor(156, 163, 175)
      pdf.text(`Generated on ${new Date().toLocaleString()}`, pageWidth / 2, pageHeight - 10, { align: 'center' })
    }
    
    // Download PDF
    const fileName = `${channelName}-notes-${new Date().toISOString().split('T')[0]}.pdf`
    pdf.save(fileName)
    
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
