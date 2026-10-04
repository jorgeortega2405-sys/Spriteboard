import { VideoClip, VideoProject, VideoTrack, VideoTrackType } from '../video.types.js';

export function splitClipAtPlayhead(
  project: VideoProject,
  playheadTime: number,
  selectedClipId: string | null
): { newSelectedClipId: string | null; splitDone: boolean } {
  let targetTrack: VideoTrack | null = null;
  let targetClip: VideoClip | null = null;
  let clipIndex = -1;

  for (const track of project.tracks) {
    const idx = track.clips.findIndex((c) => {
      const isUnderPlayhead = playheadTime > c.startTime + 0.05 && playheadTime < c.startTime + c.duration - 0.05;
      if (selectedClipId) {
        return c.id === selectedClipId && isUnderPlayhead;
      }
      return isUnderPlayhead;
    });
    if (idx !== -1) {
      targetTrack = track;
      targetClip = track.clips[idx];
      clipIndex = idx;
      break;
    }
  }

  if (!targetTrack || !targetClip) {
    for (const track of project.tracks) {
      const idx = track.clips.findIndex(
        (c) => playheadTime > c.startTime + 0.05 && playheadTime < c.startTime + c.duration - 0.05
      );
      if (idx !== -1) {
        targetTrack = track;
        targetClip = track.clips[idx];
        clipIndex = idx;
        break;
      }
    }
  }

  if (!targetTrack || !targetClip) return { newSelectedClipId: null, splitDone: false };

  const clipStart = targetClip.startTime;
  const splitOffset = playheadTime - clipStart;
  const firstDuration = splitOffset;
  const secondDuration = targetClip.duration - splitOffset;

  const clip1: VideoClip = {
    ...targetClip,
    duration: firstDuration,
    id: targetClip.id,
    name: `${targetClip.name} (Parte 1)`,
    trimEnd: targetClip.trimStart + firstDuration,
  };

  const clip2: VideoClip = {
    ...targetClip,
    duration: secondDuration,
    id: `clip-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: `${targetClip.name} (Parte 2)`,
    startTime: playheadTime,
    trimEnd: targetClip.trimEnd,
    trimStart: targetClip.trimStart + firstDuration,
  };

  targetTrack.clips.splice(clipIndex, 1, clip1, clip2);
  return { newSelectedClipId: clip2.id, splitDone: true };
}

export function deleteClipsFromProject(
  project: VideoProject,
  idsToDelete: Set<string>
): boolean {
  if (idsToDelete.size === 0) return false;
  let modified = false;

  for (const track of project.tracks) {
    const initialCount = track.clips.length;
    track.clips = track.clips.filter((c) => !idsToDelete.has(c.id));
    if (track.clips.length !== initialCount) {
      modified = true;
    }
  }

  return modified;
}

export function rippleDeleteClipsFromProject(
  project: VideoProject,
  idsToDelete: Set<string>
): boolean {
  if (idsToDelete.size === 0) return false;
  let modified = false;

  for (const track of project.tracks) {
    const toDelete = track.clips.filter((c) => idsToDelete.has(c.id)).sort((a, b) => a.startTime - b.startTime);
    if (toDelete.length > 0) {
      modified = true;
      for (const del of toDelete) {
        const delStart = del.startTime;
        const delDur = del.duration;
        const idx = track.clips.findIndex((c) => c.id === del.id);
        if (idx !== -1) {
          track.clips.splice(idx, 1);
          for (const c of track.clips) {
            if (c.startTime > delStart) {
              c.startTime = Math.max(0, c.startTime - delDur);
            }
          }
        }
      }
    }
  }

  return modified;
}

export function detachAudioFromClipInProject(
  project: VideoProject,
  targetClipId: string
): { audioClipId: string; modified: boolean } {
  let sourceClip: VideoClip | null = null;
  let sourceTrack: VideoTrack | null = null;

  for (const track of project.tracks) {
    const c = track.clips.find((clip) => clip.id === targetClipId);
    if (c) {
      sourceClip = c;
      sourceTrack = track;
      break;
    }
  }

  if (!sourceClip || !sourceTrack || (sourceClip.mediaType !== 'video' && sourceClip.mediaType !== 'audio')) {
    return { audioClipId: '', modified: false };
  }

  let audioTrack = project.tracks.find((t) => t.type === 'audio');
  if (!audioTrack) {
    const createdTrack: VideoTrack = {
      clips: [],
      id: `track-audio-${Date.now()}`,
      locked: false,
      muted: false,
      name: 'Pista de Audio',
      type: 'audio',
      volume: 1,
    };
    project.tracks.push(createdTrack);
    audioTrack = createdTrack;
  }

  const audioClipId = `clip-audio-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const audioClip: VideoClip = {
    assetUrl: sourceClip.assetUrl,
    duration: sourceClip.duration,
    id: audioClipId,
    mediaType: 'audio',
    name: `${sourceClip.name} (Audio)`,
    sourceDuration: sourceClip.sourceDuration,
    speed: sourceClip.speed || 1,
    startTime: sourceClip.startTime,
    trimEnd: sourceClip.trimEnd,
    trimStart: sourceClip.trimStart,
    volume: sourceClip.volume ?? 1,
  };

  sourceClip.volume = 0;
  audioTrack.clips.push(audioClip);

  return { audioClipId, modified: true };
}

export function duplicateClipInProject(
  project: VideoProject,
  targetClipId: string
): { duplicateClipId: string | null } {
  for (const track of project.tracks) {
    const clip = track.clips.find((c) => c.id === targetClipId);
    if (clip) {
      const newClip: VideoClip = {
        ...clip,
        id: `clip-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: `${clip.name} (Copia)`,
        startTime: clip.startTime + clip.duration + 0.1,
      };
      track.clips.push(newClip);
      return { duplicateClipId: newClip.id };
    }
  }
  return { duplicateClipId: null };
}

export function recomputeProjectDurationUtil(project: VideoProject): number {
  let maxTime = 10;
  for (const track of project.tracks) {
    for (const clip of track.clips) {
      const end = clip.startTime + clip.duration;
      if (end > maxTime) {
        maxTime = end;
      }
    }
  }
  project.duration = Math.ceil(maxTime);
  return project.duration;
}

export function addNewTrackToProject(project: VideoProject, type: VideoTrackType = 'video'): VideoTrack {
  const isAudio = type === 'audio';
  const newTrack: VideoTrack = {
    clips: [],
    id: `track-${type}-${Date.now()}`,
    locked: false,
    muted: false,
    name: isAudio ? `Audio ${project.tracks.filter((t) => t.type === 'audio').length + 1}` : `Pista ${project.tracks.length + 1}`,
    type,
    volume: 1,
  };
  project.tracks.push(newTrack);
  return newTrack;
}
