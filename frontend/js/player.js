class RadioPlayer {
  constructor() {
    this.currentChannel = null;
    this.ws = null;
    this.audio = document.getElementById('audioPlayer');
    this.playBtn = document.getElementById('playBtn');
    this.volumeSlider = document.getElementById('volumeSlider');
    this.channelList = document.getElementById('channelList');
    this.currentChannelName = document.getElementById('currentChannelName');
    this.currentTrack = document.getElementById('currentTrack');
    this.listenerCount = document.getElementById('listenerCount');
    this.ffmpegAvailable = true;
    this.serverVolume = 1.0;
    this.localVolume = 0.8;

    this.audio.volume = this.localVolume;

    this.init();
  }

  async init() {
    await this.loadSystemConfig();
    await this.loadChannels();
    this.bindEvents();
  }

  async loadSystemConfig() {
    try {
      const response = await fetch(`${CONFIG.API_BASE}/api/config`);
      const config = await response.json();
      this.ffmpegAvailable = config.ffmpegAvailable;
    } catch (err) {
      this.ffmpegAvailable = false;
    }
  }

  async loadChannels() {
    try {
      const response = await fetch(`${CONFIG.API_BASE}/api/channels`);
      const channels = await response.json();
      this.renderChannels(channels);
    } catch (err) {
      console.error('Failed to load channels:', err);
      this.channelList.innerHTML = '<p style="color:#888">无法加载频道列表</p>';
    }
  }

  renderChannels(channels) {
    this.channelList.innerHTML = channels.map(ch => `
      <div class="channel-item ${this.currentChannel === ch.id ? 'active' : ''}" data-id="${ch.id}">
        <h3><span class="channel-status ${ch.isPlaying ? 'playing' : ''}"></span>${ch.name}</h3>
        <p>${ch.description}</p>
        <div class="channel-meta">
          <span>👥 ${ch.listeners} 人在线</span>
          <span>${ch.isPlaying ? '播放中' : '已停止'}</span>
        </div>
      </div>
    `).join('');

    this.channelList.querySelectorAll('.channel-item').forEach(item => {
      item.addEventListener('click', () => {
        const channelId = item.dataset.id;
        this.selectChannel(channelId);
      });
    });
  }

  selectChannel(channelId) {
    if (this.currentChannel === channelId) return;

    if (this.ws) {
      this.ws.close();
    }

    this.currentChannel = channelId;
    this.connectWebSocket(channelId);
    this.updatePlayerUI(channelId);
    this.loadChannels();
  }

  connectWebSocket(channelId) {
    this.ws = new WebSocket(CONFIG.WS_URL);

    this.ws.onopen = () => {
      this.ws.send(JSON.stringify({
        action: 'join',
        channelId: channelId
      }));
    };

    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      this.handleWebSocketMessage(data);
    };

    this.ws.onclose = () => {
    };

    this.ws.onerror = (err) => {
      console.error('WebSocket error:', err);
    };
  }

  handleWebSocketMessage(data) {
    switch (data.type) {
      case 'status':
        this.ffmpegAvailable = data.ffmpegAvailable !== undefined ? data.ffmpegAvailable : this.ffmpegAvailable;
        this.serverVolume = data.volume || 1.0;
        this._applyCombinedVolume();
        this.updateStatus(data);
        break;
      case 'trackChange':
        this.updateTrack(data.track);
        this.updatePlayingState(data.isPlaying);
        break;
      case 'statusChange':
        this.updatePlayingState(data.isPlaying);
        break;
      case 'listenersChange':
        this.updateListeners(data.listeners);
        this.loadChannels();
        break;
      case 'volumeChange':
        this.serverVolume = data.volume;
        this._applyCombinedVolume();
        break;
    }
  }

  _applyCombinedVolume() {
    if (this.ffmpegAvailable) {
      this.audio.volume = this.localVolume;
    } else {
      this.audio.volume = Math.max(0, Math.min(1, this.localVolume * this.serverVolume));
    }
  }

  updateStatus(data) {
    this.currentChannelName.textContent = data.name;
    if (data.currentTrack) {
      this.currentTrack.textContent = data.currentTrack.title;
    } else {
      this.currentTrack.textContent = '--';
    }
    this.listenerCount.textContent = data.listeners;
    this.updatePlayingState(data.isPlaying);
    this.playBtn.disabled = !data.currentTrack;
  }

  updateTrack(track) {
    if (track) {
      this.currentTrack.textContent = track.title;
    }
  }

  updatePlayingState(isPlaying) {
    const playIcon = this.playBtn.querySelector('.play-icon');
    if (isPlaying) {
      playIcon.textContent = '⏸';
    } else {
      playIcon.textContent = '▶';
    }
  }

  updateListeners(count) {
    this.listenerCount.textContent = count;
  }

  updatePlayerUI(channelId) {
    const streamUrl = `${CONFIG.API_BASE}/stream/${channelId}`;
    this.audio.src = streamUrl;
    this.playBtn.disabled = false;

    document.querySelectorAll('.channel-item').forEach(item => {
      item.classList.toggle('active', item.dataset.id === channelId);
    });
  }

  bindEvents() {
    this.playBtn.addEventListener('click', () => {
      if (this.audio.paused) {
        this.audio.play().catch(err => {
          console.error('Play failed:', err);
        });
      } else {
        this.audio.pause();
      }
    });

    this.audio.addEventListener('play', () => {
      this.updatePlayingState(true);
    });

    this.audio.addEventListener('pause', () => {
      this.updatePlayingState(false);
    });

    this.volumeSlider.addEventListener('input', (e) => {
      this.localVolume = e.target.value / 100;
      this._applyCombinedVolume();
    });

    this.audio.addEventListener('error', (e) => {
      console.error('Audio error:', e);
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new RadioPlayer();
});
