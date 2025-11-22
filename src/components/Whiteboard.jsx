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
  const [lastDrawTime, setLastDrawTime] = useState(0)
  
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
      
      // Only resize if dimensions actually changed to avoid unnecessary redraws
      if (canvas.width === width && canvas.height === height) {
        return
      }
      
      // Save current canvas content as image data URL
      let imageDataUrl = null
      if (canvas.width > 0 && canvas.height > 0) {
        try {
          imageDataUrl = canvas.toDataURL('image/png')
        } catch (err) {
          console.log('📷 Canvas content save skipped:', err.message)
        }
      }
      
      // Update canvas dimensions
      canvas.width = width
      canvas.height = height
      
      // Reset context properties
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      
      // Restore canvas content from image if we had content
      if (imageDataUrl && imageDataUrl !== 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==') {
        const img = new Image()
        img.onload = () => {
          ctx.drawImage(img, 0, 0)
          console.log('✅ Canvas content restored after resize')
        }
        img.onerror = () => {
          console.log('❌ Failed to restore canvas content after resize')
        }
        img.src = imageDataUrl
      }
    }
    
    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)

    // Listen for drawing from others
    if (socket) {
      socket.on('whiteboard:draw', (data) => {
        if (data.channelName === channelName) {
          console.log('✏️ Received draw on current page:', currentPage)
          drawLine(ctx, data.x0, data.y0, data.x1, data.y1, data.color, data.brushSize, data.tool)
        }
      })

      socket.on('whiteboard:clear', (data) => {
        if (data.channelName === channelName && data.page === currentPage) {
          clearCanvas()
        }
      })

      socket.on('whiteboard:newPage', (data) => {
        console.log('➕ Received new page event:', data)
        if (data.channelName === channelName) {
          // Update pages array if provided
          if (data.pagesData) {
            console.log('📚 Updating pages from teacher, total pages:', data.pagesData.length)
            setPages(data.pagesData)
          } else {
            // Fallback: just add a blank page
            setPages(prev => {
              const newPages = [...prev, null]
              console.log('📚 Pages updated, total pages:', newPages.length)
              return newPages
            })
          }
          const newPageIndex = data.pageIndex || pages.length
          setCurrentPage(newPageIndex)
          console.log('🔄 Switched to new page:', newPageIndex)
          
          // Clear canvas for new page
          const ctx = canvas.getContext('2d')
          ctx.clearRect(0, 0, canvas.width, canvas.height)
          console.log('🧹 Canvas cleared for new page')
        }
      })

      socket.on('whiteboard:changePage', (data) => {
        console.log('📄 Received page change:', data, 'Current page:', currentPage, 'isTeacher:', isTeacher)
        if (data.channelName === channelName) {
          const pageIndex = data.page
          console.log('✅ Changing to page:', pageIndex)
          
          // Update pages array if provided (from teacher)
          let pagesToUse = pages
          if (data.pagesData) {
            console.log('📚 Updating pages array from teacher, length:', data.pagesData.length)
            setPages(data.pagesData)
            pagesToUse = data.pagesData
          }
          
          // Switch to the new page immediately
          setCurrentPage(pageIndex)
          console.log('🔄 Switched to page:', pageIndex)
          
          // Clear and load the new page with improved timing
          const ctx = canvas.getContext('2d')
          ctx.clearRect(0, 0, canvas.width, canvas.height)
          console.log('🧹 Canvas cleared for page:', pageIndex)
          
          // Load page content if it exists
          if (pagesToUse[pageIndex]) {
            console.log('📥 Loading page content for page:', pageIndex)
            const img = new Image()
            img.onload = () => {
              // Use requestAnimationFrame for smooth rendering
              requestAnimationFrame(() => {
                ctx.drawImage(img, 0, 0)
                console.log('✅ Page content loaded for page:', pageIndex)
              })
            }
            img.onerror = () => {
              console.error('❌ Failed to load page:', pageIndex)
            }
            img.src = pagesToUse[pageIndex]
          } else {
            console.log('📝 Page', pageIndex, 'is blank')
          }
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

  const [lastDrawTime, setLastDrawTime] = useState(0)
  const DRAW_THROTTLE = 16 // ~60fps limit

  const draw = (e) => {
    if (!isDrawing || !isTeacher) return

    e.preventDefault() // Prevent scrolling while drawing
    
    const now = Date.now()
    if (now - lastDrawTime < DRAW_THROTTLE) {
      return // Throttle drawing for performance
    }
    setLastDrawTime(now)
    
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const { x, y } = getCoordinates(e)

    // Draw locally
    drawLine(ctx, canvas._lastX, canvas._lastY, x, y, color, brushSize, tool)

    // Emit to others with throttling
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
    return imageData // Return the saved data
  }

  const addNewPage = () => {
    if (!isTeacher) return
    
    const canvas = canvasRef.current
    if (!canvas) return
    
    // Save current page data immediately
    const currentPageData = canvas.toDataURL('image/png')
    const newPages = [...pages]
    newPages[currentPage] = currentPageData
    
    // Add new blank page
    newPages.push(null)
    setPages(newPages)
    
    // Switch to new page
    const newPageIndex = newPages.length - 1
    setCurrentPage(newPageIndex)
    
    // Clear canvas for new page
    clearCanvas()
    
    if (socket) {
      console.log('📡 Teacher emitting new page:', newPageIndex, 'total pages:', newPages.length)
      socket.emit('whiteboard:newPage', { 
        channelName, 
        pageCount: newPages.length,
        pageIndex: newPageIndex,
        pagesData: newPages // Send all pages to students
      })
    }
  }

  const goToPage = (pageIndex) => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    console.log('🎯 goToPage called:', pageIndex, 'isTeacher:', isTeacher, 'currentPage:', currentPage)
    
    // Prevent rapid toggling - debounce page changes
    if (pageIndex === currentPage) {
      console.log('⏭️ Already on page', pageIndex, '- skipping')
      return
    }
    
    let updatedPages = [...pages]
    
    // Save current page data immediately before switching
    const ctx = canvas.getContext('2d')
    if (ctx && canvas.width > 0 && canvas.height > 0) {
      try {
        const currentPageData = canvas.toDataURL('image/png')
        updatedPages[currentPage] = currentPageData
        setPages(updatedPages)
        if (isTeacher) {
          console.log('💾 Teacher saved page:', currentPage)
        } else {
          console.log('💾 Student saved page:', currentPage)
        }
      } catch (err) {
        console.log('📷 Page save skipped:', err.message)
      }
    }
    
    // Switch to new page
    setCurrentPage(pageIndex)
    console.log('🔄 Local page changed to:', pageIndex)
    
    // Clear canvas immediately
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    
    // Load the selected page with improved performance
    if (updatedPages[pageIndex]) {
      console.log('📥 Loading content for page:', pageIndex)
      const img = new Image()
      img.onload = () => {
        // Double-check we're still on the right page (prevent race conditions)
        if (currentPage === pageIndex) {
          ctx.drawImage(img, 0, 0)
          console.log('✅ Content loaded for page:', pageIndex)
        }
      }
      img.onerror = () => {
        console.error('❌ Failed to load page:', pageIndex)
      }
      // Set source last to trigger load
      img.src = updatedPages[pageIndex]
    } else {
      console.log('📝 Page', pageIndex, 'is blank')
    }
    
    // Only teacher emits page change with full pages data
    if (socket && isTeacher) {
      console.log('📡 Teacher emitting page change to:', pageIndex, 'with', updatedPages.length, 'pages')
      socket.emit('whiteboard:changePage', { 
        channelName, 
        page: pageIndex,
        pagesData: updatedPages // Send all pages to students
      })
    }
  }

  const downloadNotes = async () => {
    const canvas = canvasRef.current
    if (!canvas) {
      alert('❌ Canvas not found!')
      return
    }
    
    // First, save the current page to the pages array
    const currentCanvasData = canvas.toDataURL('image/png', 1.0)
    const updatedPages = [...pages]
    updatedPages[currentPage] = currentCanvasData
    
    // Update the pages state so all pages are saved
    setPages(updatedPages)
    
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
        try {
          // Wait for image to load
          await new Promise((resolve, reject) => {
            const img = new Image()
            img.onload = () => {
              // Get canvas dimensions to maintain aspect ratio
              const imgWidth = img.width
              const imgHeight = img.height
              const ratio = imgWidth / imgHeight
              
              // Calculate dimensions to fit A4 (210mm x 297mm with margins)
              let pageWidth = 190 // Leave 10mm margin on each side
              let pageHeight = pageWidth / ratio
              
              // If height exceeds page, scale down
              if (pageHeight > 270) {
                pageHeight = 270
                pageWidth = pageHeight * ratio
              }
              
              // Center the image
              const xOffset = (210 - pageWidth) / 2
              
              // Add image to PDF
              pdf.addImage(pageData, 'PNG', xOffset, 15, pageWidth, pageHeight, undefined, 'FAST')
              resolve()
            }
            img.onerror = reject
            img.src = pageData
          })
        } catch (err) {
          console.error('Error adding image to PDF:', err)
          pdf.setFontSize(12)
          pdf.setTextColor(150)
          pdf.text('(Error loading page)', 105, 150, { align: 'center' })
        }
      } else {
        // Empty page
        pdf.setFontSize(12)
        pdf.setTextColor(150)
        pdf.text('(Blank Page)', 105, 150, { align: 'center' })
      }
    }
    
    // Download PDF
    const filename = `${channelName}-whiteboard-notes-${dateStr.replace(/\//g, '-')}.pdf`
    pdf.save(filename)
    
    console.log('✅ PDF saved:', filename)
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

      {/* Page Navigation - For Both Teachers and Students */}
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
          
          {!isTeacher && (
            <span style={{ fontSize: '0.75rem', color: '#6b7280', marginLeft: '0.5rem' }}>
              (View Only)
            </span>
          )}
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
