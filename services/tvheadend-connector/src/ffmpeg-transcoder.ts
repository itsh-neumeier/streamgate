import { spawn, type ChildProcessByStdio } from 'node:child_process';
import type { ServerResponse } from 'node:http';
import type { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { StreamQuality } from './stream-tickets.js';
import { tvheadendStreamRequest, type TvheadendConfig } from './tvheadend-client.js';

type FfmpegChild = ChildProcessByStdio<null, Readable, Readable>;

export interface TranscodeOptions {
  channelId: string;
  profile: string;
  quality: StreamQuality;
  signal: AbortSignal;
}

export async function pipeH264Transcode(config: TvheadendConfig, options: TranscodeOptions, response: ServerResponse) {
  const { endpoint, headers } = tvheadendStreamRequest(config, options.channelId, options.profile);
  headers.accept = 'video/mp2t, application/octet-stream';
  const modes = transcodeModes();
  let lastError: unknown;

  for (const mode of modes) {
    try {
      await pipeWithMode(endpoint.toString(), headers, options, response, mode);
      return;
    } catch (cause) {
      lastError = cause;
      if (options.signal.aborted || response.headersSent) {
        throw cause;
      }
      console.warn(`FFmpeg ${mode} start failed, ${mode === modes.at(-1) ? 'no fallback left' : 'trying fallback'}:`, cause instanceof Error ? cause.message : cause);
    }
  }

  throw lastError instanceof Error ? lastError : new Error('FFmpeg konnte keinen Stream erzeugen.');
}

async function pipeWithMode(
  inputUrl: string,
  headers: Record<string, string>,
  options: TranscodeOptions,
  response: ServerResponse,
  mode: 'vaapi' | 'software'
) {
  const child = spawnFfmpeg(inputUrl, headers, options.quality, mode);
  const stderr: Buffer[] = [];
  const kill = () => killChild(child);

  options.signal.addEventListener('abort', kill, { once: true });
  child.stderr.on('data', (chunk: Buffer) => {
    stderr.push(chunk);
    if ((process.env.FFMPEG_LOG_STDERR ?? 'false') === 'true') {
      process.stderr.write(chunk);
    }
  });

  try {
    const firstChunk = await waitForFirstChunk(child, stderr, options.signal);
    response.statusCode = 200;
    response.setHeader('content-type', 'video/mp2t');
    response.setHeader('cache-control', 'no-store');
    response.setHeader('x-accel-buffering', 'no');
    response.write(firstChunk);
    await pipeline(child.stdout, response);
  } finally {
    options.signal.removeEventListener('abort', kill);
    killChild(child);
  }
}

function spawnFfmpeg(inputUrl: string, headers: Record<string, string>, quality: StreamQuality, mode: 'vaapi' | 'software') {
  return spawn(process.env.FFMPEG_BIN ?? 'ffmpeg', ffmpegArgs(inputUrl, headers, quality, mode), {
    stdio: ['ignore', 'pipe', 'pipe']
  });
}

function ffmpegArgs(inputUrl: string, headers: Record<string, string>, quality: StreamQuality, mode: 'vaapi' | 'software') {
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

function transcodeModes(): Array<'vaapi' | 'software'> {
  const mode = (process.env.FFMPEG_TRANSCODER ?? 'vaapi').toLowerCase();
  if (mode === 'software') {
    return ['software'];
  }
  if (mode === 'auto') {
    return ['vaapi', 'software'];
  }
  return ['vaapi', 'software'];
}

function waitForFirstChunk(child: FfmpegChild, stderr: Buffer[], signal: AbortSignal) {
  const timeoutMs = Number(process.env.FFMPEG_START_TIMEOUT_MS ?? 8000);
  return new Promise<Buffer>((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timer);
      child.stdout.off('data', onData);
      child.off('error', onError);
      child.off('exit', onExit);
      signal.removeEventListener('abort', onAbort);
    };
    const fail = (message: string) => {
      cleanup();
      killChild(child);
      reject(new Error(message));
    };
    const onData = (chunk: Buffer) => {
      child.stdout.pause();
      cleanup();
      resolve(chunk);
    };
    const onError = (cause: Error) => fail(`FFmpeg konnte nicht gestartet werden: ${cause.message}`);
    const onExit = (code: number | null, signalName: NodeJS.Signals | null) => {
      fail(`FFmpeg beendet ohne Streamdaten (${code ?? signalName ?? 'unknown'}): ${stderrText(stderr)}`);
    };
    const onAbort = () => fail('Client hat den Stream abgebrochen.');
    const timer = setTimeout(() => fail(`FFmpeg lieferte nach ${timeoutMs} ms keine Streamdaten: ${stderrText(stderr)}`), timeoutMs);

    child.stdout.once('data', onData);
    child.once('error', onError);
    child.once('exit', onExit);
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

function killChild(child: FfmpegChild) {
  if (!child.killed) {
    child.kill('SIGTERM');
  }
}

function stderrText(chunks: Buffer[]) {
  const text = Buffer.concat(chunks).toString('utf8').trim();
  return text.slice(-1200) || 'kein FFmpeg-Fehlertext';
}

function ffmpegHeaderBlock(headers: Record<string, string>) {
  return Object.entries(headers)
    .map(([key, value]) => `${key}: ${value}`)
    .join('\r\n')
    .concat('\r\n');
}
