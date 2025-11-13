/**
 * API Service
 * Handles all HTTP requests to the backend server
 */

import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

/**
 * Get Agora token for joining a channel
 */
export const getAgoraToken = async (channelName, role = 'student') => {
  try {
    const response = await axios.get(`${API_BASE_URL}/api/token`, {
      params: { channel: channelName, role }
    })
    return response.data
  } catch (error) {
    console.error('Error getting Agora token:', error)
    throw error
  }
}

/**
 * Get list of students in a channel
 */
export const getStudents = async (channelName) => {
  try {
    const response = await axios.get(
      `${API_BASE_URL}/api/students/${channelName}`
    )
    return response.data
  } catch (error) {
    console.error('Error getting students:', error)
    throw error
  }
}

export default {
  getAgoraToken,
  getStudents
}
