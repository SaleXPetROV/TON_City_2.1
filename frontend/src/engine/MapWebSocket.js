/**
 * WebSocket Manager for real-time map updates
 */

class MapWebSocket {
  constructor(url, token) {
    this.url = url;
    this.token = token;
    this.ws = null;
    this.reconnectTimeout = null;
    this.listeners = new Map();
    this.connected = false;
  }
  
  connect() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return;
    }
    
    try {
      this.ws = new WebSocket(`${this.url}?token=${this.token}`);
      
      this.ws.onopen = () => {
        console.log('Map WebSocket connected');
        this.connected = true;
        this.emit('connected');
      };
      
      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleMessage(data);
        } catch (e) {
          console.error('Failed to parse WS message:', e);
        }
      };
      
      this.ws.onclose = () => {
        console.log('Map WebSocket disconnected');
        this.connected = false;
        this.emit('disconnected');
        
        // Reconnect after 3 seconds
        this.reconnectTimeout = setTimeout(() => {
          this.connect();
        }, 3000);
      };
      
      this.ws.onerror = (error) => {
        console.error('Map WebSocket error:', error);
      };
    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
    }
  }
  
  disconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
  
  handleMessage(data) {
    switch (data.type) {
      case 'cell_update':
        // Single cell update
        this.emit('cell_update', data.cell);
        break;
        
      case 'batch_update':
        // Multiple cell updates
        this.emit('batch_update', data.cells);
        break;
        
      case 'building_built':
        this.emit('building_built', data);
        break;
        
      case 'building_upgraded':
        this.emit('building_upgraded', data);
        break;
        
      case 'land_purchased':
        this.emit('land_purchased', data);
        break;
        
      case 'business_stopped':
        this.emit('business_stopped', data);
        break;
        
      default:
        console.log('Unknown WS message type:', data.type);
    }
  }
  
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }
  
  off(event, callback) {
    if (this.listeners.has(event)) {
      const filtered = this.listeners.get(event).filter(cb => cb !== callback);
      this.listeners.set(event, filtered);
    }
  }
  
  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(cb => cb(data));
    }
  }
  
  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }
}

export default MapWebSocket;
