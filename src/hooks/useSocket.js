/**
 * Custom Hook: useSocket
 * Manages Socket.IO connection and events
 */

import { useEffect, useRef } from 'react'
import socketService from '../services/socket'

export const useSocket = () => {
  const socketRef = useRef(null)

  useEffect(() => {
    // Connect to socket
    socketRef.current = socketService.connect()

    return () => {
      // Cleanup on unmount
      socketService.disconnect()
    }
  }, [])

  /**
   * Emit event to server
   */
  const emit = (event, data) => {
    if (socketRef.current) {
      socketRef.current.emit(event, data)
    }
  }

  /**
   * Listen to event from server
   */
  const on = (event, callback) => {
    if (socketRef.current) {
      socketRef.current.on(event, callback)
    }
  }

  /**
   * Remove event listener
   */
  const off = (event, callback) => {
    if (socketRef.current) {
      socketRef.current.off(event, callback)
    }
  }

  return {
    socket: socketRef.current,
    emit,
    on,
    off
  }
}
