declare module 'iptv-playlist-parser' {
  interface PlaylistItem {
    name: string;
    tvg: { id?: string };
    url: string;
  }

  interface Playlist {
    items: PlaylistItem[];
  }

  const parser: {
    parse(content: string): Playlist;
  };

  export default parser;
}
