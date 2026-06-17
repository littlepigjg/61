const EventEmitter = require('events');
const crypto = require('crypto');

class ListenerManager extends EventEmitter {
  constructor() {
    super();
    this.channelListeners = new Map();
  }

  generateId() {
    return crypto.randomUUID();
  }

  addListener(channelId) {
    if (!this.channelListeners.has(channelId)) {
      this.channelListeners.set(channelId, new Map());
    }
    const listeners = this.channelListeners.get(channelId);
    const connectionId = this.generateId();
    listeners.set(connectionId, Date.now());
    this.emit('listenersChange', channelId, listeners.size);
    return connectionId;
  }

  removeListener(channelId, connectionId) {
    const listeners = this.channelListeners.get(channelId);
    if (!listeners) return 0;

    if (listeners.has(connectionId)) {
      listeners.delete(connectionId);
      this.emit('listenersChange', channelId, listeners.size);
    }

    if (listeners.size === 0) {
      this.channelListeners.delete(channelId);
    }

    return listeners.size;
  }

  getListenerCount(channelId) {
    const listeners = this.channelListeners.get(channelId);
    return listeners ? listeners.size : 0;
  }

  getAllCounts() {
    const result = {};
    for (const [channelId, listeners] of this.channelListeners.entries()) {
      result[channelId] = listeners.size;
    }
    return result;
  }

  hasListeners(channelId) {
    const listeners = this.channelListeners.get(channelId);
    return listeners ? listeners.size > 0 : false;
  }

  clearChannel(channelId) {
    const listeners = this.channelListeners.get(channelId);
    if (listeners) {
      this.channelListeners.delete(channelId);
      this.emit('listenersChange', channelId, 0);
    }
  }

  shutdown() {
    for (const channelId of this.channelListeners.keys()) {
      this.emit('listenersChange', channelId, 0);
    }
    this.channelListeners.clear();
  }
}

module.exports = ListenerManager;
