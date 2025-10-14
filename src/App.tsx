import { type CSSProperties } from 'react'
import './App.css'

type Track = {
  id: number
  title: string
  artist: string
  album: string
  artwork: string
  duration: string
}

const playlist: Track[] = [
  {
    id: 1,
    title: 'Affection',
    artist: 'Casiio',
    album: 'Behind Clouds',
    artwork: 'https://i.imgur.com/Q7p5hH4.jpeg',
    duration: '3:24',
  },
  {
    id: 2,
    title: 'Tea Rose',
    artist: 'v i v & nobuddy',
    album: 'Tea Rose',
    artwork: 'https://i.imgur.com/GXphVnQ.jpeg',
    duration: '2:58',
  },
  {
    id: 3,
    title: 'Rest',
    artist: 'Nite Crawler',
    album: 'Late Night Drive',
    artwork: 'https://i.imgur.com/Bf6WcPw.jpeg',
    duration: '4:08',
  },
  {
    id: 4,
    title: 'Dancing Dreams',
    artist: 'Lani Rivers',
    album: 'Falling Sky',
    artwork: 'https://i.imgur.com/wJ9M68s.jpeg',
    duration: '3:52',
  },
  {
    id: 5,
    title: 'Golden Hour',
    artist: 'Juniper Fields',
    album: 'Sunset Tapes',
    artwork: 'https://i.imgur.com/UR4dIcH.jpeg',
    duration: '4:42',
  },
  {
    id: 6,
    title: 'City Lights',
    artist: 'Neon Haze',
    album: 'Skylines',
    artwork: 'https://i.imgur.com/7sgF34z.jpeg',
    duration: '3:36',
  },
  {
    id: 7,
    title: 'Stillness',
    artist: 'Mira Lane',
    album: 'Quiet Rooms',
    artwork: 'https://i.imgur.com/3fnsS7e.jpeg',
    duration: '5:01',
  },
  {
    id: 8,
    title: 'Bloom',
    artist: 'Fiona Sloane',
    album: 'Morning Light',
    artwork: 'https://i.imgur.com/x1ZVk4n.jpeg',
    duration: '3:18',
  },
]

const currentTrack = playlist[0]

function App() {
  return (
    <div
      className="music-app"
      style={{
        '--background-image': `url(${currentTrack.artwork})`,
      } as CSSProperties}
    >
      <div className="background" aria-hidden="true" />
      <div className="background-overlay" aria-hidden="true" />

      <div className="app-grid">
        <section className="panel left" aria-labelledby="now-playing-heading">
          <div className="album-art">
            <img src={currentTrack.artwork} alt={`${currentTrack.album} cover`} />
          </div>

          <div className="song-info">
            <p className="eyebrow">正在播放</p>
            <h1 id="now-playing-heading">{currentTrack.title}</h1>
            <p className="artist">{currentTrack.artist}</p>
          </div>

          <div className="progress">
            <div className="time">1:24</div>
            <input type="range" min="0" max="100" defaultValue="35" aria-label="Playback progress" />
            <div className="time">{currentTrack.duration}</div>
          </div>

          <div className="controls" role="group" aria-label="Playback controls">
            <button type="button" className="control-button" aria-label="Previous">
              ⏮️
            </button>
            <button type="button" className="control-button play" aria-label="Play">
              ⏯️
            </button>
            <button type="button" className="control-button" aria-label="Next">
              ⏭️
            </button>
          </div>
        </section>

        <section className="panel right" aria-labelledby="playlist-heading">
          <header className="right-header">
            <h2 id="playlist-heading">播放列表</h2>
            <p>精选舒缓旋律，伴你度过惬意午后。</p>
          </header>
          <div className="playlist" role="list">
            {playlist.map((track) => (
              <article
                key={track.id}
                className={`track${track.id === currentTrack.id ? ' active' : ''}`}
                role="listitem"
              >
                <img src={track.artwork} alt="" aria-hidden="true" />
                <div className="track-info">
                  <span className="title">{track.title}</span>
                  <span className="meta">{track.artist} · {track.album}</span>
                </div>
                <span className="duration">{track.duration}</span>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}

export default App
