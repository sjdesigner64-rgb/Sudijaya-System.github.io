import type { Server } from 'socket.io'

let io: Server | null = null

export const setIO = (instance: Server) => {
  io = instance
}

export const emitChange = (collectionName: string) => {
  io?.emit('changed', collectionName)
}
