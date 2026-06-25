import { spawn } from 'node:child_process';
import type { ServerResponse } from 'node:http';
import { pipeline } from 'node:stream/promises';
import type { StreamQuality } from './stream-tickets.js';
import { tvheadendStreamRequest, type TvheadendConfig } from './tvheadend-client.js';

export interface TranscodeOptions {
  channelId: string;
  profile: string;
  quality: StreamQuality;
  signal: AbortSignal;
}

export async function pipeH264Transcode(config: TvheadendConfig, options: TranscodeOptions, response: ServerResponse) {
  const { endpoint, headers } = tvheadendStreamRequest(config, options.channelId, options.profile);
  headers.accept = 'video/mp2t, application/octet-stream';
  const args = ffmpegArgs(endpoint.toString(), headers, options.quality);
  const child = spawn(process.env.FFMPEG_BIN ?? 'ffmpeg', args, {
    stdio: ['ignore', 'pipe', 'pipe']
  });

  const kill = () => {
    if (!child.killed) {
      child.kill('SIGTERM');
    }
  };
  options.signal.addEventListener('abort', kill, { once: true });
  child.stderr?.on('data', (chunk: Buffer) => {
    if ((process.env.FFMPEG_LOG_STDERR ?? 'false') === 'true') {
      process.stderr.write(chunk);
    }
  });
  child.on('error', (cause) => {
    if (!response.headersSent) {
      response.statusCode = 502;
      response.end(JSON.stringify({ message: `FFmpeg konnte nicht gestartet werden: ${cause.message}` }));
    } else {
      response.destroy(cause);
    }
  });

  try {
    await pipeline(child.stdout, response);
  } finally {
    options.signal.removeEventListener('abort', kill);
    kill();
  }
}

function ffmpegArgs(inputUrl: string, headers: Record<string, string>, quality: StreamQuality) {
  const mode = (process.env.FFMPEG_TRANSCODER ?? 'vaapi').toLowerCase();
  const videoBitrate = quality === 'sd-480p' ? process.env.SD_VIDEO_BITRATE ?? '1400k' : process.env.HD_VIDEO_BITRATE ?? '5500k';
  const maxRate = quality === 'sd-480p' ? process.env.SD_VIDEO_MAXRATE ?? '1800k' : process.env.HD_VIDEO_MAXRATE ?? '7000k';
  const bufferSize = quality === 'sd-480p' ? process.env.SD_VIDEO_BUFSIZE ?? '2800k' : process.env.HD_VIDEO_BUFSIZE ?? '11000k';
  const softwareVideoFilter = quality === 'sd-480p' ? ['-vf', 'scale=-2:480'] : [];
  const vaapiVideoFilter = quality === 'sd-480p' ? 'format=nv12,hwupload,scale_vaapi=w=-2:h=480' : 'format=nv12,hwupload';
  const commonInput = [
    '-hide_banner',
    '-loglevel',
    process.env.FFMPEG_LOG_LEVEL ?? 'warning',
    '-nostdin',
    '-reconnect',
    '1',
    '-reconnect_streamed',
    '1',
    '-reconnect_delay_max',
    '2',
    '-headers',
    ffmpegHeaderBlock(headers),
    '-i',
    inputUrl
  ];
  const commonOutput = [
    '-map',
    '0:v:0?',
    '-map',
    '0:a:0?',
    '-c:a',
    'aac',
    '-b:a',
    process.env.SD_AUDIO_BITRATE ?? '128k',
    '-ac',
    '2',
    '-f',
    'mpegts',
    'pipe:1'
  ];

  if (mode === 'software') {
    return [
      ...commonInput,
      ...softwareVideoFilter,
      '-c:v',
      'libx264',
      '-preset',
      process.env.SD_X264_PRESET ?? 'veryfast',
      '-b:v',
      videoBitrate,
      '-maxrate',
      maxRate,
      '-bufsize',
      bufferSize,
      ...commonOutput
    ];
  }

  return [
    '-vaapi_device',
    process.env.VAAPI_DEVICE ?? '/dev/dri/renderD128',
    ...commonInput,
    '-vf',
    vaapiVideoFilter,
    '-c:v',
    'h264_vaapi',
    '-b:v',
    videoBitrate,
    '-maxrate',
    maxRate,
    '-bufsize',
    bufferSize,
    ...commonOutput
  ];
}

function ffmpegHeaderBlock(headers: Record<string, string>) {
  return Object.entries(headers)
    .map(([key, value]) => `${key}: ${value}`)
    .join('\r\n')
    .concat('\r\n');
}
